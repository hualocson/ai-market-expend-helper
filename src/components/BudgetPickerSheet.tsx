"use client";

import React, { useMemo } from "react";

import {
  type TBudgetOptionGroupKey,
  budgetGroupEmptyLabel,
  budgetGroupLabels,
  formatBudgetRange,
  groupBudgetOptions,
  hasAnyBudgetOption,
} from "@/lib/budget-options";
import { queries } from "@/lib/queries";
import { cn, formatVndSigned } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { CheckIcon, Loader2 } from "lucide-react";
import { flushSync } from "react-dom";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "./ui/sheet";

export type TBudgetPickerSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: number | null;
  onChange: (id: number | null) => void;
  weekStart: string;
  targetDate?: string;
  isParentOpen?: boolean;
  onCloseAutoFocus?: React.ComponentProps<
    typeof SheetContent
  >["onCloseAutoFocus"];
  onRestoreFocusRequest?: () => void;
};

const BudgetPickerSheet = ({
  open,
  onOpenChange,
  value,
  onChange,
  weekStart,
  targetDate,
  isParentOpen = true,
  onCloseAutoFocus,
  onRestoreFocusRequest,
}: TBudgetPickerSheetProps) => {
  const budgetOptionsQuery = queries.budgetWeekly.options(
    weekStart,
    targetDate
  );
  const query = useQuery({
    ...budgetOptionsQuery,
    enabled: isParentOpen && Boolean(weekStart),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
  });

  const groups = useMemo(
    () => groupBudgetOptions(query.data ?? []),
    [query.data]
  );
  const hasOptions = hasAnyBudgetOption(groups);

  const handleSelect = (id: number | null) => {
    onChange(id);
    flushSync(() => {
      onOpenChange(false);
    });
    onRestoreFocusRequest?.();
  };

  const handleOverlayPointerDown: React.PointerEventHandler<HTMLDivElement> = (
    event
  ) => {
    event.preventDefault();
    event.stopPropagation();
    flushSync(() => {
      onOpenChange(false);
    });
    onRestoreFocusRequest?.();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="rounded-t-3xl"
        onCloseAutoFocus={onCloseAutoFocus}
        onOverlayPointerDown={handleOverlayPointerDown}
      >
        <SheetHeader className="text-left">
          <SheetTitle>Budget</SheetTitle>
          <SheetDescription>
            Choose a weekly or monthly budget for this expense.
          </SheetDescription>
        </SheetHeader>
        <div className="no-scrollbar standalone:pb-safe max-h-[50svh] flex-1 space-y-3 overflow-y-auto px-4 pb-6 sm:px-6">
          <button
            type="button"
            onClick={() => handleSelect(null)}
            aria-pressed={value === null}
            className={cn(
              "group flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-sm font-medium transition",
              value === null
                ? "border-success/40 bg-success/10"
                : "border-border bg-card/80 hover:bg-card"
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  value === null ? "bg-success" : "bg-warning/80"
                )}
              />
              <span className="truncate">No budget</span>
            </span>
            {value === null ? (
              <CheckIcon className="text-success h-4 w-4" />
            ) : (
              <span className="text-muted-foreground text-xs">Clear</span>
            )}
          </button>

          {query.isPending ? (
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading budgets...
            </div>
          ) : hasOptions ? (
            <div className="space-y-3">
              {(["week", "month", "custom"] as const).map(
                (groupKey: TBudgetOptionGroupKey) => {
                  const items = groups[groupKey];
                  if (groupKey === "custom" && !items.length) {
                    return null;
                  }
                  return (
                    <section key={groupKey} className="space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.08em] uppercase">
                          {budgetGroupLabels[groupKey]}
                        </p>
                        <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-medium">
                          {items.length}
                        </span>
                      </div>
                      {items.length ? (
                        <div className="bg-muted/30 border-border/60 space-y-1 rounded-2xl border p-1">
                          {items.map((budget) => {
                            const isActive = budget.id === value;
                            return (
                              <button
                                key={budget.id}
                                type="button"
                                onClick={() => handleSelect(budget.id)}
                                aria-pressed={isActive}
                                className={cn(
                                  "group flex min-h-11 w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition",
                                  isActive
                                    ? "border-success/40 bg-success/10"
                                    : "bg-card/80 hover:bg-card border-transparent"
                                )}
                              >
                                <span className="flex min-w-0 items-center gap-2">
                                  <span
                                    className={cn(
                                      "size-2 shrink-0 rounded-full",
                                      isActive
                                        ? "bg-success"
                                        : "bg-foreground/40"
                                    )}
                                  />
                                  <span className="flex min-w-0 flex-col">
                                    <span className="truncate text-sm font-medium">
                                      {budget.name}
                                    </span>
                                    <span className="text-muted-foreground text-xs">
                                      {formatBudgetRange(budget)}
                                    </span>
                                  </span>
                                </span>
                                <span className="ml-2 flex shrink-0 items-center gap-2">
                                  <span
                                    className={cn(
                                      "text-xs font-semibold tabular-nums",
                                      budget.remaining < 0
                                        ? "text-destructive"
                                        : "text-success"
                                    )}
                                  >
                                    {formatVndSigned(budget.remaining)}
                                  </span>
                                  {isActive ? (
                                    <CheckIcon className="text-success h-4 w-4 shrink-0" />
                                  ) : null}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="bg-card/70 border-border rounded-2xl border border-dashed px-3 py-4">
                          <p className="text-muted-foreground text-xs">
                            {budgetGroupEmptyLabel[groupKey]}
                          </p>
                        </div>
                      )}
                    </section>
                  );
                }
              )}
            </div>
          ) : (
            <div className="bg-card/70 border-border rounded-2xl border border-dashed px-3 py-4">
              <p className="text-muted-foreground text-xs">
                No budgets for this date yet.
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default BudgetPickerSheet;
