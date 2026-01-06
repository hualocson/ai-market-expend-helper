import dayjs from "@/configs/date";
import { db } from "@/db";
import { expenses } from "@/db/schema";
import { and, eq, gte, lt, sql } from "drizzle-orm";

import SpendingDashboardHeaderClient from "@/components/SpendingDashboardHeaderClient";

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
      paidBy: expenses.paidBy,
      amount: sql<number>`sum(${expenses.amount})`.as("amount"),
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.isDeleted, false),
        gte(expenses.date, startOfMonth.format("YYYY-MM-DD")),
        lt(expenses.date, endOfMonth.format("YYYY-MM-DD"))
      )
    )
    .groupBy(expenses.date, expenses.paidBy);

  const normalizedRows = rows
    .map((row) => ({
      date: String(row.date),
      amount: Number(row.amount ?? 0),
      paidBy: row.paidBy,
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const totalsByPayer = new Map<
    string,
    Array<{ date: string; amount: number }>
  >();
  normalizedRows.forEach((row) => {
    const current = totalsByPayer.get(row.paidBy) ?? [];
    current.push({ date: row.date, amount: row.amount });
    totalsByPayer.set(row.paidBy, current);
  });

  const allTotals = buildDailyTotals(
    startOfMonth,
    normalizedRows.map(({ date, amount }) => ({ date, amount }))
  );
  const totalAmount = normalizedRows.reduce((sum, row) => sum + row.amount, 0);

  const payerTotals = Array.from(totalsByPayer.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .reduce<Record<string, { total: number; totals: number[] }>>(
      (acc, [payer, amounts]) => {
        const { totals } = buildDailyTotals(startOfMonth, amounts);
        const total = amounts.reduce((sum, row) => sum + row.amount, 0);
        acc[payer] = { total, totals };
        return acc;
      },
      {}
    );

  const totalsForDisplay = {
    All: { total: totalAmount, totals: allTotals.totals },
    ...payerTotals,
  };
  return (
    <SpendingDashboardHeaderClient
      activeMonthLabel={activeMonth.format("MMMM YYYY")}
      payerOptions={Object.keys(totalsForDisplay)}
      totalsByPayer={totalsForDisplay}
    />
  );
};

export default SpendingDashboardHeader;
