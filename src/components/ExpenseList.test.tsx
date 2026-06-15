import React from "react";

import { queries } from "@/lib/queries";
import type { ExpenseListResult } from "@/lib/services/expenses";
import { syncRepository } from "@/lib/sync/core/repository";
import type { InfiniteData } from "@tanstack/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";

import ExpenseList from "./ExpenseList";

vi.mock("@/components/ExpenseListItem", () => ({
  default: ({
    expense,
    onEditExpense,
  }: {
    expense: { id: number; note: string };
    onEditExpense: (expense: { id: number; note: string }) => void;
  }) => (
    <div data-testid="expense-item">
      <button type="button" onClick={() => onEditExpense(expense)}>
        {expense.note}
      </button>
    </div>
  ),
}));

vi.mock("@/components/ExpenseEditSheetHost", () => ({
  default: ({
    expense,
    open,
  }: {
    expense: { note: string } | null;
    open: boolean;
  }) => (
    <div data-testid="expense-edit-sheet-host" data-open={String(open)}>
      {expense?.note ?? ""}
    </div>
  ),
}));

vi.mock("@/components/ExpenseMonthTabs", () => ({
  default: ({
    items,
  }: {
    items: Array<{ isActive: boolean; label: string }>;
  }) => (
    <div data-testid="month-tabs">
      {items.find((item) => item.isActive)?.label}
    </div>
  ),
}));

vi.mock("./JumpToTopButton", () => ({
  default: ({ targetId }: { targetId?: string }) => (
    <button type="button" data-target-id={targetId}>
      Jump to top
    </button>
  ),
}));

const originalGlobalReact = globalThis.React;

afterEach(() => {
  vi.restoreAllMocks();

  if (typeof originalGlobalReact === "undefined") {
    Reflect.deleteProperty(globalThis, "React");
    return;
  }

  globalThis.React = originalGlobalReact;
});

