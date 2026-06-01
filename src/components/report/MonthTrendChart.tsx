import React from "react";

import dayjs from "@/configs/date";
import type { MonthTrendPoint } from "@/lib/reports/monthly-insights";
import { cn, formatVndCompact } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type MonthTrendChartProps = {
  points: MonthTrendPoint[];
};

const MonthTrendChart = ({ points }: MonthTrendChartProps) => {
  const maxTotal = Math.max(...points.map((point) => point.total), 1);

  return (
    <Card className="gap-4 py-5">
      <CardHeader className="px-4 pb-0">
        <CardTitle className="text-base text-balance">6-month trend</CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        {points.length ? (
          <div className="grid h-40 grid-cols-6 items-end gap-2">
            {points.map((point) => {
              const height = Math.max(
                8,
                Math.round((point.total / maxTotal) * 96)
              );

              return (
                <div
                  key={point.month}
                  className="flex min-w-0 flex-col items-center gap-2"
                >
                  <div className="flex h-24 w-full items-end">
                    <div
                      className={cn(
                        "w-full rounded-t-xl rounded-b-sm transition-[height,background-color]",
                        point.isSelected
                          ? "bg-emerald-300"
                          : "bg-muted-foreground/35"
                      )}
                      style={{ height }}
                      aria-label={`${point.month}: ${formatVndCompact(
                        point.total
                      )}`}
                    />
                  </div>
                  <div className="text-muted-foreground w-full truncate text-center text-[11px] font-medium">
                    {dayjs(`${point.month}-01`).format("MMM")}
                  </div>
                  <div
                    className={cn(
                      "w-full truncate text-center text-[11px] font-semibold tabular-nums",
                      point.isSelected
                        ? "text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {formatVndCompact(point.total)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-muted-foreground bg-muted/30 rounded-2xl px-3 py-4 text-sm">
            No monthly trend data yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MonthTrendChart;
