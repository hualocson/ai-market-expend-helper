"use client";

import { useEffect, useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import { setTransactionBudgetEntry } from "@/app/actions/budget-weekly-actions";
import dayjs from "@/configs/date";
import { Category } from "@/enums";
import { cn, formatVnd } from "@/lib/utils";
import { WeeklyBudgetTransaction } from "@/types/budget-weekly";
import {
  ArrowDownIcon,
  CheckIcon,
  Loader2,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

import ExpenseItemIcon from "@/components/ExpenseItemIcon";
import TransactionsSearch from "@/components/TransactionsSearch";

import { Input } from "./ui/input";

type BudgetWeeklyTransactionsClientProps = {
  weekStartDate: string;
  budgets: Array<{ id: number; name: string }>;
  transactions: WeeklyBudgetTransaction[];
};

const CATEGORY_VALUES = new Set(Object.values(Category));
const resolveCategory = (category: string) =>
  CATEGORY_VALUES.has(category as Category)
    ? (category as Category)
    : Category.OTHER;

const PAGE_SIZE = 12;
const FILTER_OPTIONS = ["all", "unassigned", "assigned"] as const;
type FilterOption = (typeof FILTER_OPTIONS)[number];

const BudgetWeeklyTransactionsClient = ({
  weekStartDate,
  budgets,
  transactions,
}: BudgetWeeklyTransactionsClientProps) => {
  const router = useRouter();
  const [assignOpen, setAssignOpen] = useState(false);
  const [activeTransaction, setActiveTransaction] =
    useState<WeeklyBudgetTransaction | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [pendingBudgetId, setPendingBudgetId] = useState<number | null>(null);
  const [budgetQuery, setBudgetQuery] = useState("");
  const [filter, setFilter] = useState<FilterOption>(() =>
    transactions.some((transaction) => !transaction.budgetId)
      ? "unassigned"
      : "all"
  );
  const [visibleUnassignedCount, setVisibleUnassignedCount] =
    useState(PAGE_SIZE);
  const [visibleAssignedCount, setVisibleAssignedCount] = useState(PAGE_SIZE);

  const { unassignedTransactions, assignedTransactions } = useMemo(() => {
    const unassigned: WeeklyBudgetTransaction[] = [];
    const assigned: WeeklyBudgetTransaction[] = [];
    for (const transaction of transactions) {
      if (transaction.budgetId) {
        assigned.push(transaction);
      } else {
        unassigned.push(transaction);
      }
    }
    return {
      unassignedTransactions: unassigned,
      assignedTransactions: assigned,
    };
  }, [transactions]);

  const filteredBudgets = useMemo(() => {
    const query = budgetQuery.trim().toLowerCase();
    if (!query) {
      return budgets;
    }
    return budgets.filter((budget) =>
      budget.name.toLowerCase().includes(query)
    );
  }, [budgets, budgetQuery]);

  const hasUnassigned = unassignedTransactions.length > 0;
  const hasAssigned = assignedTransactions.length > 0;

  useEffect(() => {
    setVisibleUnassignedCount(
      Math.min(PAGE_SIZE, unassignedTransactions.length)
    );
    setVisibleAssignedCount(Math.min(PAGE_SIZE, assignedTransactions.length));
  }, [unassignedTransactions.length, assignedTransactions.length]);

  useEffect(() => {
    if (filter === "unassigned" && !hasUnassigned && hasAssigned) {
      setFilter("assigned");
      return;
    }
    if (filter === "assigned" && !hasAssigned && hasUnassigned) {
      setFilter("unassigned");
      return;
    }
    if (!hasAssigned && !hasUnassigned && filter !== "all") {
      setFilter("all");
    }
  }, [filter, hasAssigned, hasUnassigned]);

  const handleOpenChange = (open: boolean) => {
    setAssignOpen(open);
    if (!open) {
      setActiveTransaction(null);
      setPendingBudgetId(null);
      setBudgetQuery("");
    }
  };

  const openAssign = (transaction: WeeklyBudgetTransaction) => {
    setActiveTransaction(transaction);
    setBudgetQuery("");
    setAssignOpen(true);
  };

  const handleAssign = async (budgetId: number | null) => {
    if (!activeTransaction || isAssigning) {
      return;
    }

    try {
      setIsAssigning(true);
      setPendingBudgetId(budgetId);
      await setTransactionBudgetEntry({
        transactionId: activeTransaction.id,
        budgetId,
        weekStartDate,
      });
      toast.success(budgetId ? "Budget assigned." : "Budget unassigned.");
      setAssignOpen(false);
      setActiveTransaction(null);
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to update assignment.");
    } finally {
      setIsAssigning(false);
      setPendingBudgetId(null);
    }
  };

  const renderTransactionRow = (transaction: WeeklyBudgetTransaction) => {
    const noteLabel = transaction.note?.trim() || "No note";
    const formattedDate = dayjs(transaction.date).format("DD/MM/YYYY");
    const isUnassigned = !transaction.budgetId;
    const resolvedCategory = resolveCategory(transaction.category);
    const budgetLabel = transaction.budgetName ?? "Needs budget";

    return (
      <button
        key={transaction.id}
        type="button"
        onClick={() => openAssign(transaction)}
        className={cn(
          "flex w-full items-start justify-between gap-4 rounded-3xl border border-white/10 bg-white/5 px-4 py-4 text-left transition hover:bg-white/10 active:scale-[0.99]",
          isUnassigned && "border-amber-400/30 bg-amber-400/5"
        )}
      >
        <div className="flex min-w-0 items-start gap-3">
          <ExpenseItemIcon
            category={resolvedCategory}
            size="sm"
            className="shrink-0"
          />
          <div className="flex min-w-0 flex-col items-start gap-1">
            <p className="text-foreground line-clamp-1 text-sm font-semibold">
              {noteLabel}
            </p>
            <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
              <span>{formattedDate}</span>
              <span
                className={cn(
                  "max-w-[160px] rounded-full px-2 py-0.5 text-[11px] font-medium",
                  isUnassigned
                    ? "bg-amber-400/20 text-amber-200"
                    : "text-muted-foreground bg-white/10"
                )}
              >
                <span className="line-clamp-1">{budgetLabel}</span>
              </span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="text-foreground text-sm font-semibold">
            -{formatVnd(transaction.amount)} VND
          </span>
          <span
            className={cn(
              "text-[11px] font-medium",
              isUnassigned ? "text-amber-200" : "text-muted-foreground"
            )}
          >
            {isUnassigned ? "Assign budget" : "Change budget"}
          </span>
        </div>
      </button>
    );
  };

  const visibleUnassigned = unassignedTransactions.slice(
    0,
    visibleUnassignedCount
  );
  const visibleAssigned = assignedTransactions.slice(0, visibleAssignedCount);

  const unassignedRemaining =
    unassignedTransactions.length - visibleUnassignedCount;
  const assignedRemaining = assignedTransactions.length - visibleAssignedCount;

  const showUnassigned = filter === "all" || filter === "unassigned";
  const showAssigned = filter === "all" || filter === "assigned";

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-foreground text-lg font-semibold">
            Transactions
          </h2>
          <p className="text-muted-foreground text-sm">
            Focus on what needs a budget first.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
            {unassignedTransactions.length} unassigned
          </span>
          <span className="text-muted-foreground rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
            {assignedTransactions.length} assigned
          </span>
        </div>
      </div>
      <div className="space-y-2">
        <TransactionsSearch placeholder="Search transactions by note or category" />
        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((option) => (
            <Button
              key={option}
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setFilter(option)}
              className={cn(
                "h-8 rounded-full px-3 text-xs font-semibold",
                filter === option
                  ? "bg-foreground text-background hover:bg-foreground/90"
                  : "text-muted-foreground bg-white/5 hover:bg-white/10"
              )}
            >
              {option === "all"
                ? `All (${transactions.length})`
                : option === "unassigned"
                  ? `Unassigned (${unassignedTransactions.length})`
                  : `Assigned (${assignedTransactions.length})`}
            </Button>
          ))}
        </div>
      </div>
      {transactions.length ? (
        <div className="space-y-4">
          {showUnassigned ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-foreground text-sm font-semibold">
                  Needs budget
                </p>
                <span className="text-muted-foreground text-xs">
                  {unassignedTransactions.length} items
                </span>
              </div>
              {unassignedTransactions.length ? (
                <div className="flex flex-col gap-3">
                  {visibleUnassigned.map(renderTransactionRow)}
                </div>
              ) : (
                <div className="text-muted-foreground rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
                  All transactions are assigned.
                </div>
              )}
              {unassignedRemaining > 0 ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="h-10 w-full rounded-full text-sm"
                  onClick={() =>
                    setVisibleUnassignedCount((current) =>
                      Math.min(
                        current + PAGE_SIZE,
                        unassignedTransactions.length
                      )
                    )
                  }
                >
                  Show {Math.min(PAGE_SIZE, unassignedRemaining)} more
                  unassigned
                </Button>
              ) : null}
            </div>
          ) : null}

          {showAssigned ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-foreground text-sm font-semibold">
                  Assigned
                </p>
                <span className="text-muted-foreground text-xs">
                  {assignedTransactions.length} items
                </span>
              </div>
              {assignedTransactions.length ? (
                <div className="flex flex-col gap-3">
                  {visibleAssigned.map(renderTransactionRow)}
                </div>
              ) : (
                <div className="text-muted-foreground rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
                  No assigned transactions yet.
                </div>
              )}
              {assignedRemaining > 0 ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="h-10 w-full rounded-full text-sm"
                  onClick={() =>
                    setVisibleAssignedCount((current) =>
                      Math.min(current + PAGE_SIZE, assignedTransactions.length)
                    )
                  }
                >
                  Show {Math.min(PAGE_SIZE, assignedRemaining)} more assigned
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="text-muted-foreground rounded-3xl border border-white/10 bg-white/5 px-4 py-6 text-sm">
          No transactions found in this week.
        </div>
      )}

      <Drawer open={assignOpen} onOpenChange={handleOpenChange}>
        <DrawerContent className="rounded-t-3xl! border-t-0!">
          <DrawerHeader className="gap-2">
            <DrawerTitle>Assign budget</DrawerTitle>
            <DrawerDescription asChild>
              {activeTransaction ? (
                <div className="flex w-full items-center gap-3 rounded-3xl border border-white/10 p-4 text-left">
                  <div className="shrink-0">
                    <ExpenseItemIcon
                      category={resolveCategory(activeTransaction.category)}
                    />
                  </div>
                  <div className="flex grow flex-col items-start">
                    <span className="text-foreground line-clamp-1 text-sm font-medium">
                      {activeTransaction.note?.trim() || "Transaction"}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {dayjs(activeTransaction.date).format("DD/MM/YYYY")}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {activeTransaction.budgetName
                        ? `Currently: ${activeTransaction.budgetName}`
                        : "No budget assigned"}
                    </span>
                  </div>
                  <p className="shrink-0 text-right">
                    -{formatVnd(activeTransaction.amount)} VND
                  </p>
                </div>
              ) : (
                "Pick a budget for this transaction."
              )}
            </DrawerDescription>
          </DrawerHeader>
          <div className="mx-auto mb-4">
            <ArrowDownIcon className="size-4" />
          </div>
          <div className="px-4 pb-2">
            <div className="relative">
              <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                type="search"
                value={budgetQuery}
                onChange={(event) => setBudgetQuery(event.target.value)}
                placeholder="Search budgets"
                className="h-10 rounded-full pr-9 pl-9"
                aria-label="Search budgets"
                autoComplete="off"
                spellCheck={false}
                inputMode="search"
              />
              {budgetQuery ? (
                <button
                  type="button"
                  aria-label="Clear budget search"
                  onClick={() => setBudgetQuery("")}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
          <div className="no-scrollbar max-h-[52svh] space-y-2 overflow-y-auto px-4 pb-6">
            {filteredBudgets.length ? (
              filteredBudgets.map((budget) => {
                const isActive = budget.id === activeTransaction?.budgetId;
                const isPending = pendingBudgetId === budget.id && isAssigning;
                return (
                  <Button
                    key={budget.id}
                    type="button"
                    variant="secondary"
                    className="h-12 w-full justify-between"
                    onClick={() => handleAssign(budget.id)}
                    disabled={isAssigning}
                  >
                    <span className="text-left">{budget.name}</span>
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isActive ? (
                      <CheckIcon className="h-4 w-4" />
                    ) : null}
                  </Button>
                );
              })
            ) : budgets.length ? (
              <div className="text-muted-foreground rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
                No budgets match your search.
              </div>
            ) : (
              <div className="text-muted-foreground rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
                Create a budget first to assign transactions.
              </div>
            )}
          </div>
          {activeTransaction?.budgetId ? (
            <DrawerFooter className="border-t border-white/10">
              <Button
                type="button"
                variant="destructive"
                className="w-full text-rose-300"
                onClick={() => handleAssign(null)}
                disabled={isAssigning}
              >
                {pendingBudgetId === null && isAssigning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Unassign"
                )}
              </Button>
            </DrawerFooter>
          ) : null}
        </DrawerContent>
      </Drawer>
    </section>
  );
};

export default BudgetWeeklyTransactionsClient;
