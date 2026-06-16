import { afterEach, describe, expect, it, vi } from "vitest";

import { GET as getBudgetWeekly } from "./budget-weekly/route";
import { GET as getBudgetTransactions } from "./budgets/[id]/transactions/route";
import { GET as getBudgets } from "./budgets/route";
import { GET as getBudgetTransferCandidates } from "./budgets/transfer-candidates/route";
import { GET as getDashboardMonthlySummary } from "./dashboard/monthly-summary/route";
import { GET as getExpenses } from "./expenses/route";
import { GET as getExpenseSync } from "./expenses/sync/route";
import { GET as getMonthlyReport } from "./reports/monthly/route";

const mocks = vi.hoisted(() => ({
  createExpense: vi.fn(),
  getBudgetOverview: vi.fn(),
  getBudgetTransferCandidates: vi.fn(),
  getBudgetTransactions: vi.fn(),
  getBudgetWeeklyReport: vi.fn(),
  getDashboardMonthlySummary: vi.fn(),
  getExpenseChangesSince: vi.fn(),
  getExpenseList: vi.fn(),
  getMonthlyReport: vi.fn(),
  pushExpenseOperations: vi.fn(),
}));

vi.mock("@/db/queries", () => ({
  createExpense: mocks.createExpense,
}));

vi.mock("@/db/budget-queries", () => ({
  getBudgetOverview: mocks.getBudgetOverview,
  getBudgetTransactions: mocks.getBudgetTransactions,
  getWeeklyBudgetReport: mocks.getBudgetWeeklyReport,
  getTransferCandidates: mocks.getBudgetTransferCandidates,
}));

vi.mock("@/lib/services/dashboard", () => ({
  getDashboardMonthlySummary: mocks.getDashboardMonthlySummary,
}));

vi.mock("@/lib/services/expenses", () => ({
  getExpenseList: mocks.getExpenseList,
}));

vi.mock("@/lib/services/expense-sync", () => ({
  getExpenseChangesSince: mocks.getExpenseChangesSince,
  pushExpenseOperations: mocks.pushExpenseOperations,
}));

