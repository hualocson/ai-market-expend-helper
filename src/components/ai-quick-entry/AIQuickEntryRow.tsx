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
  "bg-surface-2/95 glass-border grid min-h-12 grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-2 rounded-[18px] px-2.5 py-2 shadow-[0_12px_28px_color-mix(in_srgb,var(--background)_50%,transparent)]";

const PendingIndicator = () => (
  <span
    aria-hidden
    className="bg-muted mx-auto block size-8 animate-pulse rounded-full"
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
    className="text-destructive bg-destructive/15 mx-auto grid size-8 place-items-center rounded-full"
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
          className="mx-auto size-8 [&_svg]:size-4"
        />
      ) : variant === "failed" ? (
        <FailedIndicator />
      ) : (
        <PendingIndicator />
      )}

      <p className="text-foreground/90 min-w-0 truncate text-sm font-semibold">
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
