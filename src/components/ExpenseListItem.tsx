"use client";

import React from "react";
import { useMemo } from "react";

import { Category } from "@/enums";
import {
  type BudgetColorId,
  getBudgetColorOption,
  normalizeBudgetColor,
  normalizeBudgetIcon,
} from "@/lib/budget-appearance";
import type { ExpenseListItemSyncStatus } from "@/lib/expenses/list-model";
import { cn, formatVnd } from "@/lib/utils";

import ExpenseItemIcon from "@/components/ExpenseItemIcon";
import PaidByIcon from "@/components/PaidByIcon";
import VndSymbol from "@/components/VndSymbol";

export type ExpenseListItemData = {
  id: number;
  clientId?: string | null;
  date: string;
  amount: number;
  note: string;
  category: string;
  paidBy: string;
  budgetId: number | null;
  budgetName: string | null;
  budgetIcon: string | null;
  budgetColor: BudgetColorId | null;
  syncStatus?: ExpenseListItemSyncStatus;
};

type ExpenseListItemProps = {
  expense: ExpenseListItemData;
  onEditExpense: (expense: ExpenseListItemData) => void;
  className?: string;
};

const EXPENSE_SYNC_DOT_LABEL: Record<
  Exclude<ExpenseListItemSyncStatus, "synced">,
  string
> = {
  pending: "Sync pending",
  failed: "Sync failed",
};

const ExpenseSyncStatusDot = ({
  status,
}: {
  status?: ExpenseListItemSyncStatus;
}) => {
  if (status !== "pending" && status !== "failed") {
    return null;
  }

  const label = EXPENSE_SYNC_DOT_LABEL[status];

  return (
    <span
      aria-label={label}
      title={label}
      className={cn(
        "size-2 shrink-0 rounded-full",
        status === "pending" &&
          "bg-slate-400 shadow-[0_0_10px_rgb(148_163_184_/_0.45)]",
        status === "failed" &&
          "bg-destructive shadow-[0_0_10px_color-mix(in_srgb,var(--destructive)_45%,transparent)]"
      )}
    />
  );
};

const CategoryBadge = ({ category }: { category: string }) => (
  <span
    aria-label={`Category: ${category}`}
    className="bg-muted text-muted-foreground inline-flex max-w-[150px] min-w-0 items-center gap-1.5 rounded-2xl py-0.5 pr-2 pl-0.5 text-sm"
  >
    <ExpenseItemIcon
      category={category as Category}
      size="sm"
      className="size-5 shrink-0"
    />
    <span className="min-w-0 truncate">{category}</span>
  </span>
);

const BudgetIcon = ({
  icon,
  color,
}: {
  icon: string | null;
  color: BudgetColorId | null;
}) => {
  const normalizedIcon = normalizeBudgetIcon(icon);
  const colorOption = getBudgetColorOption(normalizeBudgetColor(color));

  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-12 shrink-0 items-center justify-center rounded-full text-xl font-medium",
        colorOption.chipClassName
      )}
    >
      {normalizedIcon}
    </span>
  );
};

const BudgetName = ({ name }: { name: string }) => (
  <span
    aria-label={`Budget: ${name}`}
    className="text-muted-foreground max-w-[160px] min-w-0 truncate text-sm"
  >
    {name}
  </span>
);

const ExpenseListItem = ({
  expense,
  onEditExpense,
  className = "",
}: ExpenseListItemProps) => {
  const formattedAmount = useMemo(
    () => formatVnd(expense.amount),
    [expense.amount]
  );
  const budgetBadgeLabel = useMemo(() => {
    if (expense.budgetName?.trim()) {
      return expense.budgetName;
    }
    if (expense.budgetId) {
      return "Budget assigned";
    }
    return "";
  }, [expense.budgetId, expense.budgetName]);

  const openEditSheet = () => {
    onEditExpense(expense);
  };

  const handleItemClick = () => {
    openEditSheet();
  };

  const handleItemKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    openEditSheet();
  };

  return (
    <div
      className={cn(
        "bg-surface-2/65 relative isolate overflow-hidden rounded-[22px] px-3 py-3 shadow-[0_14px_30px_color-mix(in_srgb,var(--background)_52%,transparent)]",
        className
      )}
      data-expense-list-item
    >
      <div
        onClick={handleItemClick}
        onKeyDown={handleItemKeyDown}
        role="button"
        tabIndex={0}
        aria-label={`Edit expense ${expense.note || expense.category}`}
        className="focus-visible:ring-ring/40 relative cursor-pointer rounded-[16px] transition-[transform] outline-none focus-visible:ring-2 active:scale-[0.99]"
      >
        <div className="flex flex-wrap items-center gap-4">
          {expense.budgetId ? (
            <BudgetIcon
              icon={expense.budgetIcon ?? null}
              color={expense.budgetColor ?? null}
            />
          ) : (
            <ExpenseItemIcon
              category={expense.category as Category}
              className={cn(
                "shrink-0",
                !expense.note && "bg-warning/15 text-warning"
              )}
            />
          )}
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-foreground/90 truncate font-semibold">
              {expense.note || "<No note>"}
            </p>
            <div className="flex min-w-0 items-center gap-2 overflow-hidden">
              <CategoryBadge category={expense.category} />
              {expense.budgetId ? (
                <BudgetName name={budgetBadgeLabel} />
              ) : (
                <span className="bg-warning size-2 rounded-full shadow-[0_0_10px_color-mix(in_srgb,var(--warning)_55%,transparent)]" />
              )}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-destructive text-right text-sm font-semibold">
              -{formattedAmount} <VndSymbol />
            </p>
            {expense.paidBy || expense.syncStatus ? (
              <div className="flex items-center justify-end gap-1.5">
                <ExpenseSyncStatusDot status={expense.syncStatus} />
                {expense.paidBy ? (
                  <PaidByIcon paidBy={expense.paidBy} size="sm" />
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(ExpenseListItem);
