import {
  type SyncEntityStoreState,
  createSyncEntityStore,
} from "@/lib/sync/core/store-factory";
import type { SyncRecord } from "@/lib/sync/core/types";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

import { EXPENSE_SYNC_ENTITY, type LocalExpense } from "./types";

type ExpenseSyncStoreInput = Omit<LocalExpense, "entity"> & {
  entity?: "expenses";
};

type ExpenseSyncRecord = SyncRecord<LocalExpense> & {
  entity: "expenses";
};

export type ExpenseSyncStatus = {
  pendingCount: number;
  failedCount: number;
};

export type ExpenseSyncState = {
  hydrated: boolean;
  expensesByClientId: Record<string, LocalExpense>;
  orderedClientIds: string[];
  pendingCount: number;
  failedCount: number;
  syncStatus: ExpenseSyncStatus;
  hydrate: (expenses: ExpenseSyncStoreInput[]) => void;
  upsertExpense: (expense: ExpenseSyncStoreInput) => void;
  removeExpense: (clientId: string) => void;
  markExpenseFailed: (clientId: string, error: string) => void;
};

const normalizeExpense = (expense: ExpenseSyncStoreInput): LocalExpense => ({
  ...expense,
  entity: EXPENSE_SYNC_ENTITY,
});

const localExpenseToSyncRecord = (
  expense: ExpenseSyncStoreInput
): ExpenseSyncRecord => {
  const normalizedExpense = normalizeExpense(expense);

  return {
    entity: EXPENSE_SYNC_ENTITY,
    clientId: normalizedExpense.clientId,
    serverId: normalizedExpense.serverId,
    syncStatus: normalizedExpense.syncStatus,
    lastError: normalizedExpense.lastError,
    updatedAt: normalizedExpense.updatedAt,
    serverUpdatedAt: normalizedExpense.serverUpdatedAt,
    payload: normalizedExpense,
  };
};

const syncRecordToLocalExpense = (record: ExpenseSyncRecord): LocalExpense => ({
  ...record.payload,
  entity: EXPENSE_SYNC_ENTITY,
  clientId: record.clientId,
  serverId: record.serverId,
  syncStatus: record.syncStatus,
  lastError: record.lastError,
  updatedAt: record.updatedAt,
  serverUpdatedAt: record.serverUpdatedAt,
});

const sortExpenseRecords = (a: ExpenseSyncRecord, b: ExpenseSyncRecord) => {
  const dateCompare = b.payload.date.localeCompare(a.payload.date);
  if (dateCompare !== 0) {
    return dateCompare;
  }

  const serverIdCompare = (b.serverId ?? 0) - (a.serverId ?? 0);
  if (serverIdCompare !== 0) {
    return serverIdCompare;
  }

  return a.clientId.localeCompare(b.clientId);
};

const createCoreStateMapper = () => {
  const localExpenseByRecord = new WeakMap<ExpenseSyncRecord, LocalExpense>();
  let lastExpenseSyncStatus: ExpenseSyncStatus | null = null;

  const getLocalExpense = (record: ExpenseSyncRecord) => {
    const cachedExpense = localExpenseByRecord.get(record);
    if (cachedExpense) {
      return cachedExpense;
    }

    const expense = syncRecordToLocalExpense(record);
    localExpenseByRecord.set(record, expense);
    return expense;
  };

  const getStableExpenseSyncStatus = (
    pendingCount: number,
    failedCount: number
  ) => {
    if (
      lastExpenseSyncStatus?.pendingCount === pendingCount &&
      lastExpenseSyncStatus.failedCount === failedCount
    ) {
      return lastExpenseSyncStatus;
    }

    const status = { pendingCount, failedCount };
    lastExpenseSyncStatus = status;
    return status;
  };

  return (
    state: SyncEntityStoreState<ExpenseSyncRecord>
  ): Omit<
    ExpenseSyncState,
    "hydrate" | "upsertExpense" | "removeExpense" | "markExpenseFailed"
  > => ({
    hydrated: state.hydrated,
    expensesByClientId: Object.fromEntries(
      Object.entries(state.recordsByClientId).map(([clientId, record]) => [
        clientId,
        getLocalExpense(record),
      ])
    ),
    orderedClientIds: state.orderedClientIds,
    pendingCount: state.pendingCount,
    failedCount: state.failedCount,
    syncStatus: getStableExpenseSyncStatus(
      state.pendingCount,
      state.failedCount
    ),
  });
};

export const createExpenseSyncStore = () => {
  const coreStore = createSyncEntityStore<ExpenseSyncRecord>(
    EXPENSE_SYNC_ENTITY,
    sortExpenseRecords
  );

  return createStore<ExpenseSyncState>()((set) => {
    const mapCoreState = createCoreStateMapper();
    const syncFromCore = () => set(mapCoreState(coreStore.getState()));

    return {
      ...mapCoreState(coreStore.getState()),
      hydrate: (expenses) => {
        coreStore.getState().hydrate(expenses.map(localExpenseToSyncRecord));
        syncFromCore();
      },
      upsertExpense: (expense) => {
        coreStore.getState().upsertRecord(localExpenseToSyncRecord(expense));
        syncFromCore();
      },
      removeExpense: (clientId) => {
        if (!coreStore.getState().recordsByClientId[clientId]) {
          return;
        }

        coreStore.getState().removeRecord(clientId);
        syncFromCore();
      },
      markExpenseFailed: (clientId, error) => {
        if (!coreStore.getState().recordsByClientId[clientId]) {
          return;
        }

        coreStore.getState().markRecordFailed(clientId, error);
        syncFromCore();
      },
    };
  });
};

export const expenseSyncStore = createExpenseSyncStore();

export const useExpenseSyncStore = <T>(
  selector: (state: ExpenseSyncState) => T
): T => useStore(expenseSyncStore, selector);

export const selectExpenseSyncHydrated = (state: ExpenseSyncState) =>
  state.hydrated;

export const selectExpenseByClientId =
  (clientId: string) => (state: ExpenseSyncState) =>
    state.expensesByClientId[clientId];

export const selectOrderedExpenseClientIds = (state: ExpenseSyncState) =>
  state.orderedClientIds;

export const selectExpenseSyncStatus = (state: ExpenseSyncState) =>
  state.syncStatus;
