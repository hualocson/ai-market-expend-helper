import { QueryClient } from "@tanstack/react-query";
import dayjs from "@/configs/date";
import type { BudgetPeriod } from "@/types/budget-weekly";

type BudgetWeeklyOptionsResponse = {
  budgets?: Array<{
    id: number;
    name: string;
    period?: BudgetPeriod;
    periodStartDate?: string;
    periodEndDate?: string | null;
  }>;
};

export type BudgetWeeklyOption = {
  id: number;
  name: string;
  period: BudgetPeriod;
  periodStartDate: string | null;
  periodEndDate: string | null;
};

export const budgetWeeklyOptionsRootQueryKey = [
  "budget-weekly-options",
] as const;
export const budgetWeeklyOptionsQueryKey = (weekStart: string) =>
  [...budgetWeeklyOptionsRootQueryKey, weekStart] as const;

export const invalidateBudgetWeeklyOptionsCache = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({ queryKey: budgetWeeklyOptionsRootQueryKey });

export const fetchWeeklyBudgetOptions = async (
  weekStart: string,
  targetDate?: string
): Promise<BudgetWeeklyOption[]> => {
  const response = await fetch(`/api/budget-weekly?weekStart=${weekStart}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to load budgets");
  }

  const data = (await response.json()) as BudgetWeeklyOptionsResponse;
  if (!Array.isArray(data.budgets)) {
    return [];
  }

  const parsedTargetDate =
    typeof targetDate === "string" && targetDate.length
      ? dayjs(targetDate, "YYYY-MM-DD", true)
      : null;
  const shouldFilterByDate = Boolean(parsedTargetDate?.isValid());

  return data.budgets
    .filter((budget) => {
      const target = parsedTargetDate;
      if (!shouldFilterByDate || !target) {
        return true;
      }

      const start = budget.periodStartDate
        ? dayjs(budget.periodStartDate, "YYYY-MM-DD", true)
        : null;
      if (!start?.isValid()) {
        return true;
      }

      const end = budget.periodEndDate
        ? dayjs(budget.periodEndDate, "YYYY-MM-DD", true)
        : start;
      if (!end.isValid()) {
        return true;
      }

      return (
        !target.isBefore(start, "day") &&
        !target.isAfter(end, "day")
      );
    })
    .map((budget) => ({
      id: Number(budget.id),
      name: String(budget.name),
      period:
        budget.period === "week" ||
        budget.period === "month" ||
        budget.period === "custom"
          ? budget.period
          : "custom",
      periodStartDate: budget.periodStartDate
        ? String(budget.periodStartDate)
        : null,
      periodEndDate: budget.periodEndDate ? String(budget.periodEndDate) : null,
    }));
};
