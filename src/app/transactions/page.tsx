import Link from "next/link";

import { ArrowLeftIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

import ExpenseList from "@/components/ExpenseList";
import TransactionsSearch from "@/components/TransactionsSearch";
import dayjs from "@/configs/date";

interface TransactionsPageProps {
  searchParams: Promise<{
    month?: string;
    q?: string;
  }>;
}

export default async function TransactionsPage({
  searchParams,
}: TransactionsPageProps) {
  const { month, q } = await searchParams;
  const selectedMonth = typeof month === "string" ? month : undefined;
  const searchQuery = typeof q === "string" ? q : undefined;

  return (
    <div className="relative mx-auto flex h-[calc(100svh-100px-env(safe-area-inset-bottom)-12px)] max-w-lg flex-col gap-3 px-4 pt-6 sm:px-6">
      <div className="flex shrink-0 items-center gap-2">
        <Link href="/">
          <Button variant="ghost" size="icon" className="active:scale-[0.97]">
            <ArrowLeftIcon />
          </Button>
        </Link>
        <h1 className="text-foreground text-lg font-semibold sm:text-xl">
          Transactions
        </h1>
       <span className="text-muted-foreground text-sm">
            {selectedMonth ? dayjs(selectedMonth).format("MMMM YYYY") : dayjs().format("MMMM YYYY")}
          </span>
      </div>
      <TransactionsSearch />
      <ExpenseList
        selectedMonth={selectedMonth}
        searchQuery={searchQuery}
        monthTabBasePath="/transactions"
      />
    </div>
  );
}
