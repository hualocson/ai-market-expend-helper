"use client";

import React from "react";

import {
  getBudgetColorOption,
  normalizeBudgetColor,
} from "@/lib/budget-appearance";
import { computeBudgetBars } from "@/lib/budget-chart";
import { cn, formatVndCompact } from "@/lib/utils";
import type { BudgetListItem } from "@/types/budget-weekly";

interface BudgetRemainingChartProps {
  budgets: BudgetListItem[];
  onSelect: (budget: BudgetListItem) => void;
}

const BudgetRemainingChart = ({
  budgets,
  onSelect,
}: BudgetRemainingChartProps) => {
  const bars = computeBudgetBars(budgets);

  if (bars.length === 0) {
    return null;
  }

  return (
    <div className="no-scrollbar -mx-4 flex items-end gap-2.5 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
      {bars.map((bar) => {
        const colorOption = getBudgetColorOption(
          normalizeBudgetColor(bar.budget.color)
        );
        const isInline = bar.display === "inline";

        return (
          <button
            key={bar.budget.id}
            type="button"
            onClick={() => onSelect(bar.budget)}
            aria-label={`${bar.budget.name}: ${formatVndCompact(
              bar.budget.remaining
            )} remaining`}
            style={{ height: `${bar.heightPx}px` }}
            className={cn(
              "flex w-[88px] flex-none flex-col items-center justify-end rounded-[22px] px-2 pb-3 transition-transform active:scale-[0.98]",
              "focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
              bar.isOver
                ? "bg-destructive text-destructive-foreground"
                : cn(colorOption.swatchClassName, "text-background"),
              isInline && "flex-row justify-center gap-1.5 pb-0"
            )}
          >
            <span
              className={cn("leading-none", isInline ? "text-sm" : "text-xl")}
            >
              {bar.budget.icon || "💰"}
            </span>
            <span
              className={cn(
                "leading-none font-bold",
                isInline ? "text-xs" : "mt-1.5 text-sm"
              )}
            >
              {formatVndCompact(bar.budget.remaining)}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default BudgetRemainingChart;
