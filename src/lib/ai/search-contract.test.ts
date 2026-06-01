import { Category } from "@/enums";
import { describe, expect, it } from "vitest";

import {
  parseSearchRequestSchema,
  searchFilterSchema,
} from "./search-contract";

describe("searchFilterSchema", () => {
  it("accepts a full filter", () => {
    const parsed = searchFilterSchema.safeParse({
      dateFrom: "2026-05-01",
      dateTo: "2026-05-31",
      categories: [Category.FOOD],
      budgetIds: [1, 2],
      hasBudget: false,
      amountMin: 50000,
      amountMax: 100000,
      q: "coffee",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts an empty filter", () => {
    expect(searchFilterSchema.safeParse({}).success).toBe(true);
  });

  it("rejects a bad date format", () => {
    expect(searchFilterSchema.safeParse({ dateFrom: "05/2026" }).success).toBe(
      false
    );
  });
});

describe("parseSearchRequestSchema", () => {
  it("requires input, todayDate, and todayMonth and defaults budgets to []", () => {
    const parsed = parseSearchRequestSchema.safeParse({
      input: "coffee no budget",
      todayDate: "2026-06-01",
      todayMonth: "2026-05",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.budgets).toEqual([]);
    }

    expect(
      parseSearchRequestSchema.safeParse({
        input: "coffee no budget",
        todayMonth: "2026-05",
      }).success
    ).toBe(false);
  });
});
