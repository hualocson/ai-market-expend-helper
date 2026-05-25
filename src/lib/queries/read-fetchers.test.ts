import { syncRepository } from "@/lib/sync/core/repository";
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { budgetQueries, fetchBudgetTransferCandidates } from "./budgets";
import { dashboardQueries, fetchDashboardMonthlySummary } from "./dashboard";
import { expenseQueries, fetchExpenseList } from "./expenses";
import { fetchDailyReport, fetchMonthlyReport, reportQueries } from "./reports";

const mockJsonResponse = (payload: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

beforeEach(async () => {
  await syncRepository.testing.clearSyncDb();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await syncRepository.testing.clearSyncDb();
});

describe("read query fetchers", () => {
  it("returns local expense IndexedDB rows before fetching the network", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    await syncRepository.records.put({
      entity: "expenses",
      clientId: "client-1",
      serverId: 1,
      syncStatus: "synced",
      lastError: null,
      updatedAt: "2026-05-24T09:00:00.000Z",
      serverUpdatedAt: "2026-05-24T09:00:00.000Z",
      payload: {
        date: "2026-05-23",
        amount: 45000,
        note: "Coffee",
        category: "Food",
        paidBy: "Cubi",
        budgetId: null,
        budgetName: null,
      },
    });

    const result = await fetchExpenseList({ month: "2026-05", limit: 1 });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ note: "Coffee", amount: 45000 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches the server page when local rows only partially fill the first page", async () => {
    await syncRepository.records.put({
      entity: "expenses",
      clientId: "client-1",
      serverId: 1,
      syncStatus: "synced",
      lastError: null,
      updatedAt: "2026-05-24T09:00:00.000Z",
      serverUpdatedAt: "2026-05-24T09:00:00.000Z",
      payload: {
        date: "2026-05-23",
        amount: 45000,
        note: "Coffee",
        category: "Food",
        paidBy: "Cubi",
        budgetId: null,
        budgetName: null,
      },
    });
    const serverPage = {
      activeMonth: "2026-05",
      effectiveRecentDays: 7,
      groupedRows: [],
      isRecent: false,
      pagination: {
        limit: 30,
        offset: 0,
        hasMore: true,
      },
      rows: [
        {
          id: 1,
          date: "2026-05-23",
          amount: 45000,
          note: "Coffee",
          category: "Food",
          paidBy: "Cubi",
          budgetId: null,
          budgetName: null,
        },
        {
          id: 2,
          date: "2026-05-22",
          amount: 50000,
          note: "Lunch",
          category: "Food",
          paidBy: "Embe",
          budgetId: null,
          budgetName: null,
        },
      ],
    };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockJsonResponse(serverPage));

    await expect(
      fetchExpenseList({ month: "2026-05", limit: 30 })
    ).resolves.toEqual(serverPage);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/expenses?month=2026-05&limit=30",
      { method: "GET", cache: "no-store" }
    );
  });

  it("serves matching local-only dirty rows immediately on the first page", async () => {
    await syncRepository.records.put({
      entity: "expenses",
      clientId: "pending-create",
      serverId: null,
      syncStatus: "pending",
      lastError: null,
      updatedAt: "2026-05-24T10:00:00.000Z",
      serverUpdatedAt: null,
      payload: {
        date: "2026-05-24",
        amount: 60000,
        note: "Offline coffee",
        category: "Food",
        paidBy: "Cubi",
        budgetId: null,
        budgetName: null,
      },
    });
    await syncRepository.records.put({
      entity: "expenses",
      clientId: "server-1",
      serverId: 1,
      syncStatus: "synced",
      lastError: null,
      updatedAt: "2026-05-24T09:00:00.000Z",
      serverUpdatedAt: "2026-05-24T09:00:00.000Z",
      payload: {
        date: "2026-05-23",
        amount: 45000,
        note: "Server cached",
        category: "Food",
        paidBy: "Cubi",
        budgetId: null,
        budgetName: null,
      },
    });
    const serverPage = {
      activeMonth: "2026-05",
      effectiveRecentDays: 7,
      groupedRows: [],
      isRecent: false,
      pagination: {
        limit: 2,
        offset: 0,
        hasMore: true,
      },
      rows: [
        {
          id: 1,
          date: "2026-05-23",
          amount: 45000,
          note: "Server cached",
          category: "Food",
          paidBy: "Cubi",
          budgetId: null,
          budgetName: null,
        },
        {
          id: 2,
          date: "2026-05-22",
          amount: 50000,
          note: "Server next",
          category: "Food",
          paidBy: "Embe",
          budgetId: null,
          budgetName: null,
        },
      ],
    };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockJsonResponse(serverPage));

    const result = await fetchExpenseList({ month: "2026-05", limit: 2 });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.rows).toMatchObject([
      { amount: 60000, note: "Offline coffee" },
    ]);
    expect(result.pagination.hasMore).toBe(true);
    expect(result.pagination.nextOffset).toBe(-1);

    await fetchExpenseList({
      month: "2026-05",
      limit: 2,
      offset: result.pagination.nextOffset,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/expenses?month=2026-05&limit=2&offset=0",
      { method: "GET", cache: "no-store" }
    );
  });

  it("keeps a full local first page open for infinite loading", async () => {
    await syncRepository.records.put({
      entity: "expenses",
      clientId: "client-1",
      serverId: 1,
      syncStatus: "synced",
      lastError: null,
      updatedAt: "2026-05-24T09:00:00.000Z",
      serverUpdatedAt: "2026-05-24T09:00:00.000Z",
      payload: {
        date: "2026-05-23",
        amount: 45000,
        note: "Coffee",
        category: "Food",
        paidBy: "Cubi",
        budgetId: null,
        budgetName: null,
      },
    });

    const result = await fetchExpenseList({ month: "2026-05", limit: 1 });

    expect(result.rows).toHaveLength(1);
    expect(result.pagination.hasMore).toBe(true);
  });

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
        limit: 30,
        offset: 60,
      })
    ).resolves.toEqual(payload);

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/expenses?month=2026-05&q=coffee&mode=recent&recentDays=14&limit=30&offset=60",
      { method: "GET", cache: "no-store" }
    );
  });

  it("falls back to the network when local rows do not match the requested month", async () => {
    await syncRepository.records.put({
      entity: "expenses",
      clientId: "may-client",
      serverId: 1,
      syncStatus: "synced",
      lastError: null,
      updatedAt: "2026-05-24T09:00:00.000Z",
      serverUpdatedAt: "2026-05-24T09:00:00.000Z",
      payload: {
        date: "2026-05-23",
        amount: 45000,
        note: "Coffee",
        category: "Food",
        paidBy: "Cubi",
        budgetId: null,
        budgetName: null,
      },
    });
    const junePayload = {
      activeMonth: "2026-06",
      effectiveRecentDays: 7,
      groupedRows: [],
      isRecent: false,
      pagination: {
        limit: 30,
        offset: 0,
        hasMore: false,
      },
      rows: [
        {
          id: 2,
          date: "2026-06-02",
          amount: 50000,
          note: "Lunch",
          category: "Food",
          paidBy: "Embe",
          budgetId: null,
          budgetName: null,
        },
      ],
    };
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockJsonResponse(junePayload));

    await expect(fetchExpenseList({ month: "2026-06" })).resolves.toEqual(
      junePayload
    );

    expect(fetchSpy).toHaveBeenCalledWith("/api/expenses?month=2026-06", {
      method: "GET",
      cache: "no-store",
    });
  });

  it("fetches and seeds additional expense pages when local rows cannot fill the requested offset", async () => {
    const firstPage = {
      activeMonth: "2026-05",
      effectiveRecentDays: 7,
      groupedRows: [],
      isRecent: false,
      pagination: {
        limit: 1,
        offset: 0,
        hasMore: true,
      },
      rows: [
        {
          id: 1,
          date: "2026-05-24",
          amount: 45000,
          note: "Coffee",
          category: "Food",
          paidBy: "Cubi",
          budgetId: null,
          budgetName: null,
        },
      ],
    };
    const secondPage = {
      activeMonth: "2026-05",
      effectiveRecentDays: 7,
      groupedRows: [],
      isRecent: false,
      pagination: {
        limit: 1,
        offset: 0,
        hasMore: false,
      },
      rows: [
        {
          id: 2,
          date: "2026-05-23",
          amount: 50000,
          note: "Lunch",
          category: "Food",
          paidBy: "Embe",
          budgetId: null,
          budgetName: null,
        },
      ],
    };
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(mockJsonResponse(firstPage))
      .mockResolvedValueOnce(mockJsonResponse(secondPage));

    await expect(
      fetchExpenseList({ month: "2026-05", limit: 1 })
    ).resolves.toEqual(firstPage);
    await expect(
      fetchExpenseList({ month: "2026-05", limit: 1, offset: 1 })
    ).resolves.toEqual(secondPage);

    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      "/api/expenses?month=2026-05&limit=1&offset=1",
      { method: "GET", cache: "no-store" }
    );
    await expect(syncRepository.records.list("expenses")).resolves.toHaveLength(
      2
    );
  });

  it("does not duplicate or overwrite a dirty local row when seeding the same server id", async () => {
    await syncRepository.records.put({
      entity: "expenses",
      clientId: "client-1",
      serverId: 1,
      syncStatus: "pending",
      lastError: null,
      updatedAt: "2026-05-24T10:00:00.000Z",
      serverUpdatedAt: "2026-05-24T09:00:00.000Z",
      payload: {
        date: "2026-05-23",
        amount: 60000,
        note: "Local edit",
        category: "Food",
        paidBy: "Cubi",
        budgetId: null,
        budgetName: null,
      },
    });
    const serverPage = {
      activeMonth: "2026-05",
      effectiveRecentDays: 7,
      groupedRows: [],
      isRecent: false,
      pagination: {
        limit: 1,
        offset: 1,
        hasMore: false,
      },
      rows: [
        {
          id: 1,
          date: "2026-05-23",
          amount: 45000,
          note: "Server value",
          category: "Food",
          paidBy: "Cubi",
          budgetId: null,
          budgetName: null,
        },
      ],
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockJsonResponse(serverPage)
    );

    const result = await fetchExpenseList({
      month: "2026-05",
      limit: 1,
    });

    expect(result.rows).toMatchObject([
      {
        id: 1,
        amount: 60000,
        note: "Local edit",
      },
    ]);
    await expect(
      syncRepository.records.list("expenses")
    ).resolves.toMatchObject([
      {
        clientId: "client-1",
        serverId: 1,
        syncStatus: "pending",
        payload: expect.objectContaining({
          amount: 60000,
          note: "Local edit",
        }),
      },
    ]);
  });

  it("does not return a stale network row hidden by a dirty local delete", async () => {
    await syncRepository.records.put({
      entity: "expenses",
      clientId: "client-1",
      serverId: 1,
      syncStatus: "deleted",
      lastError: null,
      updatedAt: "2026-05-24T10:00:00.000Z",
      serverUpdatedAt: "2026-05-24T09:00:00.000Z",
      payload: {
        date: "2026-05-23",
        amount: 45000,
        note: "Deleted local expense",
        category: "Food",
        paidBy: "Cubi",
        budgetId: null,
        budgetName: null,
      },
    });
    const serverPage = {
      activeMonth: "2026-05",
      effectiveRecentDays: 7,
      groupedRows: [],
      isRecent: false,
      pagination: {
        limit: 30,
        offset: 0,
        hasMore: false,
      },
      rows: [
        {
          id: 1,
          date: "2026-05-23",
          amount: 45000,
          note: "Server stale expense",
          category: "Food",
          paidBy: "Cubi",
          budgetId: null,
          budgetName: null,
        },
      ],
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockJsonResponse(serverPage)
    );

    const result = await fetchExpenseList({ month: "2026-05", limit: 30 });

    expect(result.rows).toEqual([]);
    expect(result.groupedRows).toEqual([]);
  });

  it("does not return a dirty network overlay when the local edit no longer matches the requested month", async () => {
    await syncRepository.records.put({
      entity: "expenses",
      clientId: "client-1",
      serverId: 1,
      syncStatus: "pending",
      lastError: null,
      updatedAt: "2026-05-24T10:00:00.000Z",
      serverUpdatedAt: "2026-05-24T09:00:00.000Z",
      payload: {
        date: "2026-06-01",
        amount: 60000,
        note: "Moved local edit",
        category: "Food",
        paidBy: "Cubi",
        budgetId: null,
        budgetName: null,
      },
    });
    const serverPage = {
      activeMonth: "2026-05",
      effectiveRecentDays: 7,
      groupedRows: [],
      isRecent: false,
      pagination: {
        limit: 30,
        offset: 0,
        hasMore: false,
      },
      rows: [
        {
          id: 1,
          date: "2026-05-23",
          amount: 45000,
          note: "Server value",
          category: "Food",
          paidBy: "Cubi",
          budgetId: null,
          budgetName: null,
        },
      ],
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockJsonResponse(serverPage)
    );

    const result = await fetchExpenseList({ month: "2026-05", limit: 30 });

    expect(result.rows).toEqual([]);
    expect(result.groupedRows).toEqual([]);
  });

  it("serves a matching pending local create immediately without waiting on the network", async () => {
    await syncRepository.records.put({
      entity: "expenses",
      clientId: "pending-create",
      serverId: null,
      syncStatus: "pending",
      lastError: null,
      updatedAt: "2026-05-24T10:00:00.000Z",
      serverUpdatedAt: null,
      payload: {
        date: "2026-05-24",
        amount: 60000,
        note: "Offline coffee",
        category: "Food",
        paidBy: "Cubi",
        budgetId: null,
        budgetName: null,
      },
    });
    const serverPage = {
      activeMonth: "2026-05",
      effectiveRecentDays: 7,
      groupedRows: [],
      isRecent: false,
      pagination: {
        limit: 30,
        offset: 0,
        hasMore: false,
      },
      rows: [
        {
          id: 1,
          date: "2026-05-23",
          amount: 45000,
          note: "Server value",
          category: "Food",
          paidBy: "Cubi",
          budgetId: null,
          budgetName: null,
        },
      ],
    };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockJsonResponse(serverPage));

    const result = await fetchExpenseList({ month: "2026-05", limit: 30 });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.rows).toMatchObject([
      {
        amount: 60000,
        note: "Offline coffee",
      },
    ]);
    expect(result.pagination.hasMore).toBe(true);
    expect(result.pagination.nextOffset).toBe(-1);

    await fetchExpenseList({
      month: "2026-05",
      limit: 30,
      offset: result.pagination.nextOffset,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/expenses?month=2026-05&limit=30&offset=0",
      { method: "GET", cache: "no-store" }
    );
  });

  it("does not duplicate a pending local create on later network pages", async () => {
    await syncRepository.records.put({
      entity: "expenses",
      clientId: "pending-create",
      serverId: null,
      syncStatus: "pending",
      lastError: null,
      updatedAt: "2026-05-24T10:00:00.000Z",
      serverUpdatedAt: null,
      payload: {
        date: "2026-05-24",
        amount: 60000,
        note: "Offline coffee",
        category: "Food",
        paidBy: "Cubi",
        budgetId: null,
        budgetName: null,
      },
    });
    const secondPage = {
      activeMonth: "2026-05",
      effectiveRecentDays: 7,
      groupedRows: [],
      isRecent: false,
      pagination: {
        limit: 30,
        offset: 30,
        hasMore: false,
      },
      rows: [
        {
          id: 2,
          date: "2026-05-22",
          amount: 50000,
          note: "Server lunch",
          category: "Food",
          paidBy: "Embe",
          budgetId: null,
          budgetName: null,
        },
      ],
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockJsonResponse(secondPage)
    );

    const result = await fetchExpenseList({
      month: "2026-05",
      limit: 30,
      offset: 30,
    });

    expect(result.rows).toMatchObject([
      {
        id: 2,
        note: "Server lunch",
      },
    ]);
  });

  it("fetches nonzero server pages when a matching local-only row shifts local ordering", async () => {
    await syncRepository.records.put({
      entity: "expenses",
      clientId: "pending-create",
      serverId: null,
      syncStatus: "pending",
      lastError: null,
      updatedAt: "2026-05-24T10:00:00.000Z",
      serverUpdatedAt: null,
      payload: {
        date: "2026-05-24",
        amount: 60000,
        note: "Offline coffee",
        category: "Food",
        paidBy: "Cubi",
        budgetId: null,
        budgetName: null,
      },
    });
    await syncRepository.records.put({
      entity: "expenses",
      clientId: "server-1",
      serverId: 1,
      syncStatus: "synced",
      lastError: null,
      updatedAt: "2026-05-24T09:00:00.000Z",
      serverUpdatedAt: "2026-05-24T09:00:00.000Z",
      payload: {
        date: "2026-05-23",
        amount: 45000,
        note: "Cached server first",
        category: "Food",
        paidBy: "Cubi",
        budgetId: null,
        budgetName: null,
      },
    });
    await syncRepository.records.put({
      entity: "expenses",
      clientId: "server-2",
      serverId: 2,
      syncStatus: "synced",
      lastError: null,
      updatedAt: "2026-05-24T08:00:00.000Z",
      serverUpdatedAt: "2026-05-24T08:00:00.000Z",
      payload: {
        date: "2026-05-22",
        amount: 50000,
        note: "Cached server second",
        category: "Food",
        paidBy: "Embe",
        budgetId: null,
        budgetName: null,
      },
    });
    const secondPage = {
      activeMonth: "2026-05",
      effectiveRecentDays: 7,
      groupedRows: [],
      isRecent: false,
      pagination: {
        limit: 1,
        offset: 1,
        hasMore: false,
      },
      rows: [
        {
          id: 2,
          date: "2026-05-22",
          amount: 50000,
          note: "Server second",
          category: "Food",
          paidBy: "Embe",
          budgetId: null,
          budgetName: null,
        },
      ],
    };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockJsonResponse(secondPage));

    const result = await fetchExpenseList({
      month: "2026-05",
      limit: 1,
      offset: 1,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/expenses?month=2026-05&limit=1&offset=1",
      { method: "GET", cache: "no-store" }
    );
    expect(result.rows).toMatchObject([
      {
        id: 2,
        note: "Server second",
      },
    ]);
  });

  it("fetches nonzero server pages even when local cache has a full synced page", async () => {
    await syncRepository.records.put({
      entity: "expenses",
      clientId: "server-1",
      serverId: 1,
      syncStatus: "synced",
      lastError: null,
      updatedAt: "2026-05-24T09:00:00.000Z",
      serverUpdatedAt: "2026-05-24T09:00:00.000Z",
      payload: {
        date: "2026-05-23",
        amount: 45000,
        note: "Cached server first",
        category: "Food",
        paidBy: "Cubi",
        budgetId: null,
        budgetName: null,
      },
    });
    await syncRepository.records.put({
      entity: "expenses",
      clientId: "server-2",
      serverId: 2,
      syncStatus: "synced",
      lastError: null,
      updatedAt: "2026-05-24T08:00:00.000Z",
      serverUpdatedAt: "2026-05-24T08:00:00.000Z",
      payload: {
        date: "2026-05-22",
        amount: 50000,
        note: "Cached server second",
        category: "Food",
        paidBy: "Embe",
        budgetId: null,
        budgetName: null,
      },
    });
    const secondPage = {
      activeMonth: "2026-05",
      effectiveRecentDays: 7,
      groupedRows: [],
      isRecent: false,
      pagination: {
        limit: 1,
        offset: 1,
        hasMore: true,
      },
      rows: [
        {
          id: 2,
          date: "2026-05-22",
          amount: 50000,
          note: "Server second",
          category: "Food",
          paidBy: "Embe",
          budgetId: null,
          budgetName: null,
        },
      ],
    };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockJsonResponse(secondPage));

    await expect(
      fetchExpenseList({ month: "2026-05", limit: 1, offset: 1 })
    ).resolves.toEqual(secondPage);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/expenses?month=2026-05&limit=1&offset=1",
      { method: "GET", cache: "no-store" }
    );
  });

  it("assigns unique ids to colliding pending local rows after network fallback", async () => {
    await syncRepository.records.put({
      entity: "expenses",
      clientId: "Aa",
      serverId: null,
      syncStatus: "pending",
      lastError: null,
      updatedAt: "2026-05-24T10:00:00.000Z",
      serverUpdatedAt: null,
      payload: {
        date: "2026-05-24",
        amount: 60000,
        note: "Offline coffee",
        category: "Food",
        paidBy: "Cubi",
        budgetId: null,
        budgetName: null,
      },
    });
    await syncRepository.records.put({
      entity: "expenses",
      clientId: "BB",
      serverId: null,
      syncStatus: "pending",
      lastError: null,
      updatedAt: "2026-05-24T09:00:00.000Z",
      serverUpdatedAt: null,
      payload: {
        date: "2026-05-24",
        amount: 50000,
        note: "Offline lunch",
        category: "Food",
        paidBy: "Embe",
        budgetId: null,
        budgetName: null,
      },
    });
    const serverPage = {
      activeMonth: "2026-05",
      effectiveRecentDays: 7,
      groupedRows: [],
      isRecent: false,
      pagination: {
        limit: 30,
        offset: 0,
        hasMore: false,
      },
      rows: [
        {
          id: 1,
          date: "2026-05-22",
          amount: 45000,
          note: "Server value",
          category: "Food",
          paidBy: "Cubi",
          budgetId: null,
          budgetName: null,
        },
      ],
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockJsonResponse(serverPage)
    );

    const result = await fetchExpenseList({ month: "2026-05", limit: 30 });

    const ids = result.rows.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps a dirty local row moved into the requested month visible after network fallback", async () => {
    await syncRepository.records.put({
      entity: "expenses",
      clientId: "client-1",
      serverId: 1,
      syncStatus: "pending",
      lastError: null,
      updatedAt: "2026-05-24T10:00:00.000Z",
      serverUpdatedAt: "2026-05-24T09:00:00.000Z",
      payload: {
        date: "2026-05-24",
        amount: 60000,
        note: "Moved into May",
        category: "Food",
        paidBy: "Cubi",
        budgetId: null,
        budgetName: null,
      },
    });
    const serverPage = {
      activeMonth: "2026-05",
      effectiveRecentDays: 7,
      groupedRows: [],
      isRecent: false,
      pagination: {
        limit: 30,
        offset: 0,
        hasMore: false,
      },
      rows: [],
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockJsonResponse(serverPage)
    );

    const result = await fetchExpenseList({ month: "2026-05", limit: 30 });

    expect(result.rows).toMatchObject([
      {
        id: 1,
        amount: 60000,
        note: "Moved into May",
      },
    ]);
  });

  it("does not duplicate a moved-in dirty server-backed row on later pages", async () => {
    await syncRepository.records.put({
      entity: "expenses",
      clientId: "client-60",
      serverId: 60,
      syncStatus: "pending",
      lastError: null,
      updatedAt: "2026-05-24T10:00:00.000Z",
      serverUpdatedAt: "2026-05-24T09:00:00.000Z",
      payload: {
        date: "2026-05-24",
        amount: 60000,
        note: "Moved into top page",
        category: "Food",
        paidBy: "Cubi",
        budgetId: null,
        budgetName: null,
      },
    });
    const firstPage = {
      activeMonth: "2026-05",
      effectiveRecentDays: 7,
      groupedRows: [],
      isRecent: false,
      pagination: {
        limit: 30,
        offset: 0,
        hasMore: true,
      },
      rows: [],
    };
    const laterPage = {
      activeMonth: "2026-05",
      effectiveRecentDays: 7,
      groupedRows: [],
      isRecent: false,
      pagination: {
        limit: 30,
        offset: 30,
        hasMore: false,
      },
      rows: [
        {
          id: 60,
          date: "2026-05-01",
          amount: 45000,
          note: "Stale server placement",
          category: "Food",
          paidBy: "Cubi",
          budgetId: null,
          budgetName: null,
        },
      ],
    };
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(mockJsonResponse(firstPage))
      .mockResolvedValueOnce(mockJsonResponse(laterPage));

    const firstResult = await fetchExpenseList({
      month: "2026-05",
      limit: 30,
    });
    const laterResult = await fetchExpenseList({
      month: "2026-05",
      limit: 30,
      offset: 30,
    });

    expect(firstResult.rows).toMatchObject([
      {
        id: 60,
        note: "Moved into top page",
      },
    ]);
    expect(laterResult.rows).toEqual([]);
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
      .mockResolvedValue(mockJsonResponse(payload));

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
    expect(typeof budgetQueries.transferCandidates(1).queryFn).toBe("function");
    expect(typeof dashboardQueries.monthlySummary("2026-05").queryFn).toBe(
      "function"
    );
    expect(typeof reportQueries.monthly("2026-05").queryFn).toBe("function");
    expect(typeof reportQueries.daily("2026-05-23").queryFn).toBe("function");
  });
});
