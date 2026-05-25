import {
  BudgetListItem,
  BudgetOverviewReport,
  BudgetTransactionsResponse,
} from "@/types/budget-weekly";
import { createQueryKeys } from "@lukemorales/query-key-factory";

import { fetchJson } from "./http";

export const fetchBudgetOverview = async (): Promise<BudgetOverviewReport> =>
  fetchJson<BudgetOverviewReport>("/api/budgets", {
    method: "GET",
    cache: "no-store",
  });

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

  return fetchJson<BudgetTransactionsResponse>(
    `/api/budgets/${budgetId}/transactions?${query}`,
    {
      method: "GET",
      cache: "no-store",
    }
  );
};

export const fetchBudgetTransferCandidates = async (
  destinationId: number
): Promise<BudgetListItem[]> =>
  fetchJson<BudgetListItem[]>(
    `/api/budgets/transfer-candidates?destinationId=${destinationId}`,
    {
      method: "GET",
      cache: "no-store",
    }
  );

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
      fetchBudgetTransferCandidates(destinationId),
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
