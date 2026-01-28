import { Suspense } from "react";

import ExpenseList from "@/components/ExpenseList";
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
    <div className="relative mx-auto flex min-h-svh max-w-lg flex-col items-stretch gap-6 px-4 pt-6 pb-16 sm:px-6">
      <Suspense
        fallback={
          <div className="bg-muted/30 h-24 w-full animate-pulse rounded-3xl" />
        }
      >
        <SpendingDashboardHeader selectedMonth={selectedMonth} />
      </Suspense>

      <Suspense
        fallback={
          <div className="bg-muted/30 h-16 w-full animate-pulse rounded-3xl" />
        }
      >
        <ExpensePrefillChips />
      </Suspense>

      <Suspense
        fallback={
          <div className="bg-muted/30 h-24 w-full animate-pulse rounded-3xl" />
        }
      >
        <ExpenseList
          selectedMonth={selectedMonth}
          mode="recent"
          recentDays={3}
          showViewFull
        />
      </Suspense>

      <JumpToTopButton />
    </div>
  );
}
