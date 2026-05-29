import { Category } from "@/enums";
import { describe, expect, it } from "vitest";

import {
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
