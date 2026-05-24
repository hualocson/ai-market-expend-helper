import { getQueryClient } from "@/lib/get-query-client";
import { queries } from "@/lib/queries";
import { getDashboardMonthlySummary } from "@/lib/services/dashboard";
import { getExpenseList } from "@/lib/services/expenses";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";

import ExpenseList from "@/components/ExpenseList";
import JumpToTopButton from "@/components/JumpToTopButton";
import SpendingDashboardHeader from "@/components/SpendingDashboardHeader";

export default async function Home() {
  const expenseListParams = { mode: "recent" as const, recentDays: 3 };
  const queryClient = getQueryClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queries.dashboard.monthlySummary().queryKey,
      queryFn: () => getDashboardMonthlySummary(),
    }),
    queryClient.prefetchQuery({
      queryKey: queries.expenses.list(expenseListParams).queryKey,
      queryFn: () => getExpenseList(expenseListParams),
    }),
  ]);

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col items-stretch px-4 pt-6 pb-28 sm:px-6 sm:pt-8">
      <div className="flex flex-col items-stretch gap-6">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <SpendingDashboardHeader />

          <ExpenseList mode="recent" recentDays={3} showViewFull />
        </HydrationBoundary>
      </div>

      <JumpToTopButton />
    </div>
  );
}
