import AIEntryCard from "@/components/AIEntryCard";
import ExpenseList from "@/components/ExpenseList";
import ExpensePrefillChips from "@/components/ExpensePrefillChips";
import JumpToTopButton from "@/components/JumpToTopButton";
import SpendingDashboardHeader from "@/components/SpendingDashboardHeader";

export default function Home() {
  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col items-stretch px-4 pt-6 pb-28 sm:px-6 sm:pt-8">
      <div className="flex flex-col items-stretch gap-6">
        <SpendingDashboardHeader />

        <AIEntryCard />

        <ExpensePrefillChips />

        <ExpenseList mode="recent" recentDays={3} showViewFull />
      </div>

      <JumpToTopButton />
    </div>
  );
}
