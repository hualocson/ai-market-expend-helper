import { getQueryClient } from "@/lib/get-query-client";
import { queries } from "@/lib/queries";
import { getDashboardMonthlySummary } from "@/lib/services/dashboard";
import { getExpenseList } from "@/lib/services/expenses";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";

import ExpenseList from "@/components/ExpenseList";
import InstantAppShell from "@/components/InstantAppShell";
import InstantShellBridge from "@/components/InstantShellBridge";
import SpendingDashboardHeader from "@/components/SpendingDashboardHeader";

export default async function Home() {
  const expenseListParams = { limit: 30 };
  const expenseListQuery = queries.expenses.list(expenseListParams);
  const queryClient = getQueryClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queries.dashboard.monthlySummary().queryKey,
      queryFn: () => getDashboardMonthlySummary(),
    }),
    queryClient.prefetchInfiniteQuery({
      queryKey: expenseListQuery.queryKey,
      queryFn: ({ pageParam }) =>
        getExpenseList({
          ...expenseListParams,
          offset: typeof pageParam === "number" ? pageParam : 0,
        }),
      initialPageParam: 0,
    }),
  ]);

  return (
    <>
      <InstantAppShell />
      <InstantShellBridge />
      <div className="mx-auto flex min-h-svh max-w-md flex-col items-stretch px-4 pt-6 pb-28 sm:px-6 sm:pt-8">
        <div className="flex flex-col items-stretch gap-6">
          <HydrationBoundary state={dehydrate(queryClient)}>
            <SpendingDashboardHeader />

            <ExpenseList />
          </HydrationBoundary>
        </div>
      </div>
    </>
  );
}
