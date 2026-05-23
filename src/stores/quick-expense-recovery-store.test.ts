import { Category, PaidBy } from "@/enums";
import { describe, expect, it } from "vitest";

import {
  createQuickExpenseRecoveryStore,
  getPersistableQuickExpenseRecoveryState,
  QUICK_EXPENSE_RECOVERY_TTL_MS,
  type TQuickExpensePayload,
  type TQuickExpenseRecoveryEntry,
} from "./quick-expense-recovery-store";

const payload: TQuickExpensePayload = {
  date: "20/05/2026",
  amount: 34000,
  note: "Retry lunch",
  category: Category.FOOD,
  paidBy: PaidBy.CUBI,
  budgetId: null,
};

const buildRecoveryEntry = (
  overrides: Partial<TQuickExpenseRecoveryEntry> = {}
): TQuickExpenseRecoveryEntry => ({
  operationId: "quick-expense-1",
  mode: "create",
  draft: payload,
  payload,
  status: "queued",
  createdAt: 1_769_000_000_000,
  ...overrides,
});

describe("quick expense recovery store", () => {
  it("enqueues entries and moves them through running and failed states", () => {
    const store = createQuickExpenseRecoveryStore();
    const entry = buildRecoveryEntry();

    store.getState().enqueue(entry);

    expect(store.getState().entries).toEqual([entry]);
    expect(store.getState().getQueuedEntries()).toEqual([entry]);

    store.getState().markRunning(entry.operationId);

    expect(store.getState().entries[0]).toMatchObject({
      operationId: entry.operationId,
      status: "running",
    });
    expect(store.getState().getQueuedEntries()).toEqual([]);

    store.getState().markFailed(entry.operationId);

    expect(store.getState().entries[0]).toMatchObject({
      operationId: entry.operationId,
      status: "failed",
    });
  });

  it("attaches toast ids to recovery entries", () => {
    const store = createQuickExpenseRecoveryStore();
    const entry = buildRecoveryEntry();

    store.getState().enqueue(entry);
    store.getState().attachToastId(entry.operationId, "toast-1");

    expect(store.getState().entries[0]).toMatchObject({
      operationId: entry.operationId,
      toastId: "toast-1",
    });
  });

  it("only marks queued entries as running", () => {
    const store = createQuickExpenseRecoveryStore();
    const failedEntry = buildRecoveryEntry({
      operationId: "quick-expense-failed",
      status: "failed",
    });

    store.getState().enqueue(failedEntry);
    store.getState().markRunning(failedEntry.operationId);

    expect(store.getState().entries[0]?.status).toBe("failed");
  });

  it("clears entries and active recovery ids", () => {
    const store = createQuickExpenseRecoveryStore();
    const activeEntry = buildRecoveryEntry({
      operationId: "quick-expense-active",
    });
    const otherEntry = buildRecoveryEntry({
      operationId: "quick-expense-other",
    });

    store.getState().enqueue(activeEntry);
    store.getState().enqueue(otherEntry);
    store.getState().setActiveRecovery(activeEntry.operationId);
    store.getState().clear(activeEntry.operationId);

    expect(store.getState().entries).toEqual([otherEntry]);
    expect(store.getState().activeRecoveryOperationId).toBeNull();
  });

  it("prunes expired entries using QUICK_EXPENSE_RECOVERY_TTL_MS", () => {
    const store = createQuickExpenseRecoveryStore();
    const now = 1_769_000_000_000;
    const expiredEntry = buildRecoveryEntry({
      operationId: "quick-expense-expired",
      createdAt: now - QUICK_EXPENSE_RECOVERY_TTL_MS - 1,
    });
    const freshEntry = buildRecoveryEntry({
      operationId: "quick-expense-fresh",
      createdAt: now - QUICK_EXPENSE_RECOVERY_TTL_MS,
    });

    store.getState().enqueue(expiredEntry);
    store.getState().enqueue(freshEntry);
    store.getState().setActiveRecovery(expiredEntry.operationId);
    store.getState().pruneExpired(now);

    expect(store.getState().entries).toEqual([freshEntry]);
    expect(store.getState().activeRecoveryOperationId).toBeNull();
  });

  it("excludes toast ids from persisted state", () => {
    const state = createQuickExpenseRecoveryStore({
      entries: [
        buildRecoveryEntry({
          operationId: "quick-expense-toast",
          toastId: "toast-1",
        }),
      ],
      activeRecoveryOperationId: "quick-expense-toast",
    }).getState();

    const persistedState = getPersistableQuickExpenseRecoveryState(state);

    expect(persistedState).toEqual({
      entries: [
        {
          ...buildRecoveryEntry({
            operationId: "quick-expense-toast",
          }),
        },
      ],
      activeRecoveryOperationId: "quick-expense-toast",
    });
    expect(persistedState.entries[0]).not.toHaveProperty("toastId");
  });
});
