import dayjs from "@/configs/date";
import { db } from "@/db";
import { expenses } from "@/db/schema";
import { formatVnd } from "@/lib/utils";
import { and, eq, gte, lt } from "drizzle-orm";

import SpendingTrendChart from "@/components/SpendingTrendChart";

type SpendingDashboardHeaderProps = {
  selectedMonth?: string;
};

const buildDailyTotals = (
  startOfMonth: dayjs.Dayjs,
  amounts: Array<{ date: string; amount: number }>
) => {
  const byDate = new Map<string, number>();
  amounts.forEach((expense) => {
    const current = byDate.get(expense.date) ?? 0;
    byDate.set(expense.date, current + expense.amount);
  });

  const start = startOfMonth.startOf("month");
  const daysInMonth = start.daysInMonth();

  const totals = Array.from({ length: daysInMonth }, (_, index) => {
    const date = start.add(index, "day").format("YYYY-MM-DD");
    return byDate.get(date) ?? 0;
  });

  return { totals };
};

const SpendingDashboardHeader = async ({
  selectedMonth,
}: SpendingDashboardHeaderProps) => {
  const parsedMonth = selectedMonth
    ? dayjs(selectedMonth, "YYYY-MM", true)
    : dayjs();
  const activeMonth = parsedMonth.isValid() ? parsedMonth : dayjs();
  const startOfMonth = activeMonth.startOf("month");
  const endOfMonth = activeMonth.add(1, "month").startOf("month");

  const rows = await db
    .select({
      date: expenses.date,
      amount: expenses.amount,
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.isDeleted, false),
        gte(expenses.date, startOfMonth.format("YYYY-MM-DD")),
        lt(expenses.date, endOfMonth.format("YYYY-MM-DD"))
      )
    );

  const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);
  const { totals } = buildDailyTotals(
    startOfMonth,
    rows
      .map((row) => ({
        date: String(row.date),
        amount: row.amount,
      }))
      .sort((a, b) => (a.date < b.date ? -1 : 1))
  );

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <p className="text-[34px] font-semibold tracking-tight text-white sm:text-[40px]">
          {formatVnd(totalAmount)} VND
        </p>
        <p className="text-sm text-slate-400">
          Spent in {activeMonth.format("MMMM YYYY")}
        </p>
      </div>

      <div className="relative overflow-hidden rounded-[28px] bg-white/5 p-4 shadow-[0_25px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(78,241,255,0.22),transparent_55%),radial-gradient(circle_at_80%_0%,rgba(58,242,162,0.12),transparent_50%)]" />
        <div className="pointer-events-none absolute -top-16 -right-10 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(58,242,162,0.25),transparent_60%)] blur-2xl" />

        <div className="relative">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-300">
              Spending trend
            </p>
            <span className="text-xs text-slate-500">This month</span>
          </div>

          <div className="mt-4">
            <SpendingTrendChart totals={totals} />
          </div>
        </div>
      </div>
    </section>
  );
};

export default SpendingDashboardHeader;
