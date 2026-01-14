import Link from "next/link";

import dayjs from "@/configs/date";
import { db } from "@/db";
import { expenses } from "@/db/schema";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { ArrowLeftIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

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

  const categoryTotals = await db
    .select({
      category: expenses.category,
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
    .groupBy(expenses.category)
    .orderBy(desc(totalSum));

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
    <div className="relative mx-auto flex h-[calc(100svh-100px)] max-w-lg flex-col gap-3 px-4 pt-6 sm:px-6">
      <div className="flex shrink-0 items-center gap-2">
        <Link href="/">
          <Button variant="ghost" size="icon" className="active:scale-[0.97]">
            <ArrowLeftIcon />
          </Button>
        </Link>
      </div>
      <div className="shrink-0">
        <ExpenseMonthTabs items={monthItems} />
      </div>
      <CategorySpendPieChart
        totals={categoryTotals}
        monthLabel={activeMonth.format("MMM YYYY")}
      />
    </div>
  );
}
