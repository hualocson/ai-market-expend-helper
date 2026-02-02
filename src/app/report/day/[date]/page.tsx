import Link from "next/link";

import dayjs from "@/configs/date";
import { getWeeklyBudgetReport } from "@/db/budget-queries";
import { db } from "@/db";
import { budgets, expenseBudgets, expenses } from "@/db/schema";
import { getWeekRange } from "@/lib/week";
import { cn, formatVnd, formatVndSigned } from "@/lib/utils";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import {
  ArrowLeftIcon,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardList,
} from "lucide-react";

import CategorySpendPieChart from "@/components/CategorySpendPieChart";
import ExpenseListItem from "@/components/ExpenseListItem";
import { Button } from "@/components/ui/button";

interface DailyReportPageProps {
  params: Promise<{
    date: string;
  }>;
}

const formatWeekRange = (start: dayjs.Dayjs, end: dayjs.Dayjs) =>
  `${start.format("DD MMM")} - ${end.format("DD MMM")}`;

export default async function DailyReportPage({ params }: DailyReportPageProps) {
  const { date } = await params;
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
    })
    .from(expenses)
    .leftJoin(expenseBudgets, eq(expenseBudgets.expenseId, expenses.id))
    .leftJoin(budgets, eq(budgets.id, expenseBudgets.budgetId))
    .where(and(eq(expenses.isDeleted, false), eq(expenses.date, dateKey)))
    .orderBy(desc(expenses.id));

  const totalSpentToday = dailyExpenses.reduce(
    (sum, row) => sum + Number(row.amount ?? 0),
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
  const paceStatus =
    !hasWeeklyBudget
      ? "No weekly budget"
      : paceDelta <= 0
        ? "On pace"
        : "Over pace";
  const paceTone =
    paceStatus === "Over pace"
      ? "text-rose-200"
      : paceStatus === "On pace"
        ? "text-emerald-200"
        : "text-muted-foreground";
  const paceProgress =
    weeklyBudgetTotal > 0
      ? Math.min(weekSpentToDate / weeklyBudgetTotal, 1)
      : 0;

  return (
    <div className="relative mx-auto flex h-[calc(100svh-100px-env(safe-area-inset-bottom))] max-w-lg flex-col gap-4 px-4 pt-6 pb-6 sm:px-6">
      <div className="pointer-events-none absolute -top-16 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-emerald-400/15 blur-3xl" />
      <div className="pointer-events-none absolute top-24 right-6 h-24 w-24 rounded-full bg-fuchsia-400/20 blur-2xl" />

      <div className="relative z-10 flex shrink-0 items-center gap-2">
        <Link href={`/transactions?month=${monthKey}`}>
          <Button variant="ghost" size="icon" className="active:scale-[0.97]">
            <ArrowLeftIcon />
          </Button>
        </Link>
        <div>
          <h1 className="text-foreground text-lg font-semibold sm:text-xl">
            Daily report
          </h1>
          <p className="text-muted-foreground text-sm">
            {activeDate.format("dddd, DD MMM YYYY")}
          </p>
        </div>
      </div>

      <div className="no-scrollbar flex grow flex-col gap-4 overflow-y-auto">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[0_16px_40px_-24px_rgba(0,0,0,0.55)] sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-muted-foreground text-xs font-semibold uppercase tracking-[0.26em]">
                Spent today
              </p>
              <p className="text-foreground text-3xl font-semibold">
                -{formatVnd(totalSpentToday)} VND
              </p>
              <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span>{dailyExpenses.length} transactions</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-semibold">
                  Day {dayIndex} of 7
                </span>
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
            <div>
              <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.24em]">
                Week range
              </p>
              <p className="text-foreground text-sm font-semibold">
                {weekLabel}
              </p>
            </div>
            <span
              className={cn(
                "rounded-full border px-3 py-1 text-[11px] font-semibold",
                paceStatus === "Over pace"
                  ? "border-rose-500/40 bg-rose-500/15 text-rose-100"
                  : paceStatus === "On pace"
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-100"
                    : "border-white/10 bg-white/5 text-muted-foreground"
              )}
            >
              {paceStatus}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                Daily target
              </div>
              <p className="text-foreground mt-2 text-sm font-semibold">
                {hasWeeklyBudget
                  ? `${formatVnd(Math.round(dailyTarget))} VND`
                  : "Set weekly budget"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ChartNoAxesCombined className="h-3.5 w-3.5" />
                Week so far
              </div>
              <p className="text-foreground mt-2 text-sm font-semibold">
                {formatVnd(weekSpentToDate)} VND
              </p>
            </div>
            <div className="col-span-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 sm:col-span-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ClipboardList className="h-3.5 w-3.5" />
                Today remaining
              </div>
              <p
                className={cn(
                  "mt-2 text-sm font-semibold",
                  dailyRemaining < 0 ? "text-rose-200" : "text-emerald-200"
                )}
              >
                {hasWeeklyBudget
                  ? `${formatVndSigned(Math.round(dailyRemaining))} VND`
                  : "-"}
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Weekly pace</span>
              <span className={cn("font-semibold", paceTone)}>
                {paceStatus}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-white/10">
              <div
                className={cn(
                  "h-full rounded-full transition-[width]",
                  paceStatus === "Over pace"
                    ? "bg-rose-500"
                    : "bg-emerald-400"
                )}
                style={{ width: `${paceProgress * 100}%` }}
              />
            </div>
            <div className="text-muted-foreground flex items-center justify-between text-[11px]">
              <span>
                {hasWeeklyBudget
                  ? `Week budget ${formatVnd(weeklyBudgetTotal)} VND`
                  : "Add a weekly budget to unlock pace tracking."}
              </span>
              {hasWeeklyBudget ? (
                <span>
                  Expected {formatVnd(Math.round(expectedSpendToDate))} VND
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <CategorySpendPieChart
          totals={dailyCategoryTotals}
          monthLabel={`${activeDate.format("DD MMM YYYY")}`}
        />

        <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-foreground text-base font-semibold">
                Today transactions
              </h2>
              <p className="text-muted-foreground text-xs">
                {dailyExpenses.length
                  ? `${dailyExpenses.length} items on ${activeDate.format(
                      "DD MMM"
                    )}`
                  : "No expenses for this date"}
              </p>
            </div>
            <span className="text-muted-foreground text-xs">
              {weekStartKey} to {weekEndKey}
            </span>
          </div>
          <div className="mt-3 flex flex-col gap-3">
            {dailyExpenses.length ? (
              dailyExpenses.map((expense) => (
                <ExpenseListItem
                  key={expense.id}
                  expense={{
                    id: Number(expense.id),
                    date: String(expense.date),
                    amount: Number(expense.amount ?? 0),
                    note: expense.note ?? "",
                    category: expense.category ?? "",
                    paidBy: expense.paidBy ?? "",
                    budgetId:
                      expense.budgetId === null
                        ? null
                        : Number(expense.budgetId),
                    budgetName: expense.budgetName ?? null,
                  }}
                />
              ))
            ) : (
              <div className="text-muted-foreground py-6 text-center text-sm">
                Add an expense to start your daily report.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
