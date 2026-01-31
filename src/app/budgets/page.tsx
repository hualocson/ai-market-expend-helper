import Link from "next/link";

import dayjs from "@/configs/date";
import { getBudgetOverview } from "@/db/budget-queries";
import { formatVnd, formatVndSigned } from "@/lib/utils";
import { getWeekRange } from "@/lib/week";
import { ArrowLeftIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import BudgetWeeklyBudgetsClient from "@/components/BudgetWeeklyBudgetsClient";

export default async function BudgetsPage() {
  const currentWeekStart =
    getWeekRange(dayjs()).weekStartDate.format("YYYY-MM-DD");
  const report = await getBudgetOverview();

  return (
    <div className="relative mx-auto flex h-[calc(100svh-100px-env(safe-area-inset-bottom))] max-w-lg flex-col gap-4 px-4 pt-6 sm:px-6">
      <div className="flex items-center gap-2">
        <Link href="/">
          <Button variant="ghost" size="icon" className="active:scale-[0.97]">
            <ArrowLeftIcon />
          </Button>
        </Link>
        <div>
          <h1 className="text-foreground text-lg font-semibold sm:text-xl">
            Budgets
          </h1>
          <p className="text-muted-foreground text-sm">
            Monthly & weekly budgets
          </p>
        </div>
      </div>

      <div className="no-scrollbar flex grow flex-col gap-4 overflow-x-auto overflow-y-auto">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Budget overview</CardTitle>
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
                <p className="text-muted-foreground text-xs">Total spent</p>
                <p className="text-foreground text-lg font-semibold">
                  {formatVnd(report.summary.totalSpent)} VND
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Budgets</p>
                <p className="text-foreground text-lg font-semibold">
                  {report.summary.budgetCount}
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
          weekStartDate={currentWeekStart}
          budgets={report.budgets}
        />
      </div>
    </div>
  );
}