describe("ExpenseList", () => {
  const buildClient = () =>
    new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 60 * 1000,
        },
      },
    });

  const firstExpense = {
    id: 1,
    date: "2026-05-23",
    amount: 120000,
    note: "Coffee beans",
    category: "Groceries",
    paidBy: "Loc",
    budgetId: null,
    budgetName: null,
    budgetIcon: null,
    budgetColor: null,
  };

  const buildPage = (
    rows: ExpenseListResult["rows"] = [firstExpense]
  ): ExpenseListResult => ({
    activeMonth: "2026-05",
    effectiveRecentDays: 7,
    groupedRows: [
      {
        key: "2026-05-23",
        label: "Saturday, 23/05/2026",
        totalAmount: rows.reduce((sum, row) => sum + row.amount, 0),
        items: rows,
      },
    ],
    isRecent: false,
    pagination: {
      limit: 30,
      offset: 0,
      hasMore: false,
    },
    rows,
  });

  it("renders hydrated all-time infinite expense list data without month tabs", () => {
    globalThis.React = React;

    const queryClient = buildClient();
    const params = { limit: 30 };
    const payload: InfiniteData<ExpenseListResult, number> = {
      pageParams: [0],
      pages: [buildPage()],
    };
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    queryClient.setQueryData(queries.expenses.list(params).queryKey, payload);

    render(
      <QueryClientProvider client={queryClient}>
        <ExpenseList />
      </QueryClientProvider>
    );

    expect(
      screen.queryByRole("heading", { name: "All expenses" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Latest entries from your sheet.")
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("month-tabs")).not.toBeInTheDocument();
    expect(screen.queryByText("1 items")).not.toBeInTheDocument();
    expect(screen.getByTestId("expense-item")).toHaveTextContent(
      "Coffee beans"
    );
    expect(screen.getByText(/-120\.000/)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("opens one central edit sheet host when an expense item requests edit", async () => {
    globalThis.React = React;

    const user = userEvent.setup();
    const queryClient = buildClient();
    const params = { limit: 30 };
    const payload: InfiniteData<ExpenseListResult, number> = {
      pageParams: [0],
      pages: [buildPage()],
    };

    queryClient.setQueryData(queries.expenses.list(params).queryKey, payload);

    render(
      <QueryClientProvider client={queryClient}>
        <ExpenseList />
      </QueryClientProvider>
    );

    expect(screen.getAllByTestId("expense-edit-sheet-host")).toHaveLength(1);
    expect(screen.getByTestId("expense-edit-sheet-host")).toHaveAttribute(
      "data-open",
      "false"
    );

    await user.click(screen.getByRole("button", { name: "Coffee beans" }));

    expect(screen.getByTestId("expense-edit-sheet-host")).toHaveAttribute(
      "data-open",
      "true"
    );
    expect(screen.getByTestId("expense-edit-sheet-host")).toHaveTextContent(
      "Coffee beans"
    );
  });

  it("renders the day summary header without a navigation link", () => {
    globalThis.React = React;

    const queryClient = buildClient();
    const params = { limit: 30 };
    const payload: InfiniteData<ExpenseListResult, number> = {
      pageParams: [0],
      pages: [buildPage()],
    };

    queryClient.setQueryData(queries.expenses.list(params).queryKey, payload);

    render(
      <QueryClientProvider client={queryClient}>
        <ExpenseList />
      </QueryClientProvider>
    );

    expect(
      screen.queryByRole("link", { name: /Saturday, 23\/05\/2026/ })
    ).toBeNull();
    expect(screen.getByText(/Saturday, 23\/05\/2026/)).toBeInTheDocument();
  });

  it("uses drawer presentation spacing when requested", () => {
    globalThis.React = React;

    const queryClient = buildClient();
    const params = { limit: 30 };
    const payload: InfiniteData<ExpenseListResult, number> = {
      pageParams: [0],
      pages: [buildPage()],
    };

    queryClient.setQueryData(queries.expenses.list(params).queryKey, payload);

    render(
      <QueryClientProvider client={queryClient}>
        <ExpenseList presentation="search-drawer" />
      </QueryClientProvider>
    );

    expect(screen.getByTestId("expense-list-section")).toHaveAttribute(
      "data-presentation",
      "search-drawer"
    );
  });

  it("uses a unique scroll target for drawer presentation", () => {
    globalThis.React = React;

    const queryClient = buildClient();
    const params = { limit: 30 };
    const payload: InfiniteData<ExpenseListResult, number> = {
      pageParams: [0],
      pages: [buildPage()],
    };

    queryClient.setQueryData(queries.expenses.list(params).queryKey, payload);

    render(
      <QueryClientProvider client={queryClient}>
        <ExpenseList />
        <ExpenseList presentation="search-drawer" />
      </QueryClientProvider>
    );

    expect(document.querySelectorAll("#expense-list")).toHaveLength(1);
    expect(
      document.querySelectorAll("#expense-list-search-drawer")
    ).toHaveLength(1);
    expect(
      screen
        .getAllByRole("button", { name: "Jump to top" })
        .map((button) => button.getAttribute("data-target-id"))
    ).toEqual(["expense-list", "expense-list-search-drawer"]);
  });

  it("deduplicates expenses that appear in overlapping infinite pages", () => {
    globalThis.React = React;

    const queryClient = buildClient();
    const params = { limit: 30 };
    const duplicateExpense = {
      ...firstExpense,
      id: 30,
      note: "Overlapping lunch",
    };
    const payload: InfiniteData<ExpenseListResult, number> = {
      pageParams: [0, 30],
      pages: [buildPage([duplicateExpense]), buildPage([duplicateExpense])],
    };

    queryClient.setQueryData(queries.expenses.list(params).queryKey, payload);

    render(
      <QueryClientProvider client={queryClient}>
        <ExpenseList />
      </QueryClientProvider>
    );

    expect(screen.getAllByTestId("expense-item")).toHaveLength(1);
    expect(screen.getByTestId("expense-item")).toHaveTextContent(
      "Overlapping lunch"
    );
    expect(screen.getByText(/-120\.000/)).toBeInTheDocument();
    expect(screen.queryByText(/-240\.000/)).not.toBeInTheDocument();
  });

  it("gates manual load more while the initial expense sync cursor is missing", async () => {
    globalThis.React = React;
    await syncRepository.testing.clearSyncDb();

    const queryClient = buildClient();
    const params = { limit: 30 };
    const firstPage: ExpenseListResult = {
      ...buildPage(),
      pagination: {
        limit: 30,
        offset: 0,
        hasMore: true,
      },
    };
    queryClient.setQueryData<InfiniteData<ExpenseListResult, number>>(
      queries.expenses.list(params).queryKey,
      { pageParams: [0], pages: [firstPage] }
    );

    render(
      <QueryClientProvider client={queryClient}>
        <ExpenseList />
      </QueryClientProvider>
    );

    expect(
      await screen.findByText("Syncing all expenses before loading more.")
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Load more" })
    ).not.toBeInTheDocument();

    const cachedData = queryClient.getQueryData<
      InfiniteData<ExpenseListResult, number>
    >(queries.expenses.list(params).queryKey);
    expect(cachedData?.pages).toHaveLength(1);

    await syncRepository.testing.clearSyncDb();
  });

  it("fetches exactly one next page when Load more is clicked", async () => {
    globalThis.React = React;
    await syncRepository.testing.clearSyncDb();
    await syncRepository.metadata.setCursor(
      "expenses",
      "2026-05-24T10:00:00.000Z"
    );
    await syncRepository.records.putMany(
      Array.from({ length: 61 }, (_, index) => ({
        entity: "expenses",
        clientId: `client-${index}`,
        serverId: 100 + index,
        syncStatus: "synced",
        lastError: null,
        updatedAt: "2026-05-24T10:00:00.000Z",
        serverUpdatedAt: "2026-05-24T10:00:00.000Z",
        payload: {
          date: "2026-05-24",
          amount: 50000 + index,
          note: `Local expense ${index}`,
          category: "Food",
          paidBy: "Cubi",
          budgetId: null,
          budgetName: null,
          budgetIcon: null,
          budgetColor: null,
        },
      }))
    );

    const user = userEvent.setup();
    const queryClient = buildClient();
    const params = { limit: 30 };
    const firstPage: ExpenseListResult = {
      ...buildPage(),
      pagination: {
        limit: 30,
        offset: 0,
        hasMore: true,
      },
    };
    queryClient.setQueryData<InfiniteData<ExpenseListResult, number>>(
      queries.expenses.list(params).queryKey,
      { pageParams: [0], pages: [firstPage] }
    );
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    render(
      <QueryClientProvider client={queryClient}>
        <ExpenseList />
      </QueryClientProvider>
    );

    const loadMoreButton = await screen.findByRole("button", {
      name: "Load more",
    });
    expect(
      queryClient.getQueryData<InfiniteData<ExpenseListResult, number>>(
        queries.expenses.list(params).queryKey
      )?.pages
    ).toHaveLength(1);

    await user.click(loadMoreButton);

    await waitFor(() => {
      const cachedData = queryClient.getQueryData<
        InfiniteData<ExpenseListResult, number>
      >(queries.expenses.list(params).queryKey);

      expect(cachedData?.pages).toHaveLength(2);
      expect(cachedData?.pages[1]?.pagination).toMatchObject({
        limit: 30,
        offset: 30,
        hasMore: true,
      });
      expect(cachedData?.pages[1]?.rows).toHaveLength(30);
      expect(cachedData?.pages[1]?.rows[0]).toEqual(
        expect.objectContaining({
          id: 130,
          note: "Local expense 30",
        })
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(
      queryClient.getQueryData<InfiniteData<ExpenseListResult, number>>(
        queries.expenses.list(params).queryKey
      )?.pages
    ).toHaveLength(2);
    expect(fetchSpy).not.toHaveBeenCalled();

    await syncRepository.testing.clearSyncDb();
  });

  it("does not create an IntersectionObserver for manual load more", async () => {
    globalThis.React = React;
    await syncRepository.testing.clearSyncDb();
    await syncRepository.metadata.setCursor(
      "expenses",
      "2026-05-24T10:00:00.000Z"
    );

    const observe = vi.fn();
    const originalIntersectionObserver = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = vi.fn(() => ({
      observe,
      unobserve: vi.fn(),
      disconnect: vi.fn(),
      root: null,
      rootMargin: "",
      thresholds: [],
      takeRecords: () => [],
    })) as unknown as typeof IntersectionObserver;

    const queryClient = buildClient();
    const params = { limit: 30 };
    const firstPage: ExpenseListResult = {
      ...buildPage(),
      pagination: {
        limit: 30,
        offset: 0,
        hasMore: true,
      },
    };
    queryClient.setQueryData<InfiniteData<ExpenseListResult, number>>(
      queries.expenses.list(params).queryKey,
      { pageParams: [0], pages: [firstPage] }
    );

    try {
      render(
        <QueryClientProvider client={queryClient}>
          <ExpenseList />
        </QueryClientProvider>
      );

      expect(
        await screen.findByRole("button", { name: "Load more" })
      ).toBeInTheDocument();
      expect(globalThis.IntersectionObserver).not.toHaveBeenCalled();
      expect(observe).not.toHaveBeenCalled();
    } finally {
      globalThis.IntersectionObserver = originalIntersectionObserver;
      await syncRepository.testing.clearSyncDb();
    }
  });

  it("retries next-page loading only after Retry loading more is clicked", async () => {
    globalThis.React = React;
    await syncRepository.testing.clearSyncDb();
    await syncRepository.metadata.setCursor(
      "expenses",
      "2026-05-24T10:00:00.000Z"
    );
    await syncRepository.records.putMany(
      Array.from({ length: 31 }, (_, index) => ({
        entity: "expenses",
        clientId: `retry-client-${index}`,
        serverId: 200 + index,
        syncStatus: "synced",
        lastError: null,
        updatedAt: "2026-05-24T10:00:00.000Z",
        serverUpdatedAt: "2026-05-24T10:00:00.000Z",
        payload: {
          date: "2026-05-24",
          amount: 60000 + index,
          note: `Retry expense ${index}`,
          category: "Food",
          paidBy: "Cubi",
          budgetId: null,
          budgetName: null,
          budgetIcon: null,
          budgetColor: null,
        },
      }))
    );

    const user = userEvent.setup();
    const queryClient = buildClient();
    const params = { limit: 30 };
    const firstPage: ExpenseListResult = {
      ...buildPage(),
      pagination: {
        limit: 30,
        offset: 0,
        hasMore: true,
      },
    };
    queryClient.setQueryData<InfiniteData<ExpenseListResult, number>>(
      queries.expenses.list(params).queryKey,
      { pageParams: [0], pages: [firstPage] }
    );
    const recordsListSpy = vi
      .spyOn(syncRepository.records, "list")
      .mockRejectedValueOnce(new Error("IndexedDB unavailable"));

    render(
      <QueryClientProvider client={queryClient}>
        <ExpenseList />
      </QueryClientProvider>
    );

    await user.click(await screen.findByRole("button", { name: "Load more" }));

    expect(
      await screen.findByRole("button", { name: "Retry loading more" })
    ).toBeInTheDocument();
    expect(
      queryClient.getQueryData<InfiniteData<ExpenseListResult, number>>(
        queries.expenses.list(params).queryKey
      )?.pages
    ).toHaveLength(1);

    recordsListSpy.mockRestore();
    await user.click(
      screen.getByRole("button", { name: "Retry loading more" })
    );

    await waitFor(() => {
      const cachedData = queryClient.getQueryData<
        InfiniteData<ExpenseListResult, number>
      >(queries.expenses.list(params).queryKey);

      expect(cachedData?.pages).toHaveLength(2);
      expect(cachedData?.pages[1]?.pagination).toMatchObject({
        limit: 30,
        offset: 30,
        hasMore: false,
      });
      expect(cachedData?.pages[1]?.rows).toEqual([
        expect.objectContaining({
          id: 200,
          note: "Retry expense 0",
        }),
      ]);
    });

    await syncRepository.testing.clearSyncDb();
  });
});
