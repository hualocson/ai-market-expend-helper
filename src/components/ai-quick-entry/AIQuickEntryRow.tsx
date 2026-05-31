"use client";

import React from "react";

import { Category } from "@/enums";
import {
  getBudgetColorOption,
  normalizeBudgetColor,
  normalizeBudgetIcon,
} from "@/lib/budget-appearance";
import { cn, formatVnd } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

import ExpenseItemIcon from "@/components/ExpenseItemIcon";
import VndSymbol from "@/components/VndSymbol";

import type { QuickEntry } from "./types";

type AIQuickEntryRowProps = {
  entry: QuickEntry;
  variant: "active" | "saved" | "needsReview";
  className?: string;
};

const rowClassName =
  "flex bg-surface-3/80 items-center gap-2 rounded-[24px] p-2";

const PendingIndicator = () => (
  <span
    aria-hidden
    className="bg-surface-2 block size-8 shrink-0 animate-pulse rounded-full"
  />
);

const PendingAmountSkeleton = () => (
  <span
    aria-hidden
    data-testid="ai-quick-entry-amount-skeleton"
    className="bg-surface-2 h-6 w-16 shrink-0 animate-pulse rounded-full"
  />
);

const FailedIndicator = () => (
  <span
    aria-hidden
    className="text-destructive bg-destructive/15 grid size-8 shrink-0 place-items-center rounded-full"
  >
    <AlertTriangle className="size-4" />
  </span>
);

const CompactAmount = ({ amount }: { amount: number }) => (
  <span className="bg-destructive/15 text-destructive inline-flex h-6 shrink-0 items-center rounded-full px-2 text-xs font-semibold tabular-nums">
    {formatVnd(amount)}
    <VndSymbol className="ml-0.5" />
  </span>
);

const BudgetIcon = ({
  icon,
  color,
}: {
  icon: string | null | undefined;
  color: unknown;
}) => {
  const normalizedIcon = normalizeBudgetIcon(icon);
  const colorOption = getBudgetColorOption(normalizeBudgetColor(color));

  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-full text-base font-medium",
        colorOption.chipClassName
      )}
    >
      {normalizedIcon}
    </span>
  );
};

const getDisplayExpense = (entry: QuickEntry) =>
  entry.savedExpense ?? entry.reviewDraft ?? null;

const AIQuickEntryRow = ({
  entry,
  variant,
  className,
}: AIQuickEntryRowProps) => {
  const displayExpense = getDisplayExpense(entry);
  const note = displayExpense?.note?.trim() || entry.input;
  const amount = displayExpense?.amount;
  const category = displayExpense?.category;
  const isSaving = entry.status === "saving";

  return (
    <div
      data-ai-quick-entry-row
      data-testid="ai-quick-entry-row"
      data-variant={variant}
      aria-label={
        variant === "active"
          ? `${isSaving ? "Saving" : "Parsing"} expense: ${note}`
          : variant === "needsReview"
            ? `Expense needs review: ${note}`
            : `Saved expense: ${note}, ${formatVnd(amount ?? 0)}`
      }
      className={cn(rowClassName, className)}
    >
      {variant === "saved" && displayExpense ? (
        displayExpense.budgetId ? (
          <BudgetIcon
            icon={displayExpense.budgetIcon}
            color={displayExpense.budgetColor}
          />
        ) : category ? (
          <ExpenseItemIcon
            category={category as Category}
            size="sm"
            className="size-8 shrink-0 [&_svg]:size-4"
          />
        ) : (
          <ExpenseItemIcon
            category={Category.OTHER}
            size="sm"
            className="size-8 shrink-0 [&_svg]:size-4"
          />
        )
      ) : variant === "needsReview" ? (
        <FailedIndicator />
      ) : (
        <PendingIndicator />
      )}

      <p className="text-foreground/90 min-w-0 grow truncate text-sm font-semibold">
        {note}
      </p>

      {variant === "saved" && typeof amount === "number" ? (
        <CompactAmount amount={amount} />
      ) : variant === "needsReview" ? (
        <span className="text-destructive shrink-0 pr-2 text-xs font-semibold">
          Review
        </span>
      ) : isSaving ? (
        <span className="text-muted-foreground shrink-0 pr-2 text-xs font-semibold">
          Saving
        </span>
      ) : (
        <PendingAmountSkeleton />
      )}
    </div>
  );
};

export default AIQuickEntryRow;
