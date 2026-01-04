import SiriOrb from "@/components/ui/siri-orb";

import ExpenseEntryDrawer from "@/components/ExpenseEntryDrawer";
import ExpenseList from "@/components/ExpenseList";
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
    <div className="relative flex flex-col gap-6 bg-[radial-gradient(circle_at_top,#1b1d25,#151822_50%,#0e1118_100%)] px-4 pt-10 pb-4 sm:px-6">
      <div className="pointer-events-none absolute -top-32 right-0 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(122,92,255,0.18),transparent_60%)] blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-[-120px] h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle,rgba(28,210,180,0.18),transparent_60%)] blur-3xl" />
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex shrink-0">
              <SiriOrb size="48px" />
            </div>
            <h1 className="text-3xl leading-tight font-semibold text-slate-100 sm:text-4xl">
              Track expenses
            </h1>
          </div>
        </div>
        <ExpenseEntryDrawer />
      </header>

      <SpendingDashboardHeader selectedMonth={selectedMonth} />

      <ExpenseList selectedMonth={selectedMonth} />
    </div>
  );
}
