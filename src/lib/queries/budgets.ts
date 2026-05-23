import { getTransferCandidates } from "@/app/actions/budget-weekly-actions";
import {
  BudgetListItem,
  BudgetOverviewReport,
  BudgetTransactionsResponse,
} from "@/types/budget-weekly";
import { createQueryKeys } from "@lukemorales/query-key-factory";

export const fetchBudgetOverview = async (): Promise<BudgetOverviewReport> => {
  const response = await fetch("/api/budgets", {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
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

  const response = await fetch(
    `/api/budgets/${budgetId}/transactions?${query}`,
    {
      method: "GET",
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(payload?.error ?? "Failed to fetch budget transactions");
  }

  return (await response.json()) as BudgetTransactionsResponse;
};

const baseBudgetQueries = createQueryKeys("budgets", {
  overview: {
    queryKey: null,
    queryFn: fetchBudgetOverview,
  },
  transactions: (
    budgetId: number,
    { limit = 20 }: { limit?: number } = {}
  ) => ({
    queryKey: [budgetId],
    queryFn: ({ pageParam }) =>
      fetchBudgetTransactions(budgetId, {
        limit,
        offset: typeof pageParam === "number" ? pageParam : 0,
      }),
  }),
  transferCandidates: (destinationId: number) => ({
    queryKey: [destinationId],
    queryFn: (): Promise<BudgetListItem[]> =>
      getTransferCandidates({ destinationBudgetId: destinationId }),
  }),
});

export const budgetQueries = baseBudgetQueries;

export const budgetOverviewQueryKey = budgetQueries.overview.queryKey;
export const budgetTransactionsQueryKey = (budgetId: number) =>
  budgetQueries.transactions(budgetId).queryKey;
// Prefix shared by every transfer-candidates query. Use this with
// invalidateQueries when a mutation (create/update/delete/transfer) might
// affect any picker's candidate list, since TanStack Query matches prefix.
export const budgetTransferCandidatesPrefixQueryKey =
  budgetQueries.transferCandidates._def;
export const budgetTransferCandidatesQueryKey = (destinationId: number) =>
  budgetQueries.transferCandidates(destinationId).queryKey;
