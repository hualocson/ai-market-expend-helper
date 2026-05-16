import dayjs from "@/configs/date";
import { getWeekRange } from "@/lib/week";
import type { BudgetListItem } from "@/types/budget-weekly";

export type GroupKey =
  | { kind: "this-week" }
  | { kind: "last-week" }
  | { kind: "this-month" }
  | { kind: "last-month" }
  | { kind: "earlier" };

export type CandidateGroup = {
  key: GroupKey;
  label: string;
  candidates: BudgetListItem[];
};

const GROUP_ORDER: GroupKey["kind"][] = [
  "this-week",
  "last-week",
  "this-month",
  "last-month",
  "earlier",
];

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
});
const DAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const formatWeekRange = (
  prefix: "This week" | "Last week",
  weekStart: Date,
  weekEnd: Date
) =>
  `${prefix} · ${DAY_FORMATTER.format(weekStart)} – ${DAY_FORMATTER.format(weekEnd)}`;

const formatMonthLabel = (prefix: "This month" | "Last month", month: Date) =>
  `${prefix} · ${MONTH_FORMATTER.format(month)} ${month.getFullYear()}`;

const classify = (
  candidate: BudgetListItem,
  ranges: {
    thisWeekStart: dayjs.Dayjs;
    thisWeekEnd: dayjs.Dayjs;
    lastWeekStart: dayjs.Dayjs;
    lastWeekEnd: dayjs.Dayjs;
    thisMonthStart: dayjs.Dayjs;
    thisMonthEnd: dayjs.Dayjs;
    lastMonthStart: dayjs.Dayjs;
    lastMonthEnd: dayjs.Dayjs;
  }
): GroupKey["kind"] => {
  const start = dayjs(candidate.periodStartDate);

  if (candidate.period === "week") {
    if (
      !start.isBefore(ranges.thisWeekStart) &&
      !start.isAfter(ranges.thisWeekEnd)
    ) {
      return "this-week";
    }
    if (
      !start.isBefore(ranges.lastWeekStart) &&
      !start.isAfter(ranges.lastWeekEnd)
    ) {
      return "last-week";
    }
    return "earlier";
  }

  if (candidate.period === "month") {
    if (
      !start.isBefore(ranges.thisMonthStart) &&
      !start.isAfter(ranges.thisMonthEnd)
    ) {
      return "this-month";
    }
    if (
      !start.isBefore(ranges.lastMonthStart) &&
      !start.isAfter(ranges.lastMonthEnd)
    ) {
      return "last-month";
    }
    return "earlier";
  }

  return "earlier";
};

const labelFor = (
  kind: GroupKey["kind"],
  ranges: {
    thisWeekStart: dayjs.Dayjs;
    thisWeekEnd: dayjs.Dayjs;
    lastWeekStart: dayjs.Dayjs;
    lastWeekEnd: dayjs.Dayjs;
    thisMonthStart: dayjs.Dayjs;
    lastMonthStart: dayjs.Dayjs;
  }
): string => {
  switch (kind) {
    case "this-week":
      return formatWeekRange(
        "This week",
        ranges.thisWeekStart.toDate(),
        ranges.thisWeekEnd.toDate()
      );
    case "last-week":
      return formatWeekRange(
        "Last week",
        ranges.lastWeekStart.toDate(),
        ranges.lastWeekEnd.toDate()
      );
    case "this-month":
      return formatMonthLabel("This month", ranges.thisMonthStart.toDate());
    case "last-month":
      return formatMonthLabel("Last month", ranges.lastMonthStart.toDate());
    case "earlier":
      return "Earlier";
  }
};

const sortWithinGroup = (a: BudgetListItem, b: BudgetListItem) => {
  const aPositive = a.remaining > 0;
  const bPositive = b.remaining > 0;
  if (aPositive !== bPositive) {
    return aPositive ? -1 : 1;
  }
  return b.remaining - a.remaining;
};

export const groupTransferCandidates = (
  candidates: BudgetListItem[],
  now: Date
): CandidateGroup[] => {
  const { weekStartDate, weekEndDate } = getWeekRange(now);
  const lastWeekStart = weekStartDate.subtract(7, "day");
  const lastWeekEnd = weekEndDate.subtract(7, "day");
  const thisMonthStart = dayjs(now).startOf("month");
  const thisMonthEnd = dayjs(now).endOf("month").startOf("day");
  const lastMonthStart = thisMonthStart.subtract(1, "month");
  const lastMonthEnd = thisMonthStart.subtract(1, "day").startOf("day");

  const ranges = {
    thisWeekStart: weekStartDate,
    thisWeekEnd: weekEndDate,
    lastWeekStart,
    lastWeekEnd,
    thisMonthStart,
    thisMonthEnd,
    lastMonthStart,
    lastMonthEnd,
  };

  const buckets = new Map<GroupKey["kind"], BudgetListItem[]>();
  for (const candidate of candidates) {
    const kind = classify(candidate, ranges);
    const bucket = buckets.get(kind) ?? [];
    bucket.push(candidate);
    buckets.set(kind, bucket);
  }

  return GROUP_ORDER.filter((kind) => buckets.has(kind)).map((kind) => ({
    key: { kind } as GroupKey,
    label: labelFor(kind, ranges),
    candidates: (buckets.get(kind) ?? []).slice().sort(sortWithinGroup),
  }));
};
