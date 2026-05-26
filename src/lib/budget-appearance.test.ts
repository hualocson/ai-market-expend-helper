import { describe, expect, it } from "vitest";

import {
  BUDGET_COLOR_OPTIONS,
  DEFAULT_BUDGET_COLOR,
  DEFAULT_BUDGET_ICON,
  isBudgetColorId,
  normalizeBudgetColor,
  normalizeBudgetIcon,
} from "./budget-appearance";

describe("budget appearance helpers", () => {
  it("defines exactly 12 unique palette options", () => {
    expect(BUDGET_COLOR_OPTIONS).toHaveLength(12);
    expect(new Set(BUDGET_COLOR_OPTIONS.map((option) => option.id)).size).toBe(
      12
    );
  });

  it("recognizes palette ids and rejects arbitrary colors", () => {
    expect(isBudgetColorId(DEFAULT_BUDGET_COLOR)).toBe(true);
    expect(isBudgetColorId("#ff00aa")).toBe(false);
    expect(isBudgetColorId("")).toBe(false);
  });

  it("normalizes icon and color fallback values", () => {
    expect(normalizeBudgetIcon(" 🍜 ")).toBe("🍜");
    expect(normalizeBudgetIcon("")).toBe(DEFAULT_BUDGET_ICON);
    expect(normalizeBudgetIcon("long-label")).toBe(DEFAULT_BUDGET_ICON);
    expect(normalizeBudgetColor("sky")).toBe("sky");
    expect(normalizeBudgetColor("custom")).toBe(DEFAULT_BUDGET_COLOR);
  });
});
