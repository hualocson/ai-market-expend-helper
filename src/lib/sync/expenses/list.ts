import dayjs from "@/configs/date";
import {
  type ExpenseListItem,
  type ExpenseListQueryParams,
  type ExpenseListResult,
  groupExpenseRowsByDate,
  resolveExpenseListRange,
} from "@/lib/expenses/list-model";

import type { LocalExpense } from "./types";

const normalizeSearchText = (value: string) =>
  value
    .replace(/[đĐ]/g, (character) => (character === "Đ" ? "D" : "d"))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const tokenizeSearchText = (value: string) =>
  normalizeSearchText(value)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

const matchesLocalExpenseSearch = (row: LocalExpense, q: string) => {
  const terms = tokenizeSearchText(q);
  if (terms.length === 0) {
    return true;
  }

  const rowTokens = new Set(tokenizeSearchText(`${row.note} ${row.category}`));

  return terms.every((term) => rowTokens.has(term));
};

const localExpenseClientIdToListId = (clientId: string) => {
  const hash = [...clientId].reduce(
    (acc, character) => (acc * 31 + character.charCodeAt(0)) >>> 0,
    0
  );

  return -Math.max(1, hash);
};

const reserveLocalExpenseListId = (row: LocalExpense, usedIds: Set<number>) => {
  if (row.serverId !== null) {
    usedIds.add(row.serverId);
    return row.serverId;
  }

  let id = localExpenseClientIdToListId(row.clientId);
  while (usedIds.has(id)) {
    id -= 1;
  }
  usedIds.add(id);

  return id;
};

const localExpenseToListItem = (
  row: LocalExpense,
  usedIds: Set<number>
): ExpenseListItem => ({
  id: reserveLocalExpenseListId(row, usedIds),
  clientId: row.clientId,
  date: row.date,
  amount: row.amount,
  note: row.note,
  category: row.category,
  paidBy: row.paidBy,
  budgetId: row.budgetId,
  budgetName: row.budgetName,
  syncStatus: row.syncStatus === "deleted" ? undefined : row.syncStatus,
});

const compareNullableServerIds = (a: LocalExpense, b: LocalExpense) => {
  const aIsPending = a.serverId === null;
  const bIsPending = b.serverId === null;
  if (aIsPending !== bIsPending) {
    return aIsPending ? -1 : 1;
  }
  if (aIsPending && bIsPending) {
    const updatedCompare = b.updatedAt.localeCompare(a.updatedAt);
    return updatedCompare !== 0
      ? updatedCompare
      : a.clientId.localeCompare(b.clientId);
  }

  return (b.serverId ?? 0) - (a.serverId ?? 0);
};

const sortLocalExpenses = (a: LocalExpense, b: LocalExpense) => {
  const dateCompare = b.date.localeCompare(a.date);
  if (dateCompare !== 0) {
    return dateCompare;
  }

  return compareNullableServerIds(a, b);
};

const localExpensesToListItems = (rows: LocalExpense[]) => {
  const usedIds = new Set<number>();

  return rows.map((row) => localExpenseToListItem(row, usedIds));
};

export const buildExpenseListResultFromLocalRows = (
  rows: LocalExpense[],
  params: ExpenseListQueryParams = {}
): ExpenseListResult => {
  const { activeMonth, effectiveRecentDays, isRecent, rangeEnd, rangeStart } =
    resolveExpenseListRange(params);
  const trimmedSearch = params.q?.trim();
  const pageLimit = Math.max(1, Math.floor(params.limit ?? 30));
  const pageOffset = Math.max(0, Math.floor(params.offset ?? 0));
  const filteredRows = localExpensesToListItems(
    rows
      .filter((row) => row.syncStatus !== "deleted")
      .filter((row) => {
        const date = dayjs(row.date, "YYYY-MM-DD", true);
        const inRange =
          !params.month && !isRecent
            ? true
            : date.isValid() &&
              !date.isBefore(rangeStart, "day") &&
              date.isBefore(rangeEnd, "day");
        return inRange && matchesLocalExpenseSearch(row, trimmedSearch ?? "");
      })
      .sort(sortLocalExpenses)
  );
  const pageRows = filteredRows.slice(pageOffset, pageOffset + pageLimit);

  return {
    activeMonth: activeMonth.format("YYYY-MM"),
    effectiveRecentDays,
    groupedRows: groupExpenseRowsByDate(pageRows),
    isRecent,
    pagination: {
      limit: pageLimit,
      offset: pageOffset,
      hasMore: filteredRows.length > pageOffset + pageLimit,
    },
    rows: pageRows,
    trimmedSearch,
  };
};
