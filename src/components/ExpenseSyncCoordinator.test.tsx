import React, { type PropsWithChildren } from "react";

import type { ExpenseListResult } from "@/lib/expenses/list-model";
import { queries } from "@/lib/queries";
import { syncRepository } from "@/lib/sync/core/repository";
import {
  type InfiniteData,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ExpenseSyncCoordinator from "./ExpenseSyncCoordinator";

const requestExpenseSyncMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/sync/expenses/scheduler", () => ({
  requestExpenseSync: requestExpenseSyncMock,
}));

const renderCoordinator = (
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
) => {
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return render(<ExpenseSyncCoordinator />, { wrapper });
};

describe("ExpenseSyncCoordinator", () => {
  const buildExpensePage = (): ExpenseListResult => ({
    activeMonth: "2026-05",
    effectiveRecentDays: 7,
    groupedRows: [
      {
        key: "2026-05-24",
        label: "Sunday, 24/05/2026",
        totalAmount: 50000,
        items: [
          {
            id: 30,
            clientId: "server-client-30",
            date: "2026-05-24",
            amount: 50000,
            note: "Hydrated lunch",
            category: "Food",
            paidBy: "Cubi",
            budgetId: 7,
            budgetName: "Meals",
            budgetIcon: "🍜",
            budgetColor: "rose",
          },
        ],
      },
    ],
    isRecent: false,
    pagination: {
      limit: 30,
      offset: 0,
      hasMore: true,
    },
    rows: [
      {
        id: 30,
        clientId: "server-client-30",
        date: "2026-05-24",
        amount: 50000,
        note: "Hydrated lunch",
        category: "Food",
        paidBy: "Cubi",
        budgetId: 7,
        budgetName: "Meals",
        budgetIcon: "🍜",
        budgetColor: "rose",
      },
    ],
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not emit console errors for background sync failures", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    requestExpenseSyncMock.mockRejectedValue(
      new Error("Failed to sync expenses")
    );

    renderCoordinator();

    await waitFor(() =>
      expect(requestExpenseSyncMock).toHaveBeenCalledTimes(1)
    );
    await waitFor(() => expect(consoleError).not.toHaveBeenCalled());
  });

  it("requests queued sync on mount, online, and focus", async () => {
    requestExpenseSyncMock.mockResolvedValue(undefined);

    renderCoordinator();
    await waitFor(() =>
      expect(requestExpenseSyncMock).toHaveBeenCalledTimes(1)
    );

    window.dispatchEvent(new Event("online"));
    window.dispatchEvent(new Event("focus"));

    await waitFor(() =>
      expect(requestExpenseSyncMock).toHaveBeenCalledTimes(3)
    );
  });

  it("seeds hydrated first expense page into IndexedDB without creating outbox operations", async () => {
    await syncRepository.testing.clearSyncDb();
    requestExpenseSyncMock.mockResolvedValue(undefined);
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const params = { limit: 30 };
    queryClient.setQueryData<InfiniteData<ExpenseListResult, number>>(
      queries.expenses.list(params).queryKey,
      {
        pageParams: [0],
        pages: [buildExpensePage()],
      }
    );

    renderCoordinator(queryClient);

    await waitFor(async () => {
      const records = await syncRepository.records.list("expenses");
      expect(records).toEqual([
        expect.objectContaining({
          entity: "expenses",
          clientId: "server-client-30",
          serverId: 30,
          syncStatus: "synced",
          lastError: null,
          payload: expect.objectContaining({
            date: "2026-05-24",
            amount: 50000,
            note: "Hydrated lunch",
            category: "Food",
            paidBy: "Cubi",
            budgetId: 7,
            budgetName: "Meals",
          }),
        }),
      ]);
    });
    await expect(syncRepository.outbox.list("expenses")).resolves.toEqual([]);
    expect(requestExpenseSyncMock).toHaveBeenCalledWith(queryClient);

    await syncRepository.testing.clearSyncDb();
  });

  it("requests sync when hydrated page seeding fails", async () => {
    await syncRepository.testing.clearSyncDb();
    requestExpenseSyncMock.mockResolvedValue(undefined);
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    queryClient.setQueryData<InfiniteData<ExpenseListResult, number>>(
      queries.expenses.list({ limit: 30 }).queryKey,
      {
        pageParams: [0],
        pages: [buildExpensePage()],
      }
    );
    vi.spyOn(syncRepository.records, "list").mockRejectedValueOnce(
      new Error("IndexedDB unavailable")
    );

    renderCoordinator(queryClient);

    await waitFor(() =>
      expect(requestExpenseSyncMock).toHaveBeenCalledWith(queryClient)
    );

    await syncRepository.testing.clearSyncDb();
  });

  it("seeds hydrated first expense page only during initial bootstrap", async () => {
    await syncRepository.testing.clearSyncDb();
    requestExpenseSyncMock.mockResolvedValue(undefined);
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    queryClient.setQueryData<InfiniteData<ExpenseListResult, number>>(
      queries.expenses.list({ limit: 30 }).queryKey,
      {
        pageParams: [0],
        pages: [buildExpensePage()],
      }
    );
    const putMany = vi.spyOn(syncRepository.records, "putMany");

    renderCoordinator(queryClient);
    await waitFor(() =>
      expect(requestExpenseSyncMock).toHaveBeenCalledTimes(1)
    );

    window.dispatchEvent(new Event("online"));
    window.dispatchEvent(new Event("focus"));

    await waitFor(() =>
      expect(requestExpenseSyncMock).toHaveBeenCalledTimes(3)
    );
    expect(putMany).toHaveBeenCalledTimes(1);

    await syncRepository.testing.clearSyncDb();
  });
});
