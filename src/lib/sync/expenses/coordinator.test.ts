import type { ExpenseListResult } from "@/lib/expenses/list-model";
import { queries } from "@/lib/queries";
import { syncRepository } from "@/lib/sync/core/repository";
import type { SyncOperation, SyncRecord } from "@/lib/sync/core/types";
import {
  InfiniteQueryObserver,
  QueryClient,
  type QueryFunction,
  QueryObserver,
} from "@tanstack/react-query";
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  flushExpenseOutbox,
  hydrateExpenseSync,
  pullExpenseChanges,
  seedExpenseListResultInSyncStorage,
} from "./coordinator";
import { expenseSyncStore } from "./store";

const jsonResponse = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

const successEnvelope = <T>(data: T) => ({ success: true, data });

const expenseRecord = (overrides: Partial<SyncRecord> = {}): SyncRecord => ({
  entity: "expenses",
  clientId: "client-1",
  serverId: 10,
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
    budgetIcon: null,
    budgetColor: null,
  },
  ...overrides,
});

const outboxOperation = (
  overrides: Partial<SyncOperation> = {}
): SyncOperation => ({
  operationId: "op-1",
  entity: "expenses",
  type: "create",
  clientId: "client-1",
  serverId: null,
  payload: {
    entity: "expenses",
    clientId: "client-1",
    serverId: null,
    date: "2026-05-23",
    amount: 45000,
    note: "Coffee",
    category: "Food",
    paidBy: "Cubi",
    budgetId: null,
    budgetName: null,
    budgetIcon: null,
    budgetColor: null,
    syncStatus: "pending",
    lastError: null,
    updatedAt: "2026-05-24T09:00:00.000Z",
    serverUpdatedAt: null,
  },
  createdAt: "2026-05-24T09:00:00.000Z",
  attemptCount: 0,
  lastAttemptAt: null,
  lastError: null,
  ...overrides,
});

const expenseListResult = (
  rows: ExpenseListResult["rows"]
): ExpenseListResult => ({
  activeMonth: "2026-05",
  effectiveRecentDays: 7,
  groupedRows: [],
  isRecent: false,
  pagination: {
    limit: 30,
    offset: 0,
    hasMore: false,
  },
  rows,
});

const observeExpenseList = (queryClient: QueryClient) => {
  const query = queries.expenses.list({ month: "2026-05", limit: 30 });
  const observer = new QueryObserver(queryClient, {
    queryKey: query.queryKey,
    queryFn: query.queryFn,
    enabled: false,
  });
  const unsubscribe = observer.subscribe(() => {});

  return { query, unsubscribe };
};

const observeInfiniteExpenseList = (queryClient: QueryClient) => {
  const query = queries.expenses.list({ month: "2026-05", limit: 30 });
  const observer = new InfiniteQueryObserver(queryClient, {
    queryKey: query.queryKey,
    queryFn: query.queryFn as QueryFunction<
      Awaited<ReturnType<typeof query.queryFn>>,
      typeof query.queryKey,
      number
    >,
    enabled: false,
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore
        ? lastPage.pagination.offset + lastPage.pagination.limit
        : undefined,
  });
  const unsubscribe = observer.subscribe(() => {});

  return { query, unsubscribe };
};

