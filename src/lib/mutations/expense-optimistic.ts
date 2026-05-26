import dayjs from "@/configs/date";
import type { CreateExpenseInput } from "@/db/type";
import { isBudgetColorId } from "@/lib/budget-appearance";
import { queries } from "@/lib/queries";
import type { BudgetWeeklyOption } from "@/lib/queries/budget-weekly";
import type {
  ExpenseListItem,
  ExpenseListResult,
} from "@/lib/services/expenses";
import type {
  InfiniteData,
  QueryClient,
  QueryKey,
} from "@tanstack/react-query";

type ExpenseListCacheData =
  | ExpenseListResult
  | InfiniteData<ExpenseListResult, number>;

type ExpenseListSnapshot = {
  queryKey: QueryKey;
  data: ExpenseListCacheData;
};

export type ExpenseOptimisticContext = {
  snapshots: ExpenseListSnapshot[];
};

type UpdateExpenseVariables = {
  id: number;
  input: CreateExpenseInput;
};

type ExpenseListQueryParamsFromKey = {
  month: string | null;
  q: string | null;
  mode: "full" | "recent" | null;
  recentDays: number | null;
};

type BuildRowOptions = {
  fallbackBudgetId?: number | null;
  fallbackBudgetName?: string | null;
  fallbackBudgetIcon?: string | null;
  fallbackBudgetColor?: CreateExpenseInput["budgetColor"];
  fallbackDate?: string;
};

type BudgetSnapshot = {
  name: string;
  icon: string | null;
  color: CreateExpenseInput["budgetColor"];
};

let optimisticExpenseId = -1;

const parseInputDate = (date: string) => {
  const displayDate = dayjs(date, "DD/MM/YYYY", true);
  if (displayDate.isValid()) {
    return displayDate.format("YYYY-MM-DD");
  }

  const isoDate = dayjs(date, "YYYY-MM-DD", true);
  if (isoDate.isValid()) {
    return isoDate.format("YYYY-MM-DD");
  }

  return null;
};

const getExpenseListQueries = (queryClient: QueryClient) =>
  queryClient
    .getQueryCache()
    .findAll({ queryKey: queries.expenses.list._def })
    .filter(
      (query) =>
        typeof query.state.data !== "undefined" &&
        query.queryKey.length >= queries.expenses.list._def.length
    );

const isExpenseListResult = (data: unknown): data is ExpenseListResult =>
  typeof data === "object" &&
  data !== null &&
  Array.isArray((data as Partial<ExpenseListResult>).rows) &&
  Array.isArray((data as Partial<ExpenseListResult>).groupedRows);

const isInfiniteExpenseListResult = (
  data: unknown
): data is InfiniteData<ExpenseListResult, number> => {
  if (typeof data !== "object" || data === null) {
    return false;
  }

  const candidate = data as Partial<InfiniteData<ExpenseListResult, number>>;
  return (
    Array.isArray(candidate.pages) &&
    candidate.pages.every(isExpenseListResult) &&
    Array.isArray(candidate.pageParams)
  );
};

const snapshotExpenseLists = (
  queryClient: QueryClient
): ExpenseOptimisticContext => ({
  snapshots: getExpenseListQueries(queryClient).flatMap((query) => {
    const data = query.state.data;
    if (!isExpenseListResult(data) && !isInfiniteExpenseListResult(data)) {
      return [];
    }

    return [{ queryKey: query.queryKey, data }];
  }),
});

const getParamsFromQueryKey = (
  queryKey: QueryKey
): ExpenseListQueryParamsFromKey => {
  const last = queryKey[queryKey.length - 1];
  if (
    typeof last === "object" &&
    last !== null &&
    "month" in last &&
    "q" in last &&
    "mode" in last &&
    "recentDays" in last
  ) {
    const params = last as ExpenseListQueryParamsFromKey;
    return {
      month: params.month,
      q: params.q,
      mode: params.mode,
      recentDays: params.recentDays,
    };
  }

  return { month: null, q: null, mode: null, recentDays: null };
};

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

const matchesSearch = (row: ExpenseListItem, q: string | null) => {
  const terms = tokenizeSearchText(q ?? "");
  if (terms.length === 0) {
    return true;
  }

  const rowTokens = new Set(tokenizeSearchText(`${row.note} ${row.category}`));

  return terms.every((term) => rowTokens.has(term));
};

const matchesMonth = (
  row: ExpenseListItem,
  _result: ExpenseListResult,
  params: ExpenseListQueryParamsFromKey
) => {
  if (params.month === null) {
    return true;
  }

  const rowMonth = dayjs(row.date, "YYYY-MM-DD", true).format("YYYY-MM");
  return rowMonth === params.month;
};

