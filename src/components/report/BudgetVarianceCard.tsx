import React from "react";

import type { BudgetVarianceSummary } from "@/lib/reports/monthly-insights";
import { cn, formatVnd, formatVndSigned } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import VndSymbol from "@/components/VndSymbol";

type BudgetVarianceCardProps = {
  budgetVariance: BudgetVarianceSummary;
};

const statusClassName = {
  under: "bg-emerald-500/12 text-emerald-300",
  near: "bg-amber-500/12 text-amber-300",
  over: "bg-red-500/12 text-red-300",
  "no-allowance": "bg-muted/50 text-muted-foreground",
} satisfies Record<BudgetVarianceSummary["rows"][number]["status"], string>;

const formatPercentUsed = (value: number | null) =>
  value === null
    ? "No allowance"
    : `${value.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}% used`;

const BudgetVarianceCard = ({ budgetVariance }: BudgetVarianceCardProps) => {
  const { rows, summary } = budgetVariance;

  return (
    <Card className="gap-4 py-5">
      <CardHeader className="px-4 pb-0">
        <CardTitle className="text-base text-balance">
          Budget variance
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-4">
        {rows.length ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-muted/30 rounded-2xl p-3">
                <div className="text-muted-foreground text-xs">Assigned</div>
                <div className="text-foreground mt-1 flex max-w-full flex-wrap items-center gap-x-1 gap-y-1 text-sm font-semibold break-all tabular-nums">
                  {formatVnd(summary.totalAssignedSpend)}
                  <VndSymbol className="size-3.5" aria-hidden="true" />
                </div>
              </div>
              <div className="bg-muted/30 rounded-2xl p-3">
                <div className="text-muted-foreground text-xs">Variance</div>
                <div className="text-foreground mt-1 flex max-w-full flex-wrap items-center gap-x-1 gap-y-1 text-sm font-semibold break-all tabular-nums">
                  {summary.totalVariance > 0 ? "+" : ""}
                  {formatVndSigned(summary.totalVariance)}
                  <VndSymbol className="size-3.5" aria-hidden="true" />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {rows.map((row) => (
                <div
                  key={row.budgetId}
                  className="bg-muted/20 flex min-h-16 flex-col items-start gap-3 rounded-2xl px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex max-w-full min-w-0 items-center gap-3">
                    <span
                      className="bg-background/70 flex size-9 shrink-0 items-center justify-center rounded-xl text-base"
                      aria-hidden="true"
                    >
                      {row.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="text-foreground truncate text-sm font-medium">
                        {row.name}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {formatPercentUsed(row.percentUsed)}
                      </div>
                    </div>
                  </div>

                  <div className="flex max-w-full flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                    <span
                      className={cn(
                        "rounded-full px-2 py-1 text-[11px] font-semibold capitalize",
                        statusClassName[row.status]
                      )}
                    >
                      {row.status.replace("-", " ")}
                    </span>
                    <span className="text-muted-foreground flex max-w-full flex-wrap items-center gap-x-1 gap-y-1 text-xs break-all tabular-nums sm:justify-end sm:text-right">
                      {formatVnd(row.assignedSpend)}
                      <VndSymbol className="size-3" aria-hidden="true" />
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {summary.unassignedSpend > 0 ? (
              <div className="text-muted-foreground flex items-center justify-between gap-3 text-xs">
                <span>Unassigned spend</span>
                <span className="flex max-w-full flex-wrap items-center justify-end gap-x-1 gap-y-1 text-right font-medium break-all tabular-nums">
                  {formatVnd(summary.unassignedSpend)}
                  <VndSymbol className="size-3" aria-hidden="true" />
                </span>
              </div>
            ) : null}
          </>
        ) : (
          <div className="text-muted-foreground bg-muted/30 rounded-2xl px-3 py-4 text-sm">
            No assigned budget spend this month.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BudgetVarianceCard;
