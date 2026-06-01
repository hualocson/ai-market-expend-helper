"use client";

import React, { useMemo, useState } from "react";

import dayjs from "@/configs/date";
import type { BudgetVarianceSummary } from "@/lib/reports/monthly-insights";
import { cn, formatVnd, formatVndSigned } from "@/lib/utils";
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  TriangleAlert,
  WalletCards,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import VndSymbol from "@/components/VndSymbol";

type BudgetVarianceCardProps = {
  budgetVariance: BudgetVarianceSummary;
};

type BudgetVarianceRow = BudgetVarianceSummary["rows"][number];

const DEFAULT_VISIBLE_ROWS = 5;

const statusPriority = {
  over: 0,
  near: 1,
  under: 2,
  "no-allowance": 2,
} satisfies Record<BudgetVarianceRow["status"], number>;

const sortBudgetRows = (rows: BudgetVarianceRow[]) =>
  [...rows].sort((first, second) => {
    const statusDelta =
      statusPriority[first.status] - statusPriority[second.status];
    if (statusDelta !== 0) {
      return statusDelta;
    }

    const spendDelta = second.assignedSpend - first.assignedSpend;
    if (spendDelta !== 0) {
      return spendDelta;
    }

    const varianceDelta = Math.abs(second.variance) - Math.abs(first.variance);
    if (varianceDelta !== 0) {
      return varianceDelta;
    }

    return first.name.localeCompare(second.name);
  });

const getBudgetCounts = (rows: BudgetVarianceRow[]) => ({
  total: rows.length,
  over: rows.filter((row) => row.status === "over").length,
  near: rows.filter((row) => row.status === "near").length,
});

type WeeklyBudgetGroup = {
  key: string;
  label: string;
  rows: BudgetVarianceRow[];
  assignedSpend: number;
  attentionLabel: string;
};

const formatBudgetPeriodRange = (startDate: string, endDate: string) => {
  const start = dayjs(startDate);
  const end = dayjs(endDate);

  if (start.isSame(end, "month")) {
    return `${start.format("MMM D")}-${end.format("D")}`;
  }

  return `${start.format("MMM D")}-${end.format("MMM D")}`;
};

const formatCompactRollupVnd = (value: number) => {
  const absoluteValue = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const compactNumber = (amount: number) =>
    amount.toLocaleString("en-US", {
      maximumFractionDigits: 2,
    });

  if (absoluteValue >= 1_000_000_000) {
    return `${sign}${compactNumber(absoluteValue / 1_000_000_000)}B`;
  }

  if (absoluteValue >= 1_000_000) {
    return `${sign}${compactNumber(absoluteValue / 1_000_000)}M`;
  }

  if (absoluteValue >= 1_000) {
    return `${sign}${compactNumber(absoluteValue / 1_000)}K`;
  }

  return value.toLocaleString("vi-VN");
};

const getAttentionLabel = ({
  overCount,
  nearCount,
}: {
  overCount: number;
  nearCount: number;
}) => {
  if (overCount > 0) {
    return `${overCount} over`;
  }
  if (nearCount > 0) {
    return `${nearCount} near`;
  }
  return "0 over";
};

