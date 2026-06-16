import { describe, expect, it } from "vitest";

import { summarizePaidByCategoryTotals } from "./reports";

describe("report services", () => {
  it("summarizes monthly payer/category totals for report cards", () => {
    expect(
      summarizePaidByCategoryTotals([
        { category: "Food", paidBy: "Cubi", total: 200 },
        { category: "Food", paidBy: "Embe", total: 100 },
        { category: "Transport", paidBy: "Cubi", total: 50 },
      ])
    ).toEqual({
      categoryTotals: [
        { category: "Food", total: 300 },
        { category: "Transport", total: 50 },
      ],
      paidByTotals: [
        { paidBy: "Cubi", total: 250 },
        { paidBy: "Embe", total: 100 },
      ],
      paidByTotalSpent: 350,
    });
  });
});
