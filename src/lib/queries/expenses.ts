import type {
  ExpenseListQueryParams,
  ExpenseListResult,
} from "@/lib/expenses/list-model";
import { syncRepository } from "@/lib/sync/core/repository";
import type { SyncRecord } from "@/lib/sync/core/types";
import { buildExpenseListResultFromLocalRows } from "@/lib/sync/expenses/list";
import {
  EXPENSE_SYNC_ENTITY,
  type ExpensePayload,
  type LocalExpense,
} from "@/lib/sync/expenses/types";
import { createQueryKeys } from "@lukemorales/query-key-factory";

export type { ExpenseListQueryParams } from "@/lib/expenses/list-model";

const isBrowserIndexedDbAvailable = () =>
  typeof window !== "undefined" && typeof indexedDB !== "undefined";

const isExpensePayload = (payload: unknown): payload is ExpensePayload => {
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
  if (!isExpensePayload(record.payload)) {
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

const getLocalExpenseRows = async (): Promise<LocalExpense[]> =>
  (await syncRepository.records.list(EXPENSE_SYNC_ENTITY)).flatMap((record) => {
    const expense = syncRecordToLocalExpense(record);
    return expense ? [expense] : [];
  });

export const fetchExpenseList = async (
  params: ExpenseListQueryParams = {}
): Promise<ExpenseListResult> => {
  if (!isBrowserIndexedDbAvailable()) {
    return buildExpenseListResultFromLocalRows([], params);
  }

  return buildExpenseListResultFromLocalRows(
    await getLocalExpenseRows(),
    params
  );
};

export const expenseQueries = createQueryKeys("expenses", {
  list: (params: ExpenseListQueryParams = {}) => ({
    queryKey: [
      {
        month: params.month ?? null,
        q: params.q ?? null,
        mode: params.mode ?? null,
        recentDays: params.recentDays ?? null,
        limit: params.limit ?? null,
      },
    ],
    queryFn: ({ pageParam }) =>
      fetchExpenseList({
        ...params,
        offset: typeof pageParam === "number" ? pageParam : params.offset,
      }),
  }),
});
