import { PaidBy } from "@/enums";
import type { ExpenseListResult } from "@/lib/services/expenses";
import { queries } from "@/lib/queries";
import type { InfiniteData } from "@tanstack/react-query";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import {
  applyOptimisticExpenseCreate,
  applyOptimisticExpenseDelete,
  applyOptimisticExpenseUpdate,
  restoreExpenseListSnapshots,
} from "./expense-optimistic";

const buildExpenseList = (
  rows: ExpenseListResult["rows"],
  overrides: Partial<ExpenseListResult> = {}
): ExpenseListResult => {
  const labelsByDate: Record<string, string> = {
    "2026-05-23": "Saturday, 23/05/2026",
    "2026-05-24": "Sunday, 24/05/2026",
  };

  return {
    activeMonth: "2026-05",
    effectiveRecentDays: 7,
    groupedRows: rows.reduce<ExpenseListResult["groupedRows"]>(
      (groups, row) => {
        const lastGroup = groups[groups.length - 1];

        if (lastGroup?.key === row.date) {
          lastGroup.items.push(row);
          lastGroup.totalAmount += row.amount;
          return groups;
        }

        groups.push({
          key: row.date,
          label: labelsByDate[row.date] ?? row.date,
          items: [row],
          totalAmount: row.amount,
        });
        return groups;
      },
      []
    ),
    isRecent: false,
    pagination: {
      limit: 30,
      offset: 0,
      hasMore: false,
    },
    rows,
    ...overrides,
  };
};

const buildInfiniteExpenseList = (
  pages: ExpenseListResult[]
): InfiniteData<ExpenseListResult, number> => ({
  pageParams: pages.map((page) => page.pagination.offset),
  pages,
});

const buildRows = (): ExpenseListResult["rows"] => [
  {
    id: 12,
    date: "2026-05-24",
    amount: 5000,
    note: "Tea",
    category: "Food",
    paidBy: PaidBy.CUBI,
    budgetId: null,
    budgetName: null,
  },
  {
    id: 10,
    date: "2026-05-23",
    amount: 10000,
    note: "Coffee",
    category: "Food",
    paidBy: PaidBy.CUBI,
    budgetId: null,
    budgetName: null,
  },
  {
    id: 11,
    date: "2026-05-23",
    amount: 25000,
    note: "Lunch",
    category: "Food",
    paidBy: PaidBy.EMBE,
    budgetId: null,
    budgetName: null,
  },
];

