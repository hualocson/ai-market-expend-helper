import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";

import { syncRepository } from "./repository";
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
  await syncRepository.testing.clearSyncDb();
});

describe("sync core IndexedDB repository", () => {
  it("persists and lists records by entity", async () => {
    await syncRepository.records.put(buildExpense());

    await expect(syncRepository.records.list("expenses")).resolves.toEqual([
      buildExpense(),
    ]);
  });

  it("persists outbox operations in creation order", async () => {
    await syncRepository.outbox.put(
      buildOperation({
        operationId: "op-a-later",
        clientId: "client-2",
        createdAt: "2026-05-24T10:00:00.000Z",
      })
    );
    await syncRepository.outbox.put(
      buildOperation({
        operationId: "op-z-earlier",
        clientId: "client-1",
        createdAt: "2026-05-24T09:00:00.000Z",
      })
    );

    await expect(
      syncRepository.outbox
        .list("expenses")
        .then((operations) =>
          operations.map((operation) => operation.operationId)
        )
    ).resolves.toEqual(["op-z-earlier", "op-a-later"]);
  });

  it("preserves FIFO outbox order when createdAt timestamps collide", async () => {
    await syncRepository.outbox.put(
      buildOperation({
        operationId: "op-z-enqueued-first",
        clientId: "client-1",
        createdAt: "2026-05-24T09:00:00.000Z",
      })
    );
    await syncRepository.outbox.put(
      buildOperation({
        operationId: "op-a-enqueued-second",
        clientId: "client-2",
        createdAt: "2026-05-24T09:00:00.000Z",
      })
    );

    await expect(
      syncRepository.outbox
        .list("expenses")
        .then((operations) =>
          operations.map((operation) => operation.operationId)
        )
    ).resolves.toEqual(["op-z-enqueued-first", "op-a-enqueued-second"]);
  });

  it("persists records in a batch", async () => {
    const firstExpense = buildExpense({ clientId: "client-1" });
    const secondExpense = buildExpense({ clientId: "client-2" });

    await syncRepository.records.putMany([firstExpense, secondExpense]);

    await expect(syncRepository.records.list("expenses")).resolves.toEqual([
      firstExpense,
      secondExpense,
    ]);
  });

  it("deletes a record by entity and client id", async () => {
    const firstExpense = buildExpense({ clientId: "client-1" });
    const secondExpense = buildExpense({ clientId: "client-2" });
    await syncRepository.records.putMany([firstExpense, secondExpense]);

    await syncRepository.records.delete("expenses", "client-1");

    await expect(syncRepository.records.list("expenses")).resolves.toEqual([
      secondExpense,
    ]);
  });

  it("deletes an outbox operation by operation id", async () => {
    await syncRepository.outbox.put(
      buildOperation({ operationId: "op-1", clientId: "client-1" })
    );
    await syncRepository.outbox.put(
      buildOperation({ operationId: "op-2", clientId: "client-2" })
    );

    await syncRepository.outbox.delete("op-1");

    await expect(
      syncRepository.outbox
        .list("expenses")
        .then((operations) =>
          operations.map((operation) => operation.operationId)
        )
    ).resolves.toEqual(["op-2"]);
  });

  it("marks an outbox operation as failed", async () => {
    await syncRepository.outbox.put(buildOperation({ operationId: "op-1" }));

    await syncRepository.outbox.markFailed("op-1", "Validation failed");

    await expect(
      syncRepository.outbox
        .list("expenses")
        .then(([operation]) => operation?.lastError)
    ).resolves.toBe("Validation failed");
  });

  it("marks an outbox operation as attempted", async () => {
    await syncRepository.outbox.put(
      buildOperation({
        operationId: "op-1",
        attemptCount: 2,
        lastAttemptAt: null,
      })
    );

    await syncRepository.outbox.markAttempted(
      "op-1",
      "2026-05-24T10:00:00.000Z"
    );

    await expect(
      syncRepository.outbox.list("expenses").then(([operation]) => ({
        attemptCount: operation?.attemptCount,
        lastAttemptAt: operation?.lastAttemptAt,
      }))
    ).resolves.toEqual({
      attemptCount: 3,
      lastAttemptAt: "2026-05-24T10:00:00.000Z",
    });
  });

  it("preserves outbox sequence when updating an existing operation", async () => {
    await syncRepository.outbox.put(
      buildOperation({
        operationId: "op-1",
        clientId: "client-1",
        createdAt: "2026-05-24T09:00:00.000Z",
      })
    );
    await syncRepository.outbox.put(
      buildOperation({
        operationId: "op-2",
        clientId: "client-2",
        createdAt: "2026-05-24T09:00:00.000Z",
      })
    );
    await syncRepository.outbox.put(
      buildOperation({
        operationId: "op-1",
        clientId: "client-1",
        createdAt: "2026-05-24T09:00:00.000Z",
        lastError: "Retry payload",
      })
    );

    await expect(
      syncRepository.outbox
        .list("expenses")
        .then((operations) =>
          operations.map((operation) => operation.operationId)
        )
    ).resolves.toEqual(["op-1", "op-2"]);
  });

  it("stores the sync cursor", async () => {
    await syncRepository.metadata.setCursor(
      "expenses",
      "2026-05-24T10:00:00.000Z"
    );

    await expect(syncRepository.metadata.getCursor("expenses")).resolves.toBe(
      "2026-05-24T10:00:00.000Z"
    );
  });

  it("clears persisted sync records, outbox operations, and metadata", async () => {
    await syncRepository.records.put(buildExpense());
    await syncRepository.outbox.put(buildOperation({ operationId: "op-1" }));
    await syncRepository.metadata.setCursor(
      "expenses",
      "2026-05-24T10:00:00.000Z"
    );

    await syncRepository.testing.clearSyncDb();

    await expect(syncRepository.records.list("expenses")).resolves.toEqual([]);
    await expect(syncRepository.outbox.list("expenses")).resolves.toEqual([]);
    await expect(syncRepository.metadata.getCursor("expenses")).resolves.toBe(
      null
    );
  });
});
