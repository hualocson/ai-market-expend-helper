import { BudgetOverviewReport } from "@/types/budget-weekly";

export const budgetOverviewQueryKey = ["budgets", "overview"] as const;

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
