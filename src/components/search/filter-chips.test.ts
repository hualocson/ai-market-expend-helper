import { Category } from "@/enums";
import { describe, expect, it } from "vitest";

import { buildFilterChips } from "./filter-chips";

describe("buildFilterChips", () => {
  it("creates a labelled chip per active field", () => {
    const chips = buildFilterChips({
      dateFrom: "2026-05-01",
      dateTo: "2026-05-31",
      categories: [Category.FOOD, Category.ENTERTAINMENT],
      hasBudget: false,
      amountMin: 50000,
    });
    const fields = chips.map((chip) => chip.field);
    expect(fields).toContain("dateRange");
    expect(fields).toContain("categories");
    expect(fields).toContain("hasBudget");
    expect(fields).toContain("amountMin");
    const hasBudgetChip = chips.find((chip) => chip.field === "hasBudget");
    expect(hasBudgetChip?.label.toLowerCase()).toContain("no budget");
  });

  it("returns no chips for an empty filter", () => {
    expect(buildFilterChips({})).toHaveLength(0);
  });

  it("labels a raw-text fallback chip", () => {
    const chips = buildFilterChips({ q: "weird query" });
    expect(chips[0].field).toBe("q");
    expect(chips[0].label).toContain("weird query");
  });
});
