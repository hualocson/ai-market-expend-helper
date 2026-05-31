import { Category } from "@/enums";
import { describe, expect, it } from "vitest";

import { expenseRowMatchesFilters } from "./filter-predicates";

const row = {
  date: "2026-05-15",
  amount: 60000,
  category: Category.FOOD as string,
  budgetId: null as number | null,
};

describe("expenseRowMatchesFilters", () => {
  it("returns true with no filters", () => {
    expect(expenseRowMatchesFilters(row, {})).toBe(true);
  });

  it("filters by inclusive date range", () => {
    expect(
      expenseRowMatchesFilters(row, {
        dateFrom: "2026-05-01",
        dateTo: "2026-05-31",
      })
    ).toBe(true);
    expect(expenseRowMatchesFilters(row, { dateFrom: "2026-06-01" })).toBe(
      false
    );
  });

  it("filters by categories", () => {
    expect(expenseRowMatchesFilters(row, { categories: [Category.FOOD] })).toBe(
      true
    );
    expect(
      expenseRowMatchesFilters(row, { categories: [Category.HOUSING] })
    ).toBe(false);
  });

  it("filters hasBudget=false to rows without a budget", () => {
    expect(expenseRowMatchesFilters(row, { hasBudget: false })).toBe(true);
    expect(
      expenseRowMatchesFilters({ ...row, budgetId: 3 }, { hasBudget: false })
    ).toBe(false);
  });

  it("budgetIds wins over hasBudget", () => {
    const withBudget = { ...row, budgetId: 3 };
    expect(
      expenseRowMatchesFilters(withBudget, { budgetIds: [3], hasBudget: false })
    ).toBe(true);
    expect(
      expenseRowMatchesFilters(withBudget, { budgetIds: [9], hasBudget: false })
    ).toBe(false);
  });

  it("filters by amount bounds", () => {
    expect(
      expenseRowMatchesFilters(row, { amountMin: 50000, amountMax: 70000 })
    ).toBe(true);
    expect(expenseRowMatchesFilters(row, { amountMin: 70000 })).toBe(false);
  });
});
