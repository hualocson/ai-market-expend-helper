import type { BudgetListItem } from "@/types/budget-weekly";

export type BudgetBarDisplay = "stack" | "inline";

export interface BudgetBar {
  budget: BudgetListItem;
  heightPx: number;
  isOver: boolean;
  display: BudgetBarDisplay;
}

export interface ComputeBudgetBarsOptions {
  maxPx?: number;
  minPx?: number;
  inlineThresholdPx?: number;
}

const DEFAULT_MAX_PX = 190;
const DEFAULT_MIN_PX = 40;
const DEFAULT_INLINE_THRESHOLD_PX = 64;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const computeBudgetBars = (
  budgets: BudgetListItem[],
  options: ComputeBudgetBarsOptions = {}
): BudgetBar[] => {
  const maxPx = options.maxPx ?? DEFAULT_MAX_PX;
  const minPx = options.minPx ?? DEFAULT_MIN_PX;
  const inlineThresholdPx =
    options.inlineThresholdPx ?? DEFAULT_INLINE_THRESHOLD_PX;

  if (budgets.length === 0) {
    return [];
  }

  const sorted = [...budgets].sort((a, b) => {
    if (b.remaining !== a.remaining) {
      return b.remaining - a.remaining;
    }
    if (a.name !== b.name) {
      return a.name.localeCompare(b.name);
    }
    return a.id - b.id;
  });

  const maxRemaining = sorted[0].remaining;

  return sorted.map((budget) => {
    const isOver = budget.remaining < 0;
    const heightPx =
      maxRemaining > 0 && budget.remaining > 0
        ? clamp(
            Math.round((maxPx * budget.remaining) / maxRemaining),
            minPx,
            maxPx
          )
        : minPx;
    const display: BudgetBarDisplay =
      heightPx < inlineThresholdPx ? "inline" : "stack";

    return { budget, heightPx, isOver, display };
  });
};
