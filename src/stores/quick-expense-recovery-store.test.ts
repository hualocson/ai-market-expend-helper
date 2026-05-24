import { Category, PaidBy } from "@/enums";
import type {
  ExpenseOutboxOperation,
  LocalExpense,
} from "@/lib/sync/expenses/types";
import { describe, expect, it } from "vitest";

import {
  QUICK_EXPENSE_RECOVERY_TTL_MS,
  type TQuickExpenseRecoveryEntry,
  createQuickExpenseRecoveryStore,
  getPersistableQuickExpenseRecoveryState,
  mergeQuickExpenseRecoveryPersistedState,
} from "./quick-expense-recovery-store";

const createdAtIso = "2026-05-24T09:00:00.000Z";
const createdAtMs = Date.parse(createdAtIso);

const localExpense: LocalExpense = {
  entity: "expenses",
  clientId: "expense-client-1",
  serverId: null,
  date: "20/05/2026",
  amount: 34000,
  note: "Retry lunch",
  category: Category.FOOD,
  paidBy: PaidBy.CUBI,
  budgetId: null,
  budgetName: null,
  syncStatus: "failed",
  lastError: "Invalid payload",
  updatedAt: createdAtIso,
  serverUpdatedAt: null,
};

const buildFailedOperation = (
  overrides: Partial<ExpenseOutboxOperation> = {}
): ExpenseOutboxOperation => ({
  operationId: "expense-op-1",
  entity: "expenses",
  type: "create",
  clientId: localExpense.clientId,
  serverId: localExpense.serverId,
  payload: localExpense,
  createdAt: createdAtIso,
  attemptCount: 1,
  lastAttemptAt: "2026-05-24T09:01:00.000Z",
  lastError: "Invalid payload",
  ...overrides,
});

const syncFailedEntries = (
  entries: ExpenseOutboxOperation[],
  now = createdAtMs
) => {
  const store = createQuickExpenseRecoveryStore();
  store.getState().syncFailedOutboxEntries(entries, now);

  return store;
};

