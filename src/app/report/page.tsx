import Link from "next/link";

import dayjs from "@/configs/date";
import { getMonthlyReport } from "@/lib/services/reports";
import { formatVnd } from "@/lib/utils";
import { ArrowLeftIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import CategorySpendPieChart from "@/components/CategorySpendPieChart";
import ExpenseMonthTabs from "@/components/ExpenseMonthTabs";
import PageEnterAnimation, {
  PageEnterSection,
} from "@/components/PageEnterAnimation";
import PaidByIcon from "@/components/PaidByIcon";
import VndSymbol from "@/components/VndSymbol";

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
  const report = await getMonthlyReport(selectedMonth);
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
    <PageEnterAnimation className="relative mx-auto flex h-[calc(100svh-100px-env(safe-area-inset-bottom))] max-w-lg flex-col items-stretch gap-3 overflow-y-auto px-4 pt-6 sm:px-6">
      <PageEnterSection>
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
      </PageEnterSection>

      <PageEnterSection className="shrink-0">
        <ExpenseMonthTabs items={monthItems} />
      </PageEnterSection>

      <div className="no-scrollbar flex grow flex-col gap-4 overflow-y-auto">
        <PageEnterSection>
          <CategorySpendPieChart
            totals={report.categoryTotals}
            monthLabel={`${activeMonth.format("MMM YYYY")} - All`}
          />
        </PageEnterSection>

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
              <PageEnterSection key={paidBy}>
                <CategorySpendPieChart
                  totals={totals}
                  monthLabel={`${activeMonth.format("MMM YYYY")} - ${paidBy}`}
                />
              </PageEnterSection>
            ))
        ) : (
          <PageEnterSection>
            <CategorySpendPieChart
              totals={[]}
              monthLabel={activeMonth.format("MMM YYYY")}
            />
          </PageEnterSection>
        )}

        <PageEnterSection>
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
        </PageEnterSection>
      </div>
    </PageEnterAnimation>
  );
}
