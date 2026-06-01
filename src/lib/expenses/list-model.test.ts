import { Category } from "@/enums";
import { describe, expect, it } from "vitest";

import type { ExpenseListQueryParams } from "./list-model";

describe("ExpenseListQueryParams", () => {
  it("accepts the new filter fields", () => {
    const params: ExpenseListQueryParams = {
      dateFrom: "2026-05-01",
      dateTo: "2026-05-31",
      categories: [Category.FOOD, Category.ENTERTAINMENT],
      budgetIds: [1, 2],
      hasBudget: false,
      amountMin: 50000,
      amountMax: 100000,
    };
    expect(params.categories).toHaveLength(2);
    expect(params.hasBudget).toBe(false);
  });
});