const groupWeeklyBudgetRows = (rows: BudgetVarianceRow[]) => {
  const groups = new Map<string, BudgetVarianceRow[]>();

  rows
    .filter((row) => row.period === "week")
    .forEach((row) => {
      const key = `${row.periodStartDate}|${row.periodEndDate}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    });

  return Array.from(groups.entries())
    .map(([key, groupRows]): WeeklyBudgetGroup => {
      const [periodStartDate, periodEndDate] = key.split("|");
      const sortedGroupRows = sortBudgetRows(groupRows);
      const overCount = sortedGroupRows.filter(
        (row) => row.status === "over"
      ).length;
      const nearCount = sortedGroupRows.filter(
        (row) => row.status === "near"
      ).length;

      return {
        key,
        label: formatBudgetPeriodRange(periodStartDate, periodEndDate),
        rows: sortedGroupRows,
        assignedSpend: sortedGroupRows.reduce(
          (sum, row) => sum + row.assignedSpend,
          0
        ),
        attentionLabel: getAttentionLabel({ overCount, nearCount }),
      };
    })
    .sort((first, second) => first.key.localeCompare(second.key));
};

const getMonthlyBudgetRows = (rows: BudgetVarianceRow[]) =>
  sortBudgetRows(rows.filter((row) => row.period === "month"));

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

const BudgetVarianceRowItem = ({ row }: { row: BudgetVarianceRow }) => (
  <div className="bg-muted/20 flex min-h-16 flex-col items-start gap-3 rounded-2xl px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
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
);

const WeeklyBudgetRollup = ({ group }: { group: WeeklyBudgetGroup }) => (
  <div className="flex flex-col gap-2">
    <div
      className="text-muted-foreground bg-muted/20 flex min-h-10 max-w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-3 py-2 text-xs"
      aria-label={`Budget rollup ${group.label}, ${group.rows.length} budgets, ${group.attentionLabel}, ${formatVnd(group.assignedSpend)} VND used`}
    >
      <span className="text-foreground flex items-center gap-1 font-medium">
        <CalendarDays className="size-3.5" aria-hidden="true" />
        {group.label}
      </span>
      <span className="flex items-center gap-1">
        <WalletCards className="size-3.5" aria-hidden="true" />
        {group.rows.length} budgets
      </span>
      <span className="flex items-center gap-1">
        <TriangleAlert className="size-3.5" aria-hidden="true" />
        {group.attentionLabel}
      </span>
      <span className="flex max-w-full items-center gap-1 break-all tabular-nums">
        <VndSymbol className="size-3.5" aria-hidden="true" />
        {formatCompactRollupVnd(group.assignedSpend)} used
      </span>
    </div>
    <div className="flex flex-col gap-2">
      {group.rows.map((row) => (
        <BudgetVarianceRowItem key={row.budgetId} row={row} />
      ))}
    </div>
  </div>
);

const BudgetVarianceCard = ({ budgetVariance }: BudgetVarianceCardProps) => {
  const { rows, summary } = budgetVariance;
  const [expanded, setExpanded] = useState(false);
  const sortedRows = useMemo(() => sortBudgetRows(rows), [rows]);
  const budgetCounts = useMemo(() => getBudgetCounts(rows), [rows]);
  const hasOverflow = sortedRows.length > DEFAULT_VISIBLE_ROWS;
  const visibleRows =
    expanded || !hasOverflow
      ? sortedRows
      : sortedRows.slice(0, DEFAULT_VISIBLE_ROWS);
  const monthlyRows = useMemo(() => getMonthlyBudgetRows(rows), [rows]);
  const weeklyGroups = useMemo(() => groupWeeklyBudgetRows(rows), [rows]);
  const hiddenRowCount = Math.max(sortedRows.length - DEFAULT_VISIBLE_ROWS, 0);

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

            <div
              className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs"
              aria-label={`${budgetCounts.total} budgets, ${budgetCounts.over} over, ${budgetCounts.near} near`}
            >
              <span>{budgetCounts.total} budgets</span>
              <span>{budgetCounts.over} over</span>
              <span>{budgetCounts.near} near</span>
            </div>

            {expanded && hasOverflow ? (
              <div className="flex flex-col gap-4">
                {monthlyRows.length ? (
                  <div className="flex flex-col gap-2">
                    <div className="text-muted-foreground px-1 text-xs font-medium">
                      Monthly budgets
                    </div>
                    {monthlyRows.map((row) => (
                      <BudgetVarianceRowItem key={row.budgetId} row={row} />
                    ))}
                  </div>
                ) : null}

                {weeklyGroups.map((group) => (
                  <WeeklyBudgetRollup key={group.key} group={group} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {visibleRows.map((row) => (
                  <BudgetVarianceRowItem key={row.budgetId} row={row} />
                ))}
              </div>
            )}

            {hasOverflow ? (
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground flex min-h-10 max-w-full flex-wrap items-center justify-center gap-x-1 gap-y-1 rounded-xl px-3 text-xs font-medium transition-colors"
                onClick={() => setExpanded((current) => !current)}
                aria-expanded={expanded}
              >
                {expanded ? (
                  <>
                    Show fewer budget rows
                    <ChevronUp className="size-3.5" aria-hidden="true" />
                  </>
                ) : (
                  <>
                    Show all {hiddenRowCount} more budgets
                    <ChevronDown className="size-3.5" aria-hidden="true" />
                  </>
                )}
              </button>
            ) : null}

            {summary.unassignedSpend > 0 ? (
              <div className="text-muted-foreground flex flex-col items-start gap-1 text-xs sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <span>Unassigned spend</span>
                <span className="flex max-w-full flex-wrap items-center gap-x-1 gap-y-1 font-medium break-all tabular-nums sm:justify-end sm:text-right">
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
