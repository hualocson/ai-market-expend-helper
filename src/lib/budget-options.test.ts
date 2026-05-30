import { Category } from "@/enums";
import type { BudgetWeeklyOption } from "@/lib/queries/budget-weekly";
import { describe, expect, it } from "vitest";

import {
  type TBudgetOption,
  formatBudgetRange,
  groupBudgetOptions,
  isDateWithinBudgetPeriod,
  isExpenseDateSuspicious,
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
  category: Category.OTHER,
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

const baseBudget: TBudgetOption = {
  id: 1,
  name: "Cà phê",
  icon: "☕",
  color: "lime",
  period: "week",
  periodStartDate: "2026-05-25",
  periodEndDate: "2026-05-31",
  amount: 100000,
  spent: 0,
  remaining: 100000,
  category: Category.FOOD,
};

describe("isDateWithinBudgetPeriod", () => {
  it("returns true when the date is inside the period", () => {
    expect(isDateWithinBudgetPeriod(baseBudget, "2026-05-29")).toBe(true);
  });

  it("returns false when the date is before the period", () => {
    expect(isDateWithinBudgetPeriod(baseBudget, "2026-05-20")).toBe(false);
  });

  it("returns false when the date is after the period", () => {
    expect(isDateWithinBudgetPeriod(baseBudget, "2026-06-02")).toBe(false);
  });

  it("returns false for an unparseable date", () => {
    expect(isDateWithinBudgetPeriod(baseBudget, "not-a-date")).toBe(false);
  });

  it("treats a missing start date as always covering", () => {
    expect(
      isDateWithinBudgetPeriod(
        { ...baseBudget, periodStartDate: null, periodEndDate: null },
        "2026-01-01"
      )
    ).toBe(true);
  });
});

describe("isExpenseDateSuspicious", () => {
  const today = "2026-05-30";

  it("is not suspicious for today", () => {
    expect(isExpenseDateSuspicious("2026-05-30", today)).toBe(false);
  });

  it("is not suspicious within one month either direction", () => {
    expect(isExpenseDateSuspicious("2026-05-01", today)).toBe(false);
    expect(isExpenseDateSuspicious("2026-06-29", today)).toBe(false);
    expect(isExpenseDateSuspicious("2026-04-30", today)).toBe(false);
    expect(isExpenseDateSuspicious("2026-06-30", today)).toBe(false);
  });

  it("is suspicious more than a month in the past", () => {
    expect(isExpenseDateSuspicious("2026-04-01", today)).toBe(true);
    expect(isExpenseDateSuspicious("2026-04-29", today)).toBe(true);
  });

  it("is suspicious more than a month in the future", () => {
    expect(isExpenseDateSuspicious("2027-11-12", today)).toBe(true);
    expect(isExpenseDateSuspicious("2026-07-01", today)).toBe(true);
  });

  it("is not suspicious when either date is unparseable", () => {
    expect(isExpenseDateSuspicious("not-a-date", today)).toBe(false);
    expect(isExpenseDateSuspicious("2026-05-30", "nope")).toBe(false);
  });
});
