import dayjs from "@/configs/date";
import { db } from "@/db";
import { getWeeklyBudgetReport } from "@/db/budget-queries";
import { budgets, expenseBudgets, expenses } from "@/db/schema";
import {
  type BudgetColorId,
  normalizeBudgetColor,
  normalizeBudgetIcon,
} from "@/lib/budget-appearance";
import { getWeekRange } from "@/lib/week";
import { and, desc, eq, gte, lt, lte, sql } from "drizzle-orm";

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

export type DailyReportExpense = {
  id: number;
  date: string;
  amount: number;
  note: string;
  category: string;
  paidBy: string;
  budgetId: number | null;
  budgetName: string | null;
  budgetIcon: string | null;
  budgetColor: BudgetColorId | null;
};

export type DailyReport = {
  activeDate: string;
  dailyCategoryTotals: CategoryTotal[];
  dailyExpenses: DailyReportExpense[];
  dailyRemaining: number;
  dailyTarget: number;
  dateKey: string;
  dayIndex: number;
  expectedSpendToDate: number;
  hasWeeklyBudget: boolean;
  monthKey: string;
  paceDelta: number;
  paceProgress: number;
  paceStatus: "No weekly budget" | "On pace" | "Over pace";
  totalSpentToday: number;
  weekEndKey: string;
  weekLabel: string;
  weekSpentToDate: number;
  weekStartKey: string;
  weeklyBudgetTotal: number;
};

const formatWeekRange = (start: dayjs.Dayjs, end: dayjs.Dayjs) =>
  `${start.format("DD MMM")} - ${end.format("DD MMM")}`;

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

export const getDailyReport = async (date: string): Promise<DailyReport> => {
  const parsedDate = dayjs(date, "YYYY-MM-DD", true);
  const activeDate = parsedDate.isValid() ? parsedDate : dayjs();
  const dateKey = activeDate.format("YYYY-MM-DD");
  const monthKey = activeDate.format("YYYY-MM");

  const { weekStartDate, weekEndDate } = getWeekRange(activeDate);
  const weekStartKey = weekStartDate.format("YYYY-MM-DD");
  const weekEndKey = weekEndDate.format("YYYY-MM-DD");
  const weekLabel = formatWeekRange(weekStartDate, weekEndDate);
  const dayIndex = activeDate.diff(weekStartDate, "day") + 1;

  const weeklyReport = await getWeeklyBudgetReport(dateKey);
  const weeklyBudgets = weeklyReport.budgets
    .filter((budget) => budget.period === "week")
    .sort((a, b) => a.name.localeCompare(b.name));

  const totalSum = sql<number>`sum(${expenses.amount})`;
  const dailyCategoryTotals = await db
    .select({
      category: expenses.category,
      total: sql<number>`coalesce(${totalSum}, 0)`.mapWith(Number),
    })
    .from(expenses)
    .where(and(eq(expenses.isDeleted, false), eq(expenses.date, dateKey)))
    .groupBy(expenses.category)
    .orderBy(desc(totalSum));

  const dailyExpenses = await db
    .select({
      id: expenses.id,
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
    .where(and(eq(expenses.isDeleted, false), eq(expenses.date, dateKey)))
    .orderBy(desc(expenses.id));

  const normalizedDailyExpenses = dailyExpenses.map((expense) => ({
    id: Number(expense.id),
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

  const totalSpentToday = normalizedDailyExpenses.reduce(
    (sum, row) => sum + row.amount,
    0
  );

  const [weekSpendRow] = await db
    .select({
      total: sql<number>`coalesce(sum(${expenses.amount}), 0)`.mapWith(Number),
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.isDeleted, false),
        gte(expenses.date, weekStartKey),
        lte(expenses.date, dateKey)
      )
    );

  const weekSpentToDate = Number(weekSpendRow?.total ?? 0);
  const weeklyBudgetTotal = weeklyBudgets.reduce(
    (sum, budget) => sum + budget.amount,
    0
  );
  const hasWeeklyBudget = weeklyBudgetTotal > 0;
  const dailyTarget = weeklyBudgetTotal > 0 ? weeklyBudgetTotal / 7 : 0;
  const expectedSpendToDate = dailyTarget * dayIndex;
  const paceDelta = weekSpentToDate - expectedSpendToDate;
  const dailyRemaining = dailyTarget - totalSpentToday;
  const paceStatus = !hasWeeklyBudget
    ? "No weekly budget"
    : paceDelta <= 0
      ? "On pace"
      : "Over pace";
  const paceProgress =
    weeklyBudgetTotal > 0
      ? Math.min(weekSpentToDate / weeklyBudgetTotal, 1)
      : 0;

  return {
    activeDate: dateKey,
    dailyCategoryTotals: dailyCategoryTotals.map((item) => ({
      category: item.category,
      total: Number(item.total ?? 0),
    })),
    dailyExpenses: normalizedDailyExpenses,
    dailyRemaining,
    dailyTarget,
    dateKey,
    dayIndex,
    expectedSpendToDate,
    hasWeeklyBudget,
    monthKey,
    paceDelta,
    paceProgress,
    paceStatus,
    totalSpentToday,
    weekEndKey,
    weekLabel,
    weekSpentToDate,
    weekStartKey,
    weeklyBudgetTotal,
  };
};
