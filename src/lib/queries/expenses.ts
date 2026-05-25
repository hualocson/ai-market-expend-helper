import type {
  ExpenseListItem,
  ExpenseListQueryParams,
  ExpenseListResult,
} from "@/lib/expenses/list-model";
import { groupExpenseRowsByDate } from "@/lib/expenses/list-model";
import { syncRepository } from "@/lib/sync/core/repository";
import type { SyncRecord } from "@/lib/sync/core/types";
import { buildExpenseListResultFromLocalRows } from "@/lib/sync/expenses/list";
import {
  EXPENSE_SYNC_ENTITY,
  type ExpensePayload,
  type LocalExpense,
} from "@/lib/sync/expenses/types";
import { createQueryKeys } from "@lukemorales/query-key-factory";

import { fetchJson } from "./http";

export type { ExpenseListQueryParams } from "@/lib/expenses/list-model";

const isBrowserIndexedDbAvailable = () =>
  typeof window !== "undefined" && typeof indexedDB !== "undefined";

const SERVER_FIRST_PAGE_AFTER_LOCAL_ONLY_OFFSET = -1;

const localExpenseClientIdToListId = (clientId: string) => {
  const hash = [...clientId].reduce(
    (acc, character) => (acc * 31 + character.charCodeAt(0)) >>> 0,
    0
  );

  return -Math.max(1, hash);
};

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

const expenseListRowToSyncRecord = (
  row: ExpenseListResult["rows"][number],
  updatedAt: string,
  existingRecord?: SyncRecord
): SyncRecord<ExpensePayload> => ({
  entity: EXPENSE_SYNC_ENTITY,
  clientId: existingRecord?.clientId ?? `expense-server-${row.id}`,
  serverId: row.id,
  syncStatus: "synced",
  lastError: null,
  updatedAt,
  serverUpdatedAt: updatedAt,
  payload: {
    date: row.date,
    amount: row.amount,
    note: row.note,
    category: row.category,
    paidBy: row.paidBy,
    budgetId: row.budgetId,
    budgetName: row.budgetName,
  },
});

const seedLocalExpenseRows = async (
  result: ExpenseListResult
): Promise<void> => {
  if (result.rows.length === 0) {
    return;
  }

  const updatedAt = new Date().toISOString();
  const existingRecords =
    await syncRepository.records.list(EXPENSE_SYNC_ENTITY);
  const records = result.rows.flatMap((row) => {
    const existingRecord = existingRecords.find(
      (record) => record.serverId === row.id
    );

    if (existingRecord && existingRecord.syncStatus !== "synced") {
      return [];
    }

    return [expenseListRowToSyncRecord(row, updatedAt, existingRecord)];
  });

  if (records.length > 0) {
    await syncRepository.records.putMany(records);
  }
};

const reserveLocalExpenseListId = (
  expense: LocalExpense,
  usedIds: Set<number>
) => {
  if (expense.serverId !== null) {
    usedIds.add(expense.serverId);
    return expense.serverId;
  }

  let id = localExpenseClientIdToListId(expense.clientId);
  while (usedIds.has(id)) {
    id -= 1;
  }
  usedIds.add(id);

  return id;
};

const localExpenseToListItem = (
  expense: LocalExpense,
  usedIds: Set<number>
): ExpenseListItem => ({
  id: reserveLocalExpenseListId(expense, usedIds),
  date: expense.date,
  amount: expense.amount,
  note: expense.note,
  category: expense.category,
  paidBy: expense.paidBy,
  budgetId: expense.budgetId,
  budgetName: expense.budgetName,
});

const localExpenseMatchesParams = (
  expense: LocalExpense,
  params: ExpenseListQueryParams
) =>
  buildExpenseListResultFromLocalRows([expense], {
    ...params,
    limit: 1,
    offset: 0,
  }).rows.length > 0;

const overlayDirtyLocalRows = (
  result: ExpenseListResult,
  localRows: LocalExpense[],
  params: ExpenseListQueryParams
): ExpenseListResult => {
  const dirtyLocalRows = localRows.filter((row) => row.syncStatus !== "synced");
  const dirtyLocalRowsByServerId = new Map(
    dirtyLocalRows.flatMap((row) =>
      row.serverId === null ? [] : [[row.serverId, row]]
    )
  );

  if (dirtyLocalRows.length === 0) {
    return result;
  }

  const usedIds = new Set(result.rows.map((row) => row.id));
  const representedDirtyClientIds = new Set<string>();
  const rows = result.rows.flatMap((row) => {
    const localRow = dirtyLocalRowsByServerId.get(row.id);
    if (!localRow) {
      return [row];
    }

    if (localRow.syncStatus === "deleted") {
      return [];
    }

    if (!localExpenseMatchesParams(localRow, params)) {
      return [];
    }

    if ((params.offset ?? 0) > 0) {
      return [];
    }

    representedDirtyClientIds.add(localRow.clientId);
    return [localExpenseToListItem(localRow, usedIds)];
  });
  const shouldAppendDirtyRows = (params.offset ?? 0) === 0;
  const appendedDirtyRows = shouldAppendDirtyRows
    ? dirtyLocalRows
        .filter(
          (row) =>
            !representedDirtyClientIds.has(row.clientId) &&
            row.syncStatus !== "deleted" &&
            localExpenseMatchesParams(row, params)
        )
        .map((row) => localExpenseToListItem(row, usedIds))
    : [];
  const mergedRows = [...appendedDirtyRows, ...rows].sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) {
      return dateCompare;
    }

    return b.id - a.id;
  });

  return {
    ...result,
    groupedRows: groupExpenseRowsByDate(mergedRows),
    rows: mergedRows,
  };
};

