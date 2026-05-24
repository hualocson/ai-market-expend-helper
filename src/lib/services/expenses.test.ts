import { afterEach, describe, expect, it, vi } from "vitest";

import {
  groupExpenseRowsByDate,
  resolveExpenseListRange,
} from "./expenses";

vi.mock("@/db", () => ({
  db: {},
}));

afterEach(() => {
  vi.useRealTimers();
});

describe("expense services", () => {
  it("resolves recent ranges within the selected month", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-23T12:00:00Z"));

    const range = resolveExpenseListRange({
      month: "2026-05",
      mode: "recent",
      recentDays: 7,
    });

    expect(range.activeMonth.format("YYYY-MM")).toBe("2026-05");
    expect(range.rangeStart.format("YYYY-MM-DD")).toBe("2026-05-17");
    expect(range.rangeEnd.format("YYYY-MM-DD")).toBe("2026-05-24");
    expect(range.effectiveRecentDays).toBe(7);
  });

  it("groups expense rows by formatted date and totals each day", () => {
    const rows = [
      {
        id: 2,
        date: "2026-05-22",
        amount: 200,
        note: "Lunch",
        category: "Food",
        paidBy: "Cubi",
        budgetId: null,
        budgetName: null,
      },
      {
        id: 1,
        date: "2026-05-22",
        amount: 100,
        note: "Coffee",
        category: "Food",
        paidBy: "Embe",
        budgetId: 10,
        budgetName: "Meals",
      },
      {
        id: 3,
        date: "2026-05-21",
        amount: 50,
        note: "Bus",
        category: "Transport",
        paidBy: "Cubi",
        budgetId: null,
        budgetName: null,
      },
    ];

    expect(groupExpenseRowsByDate(rows)).toMatchObject([
      {
        key: "2026-05-22",
        label: "Friday, 22/05/2026",
        totalAmount: 300,
        items: [rows[0], rows[1]],
      },
      {
        key: "2026-05-21",
        label: "Thursday, 21/05/2026",
        totalAmount: 50,
        items: [rows[2]],
      },
    ]);
  });

});