beforeEach(async () => {
  await syncRepository.testing.clearSyncDb();
  expenseSyncStore.getState().hydrate([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("expense sync coordinator", () => {
  it("seeds a fallback client id for list rows without client ids", async () => {
    await seedExpenseListResultInSyncStorage(
      expenseListResult([
        {
          id: 42,
          clientId: null,
          date: "2026-05-24",
          amount: 125000,
          note: "Server row",
          category: "Food",
          paidBy: "Cubi",
          budgetId: null,
          budgetName: null,
          budgetIcon: null,
          budgetColor: null,
        },
      ]),
      "2026-05-24T10:00:00.000Z"
    );

    await expect(syncRepository.records.list("expenses")).resolves.toEqual([
      expect.objectContaining({
        clientId: "expense-server-42",
        serverId: 42,
        syncStatus: "synced",
      }),
    ]);
  });

  it("seeds budget appearance snapshots from list rows", async () => {
    await seedExpenseListResultInSyncStorage(
      expenseListResult([
        {
          id: 42,
          clientId: "client-appearance",
          date: "2026-05-24",
          amount: 125000,
          note: "Server row",
          category: "Food",
          paidBy: "Cubi",
          budgetId: 10,
          budgetName: "Meals",
          budgetIcon: "🍜",
          budgetColor: "rose",
        },
      ]),
      "2026-05-24T10:00:00.000Z"
    );

    await expect(syncRepository.records.list("expenses")).resolves.toEqual([
      expect.objectContaining({
        clientId: "client-appearance",
        payload: expect.objectContaining({
          budgetIcon: "🍜",
          budgetColor: "rose",
        }),
      }),
    ]);
  });

  it("skips hydrated list rows with non-finite or non-positive server ids", async () => {
    await seedExpenseListResultInSyncStorage(
      expenseListResult([
        {
          id: Number.NaN,
          clientId: "nan-id",
          date: "2026-05-24",
          amount: 125000,
          note: "Bad row",
          category: "Food",
          paidBy: "Cubi",
          budgetId: null,
          budgetName: null,
          budgetIcon: null,
          budgetColor: null,
        },
        {
          id: Number.POSITIVE_INFINITY,
          clientId: "infinite-id",
          date: "2026-05-24",
          amount: 125000,
          note: "Bad row",
          category: "Food",
          paidBy: "Cubi",
          budgetId: null,
          budgetName: null,
          budgetIcon: null,
          budgetColor: null,
        },
        {
          id: 0,
          clientId: "zero-id",
          date: "2026-05-24",
          amount: 125000,
          note: "Bad row",
          category: "Food",
          paidBy: "Cubi",
          budgetId: null,
          budgetName: null,
          budgetIcon: null,
          budgetColor: null,
        },
      ]),
      "2026-05-24T10:00:00.000Z"
    );

    await expect(syncRepository.records.list("expenses")).resolves.toEqual([]);
  });

  it("preserves existing dirty records when seeding hydrated list rows", async () => {
    await syncRepository.records.put(
      expenseRecord({
        clientId: "dirty-client",
        serverId: 42,
        syncStatus: "pending",
        payload: {
          date: "2026-05-24",
          amount: 90000,
          note: "Local dirty",
          category: "Food",
          paidBy: "Cubi",
          budgetId: null,
          budgetName: null,
          budgetIcon: null,
          budgetColor: null,
        },
      })
    );

    await seedExpenseListResultInSyncStorage(
      expenseListResult([
        {
          id: 42,
          clientId: "dirty-client",
          date: "2026-05-24",
          amount: 125000,
          note: "Server row",
          category: "Food",
          paidBy: "Cubi",
          budgetId: null,
          budgetName: null,
          budgetIcon: null,
          budgetColor: null,
        },
      ]),
      "2026-05-24T10:00:00.000Z"
    );

    await expect(syncRepository.records.list("expenses")).resolves.toEqual([
      expect.objectContaining({
        clientId: "dirty-client",
        syncStatus: "pending",
        payload: expect.objectContaining({
          amount: 90000,
          note: "Local dirty",
        }),
      }),
    ]);
  });

  it("hydrates expense records into the store and active list caches", async () => {
    await syncRepository.records.put(expenseRecord());
    const queryClient = new QueryClient();
    const { query, unsubscribe } = observeExpenseList(queryClient);

    await hydrateExpenseSync(queryClient);

    expect(expenseSyncStore.getState().expensesByClientId["client-1"]).toEqual(
      expect.objectContaining({
        clientId: "client-1",
        note: "Coffee",
        syncStatus: "synced",
      })
    );
    expect(queryClient.getQueryData(query.queryKey)).toMatchObject({
      rows: [
        expect.objectContaining({
          id: 10,
          note: "Coffee",
        }),
      ],
    });

    unsubscribe();
  });

  it("seeds active infinite list caches before the first page loads", async () => {
    await syncRepository.records.put(expenseRecord());
    const queryClient = new QueryClient();
    const { query, unsubscribe } = observeInfiniteExpenseList(queryClient);

    await hydrateExpenseSync(queryClient);

    expect(queryClient.getQueryData(query.queryKey)).toMatchObject({
      pageParams: [0],
      pages: [
        {
          rows: [
            expect.objectContaining({
              id: 10,
              note: "Coffee",
            }),
          ],
        },
      ],
    });

    unsubscribe();
  });

  it("pulls server changes, reconciles deleted rows, and advances the cursor", async () => {
    await syncRepository.metadata.setCursor(
      "expenses",
      "2026-05-24T09:00:00.000Z"
    );
    await syncRepository.records.put(
      expenseRecord({ clientId: "deleted-client" })
    );
    const queryClient = new QueryClient();
    const { query, unsubscribe } = observeExpenseList(queryClient);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(
        successEnvelope({
          cursor: "2026-05-24T10:00:00.000Z",
          changes: [
            {
              id: 11,
              clientId: "server-client",
              date: "2026-05-24",
              amount: 50000,
              note: "Lunch",
              category: "Food",
              paidBy: "Embe",
              budgetId: 3,
              budgetName: "Meals",
              budgetIcon: null,
              budgetColor: null,
              updatedAt: "2026-05-24T10:00:00.000Z",
              deletedAt: null,
              isDeleted: false,
            },
            {
              id: 10,
              clientId: "deleted-client",
              date: "2026-05-23",
              amount: 45000,
              note: "Coffee",
              category: "Food",
              paidBy: "Cubi",
              budgetId: null,
              budgetName: null,
              budgetIcon: null,
              budgetColor: null,
              updatedAt: "2026-05-24T09:00:00.000Z",
              deletedAt: "2026-05-24T10:00:00.000Z",
              isDeleted: true,
            },
          ],
        })
      )
    );

    await pullExpenseChanges(queryClient);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/expenses/sync?cursor=2026-05-24T09%3A00%3A00.000Z",
      expect.objectContaining({ method: "GET", cache: "no-store" })
    );
    await expect(syncRepository.metadata.getCursor("expenses")).resolves.toBe(
      "2026-05-24T10:00:00.000Z"
    );
    await expect(
      syncRepository.records.list("expenses")
    ).resolves.toMatchObject([
      {
        clientId: "deleted-client",
        syncStatus: "deleted",
        serverUpdatedAt: "2026-05-24T10:00:00.000Z",
      },
      {
        clientId: "server-client",
        serverId: 11,
        syncStatus: "synced",
      },
    ]);
    expect(queryClient.getQueryData(query.queryKey)).toMatchObject({
      rows: [expect.objectContaining({ id: 11, note: "Lunch" })],
    });

    unsubscribe();
  });

  it("refreshes active expense list caches from IndexedDB after pulling server changes", async () => {
    const queryClient = new QueryClient();
    const { query, unsubscribe } = observeInfiniteExpenseList(queryClient);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(
        successEnvelope({
          cursor: "2026-05-24T10:00:00.000Z",
          changes: [
            {
              id: 22,
              clientId: "server-client",
              date: "2026-05-24",
              amount: 50000,
              note: "Pulled lunch",
              category: "Food",
              paidBy: "Cubi",
              budgetId: null,
              budgetName: null,
              budgetIcon: null,
              budgetColor: null,
              updatedAt: "2026-05-24T10:00:00.000Z",
              deletedAt: null,
              isDeleted: false,
            },
          ],
        })
      )
    );

    await pullExpenseChanges(queryClient);

    await expect(
      syncRepository.records.list("expenses")
    ).resolves.toMatchObject([
      {
        serverId: 22,
        payload: expect.objectContaining({
          note: "Pulled lunch",
        }),
      },
    ]);
    expect(queryClient.getQueryData(query.queryKey)).toMatchObject({
      pages: [
        {
          rows: [
            expect.objectContaining({
              id: 22,
              note: "Pulled lunch",
            }),
          ],
        },
      ],
    });

    unsubscribe();
  });

  it("normalizes server row budget appearance before writing local sync records", async () => {
    const queryClient = new QueryClient();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(
        successEnvelope({
          cursor: "2026-05-24T10:00:00.000Z",
          changes: [
            {
              id: 23,
              clientId: "server-appearance",
              date: "2026-05-24",
              amount: 50000,
              note: "Pulled lunch",
              category: "Food",
              paidBy: "Cubi",
              budgetId: 10,
              budgetName: "Meals",
              budgetIcon: "   ",
              budgetColor: "custom",
              updatedAt: "2026-05-24T10:00:00.000Z",
              deletedAt: null,
              isDeleted: false,
            },
          ],
        })
      )
    );

    await pullExpenseChanges(queryClient);

    await expect(
      syncRepository.records.list("expenses")
    ).resolves.toMatchObject([
      {
        serverId: 23,
        payload: expect.objectContaining({
          budgetIcon: "💰",
          budgetColor: "lime",
        }),
      },
    ]);
  });

  it("preserves dirty local rows when pulling older server changes", async () => {
    await syncRepository.metadata.setCursor(
      "expenses",
      "2026-05-24T09:00:00.000Z"
    );
    await syncRepository.records.put(
      expenseRecord({
        syncStatus: "pending",
        updatedAt: "2026-05-24T11:00:00.000Z",
        payload: {
          date: "2026-05-23",
          amount: 60000,
          note: "Local dinner edit",
          category: "Food",
          paidBy: "Cubi",
          budgetId: null,
          budgetName: null,
          budgetIcon: null,
          budgetColor: null,
        },
      })
    );
    const queryClient = new QueryClient();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(
        successEnvelope({
          cursor: "2026-05-24T10:00:00.000Z",
          changes: [
            {
              id: 10,
              clientId: "client-1",
              date: "2026-05-23",
              amount: 45000,
              note: "Server coffee",
              category: "Food",
              paidBy: "Cubi",
              budgetId: null,
              budgetName: null,
              budgetIcon: null,
              budgetColor: null,
              updatedAt: "2026-05-24T10:00:00.000Z",
              deletedAt: null,
              isDeleted: false,
            },
          ],
        })
      )
    );

    await pullExpenseChanges(queryClient);

    await expect(
      syncRepository.records.list("expenses")
    ).resolves.toMatchObject([
      {
        clientId: "client-1",
        syncStatus: "pending",
        updatedAt: "2026-05-24T11:00:00.000Z",
        payload: expect.objectContaining({
          amount: 60000,
          note: "Local dinner edit",
        }),
      },
    ]);
    await expect(syncRepository.metadata.getCursor("expenses")).resolves.toBe(
      "2026-05-24T10:00:00.000Z"
    );
  });

  it("reconciles a successful create result into a synced local row", async () => {
    await syncRepository.records.put(
      expenseRecord({
        serverId: null,
        syncStatus: "pending",
        serverUpdatedAt: null,
        payload: {
          date: "2026-05-23",
          amount: 45000,
          note: "Coffee",
          category: "Food",
          paidBy: "Cubi",
          budgetId: 10,
          budgetName: "Meals",
          budgetIcon: "🍜",
          budgetColor: "rose",
        },
      })
    );
    await syncRepository.outbox.put(
      outboxOperation({
        payload: {
          entity: "expenses",
          clientId: "client-1",
          serverId: null,
          date: "2026-05-23",
          amount: 45000,
          note: "Coffee",
          category: "Food",
          paidBy: "Cubi",
          budgetId: 10,
          budgetName: "Meals",
          budgetIcon: "🍜",
          budgetColor: "rose",
          syncStatus: "pending",
          lastError: null,
          updatedAt: "2026-05-24T09:00:00.000Z",
          serverUpdatedAt: null,
        },
      })
    );
    const queryClient = new QueryClient();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(
        successEnvelope({
          results: [
            {
              operationId: "op-1",
              ok: true,
              row: {
                id: 10,
                clientId: "client-1",
                date: "2026-05-23",
                amount: 45000,
                note: "Coffee",
                category: "Food",
                paidBy: "Cubi",
                budgetId: null,
                budgetName: null,
                budgetIcon: null,
                budgetColor: null,
                updatedAt: "2026-05-24T10:00:00.000Z",
                deletedAt: null,
                isDeleted: false,
              },
            },
          ],
        })
      )
    );

    await flushExpenseOutbox(queryClient);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/expenses/sync",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        body: JSON.stringify({
          operations: [
            {
              operationId: "op-1",
              type: "create",
              clientId: "client-1",
              serverId: null,
              payload: {
                clientId: "client-1",
                date: "2026-05-23",
                amount: 45000,
                note: "Coffee",
                category: "Food",
                paidBy: "Cubi",
                budgetId: 10,
                budgetName: "Meals",
                budgetIcon: "🍜",
                budgetColor: "rose",
              },
            },
          ],
        }),
      })
    );
    await expect(
      syncRepository.records.list("expenses")
    ).resolves.toMatchObject([
      {
        entity: "expenses",
        clientId: "client-1",
        serverId: 10,
        syncStatus: "synced",
        serverUpdatedAt: "2026-05-24T10:00:00.000Z",
      },
    ]);
    await expect(syncRepository.outbox.list("expenses")).resolves.toEqual([]);
    expect(expenseSyncStore.getState().expensesByClientId["client-1"]).toEqual(
      expect.objectContaining({
        serverId: 10,
        syncStatus: "synced",
      })
    );
  });

  it("serializes delete flush payloads as null even when the outbox preserves the local payload", async () => {
    await syncRepository.outbox.put(
      outboxOperation({
        type: "delete",
        serverId: 10,
        payload: {
          entity: "expenses",
          clientId: "client-1",
          serverId: 10,
          date: "2026-05-23",
          amount: 45000,
          note: "Coffee",
          category: "Food",
          paidBy: "Cubi",
          budgetId: null,
          budgetName: null,
          budgetIcon: null,
          budgetColor: null,
          syncStatus: "deleted",
          lastError: null,
          updatedAt: "2026-05-24T09:00:00.000Z",
          serverUpdatedAt: "2026-05-24T09:00:00.000Z",
        },
      })
    );
    const queryClient = new QueryClient();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(
        successEnvelope({
          results: [
            {
              operationId: "op-1",
              ok: true,
              row: {
                id: 10,
                clientId: "client-1",
                date: "2026-05-23",
                amount: 45000,
                note: "Coffee",
                category: "Food",
                paidBy: "Cubi",
                budgetId: null,
                budgetName: null,
                budgetIcon: null,
                budgetColor: null,
                updatedAt: "2026-05-24T10:00:00.000Z",
                deletedAt: "2026-05-24T10:00:00.000Z",
                isDeleted: true,
              },
            },
          ],
        })
      )
    );

    await flushExpenseOutbox(queryClient);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/expenses/sync",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        body: JSON.stringify({
          operations: [
            {
              operationId: "op-1",
              type: "delete",
              clientId: "client-1",
              serverId: 10,
              payload: null,
            },
          ],
        }),
      })
    );
  });

  it("marks failed flush results on the outbox operation and local row", async () => {
    await syncRepository.records.put(
      expenseRecord({
        serverId: null,
        syncStatus: "pending",
        serverUpdatedAt: null,
      })
    );
    await syncRepository.outbox.put(outboxOperation());
    const queryClient = new QueryClient();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(
        successEnvelope({
          results: [
            {
              operationId: "op-1",
              ok: false,
              error: "Invalid payload",
            },
          ],
        })
      )
    );

    await flushExpenseOutbox(queryClient);

    await expect(syncRepository.outbox.list("expenses")).resolves.toMatchObject(
      [
        {
          operationId: "op-1",
          attemptCount: 1,
          lastAttemptAt: expect.any(String),
          lastError: "Invalid payload",
        },
      ]
    );
    await expect(
      syncRepository.records.list("expenses")
    ).resolves.toMatchObject([
      {
        clientId: "client-1",
        syncStatus: "failed",
        lastError: "Invalid payload",
      },
    ]);
    expect(expenseSyncStore.getState().expensesByClientId["client-1"]).toEqual(
      expect.objectContaining({
        syncStatus: "failed",
        lastError: "Invalid payload",
      })
    );
  });

  it("keeps pending rows pending when the outbox flush cannot reach the server", async () => {
    await syncRepository.records.put(
      expenseRecord({
        serverId: null,
        syncStatus: "pending",
        serverUpdatedAt: null,
      })
    );
    await syncRepository.outbox.put(outboxOperation());
    const queryClient = new QueryClient();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Offline"));

    await expect(flushExpenseOutbox(queryClient)).rejects.toThrow("Offline");

    await expect(syncRepository.outbox.list("expenses")).resolves.toMatchObject(
      [
        {
          operationId: "op-1",
          attemptCount: 1,
          lastAttemptAt: expect.any(String),
          lastError: null,
        },
      ]
    );
    await expect(
      syncRepository.records.list("expenses")
    ).resolves.toMatchObject([
      {
        clientId: "client-1",
        syncStatus: "pending",
        lastError: null,
      },
    ]);
    expect(expenseSyncStore.getState().expensesByClientId["client-1"]).toEqual(
      expect.objectContaining({
        syncStatus: "pending",
        lastError: null,
      })
    );
  });

  it("keeps the latest failed local row when mixed same-client results return", async () => {
    await syncRepository.records.put(
      expenseRecord({
        syncStatus: "pending",
        updatedAt: "2026-05-24T11:00:00.000Z",
        payload: {
          date: "2026-05-23",
          amount: 60000,
          note: "Latest local edit",
          category: "Food",
          paidBy: "Cubi",
          budgetId: null,
          budgetName: null,
          budgetIcon: null,
          budgetColor: null,
        },
      })
    );
    await syncRepository.outbox.put(
      outboxOperation({
        operationId: "op-1",
        type: "update",
        serverId: 10,
        payload: {
          entity: "expenses",
          clientId: "client-1",
          serverId: 10,
          date: "2026-05-23",
          amount: 50000,
          note: "Older local edit",
          category: "Food",
          paidBy: "Cubi",
          budgetId: null,
          budgetName: null,
          budgetIcon: null,
          budgetColor: null,
          syncStatus: "pending",
          lastError: null,
          updatedAt: "2026-05-24T10:00:00.000Z",
          serverUpdatedAt: "2026-05-24T09:00:00.000Z",
        },
        createdAt: "2026-05-24T10:00:00.000Z",
      })
    );
    await syncRepository.outbox.put(
      outboxOperation({
        operationId: "op-2",
        type: "update",
        serverId: 10,
        payload: {
          entity: "expenses",
          clientId: "client-1",
          serverId: 10,
          date: "2026-05-23",
          amount: 60000,
          note: "Latest local edit",
          category: "Food",
          paidBy: "Cubi",
          budgetId: null,
          budgetName: null,
          budgetIcon: null,
          budgetColor: null,
          syncStatus: "pending",
          lastError: null,
          updatedAt: "2026-05-24T11:00:00.000Z",
          serverUpdatedAt: "2026-05-24T09:00:00.000Z",
        },
        createdAt: "2026-05-24T11:00:00.000Z",
      })
    );
    const queryClient = new QueryClient();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(
        successEnvelope({
          results: [
            {
              operationId: "op-1",
              ok: true,
              row: {
                id: 10,
                clientId: "client-1",
                date: "2026-05-23",
                amount: 50000,
                note: "Older local edit",
                category: "Food",
                paidBy: "Cubi",
                budgetId: null,
                budgetName: null,
                budgetIcon: null,
                budgetColor: null,
                updatedAt: "2026-05-24T10:30:00.000Z",
                deletedAt: null,
                isDeleted: false,
              },
            },
            {
              operationId: "op-2",
              ok: false,
              error: "Invalid payload",
            },
          ],
        })
      )
    );

    await flushExpenseOutbox(queryClient);

    await expect(syncRepository.outbox.list("expenses")).resolves.toMatchObject(
      [
        {
          operationId: "op-2",
          lastError: "Invalid payload",
        },
      ]
    );
    await expect(
      syncRepository.records.list("expenses")
    ).resolves.toMatchObject([
      {
        clientId: "client-1",
        serverId: 10,
        syncStatus: "failed",
        lastError: "Invalid payload",
        payload: expect.objectContaining({
          amount: 60000,
          note: "Latest local edit",
        }),
      },
    ]);
  });

  it("drops older failed same-client operations when a later operation succeeds", async () => {
    await syncRepository.records.put(
      expenseRecord({
        syncStatus: "pending",
        updatedAt: "2026-05-24T11:00:00.000Z",
        payload: {
          date: "2026-05-23",
          amount: 60000,
          note: "Latest local edit",
          category: "Food",
          paidBy: "Cubi",
          budgetId: null,
          budgetName: null,
          budgetIcon: null,
          budgetColor: null,
        },
      })
    );
    await syncRepository.outbox.put(
      outboxOperation({
        operationId: "op-1",
        type: "update",
        serverId: 10,
        payload: {
          entity: "expenses",
          clientId: "client-1",
          serverId: 10,
          date: "2026-05-23",
          amount: 50000,
          note: "Older local edit",
          category: "Food",
          paidBy: "Cubi",
          budgetId: null,
          budgetName: null,
          budgetIcon: null,
          budgetColor: null,
          syncStatus: "pending",
          lastError: null,
          updatedAt: "2026-05-24T10:00:00.000Z",
          serverUpdatedAt: "2026-05-24T09:00:00.000Z",
        },
        createdAt: "2026-05-24T10:00:00.000Z",
      })
    );
    await syncRepository.outbox.put(
      outboxOperation({
        operationId: "op-2",
        type: "update",
        serverId: 10,
        payload: {
          entity: "expenses",
          clientId: "client-1",
          serverId: 10,
          date: "2026-05-23",
          amount: 60000,
          note: "Latest local edit",
          category: "Food",
          paidBy: "Cubi",
          budgetId: null,
          budgetName: null,
          budgetIcon: null,
          budgetColor: null,
          syncStatus: "pending",
          lastError: null,
          updatedAt: "2026-05-24T11:00:00.000Z",
          serverUpdatedAt: "2026-05-24T09:00:00.000Z",
        },
        createdAt: "2026-05-24T11:00:00.000Z",
      })
    );
    const queryClient = new QueryClient();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(
        successEnvelope({
          results: [
            {
              operationId: "op-1",
              ok: false,
              error: "Superseded payload",
            },
            {
              operationId: "op-2",
              ok: true,
              row: {
                id: 10,
                clientId: "client-1",
                date: "2026-05-23",
                amount: 60000,
                note: "Latest local edit",
                category: "Food",
                paidBy: "Cubi",
                budgetId: null,
                budgetName: null,
                budgetIcon: null,
                budgetColor: null,
                updatedAt: "2026-05-24T11:30:00.000Z",
                deletedAt: null,
                isDeleted: false,
              },
            },
          ],
        })
      )
    );

    await flushExpenseOutbox(queryClient);

    await expect(syncRepository.outbox.list("expenses")).resolves.toEqual([]);
    await expect(
      syncRepository.records.list("expenses")
    ).resolves.toMatchObject([
      {
        clientId: "client-1",
        serverId: 10,
        syncStatus: "synced",
        lastError: null,
        payload: expect.objectContaining({
          amount: 60000,
          note: "Latest local edit",
        }),
      },
    ]);
  });
});