vi.mock("@/lib/services/reports", () => ({
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
        "http://localhost/api/expenses?month=2026-05&q=coffee&mode=recent&recentDays=14&limit=30&offset=60"
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: payload,
    });
    expect(mocks.getExpenseList).toHaveBeenCalledWith({
      month: "2026-05",
      q: "coffee",
      mode: "recent",
      recentDays: 14,
      limit: 30,
      offset: 60,
    });
  });

  it("returns an error envelope when expense list fetching fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.getExpenseList.mockRejectedValue(new Error("database unavailable"));

    const response = await getExpenses(
      new Request("http://localhost/api/expenses")
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: "FETCH_EXPENSES_FAILED",
        message: "Failed to fetch expenses",
      },
    });
  });

  it("pulls expense sync changes from a cursor", async () => {
    const payload = {
      cursor: "2026-05-24T10:00:00.000Z",
      changes: [],
    };
    mocks.getExpenseChangesSince.mockResolvedValue(payload);

    const response = await getExpenseSync(
      new Request(
        "http://localhost/api/expenses/sync?cursor=2026-05-24T09:00:00.000Z"
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: payload,
    });
    expect(mocks.getExpenseChangesSince).toHaveBeenCalledWith(
      "2026-05-24T09:00:00.000Z"
    );
  });

  it("returns an error envelope for invalid expense sync cursors", async () => {
    const response = await getExpenseSync(
      new Request("http://localhost/api/expenses/sync?cursor=not-a-date")
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: "INVALID_CURSOR",
        message: "Invalid cursor",
      },
    });
    expect(mocks.getExpenseChangesSince).not.toHaveBeenCalled();
  });

  it("returns an error envelope when expense sync pull fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.getExpenseChangesSince.mockRejectedValue(
      new Error("database unavailable")
    );

    const response = await getExpenseSync(
      new Request("http://localhost/api/expenses/sync")
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: "SYNC_EXPENSES_FAILED",
        message: "Failed to sync expenses",
      },
    });
  });

  it("returns the budget overview service payload", async () => {
    const payload = {
      budgets: [],
      totals: {
        allocated: 0,
        remaining: 0,
        spent: 0,
      },
    };
    mocks.getBudgetOverview.mockResolvedValue(payload);

    const response = await getBudgets();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: payload,
    });
    expect(mocks.getBudgetOverview).toHaveBeenCalledWith();
  });

  it("returns an error envelope when budget overview fetching fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.getBudgetOverview.mockRejectedValue(
      new Error("database unavailable")
    );

    const response = await getBudgets();

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: "FETCH_BUDGETS_FAILED",
        message: "Failed to fetch budgets",
      },
    });
  });

  it("returns the weekly budget service payload", async () => {
    const payload = {
      budgets: [],
      searchQuery: "groceries",
      weekStart: "2026-05-18",
    };
    mocks.getBudgetWeeklyReport.mockResolvedValue(payload);

    const response = await getBudgetWeekly(
      new Request(
        "http://localhost/api/budget-weekly?weekStart=2026-05-18&q=groceries"
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: payload,
    });
    expect(mocks.getBudgetWeeklyReport).toHaveBeenCalledWith(
      "2026-05-18",
      "groceries"
    );
  });

  it("returns an error envelope when weekly budget fetching fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.getBudgetWeeklyReport.mockRejectedValue(
      new Error("database unavailable")
    );

    const response = await getBudgetWeekly(
      new Request("http://localhost/api/budget-weekly?weekStart=2026-05-18")
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: "FETCH_BUDGETS_FAILED",
        message: "Failed to fetch budget report",
      },
    });
  });

  it("returns budget transactions for the requested budget", async () => {
    const payload = {
      budget: { id: 1, name: "Dining" },
      pagination: { limit: 20, offset: 0 },
      transactions: [],
    };
    mocks.getBudgetTransactions.mockResolvedValue(payload);

    const response = await getBudgetTransactions(
      new Request("http://localhost/api/budgets/1/transactions"),
      { params: Promise.resolve({ id: "1" }) }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: payload,
    });
    expect(mocks.getBudgetTransactions).toHaveBeenCalledWith(1, {
      limit: 20,
      offset: 0,
    });
  });

  it("returns 400 for an invalid budget transaction id", async () => {
    const response = await getBudgetTransactions(
      new Request("http://localhost/api/budgets/abc/transactions"),
      { params: Promise.resolve({ id: "abc" }) }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: "INVALID_PARAMS",
        message: "Invalid budget id",
      },
    });
    expect(mocks.getBudgetTransactions).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid budget transaction pagination", async () => {
    const response = await getBudgetTransactions(
      new Request("http://localhost/api/budgets/1/transactions?limit=0"),
      { params: Promise.resolve({ id: "1" }) }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: "INVALID_PARAMS",
        message: "Invalid limit",
      },
    });
    expect(mocks.getBudgetTransactions).not.toHaveBeenCalled();
  });

  it("returns a 404 envelope when budget transactions cannot find the budget", async () => {
    mocks.getBudgetTransactions.mockRejectedValue(
      new Error("Budget not found")
    );

    const response = await getBudgetTransactions(
      new Request("http://localhost/api/budgets/1/transactions"),
      { params: Promise.resolve({ id: "1" }) }
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: "FETCH_BUDGETS_FAILED",
        message: "Budget not found",
      },
    });
  });

  it("returns an error envelope when budget transactions fetching fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.getBudgetTransactions.mockRejectedValue(
      new Error("database unavailable")
    );

    const response = await getBudgetTransactions(
      new Request("http://localhost/api/budgets/1/transactions"),
      { params: Promise.resolve({ id: "1" }) }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: "FETCH_BUDGETS_FAILED",
        message: "Failed to fetch budget transactions",
      },
    });
  });

  it("returns budget transfer candidates for the destination budget", async () => {
    const payload = [
      {
        id: 2,
        name: "Dining",
        amount: 500000,
        spent: 100000,
        remaining: 400000,
        period: "week",
        periodStartDate: "2026-05-18",
        periodEndDate: "2026-05-24",
      },
    ];
    mocks.getBudgetTransferCandidates.mockResolvedValue(payload);

    const response = await getBudgetTransferCandidates(
      new Request(
        "http://localhost/api/budgets/transfer-candidates?destinationId=1"
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: payload,
    });
    expect(mocks.getBudgetTransferCandidates).toHaveBeenCalledWith(1);
  });

  it("returns 400 for an invalid transfer candidate destination", async () => {
    const response = await getBudgetTransferCandidates(
      new Request(
        "http://localhost/api/budgets/transfer-candidates?destinationId=0"
      )
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: "INVALID_PARAMS",
        message: "Invalid destination budget id",
      },
    });
    expect(mocks.getBudgetTransferCandidates).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid expense list params", async () => {
    const response = await getExpenses(
      new Request("http://localhost/api/expenses?mode=all")
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: "INVALID_PARAMS",
        message: "Invalid mode",
      },
    });
    expect(mocks.getExpenseList).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid recentDays", async () => {
    const response = await getExpenses(
      new Request("http://localhost/api/expenses?recentDays=0")
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: "INVALID_PARAMS",
        message: "Invalid recentDays",
      },
    });
    expect(mocks.getExpenseList).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid expense pagination", async () => {
    const response = await getExpenses(
      new Request("http://localhost/api/expenses?offset=-1")
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: "INVALID_PARAMS",
        message: "Invalid offset",
      },
    });
    expect(mocks.getExpenseList).not.toHaveBeenCalled();
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
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: payload,
    });
    expect(mocks.getDashboardMonthlySummary).toHaveBeenCalledWith("2026-05");
  });

  it("returns 400 for an invalid dashboard month", async () => {
    const response = await getDashboardMonthlySummary(
      new Request(
        "http://localhost/api/dashboard/monthly-summary?month=2026-13"
      )
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: "INVALID_PARAMS",
        message: "Invalid month",
      },
    });
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
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: payload,
    });
    expect(mocks.getMonthlyReport).toHaveBeenCalledWith("2026-05");
  });

  it("returns 400 for an invalid monthly report month", async () => {
    const response = await getMonthlyReport(
      new Request("http://localhost/api/reports/monthly?month=May")
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: "INVALID_PARAMS",
        message: "Invalid month",
      },
    });
    expect(mocks.getMonthlyReport).not.toHaveBeenCalled();
  });

  it("returns an error envelope when monthly report fetching fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.getMonthlyReport.mockRejectedValue(new Error("database unavailable"));

    const response = await getMonthlyReport(
      new Request("http://localhost/api/reports/monthly?month=2026-05")
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: "FETCH_REPORT_FAILED",
        message: "Failed to fetch monthly report",
      },
    });
  });
});
