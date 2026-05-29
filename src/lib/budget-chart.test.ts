import type { BudgetListItem } from "@/types/budget-weekly";
import { describe, expect, it } from "vitest";

import { computeBudgetBars } from "./budget-chart";

const makeBudget = (overrides: Partial<BudgetListItem>): BudgetListItem => ({
  id: 1,
  name: "Budget",
  icon: "💰",
  color: "lime",
  amount: 1000,
  spent: 0,
  remaining: 1000,
  period: "week",
  periodStartDate: "2026-05-25",
  periodEndDate: null,
  ...overrides,
});

describe("computeBudgetBars", () => {
  it("returns an empty array for no budgets", () => {
    expect(computeBudgetBars([])).toEqual([]);
  });

  it("sorts by remaining descending", () => {
    const bars = computeBudgetBars([
      makeBudget({ id: 1, remaining: 100 }),
      makeBudget({ id: 2, remaining: 300 }),
      makeBudget({ id: 3, remaining: 200 }),
    ]);
    expect(bars.map((bar) => bar.budget.id)).toEqual([2, 3, 1]);
  });

  it("breaks ties by name then id", () => {
    const bars = computeBudgetBars([
      makeBudget({ id: 5, name: "Beta", remaining: 100 }),
      makeBudget({ id: 4, name: "Alpha", remaining: 100 }),
      makeBudget({ id: 9, name: "Alpha", remaining: 100 }),
    ]);
    expect(bars.map((bar) => bar.budget.id)).toEqual([4, 9, 5]);
  });

  it("scales heights against the largest remaining", () => {
    const bars = computeBudgetBars(
      [
        makeBudget({ id: 1, remaining: 200 }),
        makeBudget({ id: 2, remaining: 100 }),
      ],
      { maxPx: 200, minPx: 40, inlineThresholdPx: 64 }
    );
    expect(bars[0].heightPx).toBe(200);
    expect(bars[1].heightPx).toBe(100);
  });

  it("clamps tiny positive remainders to the minimum height", () => {
    const bars = computeBudgetBars(
      [
        makeBudget({ id: 1, remaining: 1000 }),
        makeBudget({ id: 2, remaining: 1 }),
      ],
      { maxPx: 190, minPx: 40, inlineThresholdPx: 64 }
    );
    expect(bars[1].heightPx).toBe(40);
  });

  it("uses the minimum height and flags over-budget when all remainders are non-positive", () => {
    const bars = computeBudgetBars(
      [
        makeBudget({ id: 1, remaining: 0 }),
        makeBudget({ id: 2, remaining: -50 }),
      ],
      { maxPx: 190, minPx: 40, inlineThresholdPx: 64 }
    );
    expect(bars.every((bar) => bar.heightPx === 40)).toBe(true);
    expect(bars.find((bar) => bar.budget.id === 2)?.isOver).toBe(true);
    expect(bars.find((bar) => bar.budget.id === 1)?.isOver).toBe(false);
  });

  it("chooses inline display for short bars and stacked for tall bars", () => {
    const bars = computeBudgetBars(
      [
        makeBudget({ id: 1, remaining: 1000 }),
        makeBudget({ id: 2, remaining: 10 }),
      ],
      { maxPx: 190, minPx: 40, inlineThresholdPx: 64 }
    );
    expect(bars[0].display).toBe("stack");
    expect(bars[1].display).toBe("inline");
  });
});
