import { Category } from "@/enums";
import { describe, expect, it } from "vitest";

import { expenseQueries } from "./expenses";

describe("expenseQueries.list query key", () => {
  it("produces distinct keys for distinct filters", () => {
    const a = JSON.stringify(
      expenseQueries.list({ categories: [Category.FOOD] }).queryKey
    );
    const b = JSON.stringify(
      expenseQueries.list({ categories: [Category.HOUSING] }).queryKey
    );
    expect(a).not.toBe(b);
  });

  it("normalizes absent filter fields to null", () => {
    const key = expenseQueries.list({}).queryKey;
    const entry = key[key.length - 1] as Record<string, unknown>;
    expect(entry.hasBudget).toBeNull();
    expect(entry.dateFrom).toBeNull();
    expect(entry.categories).toBeNull();
  });
});
