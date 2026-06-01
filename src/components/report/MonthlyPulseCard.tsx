import React from "react";

import type { MonthlyPulse } from "@/lib/reports/monthly-insights";
import { cn, formatVnd, formatVndSigned } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import VndSymbol from "@/components/VndSymbol";

type MonthlyPulseCardProps = {
  pulse: MonthlyPulse;
};

const formatPercent = (value: number | null) => {
  if (value === null) {
    return null;
  }

  return `${value > 0 ? "+" : ""}${value.toLocaleString("vi-VN", {
    maximumFractionDigits: 1,
  })}%`;
};

const signedCurrency = (value: number | null) => {
  if (value === null) {
    return "No comparison";
  }

  return `${value > 0 ? "+" : ""}${formatVndSigned(value)}`;
};

const getDeltaTone = (value: number | null) => {
  if (value === null || value === 0) {
    return {
      Icon: Minus,
      className: "text-muted-foreground bg-muted/40",
    };
  }

  if (value > 0) {
    return {
      Icon: ArrowUpRight,
      className: "bg-red-500/12 text-red-300",
    };
  }

  return {
    Icon: ArrowDownRight,
    className: "bg-emerald-500/12 text-emerald-300",
  };
};

const DeltaPill = ({
  amount,
  percent,
}: {
  amount: number | null;
  percent: number | null;
}) => {
  const { Icon, className } = getDeltaTone(amount);
  const formattedPercent = formatPercent(percent);

  return (
    <span
      className={cn(
        "inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold tabular-nums",
        className
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      <span>{signedCurrency(amount)}</span>
      {formattedPercent ? <span>{formattedPercent}</span> : null}
    </span>
  );
};

const MonthlyPulseCard = ({ pulse }: MonthlyPulseCardProps) => {
  return (
    <Card className="gap-4 py-5">
      <CardHeader className="px-4 pb-0">
        <CardTitle className="text-base text-balance">Monthly pulse</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-muted-foreground text-xs font-medium">
              Current spend
            </div>
            <div className="text-foreground mt-1 flex items-center gap-1 text-3xl leading-none font-semibold tracking-tight tabular-nums">
              {formatVnd(pulse.selectedTotal)}
              <VndSymbol className="size-6 shrink-0" aria-hidden="true" />
            </div>
          </div>
          <DeltaPill
            amount={pulse.previousMonthDelta}
            percent={pulse.previousMonthDeltaPercent}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-muted/30 rounded-2xl p-3">
            <div className="text-muted-foreground text-xs">Previous month</div>
            <div className="text-foreground mt-1 flex items-center gap-1 text-sm font-semibold tabular-nums">
              {formatVnd(pulse.previousMonthTotal)}
              <VndSymbol className="size-3.5" aria-hidden="true" />
            </div>
          </div>
          <div className="bg-muted/30 rounded-2xl p-3">
            <div className="text-muted-foreground text-xs">3-month avg</div>
            <div className="text-foreground mt-1 flex items-center gap-1 text-sm font-semibold tabular-nums">
              {formatVnd(Math.round(pulse.priorThreeMonthAverage))}
              <VndSymbol className="size-3.5" aria-hidden="true" />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="text-muted-foreground">vs 3-month average</span>
          <DeltaPill
            amount={pulse.priorThreeMonthDelta}
            percent={pulse.priorThreeMonthDeltaPercent}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default MonthlyPulseCard;
