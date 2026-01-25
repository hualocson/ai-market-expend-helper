"use client";

import { useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import { setTransactionBudgetEntry } from "@/app/actions/budget-weekly-actions";
import dayjs from "@/configs/date";
import { Category } from "@/enums";
import { cn, formatVnd } from "@/lib/utils";
import { WeeklyBudgetTransaction } from "@/types/budget-weekly";
import { ArrowDownIcon, CheckIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

import ExpenseItemIcon from "@/components/ExpenseItemIcon";
import TransactionsSearch from "@/components/TransactionsSearch";

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

  const handleOpenChange = (open: boolean) => {
    setAssignOpen(open);
    if (!open) {
      setActiveTransaction(null);
      setPendingBudgetId(null);
    }
  };

  const openAssign = (transaction: WeeklyBudgetTransaction) => {
    setActiveTransaction(transaction);
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

  const transactionRows = useMemo(() => {
    return transactions.map((transaction) => {
      const noteLabel = transaction.note?.trim() || "<No note>";
      const formattedDate = dayjs(transaction.date).format("DD/MM/YYYY");
      const isUnassigned = !transaction.budgetId;
      const resolvedCategory = resolveCategory(transaction.category);

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
            <ExpenseItemIcon category={resolvedCategory} size="sm" />
            <div>
              <p className="text-foreground truncate text-sm font-semibold">
                {noteLabel}
              </p>
              <p className="text-muted-foreground text-xs">{formattedDate}</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <span className="text-foreground text-sm font-semibold">
              -{formatVnd(transaction.amount)} VND
            </span>
            <span
              className={cn(
                "text-xs font-medium",
                transaction.budgetName
                  ? "text-muted-foreground"
                  : "text-amber-300"
              )}
            >
              {transaction.budgetName ?? "Unassigned"}
            </span>
          </div>
        </button>
      );
    });
  }, [transactions]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-foreground text-lg font-semibold">
            Transactions
          </h2>
          <p className="text-muted-foreground text-sm">
            Unassigned transactions appear first.
          </p>
        </div>
        <span className="text-muted-foreground text-xs">
          {transactions.length} items
        </span>
      </div>
      <TransactionsSearch placeholder="Search transactions by note or category" />
      {transactions.length ? (
        <div className="flex flex-col gap-3">{transactionRows}</div>
      ) : (
        <div className="text-muted-foreground rounded-3xl border border-white/10 bg-white/5 px-4 py-6 text-sm">
          No transactions found in this week.
        </div>
      )}

      <Drawer open={assignOpen} onOpenChange={handleOpenChange}>
        <DrawerContent className="border-t-none! rounded-t-3xl!">
          <DrawerHeader className="gap-2">
            <DrawerTitle>Assign budget</DrawerTitle>
            <DrawerDescription>
              {activeTransaction ? (
                <div className="mx-auto flex w-fit items-center gap-3 rounded-xl border border-white/10 p-4">
                  <ExpenseItemIcon
                    category={resolveCategory(activeTransaction.category)}
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-foreground truncate text-sm font-medium">
                      {activeTransaction.note?.trim() || "Transaction"}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {dayjs(activeTransaction.date).format("DD/MM/YYYY")}
                    </span>
                  </div>
                  <span className="text-foreground text-sm font-semibold">
                    -{formatVnd(activeTransaction.amount)} VND
                  </span>
                </div>
              ) : (
                "Pick a budget for this transaction."
              )}
            </DrawerDescription>
          </DrawerHeader>
          <div className="mx-auto mb-4">
            <ArrowDownIcon className="size-4" />
          </div>
          <div className="space-y-2 px-4 pb-6">
            {budgets.length ? (
              budgets.map((budget) => {
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
            ) : (
              <div className="text-muted-foreground rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
                Create a budget first to assign transactions.
              </div>
            )}
            {activeTransaction?.budgetId ? (
              <Button
                type="button"
                variant="ghost"
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
            ) : null}
          </div>
        </DrawerContent>
      </Drawer>
    </section>
  );
};

export default BudgetWeeklyTransactionsClient;
