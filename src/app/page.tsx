import { Suspense } from "react";

import ExpenseList from "@/components/ExpenseList";
import PageEnterAnimation, {
  PageEnterSection,
} from "@/components/PageEnterAnimation";
import ExpensePrefillChips from "@/components/ExpensePrefillChips";
import JumpToTopButton from "@/components/JumpToTopButton";
import SpendingDashboardHeader from "@/components/SpendingDashboardHeader";

interface HomeProps {
  searchParams: Promise<{
    month?: string;
  }>;
}

export default async function Home({ searchParams }: HomeProps) {
  const { month } = await searchParams;
  const selectedMonth = typeof month === "string" ? month : undefined;

  return (
    <PageEnterAnimation className="mx-auto flex min-h-svh max-w-md flex-col items-stretch px-4 pt-6 pb-28 sm:px-6 sm:pt-8">
      <div className="flex flex-col items-stretch gap-6">
        <PageEnterSection>
          <Suspense
            fallback={
              <div className="bg-surface-2/70 h-24 w-full animate-pulse rounded-[32px]" />
            }
          >
            <SpendingDashboardHeader selectedMonth={selectedMonth} />
          </Suspense>
        </PageEnterSection>

        <PageEnterSection>
          <Suspense
            fallback={
              <div className="bg-surface-2/70 h-16 w-full animate-pulse rounded-[28px]" />
            }
          >
            <ExpensePrefillChips />
          </Suspense>
        </PageEnterSection>

        <PageEnterSection>
          <Suspense
            fallback={
              <div className="bg-surface-2/70 h-24 w-full animate-pulse rounded-[28px]" />
            }
          >
            <ExpenseList
              selectedMonth={selectedMonth}
              mode="recent"
              recentDays={3}
              showViewFull
            />
          </Suspense>
        </PageEnterSection>
      </div>

      <PageEnterSection>
        <JumpToTopButton />
      </PageEnterSection>
    </PageEnterAnimation>
  );
}