describe("quick expense recovery store", () => {
  it("maps failed create outbox operations to recovery entries", () => {
    const operation = buildFailedOperation();
    const store = syncFailedEntries([operation]);

    expect(store.getState().entries).toEqual({
      [operation.operationId]: expect.objectContaining({
        operationId: operation.operationId,
        mode: "create",
        clientId: "expense-client-1",
        serverId: null,
        status: "failed",
        lastError: "Invalid payload",
        createdAt: Date.parse("2026-05-24T09:01:00.000Z"),
        draft: expect.objectContaining({
          clientId: "expense-client-1",
          amount: 34000,
          note: "Retry lunch",
          category: Category.FOOD,
          paidBy: PaidBy.CUBI,
          budgetId: null,
        }),
        payload: expect.objectContaining({
          clientId: "expense-client-1",
          amount: 34000,
          note: "Retry lunch",
        }),
      }),
    });
    expect(store.getState().getUnnotifiedFailedEntries()).toEqual([
      store.getState().entries[operation.operationId],
    ]);
  });

  it("maps failed update outbox operations to edit recovery entries with server id", () => {
    const operation = buildFailedOperation({
      operationId: "expense-op-edit",
      type: "update",
      serverId: 42,
      payload: {
        ...localExpense,
        serverId: 42,
      },
    });
    const store = syncFailedEntries([operation]);

    expect(store.getState().entries[operation.operationId]).toMatchObject({
      mode: "edit",
      transactionId: 42,
      clientId: "expense-client-1",
      serverId: 42,
      draft: expect.objectContaining({
        clientId: "expense-client-1",
        amount: 34000,
      }),
    });
  });

  it("ages recovery entries from the failed sync attempt instead of the original queue time", () => {
    const operation = buildFailedOperation({
      createdAt: "2026-05-24T08:00:00.000Z",
      lastAttemptAt: "2026-05-24T09:05:00.000Z",
    });
    const store = syncFailedEntries(
      [operation],
      Date.parse("2026-05-24T09:10:00.000Z")
    );

    expect(store.getState().entries[operation.operationId]).toMatchObject({
      createdAt: Date.parse("2026-05-24T09:05:00.000Z"),
      status: "failed",
    });
  });

  it("ignores non-recoverable outbox operations", () => {
    const store = syncFailedEntries([
      buildFailedOperation({ lastError: null }),
      buildFailedOperation({
        operationId: "delete-op",
        type: "delete",
        payload: null,
        lastError: "Cannot delete",
      }),
      buildFailedOperation({
        operationId: "invalid-op",
        payload: {
          ...localExpense,
          amount: Number.NaN,
        },
      }),
    ]);

    expect(store.getState().entries).toEqual({});
  });

  it("tracks notification state without duplicating unchanged failed toasts", () => {
    const operation = buildFailedOperation();
    const store = syncFailedEntries([operation]);

    store
      .getState()
      .markNotified(operation.operationId, "toast-1", createdAtMs);

    expect(store.getState().getUnnotifiedFailedEntries()).toEqual([]);

    store.getState().syncFailedOutboxEntries([operation], createdAtMs + 1);

    expect(store.getState().getUnnotifiedFailedEntries()).toEqual([]);
    expect(store.getState().entries[operation.operationId]).toMatchObject({
      toastId: "toast-1",
      notifiedAt: createdAtMs,
    });

    store
      .getState()
      .syncFailedOutboxEntries(
        [buildFailedOperation({ lastError: "Still invalid" })],
        createdAtMs + 2
      );

    expect(store.getState().getUnnotifiedFailedEntries()).toEqual([
      expect.objectContaining({
        operationId: operation.operationId,
        lastError: "Still invalid",
      }),
    ]);
    expect(store.getState().entries[operation.operationId]).not.toHaveProperty(
      "notifiedAt"
    );
  });

  it("clears active recovery and suppresses the same failed outbox entry until it changes", () => {
    const operation = buildFailedOperation();
    const store = syncFailedEntries([operation]);

    store.getState().setActiveRecovery(operation.operationId);
    store.getState().clear(operation.operationId);

    expect(store.getState().entries).toEqual({});
    expect(store.getState().activeRecoveryOperationId).toBeNull();

    store.getState().syncFailedOutboxEntries([operation], createdAtMs + 1);

    expect(store.getState().entries).toEqual({});

    store.getState().syncFailedOutboxEntries(
      [
        buildFailedOperation({
          lastAttemptAt: "2026-05-24T09:02:00.000Z",
        }),
      ],
      createdAtMs + 3
    );

    expect(store.getState().entries[operation.operationId]).toMatchObject({
      operationId: operation.operationId,
      status: "failed",
      createdAt: Date.parse("2026-05-24T09:02:00.000Z"),
    });
  });

  it("prunes expired failed entries using QUICK_EXPENSE_RECOVERY_TTL_MS", () => {
    const now = createdAtMs + QUICK_EXPENSE_RECOVERY_TTL_MS + 1;
    const operation = buildFailedOperation({ lastAttemptAt: createdAtIso });
    const store = syncFailedEntries([operation], createdAtMs);

    store.getState().setActiveRecovery(operation.operationId);
    store.getState().pruneExpired(now);

    expect(store.getState().entries).toEqual({});
    expect(store.getState().activeRecoveryOperationId).toBeNull();

    store.getState().syncFailedOutboxEntries([operation], now + 1);

    expect(store.getState().entries).toEqual({});
  });

  it("excludes outbox-derived entries and toast ids from persisted state", () => {
    const operation = buildFailedOperation();
    const store = syncFailedEntries([operation]);

    store.getState().setActiveRecovery(operation.operationId);
    store
      .getState()
      .markNotified(operation.operationId, "toast-1", createdAtMs);
    store.getState().clear(operation.operationId);

    const persistedState = getPersistableQuickExpenseRecoveryState(
      store.getState()
    );

    expect(persistedState).toEqual({
      activeRecoveryOperationId: null,
      dismissedErrorsByOperationId: {
        [operation.operationId]: "Invalid payload:1779613260000",
      },
    });
    expect(persistedState).not.toHaveProperty("entries");
  });

  it("drops legacy persisted session entries when merging persisted state", () => {
    const currentState = createQuickExpenseRecoveryStore().getState();
    const legacyEntry = {
      operationId: "legacy-running",
      mode: "create",
      draft: localExpense,
      payload: localExpense,
      status: "running",
      createdAt: createdAtMs,
    } as unknown as TQuickExpenseRecoveryEntry;

    const mergedState = mergeQuickExpenseRecoveryPersistedState(
      {
        entries: {
          [legacyEntry.operationId]: legacyEntry,
        },
        activeRecoveryOperationId: legacyEntry.operationId,
        dismissedErrorsByOperationId: {
          "dismissed-op": "Invalid payload",
        },
      },
      currentState
    );

    expect(mergedState.entries).toEqual({});
    expect(mergedState.activeRecoveryOperationId).toBe(legacyEntry.operationId);
    expect(mergedState.dismissedErrorsByOperationId).toEqual({
      "dismissed-op": "Invalid payload",
    });
    expect(mergedState.syncFailedOutboxEntries).toBe(
      currentState.syncFailedOutboxEntries
    );
  });
});
