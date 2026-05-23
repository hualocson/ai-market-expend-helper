import { afterEach, describe, expect, it, vi } from "vitest";

import { dashboardQueries, fetchDashboardMonthlySummary } from "./dashboard";
import {
  expenseQueries,
  fetchExpenseList,
  fetchExpensePrefills,
} from "./expenses";
import { fetchDailyReport, fetchMonthlyReport, reportQueries } from "./reports";

const mockJsonResponse = (payload: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("read query fetchers", () => {
  it("fetches expense lists with query params", async () => {
    const payload = {
      activeMonth: "2026-05",
      effectiveRecentDays: 14,
      groupedRows: [],
      isRecent: true,
      rows: [],
    };
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockJsonResponse(payload));

    await expect(
      fetchExpenseList({
        month: "2026-05",
        q: "coffee",
        mode: "recent",
        recentDays: 14,
      })
    ).resolves.toEqual(payload);

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/expenses?month=2026-05&q=coffee&mode=recent&recentDays=14",
      { method: "GET", cache: "no-store" }
    );
  });

  it("fetches expense prefills", async () => {
    const payload = [{ note: "Lunch", category: "Food", amount: 120000 }];
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockJsonResponse(payload));

    await expect(fetchExpensePrefills()).resolves.toEqual(payload);

    expect(fetchSpy).toHaveBeenCalledWith("/api/expense-prefills", {
      method: "GET",
      cache: "no-store",
    });
  });

  it("fetches dashboard monthly summaries", async () => {
    const payload = {
      activeMonth: "2026-05",
      payerOptions: ["All"],
      totalsByPayer: { All: { total: 0, totals: [] } },
    };
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockJsonResponse(payload));

    await expect(fetchDashboardMonthlySummary("2026-05")).resolves.toEqual(
      payload
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/dashboard/monthly-summary?month=2026-05",
      { method: "GET", cache: "no-store" }
    );
  });

  it("fetches monthly and daily reports", async () => {
    const monthlyPayload = { activeMonth: "2026-05" };
    const dailyPayload = { activeDate: "2026-05-23" };
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(mockJsonResponse(monthlyPayload))
      .mockResolvedValueOnce(mockJsonResponse(dailyPayload));

    await expect(fetchMonthlyReport("2026-05")).resolves.toEqual(
      monthlyPayload
    );
    await expect(fetchDailyReport("2026-05-23")).resolves.toEqual(dailyPayload);

    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      "/api/reports/monthly?month=2026-05",
      { method: "GET", cache: "no-store" }
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      "/api/reports/daily?date=2026-05-23",
      { method: "GET", cache: "no-store" }
    );
  });

  it("throws route error messages", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockJsonResponse({ error: "Invalid month" }, { status: 400 })
    );

    await expect(fetchMonthlyReport("bad-month")).rejects.toThrow(
      "Invalid month"
    );
  });

  it("adds queryFns to read query factory entries", () => {
    expect(typeof expenseQueries.list().queryFn).toBe("function");
    expect(typeof expenseQueries.prefills.queryFn).toBe("function");
    expect(typeof dashboardQueries.monthlySummary("2026-05").queryFn).toBe(
      "function"
    );
    expect(typeof reportQueries.monthly("2026-05").queryFn).toBe("function");
    expect(typeof reportQueries.daily("2026-05-23").queryFn).toBe("function");
  });
});
