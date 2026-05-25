import React, { type PropsWithChildren } from "react";

import { PaidBy } from "@/enums";
import {
  useAssignTransactionBudgetMutation,
  useCreateBudgetMutation,
  useCreateExpenseMutation,
  useDeleteBudgetMutation,
  useDeleteExpenseMutation,
  useTransferBudgetMutation,
  useUpdateBudgetMutation,
  useUpdateExpenseMutation,
} from "@/lib/mutations";
import { queries } from "@/lib/queries";
import { syncRepository } from "@/lib/sync/core/repository";
import { expenseSyncStore } from "@/lib/sync/expenses/store";
import type { LocalExpense } from "@/lib/sync/expenses/types";
import type { BudgetTransactionsResponse } from "@/types/budget-weekly";
import {
  type InfiniteData,
  QueryClient,
  QueryClientProvider,
  type QueryFunction,
  useInfiniteQuery,
} from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requestExpenseSyncMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/sync/expenses/scheduler", () => ({
  requestExpenseSync: requestExpenseSyncMock,
}));

const jsonResponse = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

const successEnvelope = <T,>(data: T) => ({ success: true, data });

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

const syncedLocalExpense = (
  overrides: Partial<LocalExpense> = {}
): Omit<LocalExpense, "entity"> => ({
  clientId: "client-1",
  serverId: 10,
  date: "2026-05-23",
  amount: 10000,
  note: "Coffee",
  category: "Food",
  paidBy: PaidBy.CUBI,
  budgetId: null,
  budgetName: null,
  syncStatus: "synced",
  lastError: null,
  updatedAt: "2026-05-24T09:00:00.000Z",
  serverUpdatedAt: "2026-05-24T09:00:00.000Z",
  ...overrides,
});

describe("mutation hooks", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    requestExpenseSyncMock.mockResolvedValue(undefined);
    await syncRepository.testing.clearSyncDb();
    expenseSyncStore.getState().hydrate([]);
  });

  it("creates an expense locally and invalidates affected query families", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const { result, queryClient } = renderMutationHook(() =>
      useCreateExpenseMutation()
    );
    const invalidateSpy = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();

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
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetchMock).not.toHaveBeenCalled();
    const records = await syncRepository.records.list("expenses");
    expect(records).toMatchObject([
      {
        entity: "expenses",
        serverId: null,
        syncStatus: "pending",
        payload: expect.objectContaining({ note: "Lunch" }),
      },
    ]);
    await expect(syncRepository.outbox.list("expenses")).resolves.toMatchObject(
      [
        {
          entity: "expenses",
          type: "create",
          clientId: records[0]?.clientId,
        },
      ]
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
    expect(requestExpenseSyncMock).toHaveBeenCalledTimes(1);
    expect(requestExpenseSyncMock).toHaveBeenCalledWith(queryClient);
  });

  it("updates and deletes expenses locally through the existing id-based API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    expenseSyncStore.getState().hydrate([syncedLocalExpense()]);
    const { result, queryClient } = renderMutationHook(() => ({
      update: useUpdateExpenseMutation(),
      remove: useDeleteExpenseMutation(),
    }));
    const invalidateSpy = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();

    await act(async () => {
      await result.current.update.mutateAsync({
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
    });
    await waitFor(() => expect(result.current.update.isSuccess).toBe(true));

    await act(async () => {
      await result.current.remove.mutateAsync(10);
    });
    await waitFor(() => expect(result.current.remove.isSuccess).toBe(true));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      expenseSyncStore.getState().expensesByClientId["client-1"]
    ).toMatchObject({
      note: "Dinner",
      syncStatus: "deleted",
    });
    await expect(syncRepository.outbox.list("expenses")).resolves.toMatchObject(
      [
        { entity: "expenses", type: "update", clientId: "client-1" },
        { entity: "expenses", type: "delete", clientId: "client-1" },
      ]
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queries.expenses._def,
    });
    expect(requestExpenseSyncMock).toHaveBeenCalledTimes(2);
    expect(requestExpenseSyncMock).toHaveBeenNthCalledWith(1, queryClient);
    expect(requestExpenseSyncMock).toHaveBeenNthCalledWith(2, queryClient);
  });

  it("updates budgets with the id route and invalidates budget query roots", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse(successEnvelope({ id: 7 })));
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
      .mockResolvedValue(
        jsonResponse(successEnvelope({ id: 8 }), { status: 201 })
      );
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

  it("does not request expense sync for budget mutations", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);

      if (url === "/api/weekly-budgets" && init?.method === "POST") {
        return jsonResponse(successEnvelope({ id: 8 }), { status: 201 });
      }

      if (url === "/api/weekly-budgets/7" && init?.method === "PATCH") {
        return jsonResponse(successEnvelope({ id: 7 }));
      }

      if (url === "/api/weekly-budgets/9" && init?.method === "DELETE") {
        return jsonResponse(successEnvelope({ id: 9 }));
      }

      if (url === "/api/transaction-budget" && init?.method === "POST") {
        return jsonResponse(successEnvelope({ expenseId: 10, budgetId: 7 }));
      }

      if (url === "/api/budgets/transfer" && init?.method === "POST") {
        return jsonResponse(successEnvelope({ ok: true }));
      }

      return jsonResponse(
        {
          success: false,
          error: {
            code: "UNEXPECTED_REQUEST",
            message: "Unexpected request",
          },
        },
        { status: 500 }
      );
    });
    const { result } = renderMutationHook(() => ({
      assignTransaction: useAssignTransactionBudgetMutation(),
      create: useCreateBudgetMutation(),
      remove: useDeleteBudgetMutation(),
      transfer: useTransferBudgetMutation(),
      update: useUpdateBudgetMutation(),
    }));

    await act(async () => {
      await result.current.create.mutateAsync({
        name: "Dining",
        amount: 200000,
        period: "month",
        periodStartDate: "2026-05-01",
        periodEndDate: "2026-05-31",
      });
      await result.current.update.mutateAsync({
        id: 7,
        input: {
          name: "Groceries",
          amount: 750000,
          period: "week",
          periodStartDate: "2026-05-17",
          periodEndDate: "2026-05-23",
        },
      });
      await result.current.remove.mutateAsync(9);
      await result.current.assignTransaction.mutateAsync({
        expenseId: 10,
        budgetId: 7,
      });
      await result.current.transfer.mutateAsync({
        fromBudgetId: 2,
        toBudgetId: 1,
        amount: 100000,
      });
    });

    expect(requestExpenseSyncMock).not.toHaveBeenCalled();
  });

  it("does not refetch deleted budget transactions after successful delete", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input, init) => {
        const url = String(input);

        if (url.startsWith("/api/budgets/9/transactions")) {
          return jsonResponse(
            successEnvelope({
              budgetId: 9,
              summary: { count: 0, totalSpent: 0 },
              items: [],
              pagination: { limit: 20, offset: 0, hasMore: false },
            })
          );
        }

        if (url === "/api/weekly-budgets/9" && init?.method === "DELETE") {
          return jsonResponse(successEnvelope({ id: 9 }));
        }

        return jsonResponse(
          {
            success: false,
            error: {
              code: "UNEXPECTED_REQUEST",
              message: "Unexpected request",
            },
          },
          { status: 500 }
        );
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
        {
          success: false,
          error: {
            code: "BUDGET_TRANSFER_FAILED",
            message: "Insufficient source budget amount",
          },
        },
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
