"use client";

import { useEffect, useMemo, useState } from "react";

import dayjs from "@/configs/date";
import { getQuantileBuckets } from "@/lib/heatmap-buckets";
import { cn, formatVnd } from "@/lib/utils";

type SpendingHeatmapChartProps = {
  totals: number[];
  activeMonth: string;
};

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const BUCKET_OPACITY = [0, 18, 35, 55, 80] as const;

const bucketStyle = (bucket: number): React.CSSProperties => ({
  backgroundColor: `color-mix(in srgb, var(--accent) ${BUCKET_OPACITY[bucket]}%, transparent)`,
});

const toMondayIndex = (sundayBasedDay: number) => (sundayBasedDay + 6) % 7;

const SpendingHeatmapChart = ({
  totals,
  activeMonth,
}: SpendingHeatmapChartProps) => {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  useEffect(() => {
    setSelectedDay(null);
  }, [totals]);

  const parsed = dayjs(activeMonth, "YYYY-MM", true);
  const monthStart = parsed.isValid() ? parsed.startOf("month") : dayjs().startOf("month");
  const daysInMonth = monthStart.daysInMonth();
  const monthLabel = monthStart.format("MMMM YYYY");
  const leadingPad = toMondayIndex(monthStart.day());
  const trailingPad = (7 - ((leadingPad + daysInMonth) % 7)) % 7;

  const buckets = useMemo(() => getQuantileBuckets(totals), [totals]);
  const totalSpend = useMemo(
    () => totals.reduce((sum, t) => sum + t, 0),
    [totals]
  );

  const leadingDays = useMemo(
    () =>
      Array.from({ length: leadingPad }, (_, i) =>
        monthStart.subtract(leadingPad - i, "day").date()
      ),
    [leadingPad, monthStart]
  );

  const trailingDays = useMemo(
    () => Array.from({ length: trailingPad }, (_, i) => i + 1),
    [trailingPad]
  );

  const detailMessage = (() => {
    if (totalSpend === 0) {
      return `No spending in ${monthLabel}`;
    }
    if (selectedDay === null) {
      return "Tap a day to see details";
    }
    const amount = totals[selectedDay - 1] ?? 0;
    return `Day ${selectedDay} · ${formatVnd(amount)} VND`;
  })();

  return (
    <div className="flex flex-col gap-3">
      <div role="grid" className="grid grid-cols-7 gap-1.5">
        {WEEKDAY_LABELS.map((label) => (
          <span
            key={label}
            className="text-muted-foreground text-center text-[10px] font-semibold tracking-[0.18em] uppercase"
          >
            {label}
          </span>
        ))}

        {leadingDays.map((day, index) => (
          <span
            key={`lead-${index}`}
            aria-hidden="true"
            className="text-muted-foreground/40 pointer-events-none flex aspect-square items-center justify-center rounded-md text-[11px] tabular-nums"
          >
            {day}
          </span>
        ))}

        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const amount = totals[day - 1] ?? 0;
          const bucket = buckets[day - 1] ?? 0;
          const isSelected = selectedDay === day;
          return (
            <button
              key={day}
              type="button"
              aria-pressed={isSelected}
              aria-label={`Day ${day}, ${formatVnd(amount)} VND`}
              onClick={() =>
                setSelectedDay((prev) => (prev === day ? null : day))
              }
              style={bucketStyle(bucket)}
              className={cn(
                "border-border/50 text-foreground/90 focus-visible:ring-ring/40 flex aspect-square items-center justify-center rounded-md border text-[11px] font-medium tabular-nums transition focus-visible:ring-2 focus-visible:outline-none",
                isSelected && "ring-foreground/60 ring-2"
              )}
            >
              {day}
            </button>
          );
        })}

        {trailingDays.map((day, index) => (
          <span
            key={`trail-${index}`}
            aria-hidden="true"
            className="text-muted-foreground/40 pointer-events-none flex aspect-square items-center justify-center rounded-md text-[11px] tabular-nums"
          >
            {day}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-foreground/80 font-mono text-sm tabular-nums">
          {detailMessage}
        </p>

        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground text-[10px] tracking-[0.18em] uppercase">
            Less
          </span>
          {BUCKET_OPACITY.map((_, bucket) => (
            <span
              key={bucket}
              aria-hidden="true"
              style={bucketStyle(bucket)}
              className="border-border/50 h-3 w-3 rounded-sm border"
            />
          ))}
          <span className="text-muted-foreground text-[10px] tracking-[0.18em] uppercase">
            More
          </span>
        </div>
      </div>
    </div>
  );
};

export default SpendingHeatmapChart;
