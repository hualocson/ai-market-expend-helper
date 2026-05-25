import { ApiResponseError, unwrapApiResponse } from "@/lib/api/api-response";
import { queries } from "@/lib/queries";
import type { ExpenseListQueryParams } from "@/lib/queries/expenses";
import { syncRepository } from "@/lib/sync/core/repository";
import type { SyncOperation, SyncRecord } from "@/lib/sync/core/types";
import type { InfiniteData, Query, QueryClient } from "@tanstack/react-query";

import { buildExpenseListResultFromLocalRows } from "./list";
import { expenseSyncStore } from "./store";
import {
  EXPENSE_SYNC_ENTITY,
  type ExpensePayload,
  type LocalExpense,
} from "./types";

type ExpenseSyncServerRow = {
  id: number;
  clientId: string | null;
  date: string;
  amount: number;
  note: string;
  category: string;
  paidBy: string;
  budgetId: number | null;
  budgetName: string | null;
  updatedAt: string;
  deletedAt: string | null;
  isDeleted: boolean;
};

type ExpenseSyncPullResult = {
  cursor: string;
  changes: ExpenseSyncServerRow[];
};

type ExpenseSyncPushResult = {
  results: Array<
    | {
        operationId: string;
        ok: true;
        row: ExpenseSyncServerRow;
      }
    | {
        operationId: string;
        ok: false;
        error: string;
      }
  >;
};

type ExpenseListCacheParams = Omit<ExpenseListQueryParams, "offset">;

const isRecordPayload = (payload: unknown): payload is ExpensePayload => {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  const candidate = payload as Partial<ExpensePayload>;
  return (
    typeof candidate.date === "string" &&
    typeof candidate.amount === "number" &&
    typeof candidate.note === "string" &&
    typeof candidate.category === "string" &&
    typeof candidate.paidBy === "string" &&
    (typeof candidate.budgetId === "number" || candidate.budgetId === null) &&
    (typeof candidate.budgetName === "string" || candidate.budgetName === null)
  );
};

const syncRecordToLocalExpense = (
  record: SyncRecord<unknown>
): LocalExpense | null => {
  if (!isRecordPayload(record.payload)) {
    return null;
  }

  return {
    entity: EXPENSE_SYNC_ENTITY,
    clientId: record.clientId,
    serverId: record.serverId,
    syncStatus: record.syncStatus,
    lastError: record.lastError,
    updatedAt: record.updatedAt,
    serverUpdatedAt: record.serverUpdatedAt,
    ...record.payload,
  };
};

const localExpenseToSyncRecord = (
  expense: LocalExpense
): SyncRecord<ExpensePayload> => ({
  entity: EXPENSE_SYNC_ENTITY,
  clientId: expense.clientId,
  serverId: expense.serverId,
  syncStatus: expense.syncStatus,
  lastError: expense.lastError,
  updatedAt: expense.updatedAt,
  serverUpdatedAt: expense.serverUpdatedAt,
  payload: {
    date: expense.date,
    amount: expense.amount,
    note: expense.note,
    category: expense.category,
    paidBy: expense.paidBy,
    budgetId: expense.budgetId,
    budgetName: expense.budgetName,
  },
});

const getLocalExpensesFromRecords = async (): Promise<LocalExpense[]> =>
  (await syncRepository.records.list(EXPENSE_SYNC_ENTITY)).flatMap((record) => {
    const expense = syncRecordToLocalExpense(record);
    return expense ? [expense] : [];
  });

const getExistingExpenseIdentity = (
  row: ExpenseSyncServerRow,
  existingRows: LocalExpense[]
) => {
  if (row.clientId) {
    return row.clientId;
  }

  return (
    existingRows.find((expense) => expense.serverId === row.id)?.clientId ??
    `expense-server-${row.id}`
  );
};

const findExistingExpenseForServerRow = (
  row: ExpenseSyncServerRow,
  existingRows: LocalExpense[]
) =>
  row.clientId
    ? existingRows.find((expense) => expense.clientId === row.clientId)
    : existingRows.find((expense) => expense.serverId === row.id);

const serverRowToLocalExpense = (
  row: ExpenseSyncServerRow,
  existingRows: LocalExpense[]
): LocalExpense => {
  const deletedAt = row.deletedAt ?? row.updatedAt;

  return {
    entity: EXPENSE_SYNC_ENTITY,
    clientId: getExistingExpenseIdentity(row, existingRows),
    serverId: row.id,
    date: row.date,
    amount: row.amount,
    note: row.note,
    category: row.category,
    paidBy: row.paidBy,
    budgetId: row.budgetId,
    budgetName: row.budgetName,
    syncStatus: row.isDeleted ? "deleted" : "synced",
    lastError: null,
    updatedAt: row.isDeleted ? deletedAt : row.updatedAt,
    serverUpdatedAt: row.isDeleted ? deletedAt : row.updatedAt,
  };
};

const isExpenseListCacheData = (
  data: unknown
): data is ReturnType<typeof buildExpenseListResultFromLocalRows> => {
  if (typeof data !== "object" || data === null) {
    return false;
  }

  const candidate = data as Partial<
    ReturnType<typeof buildExpenseListResultFromLocalRows>
  >;
  return Array.isArray(candidate.rows) && Array.isArray(candidate.groupedRows);
};

