import { db } from "@/db";
import { budgets, expenseBudgets, expenses } from "@/db/schema";
import {
  normalizeBudgetColor,
  normalizeBudgetIcon,
} from "@/lib/budget-appearance";
import {
  type ExpenseListQueryParams,
  type ExpenseListResult,
  groupExpenseRowsByDate,
  resolveExpenseListRange,
} from "@/lib/expenses/list-model";
import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  sql,
} from "drizzle-orm";

export { groupExpenseRowsByDate, resolveExpenseListRange };
export type {
  ExpenseListGroup,
  ExpenseListItem,
  ExpenseListQueryParams,
  ExpenseListResult,
} from "@/lib/expenses/list-model";

export const getExpenseList = async ({
  month,
  q,
  mode = "full",
  recentDays = 7,
  limit = 30,
  offset = 0,
  dateFrom,
  dateTo,
  categories,
  budgetIds,
  hasBudget,
  amountMin,
  amountMax,
}: ExpenseListQueryParams = {}): Promise<ExpenseListResult> => {
  const { activeMonth, effectiveRecentDays, isRecent, rangeEnd, rangeStart } =
    resolveExpenseListRange({ month, mode, recentDays });
  const trimmedSearch = q?.trim();
  const pageLimit = Math.max(1, Math.floor(limit));
  const pageOffset = Math.max(0, Math.floor(offset));
  const whereParts = [eq(expenses.isDeleted, false)];
  if (month || isRecent) {
    whereParts.push(
      gte(expenses.date, rangeStart.format("YYYY-MM-DD")),
      lt(expenses.date, rangeEnd.format("YYYY-MM-DD"))
    );
  }
  if (dateFrom) {
    whereParts.push(gte(expenses.date, dateFrom));
  }
  if (dateTo) {
    whereParts.push(lte(expenses.date, dateTo));
  }
  if (categories && categories.length > 0) {
    whereParts.push(inArray(expenses.category, categories));
  }
  if (budgetIds && budgetIds.length > 0) {
    whereParts.push(inArray(expenseBudgets.budgetId, budgetIds));
  } else if (hasBudget === true) {
    whereParts.push(isNotNull(expenseBudgets.budgetId));
  } else if (hasBudget === false) {
    whereParts.push(isNull(expenseBudgets.budgetId));
  }
  if (amountMin !== undefined) {
    whereParts.push(gte(expenses.amount, amountMin));
  }
  if (amountMax !== undefined) {
    whereParts.push(lte(expenses.amount, amountMax));
  }

  const baseWhere =
    whereParts.length === 1 ? whereParts[0] : and(...whereParts);
  const whereClause = trimmedSearch
    ? and(
        baseWhere,
        sql`to_tsvector('simple', f_unaccent(${expenses.note}) || ' ' || f_unaccent(${expenses.category}))
            @@ websearch_to_tsquery('simple', f_unaccent(${trimmedSearch}))`
      )
    : baseWhere;

  const rows = await db
    .select({
      id: expenses.id,
      clientId: expenses.clientId,
      date: expenses.date,
      amount: expenses.amount,
      note: expenses.note,
      category: expenses.category,
      paidBy: expenses.paidBy,
      budgetId: expenseBudgets.budgetId,
      budgetName: budgets.name,
      budgetIcon: budgets.icon,
      budgetColor: budgets.color,
    })
    .from(expenses)
    .leftJoin(expenseBudgets, eq(expenseBudgets.expenseId, expenses.id))
    .leftJoin(budgets, eq(budgets.id, expenseBudgets.budgetId))
    .where(whereClause)
    .orderBy(desc(expenses.date), desc(expenses.id))
    .limit(pageLimit + 1)
    .offset(pageOffset);

  const normalizedRows = rows.slice(0, pageLimit).map((expense) => ({
    id: Number(expense.id),
    clientId: expense.clientId ?? null,
    date: String(expense.date),
    amount: Number(expense.amount ?? 0),
    note: expense.note ?? "",
    category: expense.category ?? "",
    paidBy: expense.paidBy ?? "",
    budgetId: expense.budgetId === null ? null : Number(expense.budgetId),
    budgetName: expense.budgetName ?? null,
    budgetIcon:
      expense.budgetId === null
        ? null
        : normalizeBudgetIcon(expense.budgetIcon),
    budgetColor:
      expense.budgetId === null
        ? null
        : normalizeBudgetColor(expense.budgetColor),
  }));

  return {
    activeMonth: activeMonth.format("YYYY-MM"),
    effectiveRecentDays,
    groupedRows: groupExpenseRowsByDate(normalizedRows),
    isRecent,
    pagination: {
      limit: pageLimit,
      offset: pageOffset,
      hasMore: rows.length > pageLimit,
    },
    rows: normalizedRows,
    trimmedSearch,
  };
};
