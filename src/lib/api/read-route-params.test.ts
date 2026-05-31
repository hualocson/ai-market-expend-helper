import { Category } from "@/enums";
import { describe, expect, it } from "vitest";

import { parseExpenseListParams } from "./read-route-params";

const parse = (qs: string) => parseExpenseListParams(new URLSearchParams(qs));

describe("parseExpenseListParams new filter fields", () => {
  it("parses categories, budgetIds, hasBudget, amount and date range", () => {
    const result = parse(
      "dateFrom=2026-05-01&dateTo=2026-05-31&categories=Food,Entertainment&budgetIds=1,2&hasBudget=false&amountMin=50000&amountMax=100000"
    );
    expect("value" in result).toBe(true);
    if ("value" in result) {
      expect(result.value.categories).toEqual([
        Category.FOOD,
        Category.ENTERTAINMENT,
      ]);
      expect(result.value.budgetIds).toEqual([1, 2]);
      expect(result.value.hasBudget).toBe(false);
      expect(result.value.amountMin).toBe(50000);
      expect(result.value.dateFrom).toBe("2026-05-01");
    }
  });

  it("rejects an unknown category", () => {
    const result = parse("categories=Food,NotACategory");
    expect("error" in result).toBe(true);
  });

  it("rejects a non-integer budgetId", () => {
    expect("error" in parse("budgetIds=1,abc")).toBe(true);
  });

  it("rejects a bad dateFrom", () => {
    expect("error" in parse("dateFrom=2026-13-99")).toBe(true);
  });
});
