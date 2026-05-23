import dayjs from "@/configs/date";
import type { BudgetPeriod } from "@/types/budget-weekly";
import { createQueryKeys } from "@lukemorales/query-key-factory";
import { QueryClient } from "@tanstack/react-query";

type BudgetWeeklyOptionsResponse = {
  budgets?: Array<{
    id: number;
    name: string;
    period?: BudgetPeriod;
    periodStartDate?: string;
    periodEndDate?: string | null;
    amount?: number;
    spent?: number;
    remaining?: number;
  }>;
};

export type BudgetWeeklyOption = {
  id: number;
  name: string;
  period: BudgetPeriod;
  periodStartDate: string | null;
  periodEndDate: string | null;
  amount: number;
  spent: number;
  remaining: number;
};

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

      return !target.isBefore(start, "day") && !target.isAfter(end, "day");
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
      amount: Number(budget.amount ?? 0),
      spent: Number(budget.spent ?? 0),
      remaining: Number(budget.remaining ?? 0),
    }));
};

export const budgetWeeklyQueries = createQueryKeys("budgetWeekly", {
  options: (weekStart: string, targetDate?: string) => ({
    queryKey: [weekStart, targetDate],
    queryFn: () => fetchWeeklyBudgetOptions(weekStart, targetDate),
  }),
});

export const budgetWeeklyOptionsRootQueryKey = budgetWeeklyQueries.options._def;
export const budgetWeeklyOptionsQueryKey = (
  weekStart: string,
  targetDate?: string
) => budgetWeeklyQueries.options(weekStart, targetDate).queryKey;

export const invalidateBudgetWeeklyOptionsCache = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({ queryKey: budgetWeeklyOptionsRootQueryKey });
