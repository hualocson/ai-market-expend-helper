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

  it("does not create a chip for raw search text", () => {
    const chips = buildFilterChips({ q: "weird query" });
    expect(chips).toHaveLength(0);
  });

  it("shows a single date when dateFrom and dateTo are the same", () => {
    const chips = buildFilterChips({
      dateFrom: "2026-05-31",
      dateTo: "2026-05-31",
    });

    expect(chips).toContainEqual({
      field: "dateRange",
      label: "2026-05-31",
      dateRange: undefined,
    });
  });

  it("keeps date ranges as structured chip data without a symbol separator", () => {
    const chips = buildFilterChips({
      dateFrom: "2026-05-01",
      dateTo: "2026-05-31",
    });

    expect(chips).toContainEqual({
      field: "dateRange",
      label: "2026-05-01 to 2026-05-31",
      dateRange: {
        from: "2026-05-01",
        to: "2026-05-31",
      },
    });
  });
});
