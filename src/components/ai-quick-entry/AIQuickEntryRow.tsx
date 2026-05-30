"use client";

import React from "react";

import { Category } from "@/enums";
import { cn, formatVnd } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

import ExpenseItemIcon from "@/components/ExpenseItemIcon";
import VndSymbol from "@/components/VndSymbol";

import type { QuickEntry } from "./types";

type AIQuickEntryRowProps = {
  entry: QuickEntry;
  variant: "pending" | "resolved" | "failed";
  className?: string;
};

const rowClassName =
  "bg-surface-3/80 ds-glass-strong glass-border flex items-center gap-2 rounded-[24px] p-2";

const PendingIndicator = () => (
  <span
    aria-hidden
    className="bg-muted block size-8 shrink-0 animate-pulse rounded-full"
  />
);

const PendingAmountSkeleton = () => (
  <span
    aria-hidden
    data-testid="ai-quick-entry-amount-skeleton"
    className="bg-muted h-6 w-16 shrink-0 animate-pulse rounded-full"
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

const AIQuickEntryRow = ({
  entry,
  variant,
  className,
}: AIQuickEntryRowProps) => {
  const note = entry.result?.note.trim() || entry.input;

  return (
    <div
      data-ai-quick-entry-row
      data-testid="ai-quick-entry-row"
      data-variant={variant}
      aria-label={
        variant === "pending"
          ? `Parsing expense: ${entry.input}`
          : variant === "failed"
            ? `Expense needs review: ${entry.input}`
            : `Parsed expense: ${note}, ${formatVnd(entry.result?.amount ?? 0)}`
      }
      className={cn(rowClassName, className)}
    >
      {variant === "resolved" && entry.result ? (
        <ExpenseItemIcon
          category={entry.result.category as Category}
          size="sm"
          className="size-8 shrink-0 [&_svg]:size-4"
        />
      ) : variant === "failed" ? (
        <FailedIndicator />
      ) : (
        <PendingIndicator />
      )}

      <p className="text-foreground/90 min-w-0 grow truncate text-sm font-semibold">
        {note}
      </p>

      {variant === "resolved" && entry.result ? (
        <CompactAmount amount={entry.result.amount} />
      ) : variant === "failed" ? (
        <span className="text-destructive shrink-0 text-xs font-semibold">
          Review
        </span>
      ) : (
        <PendingAmountSkeleton />
      )}
    </div>
  );
};

export default AIQuickEntryRow;
