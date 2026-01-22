import Link from "next/link";

import dayjs from "@/configs/date";
import { db } from "@/db";
import { expenses } from "@/db/schema";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { ArrowLeftIcon } from "lucide-react";

import { formatVnd } from "@/lib/utils";

import PaidByIcon from "@/components/PaidByIcon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import CategorySpendPieChart from "@/components/CategorySpendPieChart";
import ExpenseMonthTabs from "@/components/ExpenseMonthTabs";

interface ReportPageProps {
  searchParams: Promise<{
    month?: string;
  }>;
}

const buildMonthOptions = (count = 12) => {
  return Array.from({ length: count }, (_, index) =>
    dayjs()
      .subtract(count - 1 - index, "month")
      .startOf("month")
  );
};

export default async function ReportPage({ searchParams }: ReportPageProps) {
  const { month } = await searchParams;
  const selectedMonth = typeof month === "string" ? month : undefined;
  const parsedMonth = selectedMonth
    ? dayjs(selectedMonth, "YYYY-MM", true)
    : dayjs();
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

  const monthOptions = buildMonthOptions();
  const monthItems = monthOptions.map((monthItem) => {
    const value = monthItem.format("YYYY-MM");
    const isCurrent = value === dayjs().format("YYYY-MM");
    return {
      value,
      label: monthItem.format("MMM"),
      href: isCurrent ? "/report" : `/report?month=${value}`,
      isActive: value === startOfMonth.format("YYYY-MM"),
    };
  });

  return (
    <div className="relative mx-auto flex h-[calc(100svh-100px-env(safe-area-inset-bottom))] max-w-lg flex-col items-stretch gap-3 px-4 pt-6 sm:px-6 overflow-y-auto ">
      <div className="flex shrink-0 items-center gap-2">
        <Link href="/">
          <Button variant="ghost" size="icon" className="active:scale-[0.97]">
            <ArrowLeftIcon />
          </Button>
        </Link>
        <h1 className="text-foreground text-lg font-semibold sm:text-xl">
          Report
        </h1>
          <span className="text-muted-foreground text-sm">
            {activeMonth.format("MMM YYYY")}
          </span>
      </div>
      <div className="shrink-0">
        <ExpenseMonthTabs items={monthItems} />
      </div>
      <div className="grow flex flex-col gap-4 overflow-y-auto no-scrollbar">
      <CategorySpendPieChart
        totals={categoryTotals}
        monthLabel={`${activeMonth.format("MMM YYYY")} - All`}
      />
      {paidByCategoryTotals.length ? (
        Array.from(
          paidByCategoryTotals.reduce(
            (acc, item) => {
              const current = acc.get(item.paidBy) ?? [];
              current.push({ category: item.category, total: item.total });
              acc.set(item.paidBy, current);
              return acc;
            },
            new Map<string, Array<{ category: string; total: number }>>()
          )
        )
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([paidBy, totals]) => (
            <CategorySpendPieChart
              key={paidBy}
              totals={totals}
              monthLabel={`${activeMonth.format("MMM YYYY")} - ${paidBy}`}
            />
          ))
      ) : (
        <CategorySpendPieChart
          totals={[]}
          monthLabel={activeMonth.format("MMM YYYY")}
        />
      )}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Spending by payer</CardTitle>
        </CardHeader>
        <CardContent>
          {paidByTotals.length ? (
            <div className="flex flex-col gap-3">
              {paidByTotals.map((item) => (
                <div
                  key={item.paidBy}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-3">
                    <PaidByIcon paidBy={item.paidBy} size="sm" />
                    <span className="text-muted-foreground">
                      {item.paidBy}
                    </span>
                  </div>
                  <span className="text-foreground font-semibold">
                    {formatVnd(item.total)} VND
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-white/10 pt-2 text-xs">
                <span className="text-muted-foreground">Total</span>
                <span className="text-foreground font-semibold">
                  {formatVnd(paidByTotalSpent)} VND
                </span>
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground text-sm">
              Add expenses to see payer totals.
            </div>
          )}
        </CardContent>
      </Card>
      </div>

    </div>
  );
}
