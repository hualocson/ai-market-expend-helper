import { getQueryClient } from "@/lib/get-query-client";
import { queries } from "@/lib/queries";
import { getDashboardMonthlySummary } from "@/lib/services/dashboard";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";

import ExpenseList from "@/components/ExpenseList";
import SpendingDashboardHeader from "@/components/SpendingDashboardHeader";

export default async function Home() {
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery({
    queryKey: queries.dashboard.monthlySummary().queryKey,
    queryFn: () => getDashboardMonthlySummary(),
  });

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col items-stretch px-4 pt-6 pb-28 sm:px-6 sm:pt-8">
      <div className="flex flex-col items-stretch gap-6">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <SpendingDashboardHeader />

          <ExpenseList />
        </HydrationBoundary>
      </div>
    </div>
  );
}
