import type { BudgetWeeklyOption } from "@/lib/queries/budget-weekly";
import { describe, expect, it } from "vitest";

import {
  formatBudgetRange,
  groupBudgetOptions,
  pickDefaultBudget,
  sortBudgetOptions,
} from "./budget-options";

const opt = (over: Partial<BudgetWeeklyOption> = {}): BudgetWeeklyOption => ({
  id: 1,
  name: "Food",
  period: "week",
  periodStartDate: "2026-05-18",
  periodEndDate: "2026-05-24",
  amount: 100,
  spent: 0,
  remaining: 100,
  icon: "💰",
  color: "lime",
  ...over,
});

describe("formatBudgetRange", () => {
  it("returns single date when start equals end", () => {
    expect(
      formatBudgetRange(
        opt({ periodStartDate: "2026-05-18", periodEndDate: "2026-05-18" })
      )
    ).toMatch(/18 May 2026/);
  });

  it("returns short range when same year", () => {
    expect(
      formatBudgetRange(
        opt({ periodStartDate: "2026-05-18", periodEndDate: "2026-05-24" })
      )
    ).toMatch(/18 May - 24 May 2026/);
  });

  it("falls back to period label when start date is missing", () => {
    expect(
      formatBudgetRange(
        opt({ periodStartDate: null, periodEndDate: null, period: "month" })
      )
    ).toBe("Month budget");
  });
});

describe("sortBudgetOptions", () => {
  it("sorts by start date desc, then by name", () => {
    const a = opt({ id: 1, name: "Bravo", periodStartDate: "2026-05-11" });
    const b = opt({ id: 2, name: "Alpha", periodStartDate: "2026-05-18" });
    const c = opt({ id: 3, name: "Charlie", periodStartDate: "2026-05-18" });
    expect(sortBudgetOptions([a, b, c]).map((o) => o.id)).toEqual([2, 3, 1]);
  });
});

describe("groupBudgetOptions", () => {
  it("groups by period and sorts each group", () => {
    const w = opt({ id: 1, period: "week", periodStartDate: "2026-05-11" });
    const m = opt({ id: 2, period: "month", periodStartDate: "2026-05-01" });
    const c = opt({ id: 3, period: "custom", periodStartDate: "2026-05-20" });
    const result = groupBudgetOptions([w, m, c]);
    expect(result.week.map((o) => o.id)).toEqual([1]);
    expect(result.month.map((o) => o.id)).toEqual([2]);
    expect(result.custom.map((o) => o.id)).toEqual([3]);
  });
});

describe("pickDefaultBudget", () => {
  it("prefers week, then month, then custom", () => {
    expect(
      pickDefaultBudget({ week: [opt({ id: 1 })], month: [], custom: [] })?.id
    ).toBe(1);
    expect(
      pickDefaultBudget({ week: [], month: [opt({ id: 2 })], custom: [] })?.id
    ).toBe(2);
    expect(
      pickDefaultBudget({ week: [], month: [], custom: [opt({ id: 3 })] })?.id
    ).toBe(3);
    expect(pickDefaultBudget({ week: [], month: [], custom: [] })).toBeNull();
  });
});
