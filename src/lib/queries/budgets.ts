import {
  BudgetOverviewReport,
  BudgetTransactionsResponse,
} from "@/types/budget-weekly";

export const budgetOverviewQueryKey = ["budgets", "overview"] as const;
export const budgetTransactionsQueryKey = (budgetId: number) =>
  ["budgets", "transactions", budgetId] as const;

export const fetchBudgetOverview = async (): Promise<BudgetOverviewReport> => {
  const response = await fetch("/api/budgets", {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(payload?.error ?? "Failed to fetch budgets");
  }

  return (await response.json()) as BudgetOverviewReport;
};

export const fetchBudgetTransactions = async (
  budgetId: number,
  {
    limit = 20,
    offset = 0,
  }: {
    limit?: number;
    offset?: number;
  } = {}
): Promise<BudgetTransactionsResponse> => {
  const query = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });

  const response = await fetch(`/api/budgets/${budgetId}/transactions?${query}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(payload?.error ?? "Failed to fetch budget transactions");
  }

  return (await response.json()) as BudgetTransactionsResponse;
};
