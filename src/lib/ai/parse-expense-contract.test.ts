import { Category } from "@/enums";
import { describe, expect, it } from "vitest";

import {
  PARSE_EXPENSE_DATE_PATTERN,
  PARSE_EXPENSE_MAX_BUDGETS,
  PARSE_EXPENSE_MIN_AMOUNT,
  parseExpenseRequestSchema,
} from "./parse-expense-contract";

describe("parseExpenseRequestSchema", () => {
  it("accepts input with budgets carrying a mapped category", () => {
    const result = parseExpenseRequestSchema.safeParse({
      input: "cf sua da 35k",
      today: "30/05/2026",
      budgets: [{ id: 2, name: "Cà phê", category: Category.FOOD }],
    });

    expect(result.success).toBe(true);
  });

  it("defaults budgets to an empty array when omitted", () => {
    const result = parseExpenseRequestSchema.safeParse({
      input: "lunch 50k",
      today: "30/05/2026",
    });

    expect(result.success).toBe(true);
    expect(result.success && result.data.budgets).toEqual([]);
  });

  it("rejects empty input", () => {
    expect(
      parseExpenseRequestSchema.safeParse({ input: "   ", budgets: [] }).success
    ).toBe(false);
  });

  it("rejects a budget category outside the Category enum", () => {
    expect(
      parseExpenseRequestSchema.safeParse({
        input: "lunch 50k",
        budgets: [{ id: 1, name: "Food", category: "Travel" }],
      }).success
    ).toBe(false);
  });

  it("rejects oversized budget lists", () => {
    const budgets = Array.from(
      { length: PARSE_EXPENSE_MAX_BUDGETS + 1 },
      (_unused, index) => ({
        id: index + 1,
        name: `Budget ${index + 1}`,
        category: Category.OTHER,
      })
    );

    expect(
      parseExpenseRequestSchema.safeParse({ input: "lunch 50k", budgets })
        .success
    ).toBe(false);
  });

  it("exposes a 1000 VND minimum constant", () => {
    expect(PARSE_EXPENSE_MIN_AMOUNT).toBe(1000);
  });
});

describe("parseExpenseRequestSchema today field", () => {
  it("accepts a DD/MM/YYYY today", () => {
    const result = parseExpenseRequestSchema.safeParse({
      input: "cf 35k",
      today: "30/05/2026",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing today", () => {
    const result = parseExpenseRequestSchema.safeParse({ input: "cf 35k" });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed today", () => {
    const result = parseExpenseRequestSchema.safeParse({
      input: "cf 35k",
      today: "2026-05-30",
    });
    expect(result.success).toBe(false);
  });
});

describe("PARSE_EXPENSE_DATE_PATTERN", () => {
  it("matches DD/MM/YYYY and rejects ISO", () => {
    expect(PARSE_EXPENSE_DATE_PATTERN.test("30/05/2026")).toBe(true);
    expect(PARSE_EXPENSE_DATE_PATTERN.test("2026-05-30")).toBe(false);
  });
});
