import Link from "next/link";

import dayjs from "@/configs/date";
import { getWeeklyBudgetReport } from "@/db/budget-queries";
import { formatVnd, formatVndSigned } from "@/lib/utils";
import { getWeekRange } from "@/lib/week";
import { ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import BudgetWeeklyBudgetsClient from "@/components/BudgetWeeklyBudgetsClient";

interface BudgetWeeklyPageProps {
  searchParams: Promise<{
    week?: string;
    q?: string;
  }>;
}

const formatWeekLabel = (start: dayjs.Dayjs, end: dayjs.Dayjs) => {
  if (start.year() !== end.year()) {
    return `${start.format("DD MMM YYYY")} - ${end.format("DD MMM YYYY")}`;
  }
  if (start.month() !== end.month()) {
    return `${start.format("DD MMM")} - ${end.format("DD MMM YYYY")}`;
  }
  return `${start.format("DD")} - ${end.format("DD MMM YYYY")}`;
};

export default async function BudgetWeeklyPage({
  searchParams,
}: BudgetWeeklyPageProps) {
  const { week, q } = await searchParams;
  const selectedWeek = typeof week === "string" ? week : undefined;
  const searchQuery = typeof q === "string" ? q : undefined;
  const parsedWeek = selectedWeek
    ? dayjs(selectedWeek, "YYYY-MM-DD", true)
    : dayjs();
  const baseDate = parsedWeek.isValid() ? parsedWeek : dayjs();
  const { weekStartDate, weekEndDate } = getWeekRange(baseDate);
  const weekStart = weekStartDate.format("YYYY-MM-DD");
  const weekLabel = formatWeekLabel(weekStartDate, weekEndDate);
  const previousWeek = weekStartDate.subtract(7, "day").format("YYYY-MM-DD");
  const nextWeek = weekStartDate.add(7, "day").format("YYYY-MM-DD");

  const report = await getWeeklyBudgetReport(weekStart, searchQuery);

  return (
    <div className="relative mx-auto flex h-[calc(100svh-100px-env(safe-area-inset-bottom))] max-w-lg flex-col gap-4 px-4 pt-6 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href="/">
            <Button variant="ghost" size="icon" className="active:scale-[0.97]">
              <ArrowLeftIcon />
            </Button>
          </Link>
          <div>
            <h1 className="text-foreground text-lg font-semibold sm:text-xl">
              Budget Weekly
            </h1>
            <p className="text-muted-foreground text-sm">{weekLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Link href={`/budget-weekly?week=${previousWeek}`}>
            <Button variant="ghost" size="icon" className="active:scale-[0.97]">
              <ChevronLeftIcon />
            </Button>
          </Link>
          <Link href={`/budget-weekly?week=${nextWeek}`}>
            <Button variant="ghost" size="icon" className="active:scale-[0.97]">
              <ChevronRightIcon />
            </Button>
          </Link>
        </div>
      </div>

      <div className="no-scrollbar flex grow flex-col gap-4 overflow-y-auto">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Week summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-muted-foreground text-xs">Total budget</p>
                <p className="text-foreground text-lg font-semibold">
                  {formatVnd(report.summary.totalBudget)} VND
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Assigned spend</p>
                <p className="text-foreground text-lg font-semibold">
                  {formatVnd(report.summary.totalSpentAssigned)} VND
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">
                  Unassigned spend
                </p>
                <p className="text-foreground text-lg font-semibold">
                  {formatVnd(report.summary.unassignedSpent)} VND
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Remaining</p>
                <p
                  className={`text-lg font-semibold ${
                    report.summary.totalRemaining < 0
                      ? "text-rose-400"
                      : "text-emerald-400"
                  }`}
                >
                  {formatVndSigned(report.summary.totalRemaining)} VND
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <BudgetWeeklyBudgetsClient
          weekStartDate={report.weekStartDate}
          budgets={report.budgets}
        />
      </div>
    </div>
  );
}
