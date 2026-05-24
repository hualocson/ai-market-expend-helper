import React, { type PropsWithChildren } from "react";

import { PaidBy } from "@/enums";
import {
  useCreateBudgetMutation,
  useCreateExpenseMutation,
  useDeleteBudgetMutation,
  useDeleteExpenseMutation,
  useTransferBudgetMutation,
  useUpdateBudgetMutation,
  useUpdateExpenseMutation,
} from "@/lib/mutations";
import { queries } from "@/lib/queries";
import type { ExpenseListResult } from "@/lib/services/expenses";
import type { BudgetTransactionsResponse } from "@/types/budget-weekly";
import {
  type InfiniteData,
  QueryClient,
  QueryClientProvider,
  type QueryFunction,
  useInfiniteQuery,
} from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const jsonResponse = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

const renderMutationHook = <TResult,>(
  hook: () => TResult
): { result: { current: TResult }; queryClient: QueryClient } => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const rendered = renderHook(hook, { wrapper });

  return { result: rendered.result, queryClient };
};

const expenseListResult = (
  rows: ExpenseListResult["rows"]
): ExpenseListResult => ({
  activeMonth: "2026-05",
  effectiveRecentDays: 7,
  groupedRows: rows.length
    ? [
        {
          key: "2026-05-23",
          label: "Saturday, 23/05/2026",
          items: rows,
          totalAmount: rows.reduce((sum, row) => sum + row.amount, 0),
        },
      ]
    : [],
  isRecent: false,
  pagination: {
    limit: 30,
    offset: 0,
    hasMore: false,
  },
  rows,
});

const deferredResponse = () => {
  let resolve: (response: Response) => void = () => {};
  const promise = new Promise<Response>((resolver) => {
    resolve = resolver;
  });

  return { promise, resolve };
};

const coffeeExpense = (): ExpenseListResult["rows"][number] => ({
  id: 10,
  date: "2026-05-23",
  amount: 10000,
  note: "Coffee",
  category: "Food",
  paidBy: PaidBy.CUBI,
  budgetId: null,
  budgetName: null,
});

