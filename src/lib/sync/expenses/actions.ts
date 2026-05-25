import dayjs from "@/configs/date";
import type { CreateExpenseInput } from "@/db/type";
import { syncRepository } from "@/lib/sync/core/repository";
import type { SyncRecord } from "@/lib/sync/core/types";
import type { StoreApi } from "zustand/vanilla";

import type { ExpenseSyncState } from "./store";
import {
  EXPENSE_SYNC_ENTITY,
  type ExpenseOutboxOperation,
  type ExpensePayload,
  type LocalExpense,
} from "./types";

type ExpenseSyncStoreApi = StoreApi<ExpenseSyncState>;

const createDevelopmentIdEntropy = () => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
};

const createLocalId = (prefix: string) => {
  if (process.env.NODE_ENV === "production") {
    return `prod-${prefix}-${crypto.randomUUID()}`;
  }

  return `dev-${prefix}-${createDevelopmentIdEntropy()}`;
};

const normalizeLocalExpenseDate = (value: string): string => {
  const displayDate = dayjs(value, "DD/MM/YYYY", true);
  if (displayDate.isValid()) {
    return displayDate.format("YYYY-MM-DD");
  }

  const isoDate = dayjs(value, "YYYY-MM-DD", true);
  if (isoDate.isValid()) {
    return isoDate.format("YYYY-MM-DD");
  }

  return dayjs().format("YYYY-MM-DD");
};

const getExistingExpense = (
  store: ExpenseSyncStoreApi,
  clientId: string
): LocalExpense => {
  const expense = store.getState().expensesByClientId[clientId];
  if (!expense) {
    throw new Error(`Local expense ${clientId} not found`);
  }

  return expense;
};

const toExpensePayload = (expense: LocalExpense): ExpensePayload => ({
  date: expense.date,
  amount: expense.amount,
  note: expense.note,
  category: expense.category,
  paidBy: expense.paidBy,
  budgetId: expense.budgetId,
  budgetName: expense.budgetName,
});

const toSyncRecord = (expense: LocalExpense): SyncRecord<ExpensePayload> => ({
  entity: EXPENSE_SYNC_ENTITY,
  clientId: expense.clientId,
  serverId: expense.serverId,
  syncStatus: expense.syncStatus,
  lastError: expense.lastError,
  updatedAt: expense.updatedAt,
  serverUpdatedAt: expense.serverUpdatedAt,
  payload: toExpensePayload(expense),
});

const toOutboxOperation = (
  expense: LocalExpense,
  type: ExpenseOutboxOperation["type"],
  createdAt: string,
  operationId = createLocalId("expense-op")
): ExpenseOutboxOperation => ({
  operationId,
  entity: EXPENSE_SYNC_ENTITY,
  type,
  clientId: expense.clientId,
  serverId: expense.serverId,
  payload: expense,
  createdAt,
  attemptCount: 0,
  lastAttemptAt: null,
  lastError: null,
});

const persistLocalExpense = async (
  store: ExpenseSyncStoreApi,
  expense: LocalExpense,
  type: ExpenseOutboxOperation["type"]
) => {
  await syncRepository.records.put(toSyncRecord(expense));
  await syncRepository.outbox.put(
    toOutboxOperation(expense, type, expense.updatedAt)
  );
  store.getState().upsertExpense(expense);

  return expense;
};

const listPendingCreateOperations = async (clientId: string) =>
  (await syncRepository.outbox.list(EXPENSE_SYNC_ENTITY)).filter(
    (operation) =>
      operation.clientId === clientId && operation.type === "create"
  ) as ExpenseOutboxOperation[];

const deleteExtraOperations = async (operations: ExpenseOutboxOperation[]) => {
  await Promise.all(
    operations.map((operation) =>
      syncRepository.outbox.delete(operation.operationId)
    )
  );
};

const coalescePendingCreate = async (
  store: ExpenseSyncStoreApi,
  expense: LocalExpense,
  pendingCreateOperations: ExpenseOutboxOperation[]
) => {
  const [pendingCreateOperation, ...extraPendingCreateOperations] =
    pendingCreateOperations;

  if (!pendingCreateOperation) {
    return null;
  }

  await syncRepository.records.put(toSyncRecord(expense));
  await syncRepository.outbox.put(
    toOutboxOperation(
      expense,
      "create",
      pendingCreateOperation.createdAt,
      pendingCreateOperation.operationId
    )
  );
  await deleteExtraOperations(extraPendingCreateOperations);
  store.getState().upsertExpense(expense);

  return expense;
};

export const createLocalExpense = async (
  store: ExpenseSyncStoreApi,
  input: CreateExpenseInput
): Promise<LocalExpense> => {
  const updatedAt = new Date().toISOString();
  const clientId = input.clientId ?? createLocalId("expense");
  const expense: LocalExpense = {
    entity: EXPENSE_SYNC_ENTITY,
    clientId,
    serverId: null,
    date: normalizeLocalExpenseDate(input.date),
    amount: input.amount,
    note: input.note?.trim() ?? "",
    category: input.category,
    paidBy: input.paidBy,
    budgetId: input.budgetId ?? null,
    budgetName: input.budgetName ?? null,
    syncStatus: "pending",
    lastError: null,
    updatedAt,
    serverUpdatedAt: null,
  };
  const coalescedExpense = await coalescePendingCreate(
    store,
    expense,
    await listPendingCreateOperations(clientId)
  );
  if (coalescedExpense) {
    return coalescedExpense;
  }

  return persistLocalExpense(store, expense, "create");
};

export const updateLocalExpense = async (
  store: ExpenseSyncStoreApi,
  clientId: string,
  input: CreateExpenseInput
): Promise<LocalExpense> => {
  const existingExpense = getExistingExpense(store, clientId);
  const updatedAt = new Date().toISOString();
  const expense: LocalExpense = {
    ...existingExpense,
    date: normalizeLocalExpenseDate(input.date),
    amount: input.amount,
    note: input.note?.trim() ?? "",
    category: input.category,
    paidBy: input.paidBy,
    budgetId: input.budgetId ?? null,
    budgetName:
      input.budgetId === null
        ? null
        : (input.budgetName ??
          (input.budgetId === existingExpense.budgetId
            ? existingExpense.budgetName
            : null)),
    syncStatus: "pending",
    lastError: null,
    updatedAt,
  };

  if (existingExpense.serverId === null) {
    const coalescedExpense = await coalescePendingCreate(
      store,
      expense,
      await listPendingCreateOperations(clientId)
    );
    if (coalescedExpense) {
      return coalescedExpense;
    }
  }

  return persistLocalExpense(store, expense, "update");
};

export const deleteLocalExpense = async (
  store: ExpenseSyncStoreApi,
  clientId: string
): Promise<LocalExpense> => {
  const existingExpense = getExistingExpense(store, clientId);
  const updatedAt = new Date().toISOString();
  const expense: LocalExpense = {
    ...existingExpense,
    syncStatus: "deleted",
    lastError: null,
    updatedAt,
  };

  if (existingExpense.serverId === null) {
    const pendingCreateOperations = await listPendingCreateOperations(clientId);
    if (pendingCreateOperations.length > 0) {
      await syncRepository.records.delete(EXPENSE_SYNC_ENTITY, clientId);
      await deleteExtraOperations(pendingCreateOperations);
      store.getState().removeExpense(clientId);

      return expense;
    }
  }

  return persistLocalExpense(store, expense, "delete");
};