describe("expense optimistic cache helpers", () => {
  it("creates a temporary row in a matching month list and regroups totals", () => {
    const queryClient = new QueryClient();
    const query = queries.expenses.list({ month: "2026-05" });
    queryClient.setQueryData(
      query.queryKey,
      buildExpenseList([
        {
          id: 10,
          date: "2026-05-23",
          amount: 10000,
          note: "Coffee",
          category: "Food",
          paidBy: PaidBy.CUBI,
          budgetId: null,
          budgetName: null,
        },
      ])
    );

    applyOptimisticExpenseCreate(queryClient, {
      date: "23/05/2026",
      amount: 25000,
      note: "Lunch",
      category: "Food",
      paidBy: PaidBy.EMBE,
      budgetId: 7,
    });

    const next = queryClient.getQueryData<ExpenseListResult>(query.queryKey);
    expect(next?.rows).toHaveLength(2);
    expect(next?.rows[0]).toMatchObject({
      amount: 25000,
      note: "Lunch",
      budgetId: 7,
      budgetName: null,
    });
    expect(next?.rows[0]?.id).toBeLessThan(0);
    expect(next?.groupedRows[0]?.totalAmount).toBe(35000);
  });

  it("does not create a row in a non-matching search list", () => {
    const queryClient = new QueryClient();
    const query = queries.expenses.list({ month: "2026-05", q: "coffee" });
    queryClient.setQueryData(query.queryKey, buildExpenseList([]));

    applyOptimisticExpenseCreate(queryClient, {
      date: "23/05/2026",
      amount: 25000,
      note: "Lunch",
      category: "Food",
      paidBy: PaidBy.EMBE,
      budgetId: null,
    });

    const next = queryClient.getQueryData<ExpenseListResult>(query.queryKey);
    expect(next?.rows).toEqual([]);
    expect(next?.groupedRows).toEqual([]);
  });

  it("creates a temporary row in a matching search list", () => {
    const queryClient = new QueryClient();
    const query = queries.expenses.list({ month: "2026-05", q: "lunch" });
    queryClient.setQueryData(query.queryKey, buildExpenseList([]));

    applyOptimisticExpenseCreate(queryClient, {
      date: "23/05/2026",
      amount: 25000,
      note: "Lunch",
      category: "Food",
      paidBy: PaidBy.EMBE,
      budgetId: null,
    });

    const next = queryClient.getQueryData<ExpenseListResult>(query.queryKey);
    expect(next?.rows).toHaveLength(1);
    expect(next?.rows[0]).toMatchObject({
      amount: 25000,
      note: "Lunch",
      category: "Food",
    });
    expect(next?.groupedRows).toHaveLength(1);
    expect(next?.groupedRows[0]).toMatchObject({
      key: "2026-05-23",
      totalAmount: 25000,
    });
  });

  it("does not create a temporary row when the input date is invalid", () => {
    const queryClient = new QueryClient();
    const query = queries.expenses.list({ month: "2026-05" });
    queryClient.setQueryData(query.queryKey, buildExpenseList([]));

    applyOptimisticExpenseCreate(queryClient, {
      date: "not-a-date",
      amount: 25000,
      note: "Lunch",
      category: "Food",
      paidBy: PaidBy.EMBE,
      budgetId: null,
    });

    const next = queryClient.getQueryData<ExpenseListResult>(query.queryKey);
    expect(next?.rows).toEqual([]);
    expect(next?.groupedRows).toEqual([]);
  });

  it("matches every search term against combined note and category text", () => {
    const queryClient = new QueryClient();
    const query = queries.expenses.list({ month: "2026-05", q: "coffee food" });
    queryClient.setQueryData(query.queryKey, buildExpenseList([]));

    applyOptimisticExpenseCreate(queryClient, {
      date: "23/05/2026",
      amount: 25000,
      note: "Coffee",
      category: "Food",
      paidBy: PaidBy.EMBE,
      budgetId: null,
    });

    const next = queryClient.getQueryData<ExpenseListResult>(query.queryKey);
    expect(next?.rows).toHaveLength(1);
    expect(next?.rows[0]).toMatchObject({
      note: "Coffee",
      category: "Food",
    });
  });

  it("matches search terms without accents", () => {
    const queryClient = new QueryClient();
    const query = queries.expenses.list({ month: "2026-05", q: "ca phe" });
    queryClient.setQueryData(query.queryKey, buildExpenseList([]));

    applyOptimisticExpenseCreate(queryClient, {
      date: "23/05/2026",
      amount: 25000,
      note: "Cà phê",
      category: "Food",
      paidBy: PaidBy.EMBE,
      budgetId: null,
    });

    const next = queryClient.getQueryData<ExpenseListResult>(query.queryKey);
    expect(next?.rows).toHaveLength(1);
    expect(next?.rows[0]).toMatchObject({
      note: "Cà phê",
      category: "Food",
    });
  });

  it("matches Vietnamese dong text when searching with plain d", () => {
    const queryClient = new QueryClient();
    const query = queries.expenses.list({ month: "2026-05", q: "dong" });
    queryClient.setQueryData(query.queryKey, buildExpenseList([]));

    applyOptimisticExpenseCreate(queryClient, {
      date: "23/05/2026",
      amount: 25000,
      note: "Đồng giá",
      category: "Food",
      paidBy: PaidBy.EMBE,
      budgetId: null,
    });

    const next = queryClient.getQueryData<ExpenseListResult>(query.queryKey);
    expect(next?.rows).toHaveLength(1);
    expect(next?.rows[0]).toMatchObject({
      note: "Đồng giá",
      category: "Food",
    });
  });

  it("does not match a partial search term inside a note token", () => {
    const queryClient = new QueryClient();
    const query = queries.expenses.list({ month: "2026-05", q: "cof" });
    queryClient.setQueryData(query.queryKey, buildExpenseList([]));

    applyOptimisticExpenseCreate(queryClient, {
      date: "23/05/2026",
      amount: 25000,
      note: "Coffee",
      category: "Food",
      paidBy: PaidBy.EMBE,
      budgetId: null,
    });

    const next = queryClient.getQueryData<ExpenseListResult>(query.queryKey);
    expect(next?.rows).toEqual([]);
    expect(next?.groupedRows).toEqual([]);
  });

  it("does not match a search term inside a larger category token", () => {
    const queryClient = new QueryClient();
    const query = queries.expenses.list({ month: "2026-05", q: "food" });
    queryClient.setQueryData(query.queryKey, buildExpenseList([]));

    applyOptimisticExpenseCreate(queryClient, {
      date: "23/05/2026",
      amount: 25000,
      note: "Dinner",
      category: "Seafood",
      paidBy: PaidBy.EMBE,
      budgetId: null,
    });

    const next = queryClient.getQueryData<ExpenseListResult>(query.queryKey);
    expect(next?.rows).toEqual([]);
    expect(next?.groupedRows).toEqual([]);
  });

  it("updates a visible row and recomputes the group total", () => {
    const queryClient = new QueryClient();
    const query = queries.expenses.list({ month: "2026-05" });
    queryClient.setQueryData(
      query.queryKey,
      buildExpenseList([
        {
          id: 10,
          date: "2026-05-23",
          amount: 10000,
          note: "Coffee",
          category: "Food",
          paidBy: PaidBy.CUBI,
          budgetId: null,
          budgetName: null,
        },
      ])
    );

    applyOptimisticExpenseUpdate(queryClient, {
      id: 10,
      input: {
        date: "23/05/2026",
        amount: 40000,
        note: "Dinner",
        category: "Food",
        paidBy: PaidBy.EMBE,
        budgetId: null,
      },
    });

    const next = queryClient.getQueryData<ExpenseListResult>(query.queryKey);
    expect(next?.rows[0]).toMatchObject({
      id: 10,
      amount: 40000,
      note: "Dinner",
      paidBy: PaidBy.EMBE,
    });
    expect(next?.groupedRows[0]?.totalAmount).toBe(40000);
  });

  it("preserves an existing budget assignment when update input omits budgetId", () => {
    const queryClient = new QueryClient();
    const query = queries.expenses.list({ month: "2026-05" });
    queryClient.setQueryData(
      query.queryKey,
      buildExpenseList([
        {
          id: 10,
          date: "2026-05-23",
          amount: 10000,
          note: "Coffee",
          category: "Food",
          paidBy: PaidBy.CUBI,
          budgetId: 7,
          budgetName: "Groceries",
        },
      ])
    );

    applyOptimisticExpenseUpdate(queryClient, {
      id: 10,
      input: {
        date: "23/05/2026",
        amount: 40000,
        note: "Dinner",
        category: "Food",
        paidBy: PaidBy.EMBE,
      },
    });

    const next = queryClient.getQueryData<ExpenseListResult>(query.queryKey);
    expect(next?.rows[0]).toMatchObject({
      id: 10,
      budgetId: 7,
      budgetName: "Groceries",
    });
  });

  it("clears an existing budget assignment when update input has null budgetId", () => {
    const queryClient = new QueryClient();
    const query = queries.expenses.list({ month: "2026-05" });
    queryClient.setQueryData(
      query.queryKey,
      buildExpenseList([
        {
          id: 10,
          date: "2026-05-23",
          amount: 10000,
          note: "Coffee",
          category: "Food",
          paidBy: PaidBy.CUBI,
          budgetId: 7,
          budgetName: "Groceries",
        },
      ])
    );

    applyOptimisticExpenseUpdate(queryClient, {
      id: 10,
      input: {
        date: "23/05/2026",
        amount: 40000,
        note: "Dinner",
        category: "Food",
        paidBy: PaidBy.EMBE,
        budgetId: null,
      },
    });

    const next = queryClient.getQueryData<ExpenseListResult>(query.queryKey);
    expect(next?.rows[0]).toMatchObject({
      id: 10,
      budgetId: null,
      budgetName: null,
    });
  });

  it("preserves the previous date when updating an existing row with an invalid date", () => {
    const queryClient = new QueryClient();
    const query = queries.expenses.list({ month: "2026-05" });
    queryClient.setQueryData(
      query.queryKey,
      buildExpenseList([
        {
          id: 10,
          date: "2026-05-24",
          amount: 10000,
          note: "Coffee",
          category: "Food",
          paidBy: PaidBy.CUBI,
          budgetId: null,
          budgetName: null,
        },
      ])
    );

    applyOptimisticExpenseUpdate(queryClient, {
      id: 10,
      input: {
        date: "not-a-date",
        amount: 40000,
        note: "Dinner",
        category: "Food",
        paidBy: PaidBy.EMBE,
        budgetId: null,
      },
    });

    const next = queryClient.getQueryData<ExpenseListResult>(query.queryKey);
    expect(next?.rows[0]).toMatchObject({
      id: 10,
      date: "2026-05-24",
      amount: 40000,
      note: "Dinner",
    });
  });

  it("keeps an updated visible row in a multi-term search cache when it still matches", () => {
    const queryClient = new QueryClient();
    const query = queries.expenses.list({ month: "2026-05", q: "coffee food" });
    queryClient.setQueryData(
      query.queryKey,
      buildExpenseList([
        {
          id: 10,
          date: "2026-05-23",
          amount: 10000,
          note: "Coffee",
          category: "Food",
          paidBy: PaidBy.CUBI,
          budgetId: null,
          budgetName: null,
        },
      ])
    );

    applyOptimisticExpenseUpdate(queryClient, {
      id: 10,
      input: {
        date: "23/05/2026",
        amount: 40000,
        note: "Coffee beans",
        category: "Food",
        paidBy: PaidBy.EMBE,
        budgetId: null,
      },
    });

    const next = queryClient.getQueryData<ExpenseListResult>(query.queryKey);
    expect(next?.rows).toHaveLength(1);
    expect(next?.rows[0]).toMatchObject({
      id: 10,
      amount: 40000,
      note: "Coffee beans",
      category: "Food",
    });
  });

  it("removes an updated row when the edited date no longer matches the cached month", () => {
    const queryClient = new QueryClient();
    const query = queries.expenses.list({ month: "2026-05" });
    queryClient.setQueryData(
      query.queryKey,
      buildExpenseList([
        {
          id: 10,
          date: "2026-05-23",
          amount: 10000,
          note: "Coffee",
          category: "Food",
          paidBy: PaidBy.CUBI,
          budgetId: null,
          budgetName: null,
        },
      ])
    );

    applyOptimisticExpenseUpdate(queryClient, {
      id: 10,
      input: {
        date: "01/06/2026",
        amount: 10000,
        note: "Coffee",
        category: "Food",
        paidBy: PaidBy.CUBI,
        budgetId: null,
      },
    });

    const next = queryClient.getQueryData<ExpenseListResult>(query.queryKey);
    expect(next?.rows).toEqual([]);
    expect(next?.groupedRows).toEqual([]);
  });

  it("deletes a row from all cached expense lists and regroups totals", () => {
    const queryClient = new QueryClient();
    const monthQuery = queries.expenses.list({ month: "2026-05" });
    const searchQuery = queries.expenses.list({ month: "2026-05", q: "coffee" });
    queryClient.setQueryData(
      monthQuery.queryKey,
      buildExpenseList(buildRows())
    );
    queryClient.setQueryData(
      searchQuery.queryKey,
      buildExpenseList([
        {
          id: 10,
          date: "2026-05-23",
          amount: 10000,
          note: "Coffee",
          category: "Food",
          paidBy: PaidBy.CUBI,
          budgetId: null,
          budgetName: null,
        },
      ])
    );

    applyOptimisticExpenseDelete(queryClient, 10);

    const monthNext = queryClient.getQueryData<ExpenseListResult>(
      monthQuery.queryKey
    );
    const searchNext = queryClient.getQueryData<ExpenseListResult>(
      searchQuery.queryKey
    );
    expect(monthNext?.rows.map((row) => row.id)).toEqual([12, 11]);
    expect(searchNext?.rows).toEqual([]);
    expect(searchNext?.groupedRows).toEqual([]);
    expect(monthNext?.groupedRows.map((group) => group.key)).toEqual([
      "2026-05-24",
      "2026-05-23",
    ]);
    expect(
      monthNext?.groupedRows.map((group) => group.items.map((row) => row.id))
    ).toEqual([[12], [11]]);
    expect(monthNext?.groupedRows[0]?.totalAmount).toBe(5000);
    expect(monthNext?.groupedRows[1]?.totalAmount).toBe(25000);
  });

  it("patches infinite expense list pages and restores them on rollback", () => {
    const queryClient = new QueryClient();
    const query = queries.expenses.list({ month: "2026-05", limit: 30 });
    const previous = buildInfiniteExpenseList([
      buildExpenseList([buildRows()[0]], {
        pagination: { limit: 30, offset: 0, hasMore: true },
      }),
      buildExpenseList(buildRows().slice(1), {
        pagination: { limit: 30, offset: 30, hasMore: false },
      }),
    ]);
    queryClient.setQueryData(query.queryKey, previous);

    const context = applyOptimisticExpenseDelete(queryClient, 10);
    const next = queryClient.getQueryData<InfiniteData<ExpenseListResult, number>>(
      query.queryKey
    );

    expect(next?.pages.flatMap((page) => page.rows.map((row) => row.id))).toEqual(
      [12, 11]
    );

    restoreExpenseListSnapshots(queryClient, context);
    expect(queryClient.getQueryData(query.queryKey)).toEqual(previous);
  });

  it("adds rows from any month to an all-time infinite expense list cache", () => {
    const queryClient = new QueryClient();
    const allTimeQuery = queries.expenses.list({ limit: 30 });
    const mayQuery = queries.expenses.list({ month: "2026-05", limit: 30 });
    queryClient.setQueryData(
      allTimeQuery.queryKey,
      buildInfiniteExpenseList([
        buildExpenseList([], {
          pagination: { limit: 30, offset: 0, hasMore: false },
        }),
      ])
    );
    queryClient.setQueryData(
      mayQuery.queryKey,
      buildInfiniteExpenseList([
        buildExpenseList([], {
          pagination: { limit: 30, offset: 0, hasMore: false },
        }),
      ])
    );

    applyOptimisticExpenseCreate(queryClient, {
      date: "01/06/2026",
      amount: 25000,
      note: "June lunch",
      category: "Food",
      paidBy: PaidBy.EMBE,
      budgetId: null,
    });

    const allTimeNext = queryClient.getQueryData<
      InfiniteData<ExpenseListResult, number>
    >(allTimeQuery.queryKey);
    const mayNext = queryClient.getQueryData<
      InfiniteData<ExpenseListResult, number>
    >(mayQuery.queryKey);

    expect(allTimeNext?.pages[0]?.rows[0]).toMatchObject({
      date: "2026-06-01",
      note: "June lunch",
    });
    expect(mayNext?.pages[0]?.rows).toEqual([]);
  });

  it("restores exact snapshots for all cached lists after a failed optimistic change", () => {
    const queryClient = new QueryClient();
    const monthQuery = queries.expenses.list({ month: "2026-05" });
    const searchQuery = queries.expenses.list({ month: "2026-05", q: "coffee" });
    const previousMonth = buildExpenseList(buildRows());
    const previousSearch = buildExpenseList([
      {
        id: 10,
        date: "2026-05-23",
        amount: 10000,
        note: "Coffee",
        category: "Food",
        paidBy: PaidBy.CUBI,
        budgetId: null,
        budgetName: null,
      },
    ]);
    queryClient.setQueryData(monthQuery.queryKey, previousMonth);
    queryClient.setQueryData(searchQuery.queryKey, previousSearch);

    const context = applyOptimisticExpenseDelete(queryClient, 10);
    restoreExpenseListSnapshots(queryClient, context);

    expect(queryClient.getQueryData(monthQuery.queryKey)).toEqual(previousMonth);
    expect(queryClient.getQueryData(searchQuery.queryKey)).toEqual(
      previousSearch
    );
  });

  it("skips malformed expense list cache data without throwing or patching it", () => {
    const queryClient = new QueryClient();
    const query = queries.expenses.list({ month: "2026-05" });
    const malformedData = { rows: [] };
    queryClient.setQueryData(query.queryKey, malformedData);

    expect(() =>
      applyOptimisticExpenseCreate(queryClient, {
        date: "23/05/2026",
        amount: 25000,
        note: "Lunch",
        category: "Food",
        paidBy: PaidBy.EMBE,
        budgetId: null,
      })
    ).not.toThrow();
    expect(queryClient.getQueryData(query.queryKey)).toBe(malformedData);
  });

  it("ignores malformed budget option cache data when building a temporary row", () => {
    const queryClient = new QueryClient();
    const expenseQuery = queries.expenses.list({ month: "2026-05" });
    const budgetQuery = queries.budgetWeekly.options("2026-05-18");
    queryClient.setQueryData(expenseQuery.queryKey, buildExpenseList([]));
    queryClient.setQueryData(budgetQuery.queryKey, { budgets: [] });

    expect(() =>
      applyOptimisticExpenseCreate(queryClient, {
        date: "23/05/2026",
        amount: 25000,
        note: "Lunch",
        category: "Food",
        paidBy: PaidBy.EMBE,
        budgetId: 7,
      })
    ).not.toThrow();

    const next = queryClient.getQueryData<ExpenseListResult>(
      expenseQuery.queryKey
    );
    expect(next?.rows[0]?.budgetName).toBeNull();
  });

  it("ignores malformed budget option items when building a temporary row", () => {
    const queryClient = new QueryClient();
    const expenseQuery = queries.expenses.list({ month: "2026-05" });
    const budgetQuery = queries.budgetWeekly.options("2026-05-18");
    queryClient.setQueryData(expenseQuery.queryKey, buildExpenseList([]));
    queryClient.setQueryData(budgetQuery.queryKey, [null]);

    expect(() =>
      applyOptimisticExpenseCreate(queryClient, {
        date: "23/05/2026",
        amount: 25000,
        note: "Lunch",
        category: "Food",
        paidBy: PaidBy.EMBE,
        budgetId: 7,
      })
    ).not.toThrow();

    const next = queryClient.getQueryData<ExpenseListResult>(
      expenseQuery.queryKey
    );
    expect(next?.rows[0]?.budgetName).toBeNull();
  });
});