describe("mutation hooks", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("creates an expense through the REST route and invalidates affected query families", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ id: 123 }, { status: 201 }));
    const { result, queryClient } = renderMutationHook(() =>
      useCreateExpenseMutation()
    );
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    await act(async () => {
      await result.current.mutateAsync({
        date: "20/05/2026",
        amount: 50000,
        note: "Lunch",
        category: "Food",
        paidBy: PaidBy.OTHER,
        budgetId: null,
      });
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/expenses",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          date: "20/05/2026",
          amount: 50000,
          note: "Lunch",
          category: "Food",
          paidBy: PaidBy.OTHER,
          budgetId: null,
        }),
      })
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queries.expenses._def,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queries.dashboard._def,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queries.reports._def,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queries.budgets.overview.queryKey,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queries.budgetWeekly.options._def,
    });
  });

  it("optimistically adds an expense to matching cached expense lists", async () => {
    const response = deferredResponse();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockReturnValue(response.promise);
    const { result, queryClient } = renderMutationHook(() =>
      useCreateExpenseMutation()
    );
    const query = queries.expenses.list({ month: "2026-05" });
    queryClient.setQueryData(query.queryKey, expenseListResult([]));

    let mutation!: Promise<unknown>;
    await act(async () => {
      mutation = result.current.mutateAsync({
        date: "23/05/2026",
        amount: 50000,
        note: "Lunch",
        category: "Food",
        paidBy: PaidBy.OTHER,
        budgetId: null,
      });

      await vi.waitFor(() => {
        const cached =
          queryClient.getQueryData<ExpenseListResult>(query.queryKey);
        expect(cached?.rows[0]).toMatchObject({
          amount: 50000,
          note: "Lunch",
          category: "Food",
        });
        expect(cached?.rows[0]?.id).toBeLessThan(0);
      });
    });

    response.resolve(jsonResponse({ id: 123 }, { status: 201 }));
    await act(async () => {
      await mutation;
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/expenses",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("rolls back an optimistic create when the REST route fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ error: "Failed to create expense" }, { status: 400 })
    );
    const { result, queryClient } = renderMutationHook(() =>
      useCreateExpenseMutation()
    );
    const query = queries.expenses.list({ month: "2026-05" });
    const previous = expenseListResult([]);
    queryClient.setQueryData(query.queryKey, previous);

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          date: "23/05/2026",
          amount: 50000,
          note: "Lunch",
          category: "Food",
          paidBy: PaidBy.OTHER,
          budgetId: null,
        })
      ).rejects.toThrow("Failed to create expense");
    });

    expect(queryClient.getQueryData(query.queryKey)).toEqual(previous);
  });

  it("optimistically updates and deletes cached expense rows", async () => {
    const updateResponse = deferredResponse();
    const deleteResponse = deferredResponse();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockReturnValueOnce(updateResponse.promise)
      .mockReturnValueOnce(deleteResponse.promise);
    const { result, queryClient } = renderMutationHook(() => ({
      update: useUpdateExpenseMutation(),
      remove: useDeleteExpenseMutation(),
    }));
    const query = queries.expenses.list({ month: "2026-05" });
    queryClient.setQueryData(
      query.queryKey,
      expenseListResult([coffeeExpense()])
    );

    let updateMutation!: Promise<unknown>;
    await act(async () => {
      updateMutation = result.current.update.mutateAsync({
        id: 10,
        input: {
          date: "23/05/2026",
          amount: 30000,
          note: "Dinner",
          category: "Food",
          paidBy: PaidBy.EMBE,
          budgetId: null,
        },
      });

      await vi.waitFor(() => {
        const cached =
          queryClient.getQueryData<ExpenseListResult>(query.queryKey);
        expect(cached?.rows[0]).toMatchObject({
          id: 10,
          amount: 30000,
          note: "Dinner",
        });
      });
    });

    updateResponse.resolve(jsonResponse({ id: 10 }));
    await act(async () => {
      await updateMutation;
    });

    let deleteMutation!: Promise<unknown>;
    await act(async () => {
      deleteMutation = result.current.remove.mutateAsync(10);

      await vi.waitFor(() => {
        const cached =
          queryClient.getQueryData<ExpenseListResult>(query.queryKey);
        expect(cached?.rows).toEqual([]);
      });
    });

    deleteResponse.resolve(jsonResponse({ id: 10 }));
    await act(async () => {
      await deleteMutation;
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/expenses/10",
      expect.objectContaining({ method: "PATCH" })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/expenses/10",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("rolls back an optimistic update when the REST route fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ error: "Failed to update expense" }, { status: 400 })
    );
    const { result, queryClient } = renderMutationHook(() =>
      useUpdateExpenseMutation()
    );
    const query = queries.expenses.list({ month: "2026-05" });
    const previous = expenseListResult([coffeeExpense()]);
    queryClient.setQueryData(query.queryKey, previous);

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          id: 10,
          input: {
            date: "23/05/2026",
            amount: 30000,
            note: "Dinner",
            category: "Food",
            paidBy: PaidBy.EMBE,
            budgetId: null,
          },
        })
      ).rejects.toThrow("Failed to update expense");
    });

    expect(queryClient.getQueryData(query.queryKey)).toEqual(previous);
  });

  it("rolls back an optimistic delete when the REST route fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ error: "Failed to delete expense" }, { status: 400 })
    );
    const { result, queryClient } = renderMutationHook(() =>
      useDeleteExpenseMutation()
    );
    const query = queries.expenses.list({ month: "2026-05" });
    const previous = expenseListResult([coffeeExpense()]);
    queryClient.setQueryData(query.queryKey, previous);

    await act(async () => {
      await expect(result.current.mutateAsync(10)).rejects.toThrow(
        "Failed to delete expense"
      );
    });

    expect(queryClient.getQueryData(query.queryKey)).toEqual(previous);
  });

  it("updates budgets with the id route and invalidates budget query roots", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ id: 7 }));
    const { result, queryClient } = renderMutationHook(() =>
      useUpdateBudgetMutation()
    );
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    await act(async () => {
      await result.current.mutateAsync({
        id: 7,
        input: {
          name: "Groceries",
          amount: 750000,
          period: "week",
          periodStartDate: "2026-05-17",
          periodEndDate: "2026-05-23",
        },
      });
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/weekly-budgets/7",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          name: "Groceries",
          amount: 750000,
          period: "week",
          periodStartDate: "2026-05-17",
          periodEndDate: "2026-05-23",
        }),
      })
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queries.budgets._def,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queries.budgetWeekly._def,
    });
  });

  it("creates budgets through the weekly budgets route and invalidates budget query roots", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ id: 8 }, { status: 201 }));
    const { result, queryClient } = renderMutationHook(() =>
      useCreateBudgetMutation()
    );
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    await act(async () => {
      await result.current.mutateAsync({
        name: "Dining",
        amount: 200000,
        period: "month",
        periodStartDate: "2026-05-01",
        periodEndDate: "2026-05-31",
      });
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/weekly-budgets",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          name: "Dining",
          amount: 200000,
          period: "month",
          periodStartDate: "2026-05-01",
          periodEndDate: "2026-05-31",
        }),
      })
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queries.budgets._def,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queries.budgetWeekly._def,
    });
  });

  it("does not refetch deleted budget transactions after successful delete", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input, init) => {
        const url = String(input);

        if (url.startsWith("/api/budgets/9/transactions")) {
          return jsonResponse({
            budgetId: 9,
            summary: { count: 0, totalSpent: 0 },
            items: [],
            pagination: { limit: 20, offset: 0, hasMore: false },
          });
        }

        if (url === "/api/weekly-budgets/9" && init?.method === "DELETE") {
          return jsonResponse({ id: 9 });
        }

        return jsonResponse({ error: "Unexpected request" }, { status: 500 });
      });
    const { result, queryClient } = renderMutationHook(() => {
      const detailQuery = queries.budgets.transactions(9);
      useInfiniteQuery<
        BudgetTransactionsResponse,
        Error,
        InfiniteData<BudgetTransactionsResponse>,
        ReturnType<typeof queries.budgets.transactions>["queryKey"],
        number
      >({
        queryKey: detailQuery.queryKey,
        queryFn: detailQuery.queryFn as QueryFunction<
          BudgetTransactionsResponse,
          typeof detailQuery.queryKey,
          number
        >,
        initialPageParam: 0,
        getNextPageParam: () => undefined,
      });

      return useDeleteBudgetMutation();
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const cancelSpy = vi.spyOn(queryClient, "cancelQueries");

    await vi.waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/budgets/9/transactions?limit=20&offset=0",
        expect.anything()
      )
    );
    fetchMock.mockClear();

    await act(async () => {
      await result.current.mutateAsync(9);
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/weekly-budgets/9",
      expect.objectContaining({ method: "DELETE" })
    );
    expect(invalidateSpy).not.toHaveBeenCalledWith({
      queryKey: queries.budgets._def,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queries.budgetWeekly._def,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queries.budgets.overview.queryKey,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queries.budgets.transferCandidates._def,
    });
    expect(cancelSpy).toHaveBeenCalledWith({
      queryKey: queries.budgets.transactions(9).queryKey,
    });
  });

  it("maps known transfer HTTP errors back to the existing transfer result shape", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(
        { error: "Insufficient source budget amount" },
        { status: 400 }
      )
    );
    const { result } = renderMutationHook(() => useTransferBudgetMutation());

    await expect(
      result.current.mutateAsync({
        fromBudgetId: 2,
        toBudgetId: 1,
        amount: 100000,
      })
    ).resolves.toEqual({ ok: false, code: "INSUFFICIENT_CAP" });
  });
});
