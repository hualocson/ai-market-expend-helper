import { Category } from "@/enums";
import { describe, expect, it } from "vitest";

import {
  budgetCloneNextPeriodPayloadSchema,
  budgetCreatePayloadSchema,
  budgetUpdatePayloadSchema,
} from "./route-schemas";

// `budgetCreatePayloadSchema` is annotated `z.ZodType<BudgetCreateInput>`, so its
// `.parse` input type requires every field. To exercise the runtime `.default()`
// for `category` we feed raw request-shaped objects through this cast helper
// rather than `any` (which the lint rules forbid).
type CreateInput = Parameters<typeof budgetCreatePayloadSchema.parse>[0];
type UpdateInput = Parameters<typeof budgetUpdatePayloadSchema.parse>[0];
const asCreateInput = (value: Record<string, unknown>) =>
  value as unknown as CreateInput;
const asUpdateInput = (value: Record<string, unknown>) =>
  value as unknown as UpdateInput;

describe("budgetCreatePayloadSchema category", () => {
  const base = {
    name: "Coffee",
    amount: 200_000,
    period: "week",
    periodStartDate: "2026-05-11",
  };

  it("defaults a missing category to Other", () => {
    const parsed = budgetCreatePayloadSchema.parse(asCreateInput(base));
    expect(parsed.category).toBe(Category.OTHER);
  });

  it("accepts a valid category", () => {
    const parsed = budgetCreatePayloadSchema.parse(
      asCreateInput({ ...base, category: Category.FOOD })
    );
    expect(parsed.category).toBe(Category.FOOD);
  });

  it("rejects an invalid category", () => {
    expect(() =>
      budgetCreatePayloadSchema.parse(
        asCreateInput({ ...base, category: "NotACategory" })
      )
    ).toThrow();
  });
});

describe("budgetUpdatePayloadSchema category", () => {
  it("omits category when not provided", () => {
    const parsed = budgetUpdatePayloadSchema.parse({ name: "Renamed" });
    expect(parsed.category).toBeUndefined();
  });

  it("rejects an invalid category", () => {
    expect(() =>
      budgetUpdatePayloadSchema.parse(asUpdateInput({ category: "Nope" }))
    ).toThrow();
  });
});

describe("budgetCloneNextPeriodPayloadSchema", () => {
  it("accepts weekly and monthly clone payloads", () => {
    expect(
      budgetCloneNextPeriodPayloadSchema.parse({
        period: "week",
        sourceStartDate: "2026-06-07",
      })
    ).toEqual({
      period: "week",
      sourceStartDate: "2026-06-07",
    });

    expect(
      budgetCloneNextPeriodPayloadSchema.parse({
        period: "month",
        sourceStartDate: "2026-06-01",
      })
    ).toEqual({
      period: "month",
      sourceStartDate: "2026-06-01",
    });
  });

  it("accepts clone payloads with per-source-budget amounts", () => {
    expect(
      budgetCloneNextPeriodPayloadSchema.parse({
        period: "week",
        sourceStartDate: "2026-06-07",
        budgets: [
          { sourceBudgetId: 1, amount: 250_000 },
          { sourceBudgetId: 2, amount: 1_500_000 },
        ],
      })
    ).toEqual({
      period: "week",
      sourceStartDate: "2026-06-07",
      budgets: [
        { sourceBudgetId: 1, amount: 250_000 },
        { sourceBudgetId: 2, amount: 1_500_000 },
      ],
    });
  });

  it("rejects invalid clone budget amount overrides", () => {
    expect(() =>
      budgetCloneNextPeriodPayloadSchema.parse({
        period: "week",
        sourceStartDate: "2026-06-07",
        budgets: [{ sourceBudgetId: 0, amount: 250_000 }],
      })
    ).toThrow();

    expect(() =>
      budgetCloneNextPeriodPayloadSchema.parse({
        period: "week",
        sourceStartDate: "2026-06-07",
        budgets: [{ sourceBudgetId: 1, amount: -1 }],
      })
    ).toThrow();

    expect(() =>
      budgetCloneNextPeriodPayloadSchema.parse({
        period: "week",
        sourceStartDate: "2026-06-07",
        budgets: [{ sourceBudgetId: 1, amount: Number.NaN }],
      })
    ).toThrow();
  });

  it("rejects custom periods and malformed dates", () => {
    expect(() =>
      budgetCloneNextPeriodPayloadSchema.parse({
        period: "custom",
        sourceStartDate: "2026-06-07",
      })
    ).toThrow();

    expect(() =>
      budgetCloneNextPeriodPayloadSchema.parse({
        period: "week",
        sourceStartDate: "07/06/2026",
      })
    ).toThrow();
  });
});
