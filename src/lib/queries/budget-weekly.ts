import { QueryClient } from "@tanstack/react-query";

type BudgetWeeklyOptionsResponse = {
  budgets?: Array<{ id: number; name: string }>;
};

export const budgetWeeklyOptionsRootQueryKey = [
  "budget-weekly-options",
] as const;
export const budgetWeeklyOptionsQueryKey = (weekStart: string) =>
  [...budgetWeeklyOptionsRootQueryKey, weekStart] as const;

export const invalidateBudgetWeeklyOptionsCache = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({ queryKey: budgetWeeklyOptionsRootQueryKey });

export const fetchWeeklyBudgetOptions = async (
  weekStart: string
): Promise<Array<{ id: number; name: string }>> => {
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

  return data.budgets.map((budget) => ({
    id: Number(budget.id),
    name: String(budget.name),
  }));
};
