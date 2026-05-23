import dayjs from "@/configs/date";
import { db } from "@/db";
import { budgets, expenseBudgets, expenses } from "@/db/schema";
import { Category } from "@/enums";
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
  rows: ExpenseListItem[];
  trimmedSearch?: string;
};

type ExpensePrefillRow = {
  note: string;
  category: string;
  paid_by: string;
  total_frequency: number;
  latest_amount: number;
  most_frequent_amount: number;
};

export type ExpensePrefillItem = {
  note: string;
  category: Category;
  totalFrequency: number;
  amount: number;
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

export const normalizeExpensePrefillRows = (
  rows: ExpensePrefillRow[]
): ExpensePrefillItem[] => {
  return rows
    .map((row) => ({
      note: String(row.note ?? ""),
      category: row.category as Category,
      totalFrequency: Number(row.total_frequency ?? 0),
      amount: Number(row.most_frequent_amount ?? 0),
    }))
    .filter(
      (row) => Object.values(Category).includes(row.category) && row.amount > 0
    );
};

export const getExpenseList = async ({
  month,
  q,
  mode = "full",
  recentDays = 7,
}: ExpenseListQueryParams = {}): Promise<ExpenseListResult> => {
  const { activeMonth, effectiveRecentDays, isRecent, rangeEnd, rangeStart } =
    resolveExpenseListRange({ month, mode, recentDays });
  const trimmedSearch = q?.trim();
  const baseWhere = and(
    eq(expenses.isDeleted, false),
    gte(expenses.date, rangeStart.format("YYYY-MM-DD")),
    lt(expenses.date, rangeEnd.format("YYYY-MM-DD"))
  );
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
    .orderBy(desc(expenses.date), desc(expenses.id));

  const normalizedRows = rows.map((expense) => ({
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
    rows: normalizedRows,
    trimmedSearch,
  };
};

export const getExpensePrefills = async (): Promise<ExpensePrefillItem[]> => {
  const { rows } = await db.execute<ExpensePrefillRow>(sql`
    WITH RankedStats AS (
      SELECT
        note,
        category,
        paid_by,
        amount,
        created_at,
        COUNT(*) OVER(PARTITION BY note, category, paid_by, amount) as price_frequency,
        ROW_NUMBER() OVER(PARTITION BY note, category, paid_by ORDER BY created_at DESC) as recency_rank
      FROM expenses
      WHERE is_deleted = false
      AND created_at >= NOW() - INTERVAL '30 days'
    )
    SELECT
      note,
      category,
      paid_by,
      COUNT(*) as total_frequency,
      COALESCE(MAX(amount) FILTER (WHERE recency_rank = 1), 0) as latest_amount,
      COALESCE((ARRAY_AGG(amount ORDER BY price_frequency DESC, created_at DESC))[1], 0) as most_frequent_amount
    FROM RankedStats
    GROUP BY note, category, paid_by
    ORDER BY total_frequency DESC
    LIMIT 10;
  `);

  return normalizeExpensePrefillRows(rows);
};