const buildLocalExpenseListResult = (
  rows: LocalExpense[],
  params: ExpenseListQueryParams
) => {
  const result = buildExpenseListResultFromLocalRows(rows, params);
  const matchingLocalOnlyDirtyRows = rows.filter(
    (row) =>
      row.serverId === null &&
      row.syncStatus !== "synced" &&
      localExpenseMatchesParams(row, params)
  );
  const hasMatchingLocalOnlyDirtyRows = matchingLocalOnlyDirtyRows.length > 0;

  if ((params.offset ?? 0) === 0 && result.rows.length > 0) {
    const usedIds = new Set<number>();
    const pageRows = hasMatchingLocalOnlyDirtyRows
      ? matchingLocalOnlyDirtyRows.map((row) =>
          localExpenseToListItem(row, usedIds)
        )
      : result.rows;

    return {
      ...result,
      groupedRows: groupExpenseRowsByDate(pageRows),
      rows: pageRows,
      pagination: {
        ...result.pagination,
        hasMore: true,
        ...(hasMatchingLocalOnlyDirtyRows
          ? { nextOffset: SERVER_FIRST_PAGE_AFTER_LOCAL_ONLY_OFFSET }
          : {}),
      },
    };
  }

  return result;
};

const canServeExpenseListFromLocalRows = (
  result: ExpenseListResult,
  params: ExpenseListQueryParams,
  localRows: LocalExpense[]
) => {
  if ((params.offset ?? 0) > 0) {
    return false;
  }

  const limit = Math.max(1, Math.floor(params.limit ?? 30));
  const hasMatchingLocalOnlyDirtyRows = localRows.some(
    (row) =>
      row.serverId === null &&
      row.syncStatus !== "synced" &&
      localExpenseMatchesParams(row, params)
  );
  if (hasMatchingLocalOnlyDirtyRows) {
    return result.rows.length > 0;
  }

  const serverBackedRowCount = result.rows.filter((row) =>
    localRows.some(
      (localRow) =>
        localRow.serverId === row.id && localRow.syncStatus === "synced"
    )
  ).length;

  return serverBackedRowCount >= limit;
};

export const fetchExpenseList = async ({
  month,
  q,
  mode,
  recentDays,
  limit,
  offset,
}: ExpenseListQueryParams = {}): Promise<ExpenseListResult> => {
  const shouldFetchServerFirstPageAfterLocalOnly =
    offset === SERVER_FIRST_PAGE_AFTER_LOCAL_ONLY_OFFSET;
  const query = new URLSearchParams();

  if (month !== undefined) {
    query.set("month", month);
  }
  if (q !== undefined) {
    query.set("q", q);
  }
  if (mode !== undefined) {
    query.set("mode", mode);
  }
  if (recentDays !== undefined) {
    query.set("recentDays", String(recentDays));
  }
  if (limit !== undefined) {
    query.set("limit", String(limit));
  }
  if (offset !== undefined) {
    query.set(
      "offset",
      String(shouldFetchServerFirstPageAfterLocalOnly ? 0 : offset)
    );
  }

  const queryString = query.toString();
  const params = { month, q, mode, recentDays, limit, offset };
  let localRows: LocalExpense[] = [];

  if (
    isBrowserIndexedDbAvailable() &&
    !shouldFetchServerFirstPageAfterLocalOnly
  ) {
    localRows = await getLocalExpenseRows();
    if (localRows.length > 0) {
      const localResult = buildLocalExpenseListResult(localRows, params);
      if (canServeExpenseListFromLocalRows(localResult, params, localRows)) {
        return localResult;
      }
    }
  }

  const result = await fetchJson<ExpenseListResult>(
    `/api/expenses${queryString ? `?${queryString}` : ""}`,
    {
      method: "GET",
      cache: "no-store",
    }
  );

  if (isBrowserIndexedDbAvailable()) {
    await seedLocalExpenseRows(result);
    return overlayDirtyLocalRows(result, localRows, params);
  }

  return result;
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
