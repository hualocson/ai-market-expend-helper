import ExpenseList from "@/components/ExpenseList";
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
    <div className="relative mx-auto flex max-w-lg flex-col gap-6 px-4 pt-6 pb-16 sm:px-6">
      <SpendingDashboardHeader selectedMonth={selectedMonth} />

      <ExpenseList
        selectedMonth={selectedMonth}
        mode="recent"
        recentDays={3}
        showViewFull
      />

      <JumpToTopButton />
    </div>
  );
}