const matchesRecent = (
  row: ExpenseListItem,
  result: ExpenseListResult,
  params: ExpenseListQueryParamsFromKey
) => {
  if (params.mode !== "recent" && !result.isRecent) {
    return true;
  }

  const rowDate = dayjs(row.date, "YYYY-MM-DD", true);
  const activeMonth = dayjs(result.activeMonth, "YYYY-MM", true);
  if (!rowDate.isValid() || !activeMonth.isValid()) {
    return false;
  }

  const startOfMonth = activeMonth.startOf("month");
  const endOfMonth = activeMonth.add(1, "month").startOf("month");
  const isCurrentMonth = activeMonth.isSame(dayjs(), "month");
  const recentRangeEnd = isCurrentMonth
    ? dayjs().add(1, "day").startOf("day")
    : endOfMonth;
  const recentRangeStart = recentRangeEnd.subtract(
    result.effectiveRecentDays,
    "day"
  );
  const rangeStart = recentRangeStart.isAfter(startOfMonth)
    ? recentRangeStart
    : startOfMonth;
  const rangeEnd = recentRangeEnd.isBefore(endOfMonth)
    ? recentRangeEnd
    : endOfMonth;

  return (
    !rowDate.isBefore(rangeStart, "day") && rowDate.isBefore(rangeEnd, "day")
  );
};

const matchesExpenseList = (
  row: ExpenseListItem,
  result: ExpenseListResult,
  queryKey: QueryKey
) => {
  const params = getParamsFromQueryKey(queryKey);
  return (
    matchesMonth(row, result, params) &&
    matchesRecent(row, result, params) &&
    matchesSearch(row, params.q)
  );
};

const rebuildGroups = (
  rows: ExpenseListItem[]
): ExpenseListResult["groupedRows"] =>
  rows.reduce<ExpenseListResult["groupedRows"]>((groups, row) => {
    const parsedDate = dayjs(row.date, "YYYY-MM-DD", true);
    const key = parsedDate.isValid()
      ? parsedDate.format("YYYY-MM-DD")
      : row.date;
    const label = parsedDate.isValid()
      ? parsedDate.format("dddd, DD/MM/YYYY")
      : row.date;
    const last = groups[groups.length - 1];

    if (!last || last.key !== key) {
      groups.push({ key, label, items: [row], totalAmount: row.amount });
      return groups;
    }

    last.items.push(row);
    last.totalAmount += row.amount;
    return groups;
  }, []);

const sortRows = (rows: ExpenseListItem[]) =>
  [...rows].sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) {
      return dateCompare;
    }

    const aIsOptimistic = a.id < 0;
    const bIsOptimistic = b.id < 0;
    if (aIsOptimistic !== bIsOptimistic) {
      return aIsOptimistic ? -1 : 1;
    }
    if (aIsOptimistic && bIsOptimistic) {
      return a.id - b.id;
    }

    return b.id - a.id;
  });

const withRows = (
  result: ExpenseListResult,
  rows: ExpenseListItem[]
): ExpenseListResult => {
  const sortedRows = sortRows(rows);
  return {
    ...result,
    rows: sortedRows,
    groupedRows: rebuildGroups(sortedRows),
  };
};

const getRowsFromCacheData = (data: ExpenseListCacheData) =>
  isInfiniteExpenseListResult(data)
    ? data.pages.flatMap((page) => page.rows)
    : data.rows;

const findBudgetSnapshot = (
  queryClient: QueryClient,
  budgetId: number | null | undefined
) => {
  if (!budgetId) {
    return null;
  }

  const budgetQueries = queryClient
    .getQueryCache()
    .findAll({ queryKey: queries.budgetWeekly.options._def });
  for (const query of budgetQueries) {
    if (!Array.isArray(query.state.data)) {
      continue;
    }

    const options = query.state.data as unknown[];
    const matched = options.find(
      (option): option is BudgetWeeklyOption =>
        typeof option === "object" &&
        option !== null &&
        "id" in option &&
        Number(option.id) === budgetId &&
        "name" in option &&
        typeof option.name === "string"
    );
    if (matched) {
      return {
        name: matched.name,
        icon: typeof matched.icon === "string" ? matched.icon : null,
        color: isBudgetColorId(matched.color) ? matched.color : null,
      } satisfies BudgetSnapshot;
    }
  }

  return null;
};

const buildRow = (
  input: CreateExpenseInput,
  queryClient: QueryClient,
  id: number,
  options: BuildRowOptions = {}
): ExpenseListItem | null => {
  const date = parseInputDate(input.date) ?? options.fallbackDate;
  if (!date) {
    return null;
  }

  const budgetId =
    input.budgetId === undefined
      ? (options.fallbackBudgetId ?? null)
      : input.budgetId;
  const budgetSnapshot =
    input.budgetId === undefined
      ? null
      : findBudgetSnapshot(queryClient, input.budgetId);
  const budgetName =
    input.budgetId === undefined
      ? (options.fallbackBudgetName ?? null)
      : input.budgetId === null
        ? null
        : (budgetSnapshot?.name ?? input.budgetName ?? null);
  const budgetIcon =
    input.budgetId === undefined
      ? (options.fallbackBudgetIcon ?? null)
      : input.budgetId === null
        ? null
        : (input.budgetIcon ??
          budgetSnapshot?.icon ??
          options.fallbackBudgetIcon ??
          null);
  const budgetColor =
    input.budgetId === undefined
      ? (options.fallbackBudgetColor ?? null)
      : input.budgetId === null
        ? null
        : (input.budgetColor ??
          budgetSnapshot?.color ??
          options.fallbackBudgetColor ??
          null);

  return {
    id,
    date,
    amount: Number(input.amount),
    note: input.note ?? "",
    category: input.category ?? "",
    paidBy: input.paidBy ?? "",
    budgetId,
    budgetName,
    budgetIcon,
    budgetColor,
  };
};

