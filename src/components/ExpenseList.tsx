"use client";

import Link from "next/link";

import dayjs from "@/configs/date";
import { queries } from "@/lib/queries";
import type { ExpenseListQueryParams } from "@/lib/queries/expenses";
import { formatVnd } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { ArrowRightIcon, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

import ExpenseListItem from "@/components/ExpenseListItem";
import ExpenseMonthTabs from "@/components/ExpenseMonthTabs";
import VndSymbol from "@/components/VndSymbol";

import JumpToTopButton from "./JumpToTopButton";

type ExpenseListProps = {
  selectedMonth?: string;
  searchQuery?: string;
  mode?: "full" | "recent";
  recentDays?: number;
  showMonthTabs?: boolean;
  showViewFull?: boolean;
  monthTabBasePath?: string;
};

const buildMonthOptions = (count = 12) => {
  return Array.from({ length: count }, (_, index) =>
    dayjs()
      .subtract(count - 1 - index, "month")
      .startOf("month")
  );
};

const ExpenseList = ({
  selectedMonth,
  searchQuery,
  mode,
  recentDays,
  showMonthTabs,
  showViewFull = false,
  monthTabBasePath = "/",
}: ExpenseListProps) => {
  const resolvedMode = mode ?? "full";
  const params: ExpenseListQueryParams = {
    month: selectedMonth,
    q: searchQuery,
    mode,
    recentDays,
  };
  const { data } = useQuery(queries.expenses.list(params));

  if (!data) {
    return null;
  }

  const {
    activeMonth: activeMonthKey,
    effectiveRecentDays,
    groupedRows,
    isRecent,
    rows,
    trimmedSearch,
  } = data;
  const activeMonth = dayjs(activeMonthKey, "YYYY-MM", true);
  const startOfMonth = activeMonth.startOf("month");
  const showTabs = showMonthTabs ?? !isRecent;
  const monthOptions = buildMonthOptions();
  const monthItems = monthOptions.map((month) => {
    const value = month.format("YYYY-MM");
    const isCurrent = value === dayjs().format("YYYY-MM");
    return {
      value,
      label: month.format("MMM"),
      href: isCurrent ? monthTabBasePath : `${monthTabBasePath}?month=${value}`,
      isActive: value === startOfMonth.format("YYYY-MM"),
    };
  });

  const title = trimmedSearch
    ? "Search results"
    : isRecent
      ? `Latest ${effectiveRecentDays} days`
      : "All expenses";
  const subtitle = trimmedSearch
    ? `Matching "${trimmedSearch}"`
    : isRecent
      ? "Recent entries from this month."
      : "Latest entries from your sheet.";
  const listContainerClassName =
    "no-scrollbar relative flex grow flex-col gap-6 overflow-y-auto";

  return (
    <section className="flex w-full grow flex-col gap-4 overflow-auto">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-foreground text-lg font-semibold sm:text-xl">
            {title}
          </h2>
          <p className="text-muted-foreground text-sm">{subtitle}</p>
        </div>
        <div className="flex flex-col justify-end text-right">
          <span className="text-muted-foreground text-xs">
            {rows.length} items
          </span>
          {showViewFull ? (
            <Link href="/transactions" className="w-full">
              <Button
                variant="ghost"
                className="w-full rounded-full active:scale-[0.97]"
              >
                View full
                <ArrowRightIcon />
              </Button>
            </Link>
          ) : null}
        </div>
      </div>
      {showTabs ? (
        <div className="shrink-0">
          <ExpenseMonthTabs items={monthItems} />
        </div>
      ) : null}

      <div id="expense-list" className={listContainerClassName}>
        {rows.length ? (
          groupedRows.map((group) => (
            <div key={group.key} className="space-y-3">
              <Link
                href={`/report/day/${group.key}`}
                className="group hover:border-border hover:bg-card/80 flex items-center justify-between rounded-2xl border border-transparent px-2 py-1 transition"
              >
                <div className="flex items-center gap-2">
                  <p className="text-muted-foreground group-hover:text-foreground text-xs font-semibold tracking-wide transition">
                    {group.label}
                  </p>
                  <ChevronRight className="text-muted-foreground group-hover:text-foreground h-3.5 w-3.5 transition" />
                </div>
                {/* total amount of day */}
                <div className="text-foreground text-right text-sm font-semibold">
                  -{formatVnd(group.totalAmount)} <VndSymbol />
                </div>
              </Link>
              <div className="flex flex-col gap-3">
                {group.items.map((expense) => (
                  <ExpenseListItem key={expense.id} expense={expense} />
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="text-muted-foreground py-6 text-center text-sm">
            {trimmedSearch
              ? "No expenses match your search."
              : isRecent
                ? `No expenses in the last ${effectiveRecentDays} days.`
                : "No expenses for this month yet. Add one above to see it here."}
          </div>
        )}

        {resolvedMode === "full" && (
          <JumpToTopButton
            targetId="expense-list"
            className="right-6 bottom-[100px]"
          />
        )}
      </div>
    </section>
  );
};

export default ExpenseList;
