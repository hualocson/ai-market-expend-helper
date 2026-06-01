import { getQueryClient } from "@/lib/get-query-client";
import { queries } from "@/lib/queries";
import { getDashboardMonthlySummary } from "@/lib/services/dashboard";
import { getExpenseList } from "@/lib/services/expenses";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";

import SpendingDashboardHeader from "@/components/SpendingDashboardHeader";
import ExpenseSearch from "@/components/search/ExpenseSearch";

export default function Home() {
  const expenseListParams = { limit: 30 };
  const dashboardSummaryOptions = {
    queryKey: queries.dashboard.monthlySummary().queryKey,
    queryFn: () => getDashboardMonthlySummary(),
  };
  const expenseListQuery = queries.expenses.list(expenseListParams);
  const expenseListOptions = {
    queryKey: expenseListQuery.queryKey,
    queryFn: ({ pageParam }: { pageParam: unknown }) =>
      getExpenseList({
        ...expenseListParams,
        offset: typeof pageParam === "number" ? pageParam : 0,
      }),
    initialPageParam: 0,
  };
  const queryClient = getQueryClient();

  void queryClient.prefetchQuery(dashboardSummaryOptions);
  void queryClient.prefetchInfiniteQuery(expenseListOptions);

  return (
    <div className="standalone:pb-[calc(env(safe-area-inset-bottom))] mx-auto flex min-h-svh max-w-md flex-col items-stretch px-4 pt-6 sm:px-6 sm:pt-8">
      <div className="flex flex-col items-stretch gap-6">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <SpendingDashboardHeader />

          <ExpenseSearch />
        </HydrationBoundary>
      </div>
    </div>
  );
}
