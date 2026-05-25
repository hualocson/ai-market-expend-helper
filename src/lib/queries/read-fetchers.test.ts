import { syncRepository } from "@/lib/sync/core/repository";
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  budgetQueries,
  fetchBudgetOverview,
  fetchBudgetTransferCandidates,
} from "./budgets";
import { dashboardQueries, fetchDashboardMonthlySummary } from "./dashboard";
import { expenseQueries, fetchExpenseList } from "./expenses";
import { fetchDailyReport, fetchMonthlyReport, reportQueries } from "./reports";

const mockJsonResponse = (payload: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

const successEnvelope = <T>(data: T) => ({ success: true, data });

beforeEach(async () => {
  await syncRepository.testing.clearSyncDb();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await syncRepository.testing.clearSyncDb();
});

describe("read query fetchers", () => {
  it("builds expense list results from IndexedDB sync records without fetching /api/expenses", async () => {
    await syncRepository.testing.clearSyncDb();
    await syncRepository.records.put({
      entity: "expenses",
      clientId: "client-1",
      serverId: 30,
      syncStatus: "synced",
      lastError: null,
      updatedAt: "2026-05-24T10:00:00.000Z",
      serverUpdatedAt: "2026-05-24T10:00:00.000Z",
      payload: {
        date: "2026-05-24",
        amount: 50000,
        note: "Lunch",
        category: "Food",
        paidBy: "Cubi",
        budgetId: null,
        budgetName: null,
      },
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await fetchExpenseList({ month: "2026-05", limit: 30 });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.rows).toEqual([
      expect.objectContaining({
        id: 30,
        note: "Lunch",
      }),
    ]);
    expect(result.groupedRows).toEqual([
      expect.objectContaining({
        key: "2026-05-24",
        totalAmount: 50000,
      }),
    ]);
  });

  it("returns an empty expense list when IndexedDB has no matching records", async () => {
    await syncRepository.testing.clearSyncDb();
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await fetchExpenseList({ month: "2026-05", limit: 30 });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.rows).toEqual([]);
    expect(result.groupedRows).toEqual([]);
    expect(result.pagination).toMatchObject({
      limit: 30,
      offset: 0,
      hasMore: false,
    });
  });

  it("paginates expense list results from IndexedDB records", async () => {
    await syncRepository.testing.clearSyncDb();
    await syncRepository.records.putMany([
      {
        entity: "expenses",
        clientId: "client-1",
        serverId: 31,
        syncStatus: "synced",
        lastError: null,
        updatedAt: "2026-05-24T10:00:00.000Z",
        serverUpdatedAt: "2026-05-24T10:00:00.000Z",
        payload: {
          date: "2026-05-24",
          amount: 50000,
          note: "Lunch",
          category: "Food",
          paidBy: "Cubi",
          budgetId: null,
          budgetName: null,
        },
      },
      {
        entity: "expenses",
        clientId: "client-2",
        serverId: 30,
        syncStatus: "synced",
        lastError: null,
        updatedAt: "2026-05-23T10:00:00.000Z",
        serverUpdatedAt: "2026-05-23T10:00:00.000Z",
        payload: {
          date: "2026-05-23",
          amount: 20000,
          note: "Coffee",
          category: "Food",
          paidBy: "Cubi",
          budgetId: null,
          budgetName: null,
        },
      },
    ]);
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const firstPage = await fetchExpenseList({ month: "2026-05", limit: 1 });
    const secondPage = await fetchExpenseList({
      month: "2026-05",
      limit: 1,
      offset: 1,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(firstPage.rows.map((row) => row.note)).toEqual(["Lunch"]);
    expect(firstPage.pagination.hasMore).toBe(true);
    expect(secondPage.rows.map((row) => row.note)).toEqual(["Coffee"]);
    expect(secondPage.pagination.hasMore).toBe(false);
  });

  it("fetches budget transfer candidates", async () => {
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
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockJsonResponse(successEnvelope(payload)));

    await expect(fetchBudgetTransferCandidates(1)).resolves.toEqual(payload);

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/budgets/transfer-candidates?destinationId=1",
      { method: "GET", cache: "no-store" }
    );
  });

  it("fetches dashboard monthly summaries", async () => {
    const payload = {
      activeMonth: "2026-05",
      payerOptions: ["All"],
      totalsByPayer: { All: { total: 0, totals: [] } },
    };
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockJsonResponse(successEnvelope(payload)));

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
      .mockResolvedValueOnce(mockJsonResponse(successEnvelope(monthlyPayload)))
      .mockResolvedValueOnce(mockJsonResponse(successEnvelope(dailyPayload)));

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
      mockJsonResponse(
        {
          success: false,
          error: {
            code: "INVALID_MONTH",
            message: "Invalid month",
          },
        },
        { status: 400 }
      )
    );

    await expect(fetchMonthlyReport("bad-month")).rejects.toThrow(
      "Invalid month"
    );
  });

  it("throws the structured API error message from read fetchers", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockJsonResponse(
        {
          success: false,
          error: {
            code: "FETCH_BUDGETS_FAILED",
            message: "Failed to fetch budgets",
          },
        },
        { status: 400 }
      )
    );

    await expect(fetchBudgetOverview()).rejects.toThrow(
      "Failed to fetch budgets"
    );
  });

  it("adds queryFns to read query factory entries", () => {
    expect(typeof expenseQueries.list().queryFn).toBe("function");
    expect(typeof budgetQueries.transferCandidates(1).queryFn).toBe("function");
    expect(typeof dashboardQueries.monthlySummary("2026-05").queryFn).toBe(
      "function"
    );
    expect(typeof reportQueries.monthly("2026-05").queryFn).toBe("function");
    expect(typeof reportQueries.daily("2026-05-23").queryFn).toBe("function");
  });
});
