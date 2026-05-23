import { afterEach, describe, expect, it, vi } from "vitest";

import { GET as getDashboardMonthlySummary } from "./dashboard/monthly-summary/route";
import { GET as getExpensePrefills } from "./expense-prefills/route";
import { GET as getExpenses } from "./expenses/route";
import { GET as getDailyReport } from "./reports/daily/route";
import { GET as getMonthlyReport } from "./reports/monthly/route";

const mocks = vi.hoisted(() => ({
  createExpense: vi.fn(),
  getDashboardMonthlySummary: vi.fn(),
  getDailyReport: vi.fn(),
  getExpenseList: vi.fn(),
  getExpensePrefills: vi.fn(),
  getMonthlyReport: vi.fn(),
}));

vi.mock("@/db/queries", () => ({
  createExpense: mocks.createExpense,
}));

vi.mock("@/lib/services/dashboard", () => ({
  getDashboardMonthlySummary: mocks.getDashboardMonthlySummary,
}));

vi.mock("@/lib/services/expenses", () => ({
  getExpenseList: mocks.getExpenseList,
  getExpensePrefills: mocks.getExpensePrefills,
}));

vi.mock("@/lib/services/reports", () => ({
  getDailyReport: mocks.getDailyReport,
  getMonthlyReport: mocks.getMonthlyReport,
}));

afterEach(() => {
  vi.restoreAllMocks();
  Object.values(mocks).forEach((mock) => mock.mockReset());
});

describe("REST read routes", () => {
  it("returns the expense list service payload", async () => {
    const payload = {
      activeMonth: "2026-05",
      effectiveRecentDays: 14,
      groupedRows: [],
      isRecent: true,
      rows: [],
      trimmedSearch: "coffee",
    };
    mocks.getExpenseList.mockResolvedValue(payload);

    const response = await getExpenses(
      new Request(
        "http://localhost/api/expenses?month=2026-05&q=coffee&mode=recent&recentDays=14"
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(payload);
    expect(mocks.getExpenseList).toHaveBeenCalledWith({
      month: "2026-05",
      q: "coffee",
      mode: "recent",
      recentDays: 14,
    });
  });

  it("returns 400 for invalid expense list params", async () => {
    const response = await getExpenses(
      new Request("http://localhost/api/expenses?mode=all")
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid mode" });
    expect(mocks.getExpenseList).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid recentDays", async () => {
    const response = await getExpenses(
      new Request("http://localhost/api/expenses?recentDays=0")
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid recentDays",
    });
    expect(mocks.getExpenseList).not.toHaveBeenCalled();
  });

  it("returns the expense prefills service payload", async () => {
    const payload = [
      {
        note: "Lunch",
        category: "Food",
        totalFrequency: 3,
        amount: 120000,
      },
    ];
    mocks.getExpensePrefills.mockResolvedValue(payload);

    const response = await getExpensePrefills();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(payload);
  });

  it("returns the dashboard monthly summary service payload", async () => {
    const payload = {
      activeMonth: "2026-05",
      payerOptions: ["All"],
      totalsByPayer: { All: { total: 100, totals: [100] } },
    };
    mocks.getDashboardMonthlySummary.mockResolvedValue(payload);

    const response = await getDashboardMonthlySummary(
      new Request(
        "http://localhost/api/dashboard/monthly-summary?month=2026-05"
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(payload);
    expect(mocks.getDashboardMonthlySummary).toHaveBeenCalledWith("2026-05");
  });

  it("returns 400 for an invalid dashboard month", async () => {
    const response = await getDashboardMonthlySummary(
      new Request(
        "http://localhost/api/dashboard/monthly-summary?month=2026-13"
      )
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid month" });
    expect(mocks.getDashboardMonthlySummary).not.toHaveBeenCalled();
  });

  it("returns the monthly report service payload", async () => {
    const payload = {
      activeMonth: "2026-05",
      categoryTotals: [],
      paidByCategoryTotals: [],
      paidByTotalSpent: 0,
      paidByTotals: [],
    };
    mocks.getMonthlyReport.mockResolvedValue(payload);

    const response = await getMonthlyReport(
      new Request("http://localhost/api/reports/monthly?month=2026-05")
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(payload);
    expect(mocks.getMonthlyReport).toHaveBeenCalledWith("2026-05");
  });

  it("returns 400 for an invalid monthly report month", async () => {
    const response = await getMonthlyReport(
      new Request("http://localhost/api/reports/monthly?month=May")
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid month" });
    expect(mocks.getMonthlyReport).not.toHaveBeenCalled();
  });

  it("returns the daily report service payload", async () => {
    const payload = {
      activeDate: "2026-05-23",
      dailyCategoryTotals: [],
      dailyExpenses: [],
      dailyRemaining: 0,
      dailyTarget: 0,
      dateKey: "2026-05-23",
      dayIndex: 1,
      expectedSpendToDate: 0,
      hasWeeklyBudget: false,
      monthKey: "2026-05",
      paceDelta: 0,
      paceProgress: 0,
      paceStatus: "No weekly budget",
      totalSpentToday: 0,
      weekEndKey: "2026-05-24",
      weekLabel: "18 May - 24 May",
      weekSpentToDate: 0,
      weekStartKey: "2026-05-18",
      weeklyBudgetTotal: 0,
    };
    mocks.getDailyReport.mockResolvedValue(payload);

    const response = await getDailyReport(
      new Request("http://localhost/api/reports/daily?date=2026-05-23")
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(payload);
    expect(mocks.getDailyReport).toHaveBeenCalledWith("2026-05-23");
  });

  it("returns 400 for a missing daily report date", async () => {
    const response = await getDailyReport(
      new Request("http://localhost/api/reports/daily")
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid date" });
    expect(mocks.getDailyReport).not.toHaveBeenCalled();
  });
});