const patchSnapshots = (
  queryClient: QueryClient,
  context: ExpenseOptimisticContext,
  patch: (result: ExpenseListResult, queryKey: QueryKey) => ExpenseListResult
) => {
  context.snapshots.forEach((snapshot) => {
    if (isInfiniteExpenseListResult(snapshot.data)) {
      queryClient.setQueryData(snapshot.queryKey, {
        ...snapshot.data,
        pages: snapshot.data.pages.map((page) =>
          patch(page, snapshot.queryKey)
        ),
      });
      return;
    }

    queryClient.setQueryData(
      snapshot.queryKey,
      patch(snapshot.data, snapshot.queryKey)
    );
  });
};

const patchCreateSnapshots = (
  queryClient: QueryClient,
  context: ExpenseOptimisticContext,
  row: ExpenseListItem
) => {
  context.snapshots.forEach((snapshot) => {
    if (isInfiniteExpenseListResult(snapshot.data)) {
      const firstPage = snapshot.data.pages[0];
      if (
        !firstPage ||
        !matchesExpenseList(row, firstPage, snapshot.queryKey)
      ) {
        return;
      }

      queryClient.setQueryData(snapshot.queryKey, {
        ...snapshot.data,
        pages: [
          withRows(firstPage, [row, ...firstPage.rows]),
          ...snapshot.data.pages.slice(1),
        ],
      });
      return;
    }

    if (!matchesExpenseList(row, snapshot.data, snapshot.queryKey)) {
      return;
    }

    queryClient.setQueryData(
      snapshot.queryKey,
      withRows(snapshot.data, [row, ...snapshot.data.rows])
    );
  });
};

export const restoreExpenseListSnapshots = (
  queryClient: QueryClient,
  context: ExpenseOptimisticContext | undefined
) => {
  context?.snapshots.forEach((snapshot) => {
    queryClient.setQueryData(snapshot.queryKey, snapshot.data);
  });
};

export const applyOptimisticExpenseCreate = (
  queryClient: QueryClient,
  input: CreateExpenseInput
): ExpenseOptimisticContext => {
  const context = snapshotExpenseLists(queryClient);
  const row = buildRow(input, queryClient, optimisticExpenseId);
  if (!row) {
    return context;
  }
  optimisticExpenseId -= 1;

  patchCreateSnapshots(queryClient, context, row);

  return context;
};

export const applyOptimisticExpenseUpdate = (
  queryClient: QueryClient,
  variables: UpdateExpenseVariables
): ExpenseOptimisticContext => {
  const context = snapshotExpenseLists(queryClient);
  const previousRow = context.snapshots
    .flatMap((snapshot) => getRowsFromCacheData(snapshot.data))
    .find((row) => row.id === variables.id);
  const shouldReusePreviousBudgetAppearance =
    typeof variables.input.budgetId === "undefined" ||
    variables.input.budgetId === previousRow?.budgetId;
  const nextRow = buildRow(variables.input, queryClient, variables.id, {
    fallbackBudgetId: previousRow?.budgetId,
    fallbackBudgetName: previousRow?.budgetName,
    fallbackBudgetIcon: shouldReusePreviousBudgetAppearance
      ? previousRow?.budgetIcon
      : null,
    fallbackBudgetColor: shouldReusePreviousBudgetAppearance
      ? previousRow?.budgetColor
      : null,
    fallbackDate: previousRow?.date,
  });
  if (!nextRow) {
    return context;
  }

  patchSnapshots(queryClient, context, (result, queryKey) => {
    const hasRow = result.rows.some((row) => row.id === variables.id);
    const shouldInclude = matchesExpenseList(nextRow, result, queryKey);

    if (!hasRow && !shouldInclude) {
      return result;
    }
    if (!hasRow && shouldInclude && !previousRow) {
      return result;
    }

    const withoutRow = result.rows.filter((row) => row.id !== variables.id);
    return withRows(
      result,
      shouldInclude ? [nextRow, ...withoutRow] : withoutRow
    );
  });

  return context;
};

export const applyOptimisticExpenseDelete = (
  queryClient: QueryClient,
  id: number
): ExpenseOptimisticContext => {
  const context = snapshotExpenseLists(queryClient);

  patchSnapshots(queryClient, context, (result) =>
    withRows(
      result,
      result.rows.filter((row) => row.id !== id)
    )
  );

  return context;
};
