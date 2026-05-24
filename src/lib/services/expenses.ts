import dayjs from "@/configs/date";
import { db } from "@/db";
import { budgets, expenseBudgets, expenses } from "@/db/schema";
import type { ExpenseListQueryParams } from "@/lib/queries/expenses";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";

export type ExpenseListItem = {
  id: number;
  date: string;
  amount: number;
  note: string;
  category: string;
  paidBy: string;
  budgetId: number | null;
  budgetName: string | null;
};

export type ExpenseListGroup = {
  key: string;
  label: string;
  items: ExpenseListItem[];
  totalAmount: number;
};

export type ExpenseListResult = {
  activeMonth: string;
  effectiveRecentDays: number;
  groupedRows: ExpenseListGroup[];
  isRecent: boolean;
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
    nextOffset?: number;
  };
  rows: ExpenseListItem[];
  trimmedSearch?: string;
};

export const resolveExpenseListRange = ({
  month,
  mode = "full",
  recentDays = 7,
}: Pick<ExpenseListQueryParams, "month" | "mode" | "recentDays">) => {
  const isRecent = mode === "recent";
  const parsedMonth = month ? dayjs(month, "YYYY-MM", true) : dayjs();
  const activeMonth = parsedMonth.isValid() ? parsedMonth : dayjs();
  const startOfMonth = activeMonth.startOf("month");
  const endOfMonth = activeMonth.add(1, "month").startOf("month");
  const effectiveRecentDays = Math.max(1, recentDays);
  const isCurrentMonth = activeMonth.isSame(dayjs(), "month");
  const recentRangeEnd = isCurrentMonth
    ? dayjs().add(1, "day").startOf("day")
    : endOfMonth;
  const recentRangeStart = recentRangeEnd.subtract(effectiveRecentDays, "day");
  const rangeStart = isRecent
    ? recentRangeStart.isAfter(startOfMonth)
      ? recentRangeStart
      : startOfMonth
    : startOfMonth;
  const rangeEnd = isRecent
    ? recentRangeEnd.isBefore(endOfMonth)
      ? recentRangeEnd
      : endOfMonth
    : endOfMonth;

  return {
    activeMonth,
    effectiveRecentDays,
    isRecent,
    rangeEnd,
    rangeStart,
    startOfMonth,
  };
};

export const groupExpenseRowsByDate = (
  rows: ExpenseListItem[]
): ExpenseListGroup[] => {
  return rows.reduce<ExpenseListGroup[]>((acc, expense) => {
    const parsedDate = dayjs(expense.date);
    const key = parsedDate.isValid()
      ? parsedDate.format("YYYY-MM-DD")
      : String(expense.date);
    const label = parsedDate.isValid()
      ? parsedDate.format("dddd, DD/MM/YYYY")
      : String(expense.date);
    const lastGroup = acc[acc.length - 1];

    if (!lastGroup || lastGroup.key !== key) {
      acc.push({ key, label, items: [expense], totalAmount: expense.amount });
    } else {
      lastGroup.items.push(expense);
      lastGroup.totalAmount += expense.amount;
    }

    return acc;
  }, []);
};

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
