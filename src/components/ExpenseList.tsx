"use client";

import { useCallback, useEffect, useState } from "react";

import dayjs from "@/configs/date";
import { Category } from "@/enums";
import { queries } from "@/lib/queries";
import type { ExpenseListQueryParams } from "@/lib/queries/expenses";
import type {
  ExpenseListGroup,
  ExpenseListItem as ExpenseListItemData,
  ExpenseListResult,
} from "@/lib/services/expenses";
import { syncRepository } from "@/lib/sync/core/repository";
import { EXPENSE_SYNC_ENTITY } from "@/lib/sync/expenses/types";
import { cn, formatVnd } from "@/lib/utils";
import type { InfiniteData, QueryFunction } from "@tanstack/react-query";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { motion as m } from "motion/react";

import ExpenseEditSheetHost from "@/components/ExpenseEditSheetHost";
import ExpenseListItem from "@/components/ExpenseListItem";
import VndSymbol from "@/components/VndSymbol";

import JumpToTopButton from "./JumpToTopButton";

type ExpenseListProps = {
  selectedMonth?: string;
  searchQuery?: string;
  mode?: "full" | "recent";
  recentDays?: number;
  pageSize?: number;
  dateFrom?: string;
  dateTo?: string;
  categories?: Category[];
  budgetIds?: number[];
  hasBudget?: boolean;
  amountMin?: number;
  amountMax?: number;
  presentation?: "default" | "search-drawer";
};

const groupRowsByDate = (rows: ExpenseListItemData[]): ExpenseListGroup[] => {
  return rows.reduce<ExpenseListGroup[]>((groups, expense) => {
    const parsedDate = dayjs(expense.date);
    const key = parsedDate.isValid()
      ? parsedDate.format("YYYY-MM-DD")
      : String(expense.date);
    const label = parsedDate.isValid()
      ? parsedDate.format("dddd, DD/MM/YYYY")
      : String(expense.date);
    const lastGroup = groups[groups.length - 1];

    if (!lastGroup || lastGroup.key !== key) {
      groups.push({
        key,
        label,
        items: [expense],
        totalAmount: expense.amount,
      });
      return groups;
    }

    lastGroup.items.push(expense);
    lastGroup.totalAmount += expense.amount;
    return groups;
  }, []);
};

const dedupeRowsById = (rows: ExpenseListItemData[]): ExpenseListItemData[] => {
  const seenIds = new Set<number>();

  return rows.filter((expense) => {
    if (seenIds.has(expense.id)) {
      return false;
    }

    seenIds.add(expense.id);
    return true;
  });
};

