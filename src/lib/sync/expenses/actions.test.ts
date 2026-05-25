import { PaidBy } from "@/enums";
import { syncRepository } from "@/lib/sync/core/repository";
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createLocalExpense,
  deleteLocalExpense,
  updateLocalExpense,
} from "./actions";
import { buildExpenseListResultFromLocalRows } from "./list";
import { createExpenseSyncStore } from "./store";
import type { LocalExpense } from "./types";

const existingExpense = (
  overrides: Partial<LocalExpense> = {}
): Omit<LocalExpense, "entity"> => ({
  clientId: "client-1",
  serverId: 10,
  date: "23/05/2026",
  amount: 45000,
  note: "Coffee",
  category: "Food",
  paidBy: PaidBy.CUBI,
  budgetId: null,
  budgetName: null,
  syncStatus: "synced",
  lastError: null,
  updatedAt: "2026-05-24T09:00:00.000Z",
  serverUpdatedAt: "2026-05-24T09:00:00.000Z",
  ...overrides,
});

beforeEach(async () => {
  await syncRepository.testing.clearSyncDb();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("local-first expense actions", () => {
  it("creates dev-prefixed local ids with getRandomValues outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const randomUUIDSpy = vi
      .spyOn(crypto, "randomUUID")
      .mockImplementation(() => {
        throw new Error("randomUUID should not be used for dev ids");
      });
    const getRandomValuesSpy = vi
      .spyOn(crypto, "getRandomValues")
      .mockImplementation((array) => {
        const bytes = array as Uint8Array;
        bytes.fill(1);
        return array;
      });
    const store = createExpenseSyncStore();

    const created = await createLocalExpense(store, {
      date: "23/05/2026",
      amount: 45000,
      note: "Coffee",
      category: "Food",
      paidBy: PaidBy.CUBI,
      budgetId: null,
    });
    const [operation] = await syncRepository.outbox.list("expenses");

    expect(created.clientId).toMatch(/^dev-expense-/);
    expect(operation?.operationId).toMatch(/^dev-expense-op-/);
    expect(getRandomValuesSpy).toHaveBeenCalled();
    expect(randomUUIDSpy).not.toHaveBeenCalled();
  });

  it("creates prod-prefixed local ids with randomUUID in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const randomUUIDSpy = vi
      .spyOn(crypto, "randomUUID")
      .mockReturnValue("11111111-2222-4333-8444-555555555555");
    const getRandomValuesSpy = vi.spyOn(crypto, "getRandomValues");
    const store = createExpenseSyncStore();

    const created = await createLocalExpense(store, {
      date: "23/05/2026",
      amount: 45000,
      note: "Coffee",
      category: "Food",
      paidBy: PaidBy.CUBI,
      budgetId: null,
    });
    const [operation] = await syncRepository.outbox.list("expenses");

    expect(created.clientId).toBe(
      "prod-expense-11111111-2222-4333-8444-555555555555"
    );
    expect(operation?.operationId).toBe(
      "prod-expense-op-11111111-2222-4333-8444-555555555555"
    );
    expect(randomUUIDSpy).toHaveBeenCalledTimes(2);
    expect(getRandomValuesSpy).not.toHaveBeenCalled();
  });

  it("creates a pending local expense and outbox operation", async () => {
    const store = createExpenseSyncStore();

    const created = await createLocalExpense(store, {
      date: "23/05/2026",
      amount: 45000,
      note: "Coffee",
      category: "Food",
      paidBy: PaidBy.CUBI,
      budgetId: null,
    });

    expect(store.getState().expensesByClientId[created.clientId]).toMatchObject(
      {
        note: "Coffee",
        syncStatus: "pending",
        serverId: null,
      }
    );
    await expect(
      syncRepository.records.list("expenses")
    ).resolves.toMatchObject([
      {
        entity: "expenses",
        clientId: created.clientId,
        serverId: null,
        syncStatus: "pending",
        payload: expect.objectContaining({ note: "Coffee" }),
      },
    ]);
    await expect(syncRepository.outbox.list("expenses")).resolves.toMatchObject(
      [
        {
          entity: "expenses",
          type: "create",
          clientId: created.clientId,
          payload: expect.objectContaining({ note: "Coffee" }),
        },
      ]
    );
  });

  it("normalizes display dates from manual submissions before local list filtering", async () => {
    const store = createExpenseSyncStore();

    const created = await createLocalExpense(store, {
      date: "23/05/2026",
      amount: 45000,
      note: "Coffee",
      category: "Food",
      paidBy: PaidBy.CUBI,
      budgetId: null,
    });
    const result = buildExpenseListResultFromLocalRows([created], {
      month: "2026-05",
      limit: 30,
    });

    expect(created.date).toBe("2026-05-23");
    expect(result.rows).toHaveLength(1);
    expect(result.groupedRows[0]?.key).toBe("2026-05-23");
    await expect(
      syncRepository.records.list("expenses")
    ).resolves.toMatchObject([
      {
        payload: expect.objectContaining({ date: "2026-05-23" }),
      },
    ]);
    await expect(syncRepository.outbox.list("expenses")).resolves.toMatchObject(
      [
        {
          payload: expect.objectContaining({ date: "2026-05-23" }),
        },
      ]
    );
  });

  it("stores the selected budget name on pending local creates", async () => {
    const store = createExpenseSyncStore();

    const created = await createLocalExpense(store, {
      date: "23/05/2026",
      amount: 45000,
      note: "Coffee",
      category: "Food",
      paidBy: PaidBy.CUBI,
      budgetId: 3,
      budgetName: "Food week",
    });

    expect(store.getState().expensesByClientId[created.clientId]).toMatchObject(
      {
        budgetId: 3,
        budgetName: "Food week",
      }
    );
    await expect(
      syncRepository.records.list("expenses")
    ).resolves.toMatchObject([
      {
        payload: expect.objectContaining({
          budgetId: 3,
          budgetName: "Food week",
        }),
      },
    ]);
    await expect(syncRepository.outbox.list("expenses")).resolves.toMatchObject(
      [
        {
          payload: expect.objectContaining({
            budgetId: 3,
            budgetName: "Food week",
          }),
        },
      ]
    );
  });

  it("updates an existing local expense and queues an update operation", async () => {
    const store = createExpenseSyncStore();
    store.getState().hydrate([existingExpense()]);

    const updated = await updateLocalExpense(store, "client-1", {
      date: "24/05/2026",
      amount: 50000,
      note: "Dinner",
      category: "Food",
      paidBy: PaidBy.EMBE,
      budgetId: 3,
    });

    expect(updated).toMatchObject({
      clientId: "client-1",
      serverId: 10,
      note: "Dinner",
      syncStatus: "pending",
      serverUpdatedAt: "2026-05-24T09:00:00.000Z",
    });
    expect(store.getState().expensesByClientId["client-1"]).toMatchObject({
      note: "Dinner",
      amount: 50000,
      budgetId: 3,
      syncStatus: "pending",
    });
    await expect(
      syncRepository.records.list("expenses")
    ).resolves.toMatchObject([
      {
        entity: "expenses",
        clientId: "client-1",
        serverId: 10,
        syncStatus: "pending",
        payload: expect.objectContaining({ note: "Dinner", budgetId: 3 }),
      },
    ]);
    await expect(syncRepository.outbox.list("expenses")).resolves.toMatchObject(
      [
        {
          entity: "expenses",
          type: "update",
          clientId: "client-1",
          serverId: 10,
          payload: expect.objectContaining({ note: "Dinner", budgetId: 3 }),
        },
      ]
    );
  });

  it("coalesces updates for an unsynced create into the create operation", async () => {
    const store = createExpenseSyncStore();

    const created = await createLocalExpense(store, {
      date: "23/05/2026",
      amount: 45000,
      note: "Coffee",
      category: "Food",
      paidBy: PaidBy.CUBI,
      budgetId: null,
    });
    const [createOperation] = await syncRepository.outbox.list("expenses");

    await updateLocalExpense(store, created.clientId, {
      date: "24/05/2026",
      amount: 50000,
      note: "Dinner",
      category: "Food",
      paidBy: PaidBy.EMBE,
      budgetId: 3,
    });

    await expect(
      syncRepository.records.list("expenses")
    ).resolves.toMatchObject([
      {
        entity: "expenses",
        clientId: created.clientId,
        serverId: null,
        syncStatus: "pending",
        payload: expect.objectContaining({ note: "Dinner", budgetId: 3 }),
      },
    ]);
    await expect(syncRepository.outbox.list("expenses")).resolves.toMatchObject(
      [
        {
          operationId: createOperation?.operationId,
          entity: "expenses",
          type: "create",
          clientId: created.clientId,
          serverId: null,
          payload: expect.objectContaining({ note: "Dinner", budgetId: 3 }),
        },
      ]
    );
  });

  it("coalesces repeated creates with the same client id into one create operation", async () => {
    const store = createExpenseSyncStore();

    await createLocalExpense(store, {
      clientId: "same-client",
      date: "23/05/2026",
      amount: 45000,
      note: "Coffee",
      category: "Food",
      paidBy: PaidBy.CUBI,
      budgetId: null,
    });
    const [createOperation] = await syncRepository.outbox.list("expenses");

    await createLocalExpense(store, {
      clientId: "same-client",
      date: "24/05/2026",
      amount: 50000,
      note: "Dinner",
      category: "Food",
      paidBy: PaidBy.EMBE,
      budgetId: 3,
    });

    await expect(syncRepository.outbox.list("expenses")).resolves.toMatchObject(
      [
        {
          operationId: createOperation?.operationId,
          entity: "expenses",
          type: "create",
          clientId: "same-client",
          serverId: null,
          payload: expect.objectContaining({ note: "Dinner", budgetId: 3 }),
        },
      ]
    );
    expect(store.getState().expensesByClientId["same-client"]).toMatchObject({
      note: "Dinner",
      amount: 50000,
      budgetId: 3,
      syncStatus: "pending",
    });
  });

  it("marks an existing local expense deleted and queues a delete operation", async () => {
    const store = createExpenseSyncStore();
    store.getState().hydrate([existingExpense()]);

    const deleted = await deleteLocalExpense(store, "client-1");

    expect(deleted).toMatchObject({
      clientId: "client-1",
      serverId: 10,
      syncStatus: "deleted",
    });
    expect(store.getState().expensesByClientId["client-1"]).toMatchObject({
      syncStatus: "deleted",
    });
    await expect(
      syncRepository.records.list("expenses")
    ).resolves.toMatchObject([
      {
        entity: "expenses",
        clientId: "client-1",
        serverId: 10,
        syncStatus: "deleted",
      },
    ]);
    await expect(syncRepository.outbox.list("expenses")).resolves.toMatchObject(
      [
        {
          entity: "expenses",
          type: "delete",
          clientId: "client-1",
          serverId: 10,
          payload: expect.objectContaining({
            entity: "expenses",
            clientId: "client-1",
            serverId: 10,
            amount: 45000,
            note: "Coffee",
            category: "Food",
            paidBy: PaidBy.CUBI,
            syncStatus: "deleted",
          }),
        },
      ]
    );
  });

  it("cancels an unsynced create when deleting it before flush", async () => {
    const store = createExpenseSyncStore();

    const created = await createLocalExpense(store, {
      date: "23/05/2026",
      amount: 45000,
      note: "Coffee",
      category: "Food",
      paidBy: PaidBy.CUBI,
      budgetId: null,
    });

    const deleted = await deleteLocalExpense(store, created.clientId);

    expect(deleted).toMatchObject({
      clientId: created.clientId,
      serverId: null,
      syncStatus: "deleted",
    });
    expect(
      store.getState().expensesByClientId[created.clientId]
    ).toBeUndefined();
    await expect(syncRepository.records.list("expenses")).resolves.toEqual([]);
    await expect(syncRepository.outbox.list("expenses")).resolves.toEqual([]);
  });

  it("cancels every pending create for a repeated explicit client id", async () => {
    const store = createExpenseSyncStore();

    await createLocalExpense(store, {
      clientId: "same-client",
      date: "23/05/2026",
      amount: 45000,
      note: "Coffee",
      category: "Food",
      paidBy: PaidBy.CUBI,
      budgetId: null,
    });
    await createLocalExpense(store, {
      clientId: "same-client",
      date: "24/05/2026",
      amount: 50000,
      note: "Dinner",
      category: "Food",
      paidBy: PaidBy.EMBE,
      budgetId: 3,
    });

    await deleteLocalExpense(store, "same-client");

    await expect(syncRepository.records.list("expenses")).resolves.toEqual([]);
    await expect(syncRepository.outbox.list("expenses")).resolves.toEqual([]);
  });
});