const isInfiniteExpenseListCacheData = (
  data: unknown
): data is InfiniteData<
  ReturnType<typeof buildExpenseListResultFromLocalRows>,
  number
> => {
  if (typeof data !== "object" || data === null) {
    return false;
  }

  const candidate = data as Partial<
    InfiniteData<ReturnType<typeof buildExpenseListResultFromLocalRows>, number>
  >;
  return (
    Array.isArray(candidate.pages) &&
    candidate.pages.every(isExpenseListCacheData) &&
    Array.isArray(candidate.pageParams)
  );
};

const getExpenseListCacheParams = (query: Query): ExpenseListCacheParams => {
  const last = query.queryKey[query.queryKey.length - 1];
  if (typeof last !== "object" || last === null) {
    return {};
  }

  const params = last as {
    month?: string | null;
    q?: string | null;
    mode?: "full" | "recent" | null;
    recentDays?: number | null;
    limit?: number | null;
  };

  return {
    month: params.month ?? undefined,
    q: params.q ?? undefined,
    mode: params.mode ?? undefined,
    recentDays: params.recentDays ?? undefined,
    limit: params.limit ?? undefined,
  };
};

const isInfiniteExpenseListQuery = (query: Query) => {
  const options = query.options as {
    behavior?: unknown;
    getNextPageParam?: unknown;
    initialPageParam?: unknown;
  };

  return (
    options.behavior !== undefined ||
    typeof options.getNextPageParam === "function" ||
    "initialPageParam" in options
  );
};

const getInitialInfinitePageParam = (query: Query) => {
  const options = query.options as { initialPageParam?: unknown };
  return typeof options.initialPageParam === "number"
    ? options.initialPageParam
    : 0;
};

const seedActiveExpenseListQueries = (
  queryClient: QueryClient,
  rows: LocalExpense[]
) => {
  const activeListQueries = queryClient
    .getQueryCache()
    .findAll({ queryKey: queries.expenses.list._def })
    .filter((query) => query.getObserversCount() > 0);

  for (const query of activeListQueries) {
    const params = getExpenseListCacheParams(query);
    const existingData = query.state.data;

    if (
      isInfiniteExpenseListCacheData(existingData) ||
      isInfiniteExpenseListQuery(query)
    ) {
      const pageParams = isInfiniteExpenseListCacheData(existingData)
        ? existingData.pageParams
        : [getInitialInfinitePageParam(query)];

      queryClient.setQueryData(query.queryKey, {
        pageParams,
        pages: pageParams.map((pageParam) =>
          buildExpenseListResultFromLocalRows(rows, {
            ...params,
            offset: typeof pageParam === "number" ? pageParam : 0,
          })
        ),
      });
      continue;
    }

    queryClient.setQueryData(
      query.queryKey,
      buildExpenseListResultFromLocalRows(rows, params)
    );
  }
};

const refreshExpenseStoreAndActiveLists = async (queryClient: QueryClient) => {
  const rows = await getLocalExpensesFromRecords();
  expenseSyncStore.getState().hydrate(rows);
  seedActiveExpenseListQueries(queryClient, rows);
};

const fetchSyncJson = async <T>(
  input: string,
  init: RequestInit
): Promise<T> => {
  const response = await fetch(input, {
    ...init,
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);

  try {
    return unwrapApiResponse<T>(payload, response.status);
  } catch (error) {
    if (error instanceof ApiResponseError) {
      throw new Error(error.message);
    }
    throw error;
  }
};

const toPushOperationPayload = (operation: SyncOperation<unknown>) => {
  const payload = syncRecordToLocalExpense({
    entity: EXPENSE_SYNC_ENTITY,
    clientId: operation.clientId,
    serverId: operation.serverId,
    syncStatus: "pending",
    lastError: null,
    updatedAt: operation.createdAt,
    serverUpdatedAt: null,
    payload: operation.payload,
  });

  return {
    operationId: operation.operationId,
    type: operation.type,
    clientId: operation.clientId,
    serverId: operation.serverId,
    payload:
      operation.type === "delete" || payload === null
        ? null
        : {
            clientId: payload.clientId,
            date: payload.date,
            amount: payload.amount,
            note: payload.note,
            category: payload.category,
            paidBy: payload.paidBy,
            budgetId: payload.budgetId,
          },
  };
};

const reconcileServerRows = async (
  rows: ExpenseSyncServerRow[],
  options: { preserveDirty?: boolean } = {}
) => {
  if (rows.length === 0) {
    return;
  }

  const existingRows = await getLocalExpensesFromRecords();
  const records = rows.flatMap((row) => {
    const existingExpense = findExistingExpenseForServerRow(row, existingRows);
    if (
      options.preserveDirty &&
      existingExpense &&
      existingExpense.syncStatus !== "synced"
    ) {
      return [];
    }

    return [
      localExpenseToSyncRecord(serverRowToLocalExpense(row, existingRows)),
    ];
  });

  if (records.length > 0) {
    await syncRepository.records.putMany(records);
  }
};

const markOperationAndRecordFailed = async (
  operation: SyncOperation<unknown>,
  error: string
) => {
  await syncRepository.outbox.markFailed(operation.operationId, error);

  const [record] = (
    await syncRepository.records.list(EXPENSE_SYNC_ENTITY)
  ).filter((candidate) => candidate.clientId === operation.clientId);
  const expense = record ? syncRecordToLocalExpense(record) : null;
  if (!expense) {
    return;
  }

  const operationExpense = syncRecordToLocalExpense({
    entity: EXPENSE_SYNC_ENTITY,
    clientId: operation.clientId,
    serverId: operation.serverId,
    syncStatus: "failed",
    lastError: error,
    updatedAt: operation.createdAt,
    serverUpdatedAt: expense.serverUpdatedAt,
    payload: operation.payload,
  });
  const failedExpense = operationExpense ?? expense;

  await syncRepository.records.put(
    localExpenseToSyncRecord({
      ...failedExpense,
      serverId: failedExpense.serverId ?? expense.serverId,
      serverUpdatedAt: failedExpense.serverUpdatedAt ?? expense.serverUpdatedAt,
      syncStatus: "failed",
      lastError: error,
    })
  );
};

export const invalidateExpenseDerivedQueries = async (
  queryClient: QueryClient
): Promise<void> => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queries.dashboard._def }),
    queryClient.invalidateQueries({ queryKey: queries.reports._def }),
    queryClient.invalidateQueries({ queryKey: queries.budgets._def }),
    queryClient.invalidateQueries({ queryKey: queries.budgetWeekly._def }),
  ]);
};

