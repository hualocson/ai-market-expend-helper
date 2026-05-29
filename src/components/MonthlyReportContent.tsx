"use client";

import Link from "next/link";

import dayjs from "@/configs/date";
import { queries } from "@/lib/queries";
import { formatVnd } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import CategorySpendPieChart from "@/components/CategorySpendPieChart";
import ExpenseMonthTabs from "@/components/ExpenseMonthTabs";
import PaidByIcon from "@/components/PaidByIcon";
import VndSymbol from "@/components/VndSymbol";

type MonthlyReportContentProps = {
  selectedMonth?: string;
};

const buildMonthOptions = (count = 12) => {
  return Array.from({ length: count }, (_, index) =>
    dayjs()
      .subtract(count - 1 - index, "month")
      .startOf("month")
  );
};

const MonthlyReportContent = ({ selectedMonth }: MonthlyReportContentProps) => {
  const { data: report } = useQuery(queries.reports.monthly(selectedMonth));

  if (!report) {
    return null;
  }

  const activeMonth = dayjs(report.activeMonth, "YYYY-MM", true);
  const startOfMonth = activeMonth.startOf("month");
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
    <div className="relative mx-auto flex h-[calc(100svh-100px-env(safe-area-inset-bottom))] max-w-lg flex-col items-stretch gap-3 overflow-y-auto px-4 pt-6 sm:px-6">
      <div>
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
      </div>

      <div className="shrink-0">
        <ExpenseMonthTabs items={monthItems} />
      </div>

      <div className="no-scrollbar flex grow flex-col gap-4 overflow-y-auto">
        <div>
          <CategorySpendPieChart
            totals={report.categoryTotals}
            monthLabel={`${activeMonth.format("MMM YYYY")} - All`}
          />
        </div>

        {report.paidByCategoryTotals.length ? (
          Array.from(
            report.paidByCategoryTotals.reduce((acc, item) => {
              const current = acc.get(item.paidBy) ?? [];
              current.push({ category: item.category, total: item.total });
              acc.set(item.paidBy, current);
              return acc;
            }, new Map<string, Array<{ category: string; total: number }>>())
          )
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([paidBy, totals]) => (
              <div key={paidBy}>
                <CategorySpendPieChart
                  totals={totals}
                  monthLabel={`${activeMonth.format("MMM YYYY")} - ${paidBy}`}
                />
              </div>
            ))
        ) : (
          <div>
            <CategorySpendPieChart
              totals={[]}
              monthLabel={activeMonth.format("MMM YYYY")}
            />
          </div>
        )}

        <div>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Spending by payer</CardTitle>
            </CardHeader>
            <CardContent>
              {report.paidByTotals.length ? (
                <div className="flex flex-col gap-3">
                  {report.paidByTotals.map((item) => (
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
                        {formatVnd(item.total)} <VndSymbol />
                      </span>
                    </div>
                  ))}
                  <div className="border-border flex items-center justify-between border-t pt-2 text-xs">
                    <span className="text-muted-foreground">Total</span>
                    <span className="text-foreground font-semibold">
                      {formatVnd(report.paidByTotalSpent)} <VndSymbol />
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
    </div>
  );
};

export default MonthlyReportContent;
