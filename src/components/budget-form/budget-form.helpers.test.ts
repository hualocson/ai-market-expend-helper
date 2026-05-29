import { describe, expect, it } from "vitest";

import {
  PERIOD_OPTIONS,
  formatDatePickerValue,
  formatStartDateLabel,
  parseDatePickerValue,
  resolvePeriodStart,
} from "./budget-form.helpers";

describe("budget-form helpers", () => {
  it("exposes week/month/custom period options", () => {
    expect(PERIOD_OPTIONS.map((option) => option.value)).toEqual([
      "week",
      "month",
      "custom",
    ]);
  });

  it("resolvePeriodStart snaps month to the first of the month", () => {
    expect(resolvePeriodStart("month", "2026-05-14")).toBe("2026-05-01");
  });

  it("resolvePeriodStart snaps week to the week start", () => {
    // 2026-05-14 is a Thursday; week starts Sunday 2026-05-10.
    expect(resolvePeriodStart("week", "2026-05-14")).toBe("2026-05-10");
  });

  it("resolvePeriodStart keeps the given day for custom", () => {
    expect(resolvePeriodStart("custom", "2026-05-14")).toBe("2026-05-14");
  });

  it("round-trips date picker formatting", () => {
    expect(formatDatePickerValue("2026-05-14")).toBe("14/05/2026");
    expect(parseDatePickerValue("14/05/2026")).toBe("2026-05-14");
  });

  it("labels an invalid start date as a prompt", () => {
    expect(formatStartDateLabel("")).toBe("Pick date");
    expect(formatStartDateLabel("2026-05-14")).toBe("14/05/2026");
  });
});