const ExpenseList = ({
  selectedMonth,
  searchQuery,
  mode,
  recentDays,
  pageSize = 30,
  dateFrom,
  dateTo,
  categories,
  budgetIds,
  hasBudget,
  amountMin,
  amountMax,
  presentation = "default",
}: ExpenseListProps) => {
  const resolvedMode = mode ?? "full";
  const params: ExpenseListQueryParams = {
    month: selectedMonth,
    q: searchQuery,
    mode,
    recentDays,
    limit: pageSize,
    dateFrom,
    dateTo,
    categories,
    budgetIds,
    hasBudget,
    amountMin,
    amountMax,
  };
  const expenseListQuery = queries.expenses.list(params);
  const [editingExpense, setEditingExpense] =
    useState<ExpenseListItemData | null>(null);
  const [expenseSyncCursorReady, setExpenseSyncCursorReady] = useState(false);
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useInfiniteQuery<
    ExpenseListResult,
    Error,
    InfiniteData<ExpenseListResult, number>,
    ReturnType<typeof queries.expenses.list>["queryKey"],
    number
  >({
    queryKey: expenseListQuery.queryKey,
    queryFn: expenseListQuery.queryFn as QueryFunction<
      ExpenseListResult,
      typeof expenseListQuery.queryKey,
      number
    >,
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore
        ? (lastPage.pagination.nextOffset ??
          lastPage.pagination.offset + lastPage.pagination.limit)
        : undefined,
  });

  useEffect(() => {
    let active = true;

    void syncRepository.metadata
      .getCursor(EXPENSE_SYNC_ENTITY)
      .then((cursor) => {
        if (active) {
          setExpenseSyncCursorReady(Boolean(cursor));
        }
      })
      .catch(() => {
        if (active) {
          setExpenseSyncCursorReady(false);
        }
      });

    return () => {
      active = false;
    };
  }, [data]);

  const isLoadMoreGated = Boolean(
    hasNextPage &&
    !expenseSyncCursorReady &&
    !isFetchingNextPage &&
    !isFetchNextPageError
  );

  const handleEditExpense = useCallback((expense: ExpenseListItemData) => {
    setEditingExpense(expense);
  }, []);

  const handleEditOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      setEditingExpense(null);
    }
  }, []);

  if (!data || data.pages.length === 0) {
    return null;
  }

  const firstPage = data.pages[0];
  const rows = dedupeRowsById(data.pages.flatMap((page) => page.rows));
  const groupedRows = groupRowsByDate(rows);
  const { effectiveRecentDays, isRecent, trimmedSearch } = firstPage;
  const isMonthFiltered = Boolean(selectedMonth);

  const listContainerClassName = cn(
    "no-scrollbar relative flex grow flex-col gap-6 overflow-y-auto",
    presentation === "search-drawer" && "px-4 pb-36"
  );
  const listTargetId =
    presentation === "search-drawer"
      ? "expense-list-search-drawer"
      : "expense-list";

  return (
    <m.section
      data-testid="expense-list-section"
      data-presentation={presentation}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, ease: "easeOut", delay: 0.14 }}
      className={cn(
        "flex w-full grow flex-col gap-4 overflow-auto",
        presentation === "search-drawer" && "min-h-0 flex-1"
      )}
    >
      <div id={listTargetId} className={listContainerClassName}>
        {rows.length ? (
          groupedRows.map((group) => (
            <div key={group.key} className="space-y-3">
              <div className="flex items-center justify-between rounded-2xl border border-transparent px-2 py-1">
                <p className="text-muted-foreground text-xs font-semibold tracking-wide">
                  {group.label}
                </p>
                <div className="text-foreground text-right text-sm font-semibold">
                  -{formatVnd(group.totalAmount)} <VndSymbol />
                </div>
              </div>
              <div className="flex flex-col gap-3">
                {group.items.map((expense) => (
                  <ExpenseListItem
                    key={expense.id}
                    expense={expense}
                    onEditExpense={handleEditExpense}
                  />
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
                : isMonthFiltered
                  ? "No expenses for this month yet. Add one above to see it here."
                  : "No expenses yet. Add one above to see it here."}
          </div>
        )}

        {hasNextPage || isFetchingNextPage || isFetchNextPageError ? (
          <div className="flex justify-center py-3">
            {isFetchNextPageError ? (
              <button
                type="button"
                onClick={() => void fetchNextPage()}
                className="text-primary text-sm font-medium underline-offset-4 hover:underline"
              >
                Retry loading more
              </button>
            ) : isFetchingNextPage ? (
              <span className="text-muted-foreground inline-flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading more
              </span>
            ) : isLoadMoreGated ? (
              <span className="text-muted-foreground text-center text-xs">
                Syncing all expenses before loading more.
              </span>
            ) : (
              <button
                type="button"
                onClick={() => void fetchNextPage()}
                className="text-primary text-sm font-medium underline-offset-4 hover:underline"
              >
                Load more
              </button>
            )}
          </div>
        ) : null}

        {resolvedMode === "full" && (
          <JumpToTopButton
            targetId={listTargetId}
            className="right-6 bottom-[100px]"
          />
        )}
      </div>
      <ExpenseEditSheetHost
        expense={editingExpense}
        open={Boolean(editingExpense)}
        onOpenChange={handleEditOpenChange}
      />
    </m.section>
  );
};

export default ExpenseList;
