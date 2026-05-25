import { db } from "@/db";
import { budgets, expenseBudgets, expenses } from "@/db/schema";
import {
  type ExpenseListQueryParams,
  type ExpenseListResult,
  groupExpenseRowsByDate,
  resolveExpenseListRange,
} from "@/lib/expenses/list-model";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";

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
      date: expenses.date,
      amount: expenses.amount,
      note: expenses.note,
      category: expenses.category,
      paidBy: expenses.paidBy,
      budgetId: expenseBudgets.budgetId,
      budgetName: budgets.name,
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
    date: String(expense.date),
    amount: Number(expense.amount ?? 0),
    note: expense.note ?? "",
    category: expense.category ?? "",
    paidBy: expense.paidBy ?? "",
    budgetId: expense.budgetId === null ? null : Number(expense.budgetId),
    budgetName: expense.budgetName ?? null,
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
