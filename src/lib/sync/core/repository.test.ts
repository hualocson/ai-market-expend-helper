import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";

import {
  clearSyncDb,
  deleteSyncOperation,
  deleteSyncRecord,
  getSyncCursor,
  listQueuedSyncOperations,
  listSyncRecords,
  markSyncOperationAttempted,
  markSyncOperationFailed,
  putSyncOperation,
  putSyncRecord,
  putSyncRecords,
  setSyncCursor,
} from "./repository";
import type { SyncOperation, SyncRecord } from "./types";

const buildExpense = (overrides: Partial<SyncRecord> = {}): SyncRecord => ({
  entity: "expenses",
  clientId: "client-1",
  serverId: null,
  syncStatus: "pending",
  lastError: null,
  updatedAt: "2026-05-24T09:00:00.000Z",
  serverUpdatedAt: null,
  payload: {
    date: "2026-05-23",
    amount: 45000,
    note: "Coffee",
    category: "Food",
    paidBy: "Cubi",
    budgetId: null,
    budgetName: null,
  },
  ...overrides,
});

const buildOperation = (
  overrides: Partial<SyncOperation> = {}
): SyncOperation => ({
  operationId: "op-1",
  entity: "expenses",
  type: "create",
  clientId: "client-1",
  serverId: null,
  payload: buildExpense(),
  createdAt: "2026-05-24T09:00:00.000Z",
  attemptCount: 0,
  lastAttemptAt: null,
  lastError: null,
  ...overrides,
});

beforeEach(async () => {
  await clearSyncDb();
});

describe("sync core IndexedDB repository", () => {
  it("persists and lists records by entity", async () => {
    await putSyncRecord(buildExpense());

    await expect(listSyncRecords("expenses")).resolves.toEqual([
      buildExpense(),
    ]);
  });

  it("persists outbox operations in creation order", async () => {
    await putSyncOperation(
      buildOperation({
        operationId: "op-a-later",
        clientId: "client-2",
        createdAt: "2026-05-24T10:00:00.000Z",
      })
    );
    await putSyncOperation(
      buildOperation({
        operationId: "op-z-earlier",
        clientId: "client-1",
        createdAt: "2026-05-24T09:00:00.000Z",
      })
    );

    await expect(
      listQueuedSyncOperations("expenses").then((operations) =>
        operations.map((operation) => operation.operationId)
      )
    ).resolves.toEqual(["op-z-earlier", "op-a-later"]);
  });

  it("preserves FIFO outbox order when createdAt timestamps collide", async () => {
    await putSyncOperation(
      buildOperation({
        operationId: "op-z-enqueued-first",
        clientId: "client-1",
        createdAt: "2026-05-24T09:00:00.000Z",
      })
    );
    await putSyncOperation(
      buildOperation({
        operationId: "op-a-enqueued-second",
        clientId: "client-2",
        createdAt: "2026-05-24T09:00:00.000Z",
      })
    );

    await expect(
      listQueuedSyncOperations("expenses").then((operations) =>
        operations.map((operation) => operation.operationId)
      )
    ).resolves.toEqual(["op-z-enqueued-first", "op-a-enqueued-second"]);
  });

  it("persists records in a batch", async () => {
    const firstExpense = buildExpense({ clientId: "client-1" });
    const secondExpense = buildExpense({ clientId: "client-2" });

    await putSyncRecords([firstExpense, secondExpense]);

    await expect(listSyncRecords("expenses")).resolves.toEqual([
      firstExpense,
      secondExpense,
    ]);
  });

  it("deletes a record by entity and client id", async () => {
    const firstExpense = buildExpense({ clientId: "client-1" });
    const secondExpense = buildExpense({ clientId: "client-2" });
    await putSyncRecords([firstExpense, secondExpense]);

    await deleteSyncRecord("expenses", "client-1");

    await expect(listSyncRecords("expenses")).resolves.toEqual([secondExpense]);
  });

  it("deletes an outbox operation by operation id", async () => {
    await putSyncOperation(
      buildOperation({ operationId: "op-1", clientId: "client-1" })
    );
    await putSyncOperation(
      buildOperation({ operationId: "op-2", clientId: "client-2" })
    );

    await deleteSyncOperation("op-1");

    await expect(
      listQueuedSyncOperations("expenses").then((operations) =>
        operations.map((operation) => operation.operationId)
      )
    ).resolves.toEqual(["op-2"]);
  });

  it("marks an outbox operation as failed", async () => {
    await putSyncOperation(buildOperation({ operationId: "op-1" }));

    await markSyncOperationFailed("op-1", "Validation failed");

    await expect(
      listQueuedSyncOperations("expenses").then(
        ([operation]) => operation?.lastError
      )
    ).resolves.toBe("Validation failed");
  });

  it("marks an outbox operation as attempted", async () => {
    await putSyncOperation(
      buildOperation({
        operationId: "op-1",
        attemptCount: 2,
        lastAttemptAt: null,
      })
    );

    await markSyncOperationAttempted("op-1", "2026-05-24T10:00:00.000Z");

    await expect(
      listQueuedSyncOperations("expenses").then(([operation]) => ({
        attemptCount: operation?.attemptCount,
        lastAttemptAt: operation?.lastAttemptAt,
      }))
    ).resolves.toEqual({
      attemptCount: 3,
      lastAttemptAt: "2026-05-24T10:00:00.000Z",
    });
  });

  it("stores the sync cursor", async () => {
    await setSyncCursor("expenses", "2026-05-24T10:00:00.000Z");

    await expect(getSyncCursor("expenses")).resolves.toBe(
      "2026-05-24T10:00:00.000Z"
    );
  });
});