export const hydrateExpenseSync = async (
  queryClient: QueryClient
): Promise<void> => {
  await refreshExpenseStoreAndActiveLists(queryClient);
};

export const pullExpenseChanges = async (
  queryClient: QueryClient
): Promise<void> => {
  const cursor = await syncRepository.metadata.getCursor(EXPENSE_SYNC_ENTITY);
  const query = new URLSearchParams();
  if (cursor) {
    query.set("cursor", cursor);
  }
  const queryString = query.toString();

  const result = await fetchSyncJson<ExpenseSyncPullResult>(
    `/api/expenses/sync${queryString ? `?${queryString}` : ""}`,
    { method: "GET" }
  );

  await reconcileServerRows(result.changes, { preserveDirty: true });
  await syncRepository.metadata.setCursor(EXPENSE_SYNC_ENTITY, result.cursor);
  await refreshExpenseStoreAndActiveLists(queryClient);
  await invalidateExpenseDerivedQueries(queryClient);
};

export const flushExpenseOutbox = async (
  queryClient: QueryClient
): Promise<void> => {
  const operations = await syncRepository.outbox.list(EXPENSE_SYNC_ENTITY);
  if (operations.length === 0) {
    return;
  }

  const attemptedAt = new Date().toISOString();
  await Promise.all(
    operations.map((operation) =>
      syncRepository.outbox.markAttempted(operation.operationId, attemptedAt)
    )
  );

  let result: ExpenseSyncPushResult;
  try {
    result = await fetchSyncJson<ExpenseSyncPushResult>("/api/expenses/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operations: operations.map(toPushOperationPayload),
      }),
    });
  } catch (error) {
    await refreshExpenseStoreAndActiveLists(queryClient);
    throw error;
  }

  const resultByOperationId = new Map(
    result.results.map((operationResult) => [
      operationResult.operationId,
      operationResult,
    ])
  );
  const failedOperationsByClientId = new Map<
    string,
    SyncOperation<unknown>[]
  >();
  const trackFailedOperation = (operation: SyncOperation<unknown>) => {
    const failedOperations =
      failedOperationsByClientId.get(operation.clientId) ?? [];
    failedOperations.push(operation);
    failedOperationsByClientId.set(operation.clientId, failedOperations);
  };

  for (const operation of operations) {
    const operationResult = resultByOperationId.get(operation.operationId);

    if (!operationResult) {
      await markOperationAndRecordFailed(operation, "No sync result returned");
      trackFailedOperation(operation);
      continue;
    }

    if (!operationResult.ok) {
      await markOperationAndRecordFailed(operation, operationResult.error);
      trackFailedOperation(operation);
      continue;
    }

    await reconcileServerRows([operationResult.row]);
    await Promise.all(
      (failedOperationsByClientId.get(operation.clientId) ?? []).map(
        (failedOperation) =>
          syncRepository.outbox.delete(failedOperation.operationId)
      )
    );
    failedOperationsByClientId.delete(operation.clientId);
    await syncRepository.outbox.delete(operation.operationId);
  }

  await refreshExpenseStoreAndActiveLists(queryClient);
  await invalidateExpenseDerivedQueries(queryClient);
};

export const syncExpensesNow = async (
  queryClient: QueryClient
): Promise<void> => {
  await hydrateExpenseSync(queryClient);
  await flushExpenseOutbox(queryClient);
  await pullExpenseChanges(queryClient);
};
