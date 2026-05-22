"use client";

import { useEffect, useMemo, useState } from "react";

import dayjs from "@/configs/date";
import { getQuantileBuckets } from "@/lib/heatmap-buckets";
import { cn, formatVnd } from "@/lib/utils";

import VndSymbol from "./VndSymbol";

type SpendingHeatmapChartProps = {
  totals: number[];
  activeMonth: string;
};

const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const BUCKET_OPACITY = [0, 10, 22, 38, 58] as const;

type BucketIndex = 0 | 1 | 2 | 3 | 4;

const bucketStyle = (bucket: BucketIndex): React.CSSProperties => ({
  backgroundColor:
    bucket === 0
      ? "color-mix(in srgb, var(--muted-foreground) 8%, transparent)"
      : `color-mix(in srgb, var(--accent) ${BUCKET_OPACITY[bucket]}%, transparent)`,
});

const clampBucket = (value: number | undefined): BucketIndex => {
  if (value === 1 || value === 2 || value === 3 || value === 4) {
    return value;
  }
  return 0;
};

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
  const monthStart = parsed.isValid()
    ? parsed.startOf("month")
    : dayjs().startOf("month");
  const daysInMonth = monthStart.daysInMonth();
  const monthLabel = monthStart.format("MMMM YYYY");
  const leadingPad = toMondayIndex(monthStart.day());
  const trailingPad = (7 - ((leadingPad + daysInMonth) % 7)) % 7;

  const buckets = useMemo(() => getQuantileBuckets(totals), [totals]);
  const totalSpend = useMemo(
    () => totals.reduce((sum, t) => sum + t, 0),
    [totals]
  );

  const leadingSlots = useMemo(
    () => Array.from({ length: leadingPad }),
    [leadingPad]
  );

  const trailingSlots = useMemo(
    () => Array.from({ length: trailingPad }),
    [trailingPad]
  );
  const selectedLabel =
    selectedDay === null ? null : monthStart.date(selectedDay).format("MMM D");

  const detailMessage = (() => {
    if (totalSpend === 0) {
      return `No spending in ${monthLabel}`;
    }
    if (selectedDay === null) {
      return `${monthStart.format("MMM")} spending by day`;
    }
    return null;
  })();

  return (
    <div className="flex flex-col gap-3">
      <div
        role="group"
        aria-label={`Spending heatmap for ${monthLabel}`}
        className="grid w-full grid-cols-7 gap-1"
      >
        {WEEKDAY_LABELS.map((label, index) => (
          <span
            key={`${label}-${index}`}
            className="text-muted-foreground/55 text-center text-[9px] font-medium tabular-nums"
          >
            {label}
          </span>
        ))}

        {leadingSlots.map((_, index) => (
          <span
            key={`lead-${index}`}
            aria-hidden="true"
            className="pointer-events-none aspect-square min-h-8 rounded-lg"
          />
        ))}

        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const amount = totals[day - 1] ?? 0;
          const bucket = clampBucket(buckets[day - 1]);
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
              className={cn(
                "focus-visible:ring-ring/40 flex aspect-square min-h-8 items-center justify-center rounded-lg transition-[background-color,transform] duration-200 ease-out focus-visible:ring-2 focus-visible:outline-none active:scale-[0.96]",
                isSelected && "bg-accent/5"
              )}
            >
              <span
                aria-hidden="true"
                style={bucketStyle(bucket)}
                className={cn(
                  "border-foreground/10 flex h-10 w-10 items-center justify-center rounded-md border text-xs font-medium tabular-nums transition-[background-color,border-color,outline-color,transform] duration-200 ease-out",
                  bucket === 0
                    ? "text-muted-foreground/70"
                    : "text-foreground/90",
                  isSelected &&
                    "border-accent/55 outline-accent/50 scale-105 outline outline-1 outline-offset-2"
                )}
              >
                {day}
              </span>
            </button>
          );
        })}

        {trailingSlots.map((_, index) => (
          <span
            key={`trail-${index}`}
            aria-hidden="true"
            className="pointer-events-none aspect-square min-h-8 rounded-lg"
          />
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="text-muted-foreground font-mono text-xs tabular-nums">
          {detailMessage ?? (
            <>
              {selectedLabel} ·{" "}
              {formatVnd(totals[(selectedDay ?? 1) - 1] ?? 0)} <VndSymbol />
            </>
          )}
        </p>

        <div className="flex shrink-0 items-center gap-1" aria-hidden="true">
          {BUCKET_OPACITY.map((_, bucket) => (
            <span
              key={bucket}
              style={bucketStyle(bucket as BucketIndex)}
              className="h-1.5 w-3 rounded-full"
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default SpendingHeatmapChart;
