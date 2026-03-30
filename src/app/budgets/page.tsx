import dayjs from "@/configs/date";
import { getBudgetOverview } from "@/db/budget-queries";
import { getQueryClient } from "@/lib/get-query-client";
import { budgetOverviewQueryKey } from "@/lib/queries/budgets";
import { getWeekRange } from "@/lib/week";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";

import BudgetWeeklyBudgetsClient from "@/components/BudgetWeeklyBudgetsClient";
import PageEnterAnimation, {
  PageEnterSection,
} from "@/components/PageEnterAnimation";

export default async function BudgetsPage() {
  const currentWeekStart =
    getWeekRange(dayjs()).weekStartDate.format("YYYY-MM-DD");
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery({
    queryKey: budgetOverviewQueryKey,
    queryFn: () => getBudgetOverview(),
  });

  return (
    <PageEnterAnimation className="relative mx-auto flex max-w-md flex-col px-4 sm:px-6">
      <PageEnterSection>
        <HydrationBoundary state={dehydrate(queryClient)}>
          <BudgetWeeklyBudgetsClient weekStartDate={currentWeekStart} />
        </HydrationBoundary>
      </PageEnterSection>
    </PageEnterAnimation>
  );
}
