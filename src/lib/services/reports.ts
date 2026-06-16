import dayjs from "@/configs/date";
import { db } from "@/db";
import { expenses } from "@/db/schema";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";

export type CategoryTotal = {
  category: string;
  total: number;
};

export type PaidByCategoryTotal = CategoryTotal & {
  paidBy: string;
};

export type PaidByTotal = {
  paidBy: string;
  total: number;
};

export type MonthlyReport = {
  activeMonth: string;
  categoryTotals: CategoryTotal[];
  paidByCategoryTotals: PaidByCategoryTotal[];
  paidByTotalSpent: number;
  paidByTotals: PaidByTotal[];
};

export const summarizePaidByCategoryTotals = (
  paidByCategoryTotals: PaidByCategoryTotal[]
) => {
  const categoryTotalsMap = new Map<string, number>();
  const paidByTotalsMap = new Map<string, number>();
  for (const item of paidByCategoryTotals) {
    categoryTotalsMap.set(
      item.category,
      (categoryTotalsMap.get(item.category) ?? 0) + item.total
    );
    paidByTotalsMap.set(
      item.paidBy,
      (paidByTotalsMap.get(item.paidBy) ?? 0) + item.total
    );
  }

  const categoryTotals = Array.from(categoryTotalsMap, ([category, total]) => ({
    category,
    total,
  })).sort((a, b) => b.total - a.total);

  const paidByTotals = Array.from(paidByTotalsMap, ([paidBy, total]) => ({
    paidBy,
    total,
  })).sort((a, b) => b.total - a.total);

  const paidByTotalSpent = paidByTotals.reduce(
    (sum, item) => sum + item.total,
    0
  );

  return { categoryTotals, paidByTotals, paidByTotalSpent };
};

export const getMonthlyReport = async (
  month?: string
): Promise<MonthlyReport> => {
  const parsedMonth = month ? dayjs(month, "YYYY-MM", true) : dayjs();
  const activeMonth = parsedMonth.isValid() ? parsedMonth : dayjs();
  const startOfMonth = activeMonth.startOf("month");
  const endOfMonth = activeMonth.add(1, "month").startOf("month");
  const totalSum = sql<number>`sum(${expenses.amount})`;

  const paidByCategoryTotals = await db
    .select({
      category: expenses.category,
      paidBy: expenses.paidBy,
      total: sql<number>`coalesce(${totalSum}, 0)`.mapWith(Number),
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.isDeleted, false),
        gte(expenses.date, startOfMonth.format("YYYY-MM-DD")),
        lt(expenses.date, endOfMonth.format("YYYY-MM-DD"))
      )
    )
    .groupBy(expenses.category, expenses.paidBy)
    .orderBy(desc(totalSum));

  const normalizedTotals = paidByCategoryTotals.map((item) => ({
    category: item.category,
    paidBy: item.paidBy,
    total: Number(item.total ?? 0),
  }));
  const { categoryTotals, paidByTotalSpent, paidByTotals } =
    summarizePaidByCategoryTotals(normalizedTotals);

  return {
    activeMonth: activeMonth.format("YYYY-MM"),
    categoryTotals,
    paidByCategoryTotals: normalizedTotals,
    paidByTotalSpent,
    paidByTotals,
  };
};
