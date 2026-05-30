import dayjs from "@/configs/date";
import type { BudgetWeeklyOption } from "@/lib/queries/budget-weekly";

export type TBudgetOption = BudgetWeeklyOption;
export type TBudgetOptionGroupKey = "week" | "month" | "custom";

export type TBudgetOptionGroups = Record<
  TBudgetOptionGroupKey,
  TBudgetOption[]
>;

export const budgetGroupLabels: Record<TBudgetOptionGroupKey, string> = {
  week: "Weekly budgets",
  month: "Monthly budgets",
  custom: "Other budgets",
};

export const budgetGroupEmptyLabel: Record<TBudgetOptionGroupKey, string> = {
  week: "No weekly budgets for this date.",
  month: "No monthly budgets for this date.",
  custom: "No additional budgets for this date.",
};

const fallbackBudgetPeriodLabel: Record<TBudgetOptionGroupKey, string> = {
  week: "Week budget",
  month: "Month budget",
  custom: "Custom budget",
};

export const parseBudgetDate = (value?: string | null) => {
  if (!value) {
    return null;
  }
  const parsed = dayjs(value, "YYYY-MM-DD", true);
  return parsed.isValid() ? parsed : null;
};

export const formatBudgetRange = (budget: TBudgetOption) => {
  const start = parseBudgetDate(budget.periodStartDate);
  if (!start) {
    return fallbackBudgetPeriodLabel[budget.period];
  }
  const end = parseBudgetDate(budget.periodEndDate) ?? start;
  if (start.isSame(end, "day")) {
    return start.format("DD MMM YYYY");
  }
  if (start.isSame(end, "year")) {
    return `${start.format("DD MMM")} - ${end.format("DD MMM YYYY")}`;
  }
  return `${start.format("DD MMM YYYY")} - ${end.format("DD MMM YYYY")}`;
};

export const sortBudgetOptions = (items: TBudgetOption[]) =>
  [...items].sort((left, right) => {
    const leftDate = parseBudgetDate(left.periodStartDate);
    const rightDate = parseBudgetDate(right.periodStartDate);
    if (leftDate && rightDate && !leftDate.isSame(rightDate, "day")) {
      return rightDate.valueOf() - leftDate.valueOf();
    }
    if (leftDate && !rightDate) {
      return -1;
    }
    if (!leftDate && rightDate) {
      return 1;
    }
    return left.name.localeCompare(right.name, undefined, {
      sensitivity: "base",
    });
  });

export const groupBudgetOptions = (
  items: TBudgetOption[]
): TBudgetOptionGroups => {
  const groups: TBudgetOptionGroups = { week: [], month: [], custom: [] };
  items.forEach((budget) => {
    if (budget.period === "week" || budget.period === "month") {
      groups[budget.period].push(budget);
      return;
    }
    groups.custom.push(budget);
  });
  return {
    week: sortBudgetOptions(groups.week),
    month: sortBudgetOptions(groups.month),
    custom: sortBudgetOptions(groups.custom),
  };
};

export const pickDefaultBudget = (groups: TBudgetOptionGroups) =>
  groups.week[0] ?? groups.month[0] ?? groups.custom[0] ?? null;

export const hasAnyBudgetOption = (groups: TBudgetOptionGroups) =>
  groups.week.length > 0 || groups.month.length > 0 || groups.custom.length > 0;

export const isDateWithinBudgetPeriod = (
  budget: TBudgetOption,
  isoDate: string
): boolean => {
  const target = dayjs(isoDate, "YYYY-MM-DD", true);
  if (!target.isValid()) {
    return false;
  }
  const start = parseBudgetDate(budget.periodStartDate);
  if (!start) {
    return true;
  }
  const end = parseBudgetDate(budget.periodEndDate) ?? start;
  return !target.isBefore(start, "day") && !target.isAfter(end, "day");
};

export const isExpenseDateSuspicious = (
  isoDate: string,
  todayIso: string
): boolean => {
  const target = dayjs(isoDate, "YYYY-MM-DD", true);
  const today = dayjs(todayIso, "YYYY-MM-DD", true);
  if (!target.isValid() || !today.isValid()) {
    return false;
  }
  return (
    target.isBefore(today.subtract(1, "month"), "day") ||
    target.isAfter(today.add(1, "month"), "day")
  );
};
