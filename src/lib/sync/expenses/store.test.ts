import { describe, expect, it } from "vitest";

import {
  createExpenseSyncStore,
  selectExpenseByClientId,
  selectExpenseSyncStatus,
  selectOrderedExpenseClientIds,
} from "./store";
import type { LocalExpense } from "./types";

const expense = (
  overrides: Partial<LocalExpense>
): Omit<LocalExpense, "entity"> => ({
  clientId: "client-1",
  serverId: 1,
  date: "2026-05-23",
  amount: 45000,
  note: "Coffee",
  category: "Food",
  paidBy: "Cubi",
  budgetId: null,
  budgetName: null,
  syncStatus: "synced",
  lastError: null,
  updatedAt: "2026-05-24T09:00:00.000Z",
  serverUpdatedAt: "2026-05-24T09:00:00.000Z",
  ...overrides,
});

describe("expense sync Zustand store", () => {
  it("hydrates expenses by client id", () => {
    const store = createExpenseSyncStore();

    store.getState().hydrate([
      expense({
        clientId: "client-1",
      }),
    ]);

    expect(store.getState().expensesByClientId["client-1"]?.note).toBe(
      "Coffee"
    );
    expect(store.getState().orderedClientIds).toEqual(["client-1"]);
  });

  it("tracks pending and failed counts", () => {
    const store = createExpenseSyncStore();

    store.getState().hydrate([
      expense({
        clientId: "pending",
        serverId: null,
        amount: 1,
        note: "",
        syncStatus: "pending",
        serverUpdatedAt: null,
      }),
      expense({
        clientId: "failed",
        serverId: null,
        amount: 1,
        note: "",
        syncStatus: "failed",
        lastError: "Invalid payload",
        serverUpdatedAt: null,
      }),
    ]);

    expect(store.getState().pendingCount).toBe(1);
    expect(store.getState().failedCount).toBe(1);
  });

  it("keeps unchanged expense row identity after an unrelated upsert", () => {
    const store = createExpenseSyncStore();

    store.getState().hydrate([
      expense({
        clientId: "existing",
        note: "Existing",
      }),
    ]);
    const existingBefore = selectExpenseByClientId("existing")(
      store.getState()
    );

    store.getState().upsertExpense(
      expense({
        clientId: "unrelated",
        note: "Unrelated",
      })
    );

    expect(selectExpenseByClientId("existing")(store.getState())).toBe(
      existingBefore
    );
  });

  it("keeps sync status selector identity only when counts are unchanged", () => {
    const store = createExpenseSyncStore();

    store.getState().hydrate([
      expense({
        clientId: "existing",
      }),
    ]);
    const statusBefore = selectExpenseSyncStatus(store.getState());

    store.getState().upsertExpense(
      expense({
        clientId: "unrelated",
      })
    );

    expect(selectExpenseSyncStatus(store.getState())).toBe(statusBefore);

    store.getState().upsertExpense(
      expense({
        clientId: "pending",
        serverId: null,
        syncStatus: "pending",
        serverUpdatedAt: null,
      })
    );

    expect(selectExpenseSyncStatus(store.getState())).not.toBe(statusBefore);
  });

  it("keeps sync status selector identity scoped to each store", () => {
    const firstStore = createExpenseSyncStore();
    const secondStore = createExpenseSyncStore();

    firstStore.getState().hydrate([
      expense({
        clientId: "first",
      }),
    ]);
    const firstStatusBefore = selectExpenseSyncStatus(firstStore.getState());

    secondStore.getState().hydrate([
      expense({
        clientId: "second",
        serverId: null,
        syncStatus: "pending",
        serverUpdatedAt: null,
      }),
    ]);
    expect(selectExpenseSyncStatus(secondStore.getState())).toEqual({
      pendingCount: 1,
      failedCount: 0,
    });

    firstStore.getState().upsertExpense(
      expense({
        clientId: "first-unrelated",
      })
    );

    expect(selectExpenseSyncStatus(firstStore.getState())).toBe(
      firstStatusBefore
    );
  });

  it("does not publish expense state for missing remove and failure actions", () => {
    const store = createExpenseSyncStore();

    store.getState().hydrate([
      expense({
        clientId: "existing",
      }),
    ]);
    const existingBefore = selectExpenseByClientId("existing")(
      store.getState()
    );
    const idsBefore = selectOrderedExpenseClientIds(store.getState());
    const statusBefore = selectExpenseSyncStatus(store.getState());
    let notificationCount = 0;
    const unsubscribe = store.subscribe(() => {
      notificationCount += 1;
    });

    store.getState().removeExpense("missing");
    store.getState().markExpenseFailed("missing", "Missing record");

    expect(selectExpenseByClientId("existing")(store.getState())).toBe(
      existingBefore
    );
    expect(selectOrderedExpenseClientIds(store.getState())).toBe(idsBefore);
    expect(selectExpenseSyncStatus(store.getState())).toBe(statusBefore);
    expect(notificationCount).toBe(0);

    unsubscribe();
  });

  it("orders expenses by date descending, server id descending, then client id", () => {
    const store = createExpenseSyncStore();

    store.getState().hydrate([
      expense({
        clientId: "same-date-server-2-b",
        serverId: 2,
        date: "2026-05-23",
      }),
      expense({
        clientId: "later-date",
        serverId: 1,
        date: "2026-05-24",
      }),
      expense({
        clientId: "same-date-server-3",
        serverId: 3,
        date: "2026-05-23",
      }),
      expense({
        clientId: "same-date-server-2-a",
        serverId: 2,
        date: "2026-05-23",
      }),
      expense({
        clientId: "earlier-date",
        serverId: 100,
        date: "2026-05-22",
      }),
    ]);

    expect(store.getState().orderedClientIds).toEqual([
      "later-date",
      "same-date-server-3",
      "same-date-server-2-a",
      "same-date-server-2-b",
      "earlier-date",
    ]);
  });
});
