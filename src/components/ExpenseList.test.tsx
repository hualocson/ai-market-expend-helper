import React from "react";

import { queries } from "@/lib/queries";
import type { ExpenseListResult } from "@/lib/services/expenses";
import { syncRepository } from "@/lib/sync/core/repository";
import type { InfiniteData } from "@tanstack/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";

import ExpenseList from "./ExpenseList";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    prefetch,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    prefetch?: boolean;
  }) => (
    <a
      href={href}
      data-prefetch={prefetch === false ? "false" : "true"}
      {...props}
    >
      {children}
    </a>
  ),
}));

vi.mock("@/components/ExpenseListItem", () => ({
  default: ({
    actionOpen,
    expense,
    onActionOpenChange,
    onDeleteExpense,
    onEditExpense,
  }: {
    actionOpen: boolean;
    expense: { id: number; note: string };
    onActionOpenChange: (open: boolean) => void;
    onDeleteExpense: (expense: { id: number; note: string }) => void;
    onEditExpense: (expense: { id: number; note: string }) => void;
  }) => (
    <div data-action-open={String(actionOpen)} data-testid="expense-item">
      <button type="button" onClick={() => onEditExpense(expense)}>
        {expense.note}
      </button>
      <button type="button" onClick={() => onActionOpenChange(true)}>
        Open actions {expense.note}
      </button>
      <button type="button" onClick={() => onActionOpenChange(false)}>
        Close actions {expense.note}
      </button>
      {actionOpen ? (
        <button type="button" onClick={() => onDeleteExpense(expense)}>
          Request delete {expense.note}
        </button>
      ) : null}
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

vi.mock("@/components/ExpenseDeleteConfirmDialog", () => ({
  default: ({
    expense,
    onOpenChange,
  }: {
    expense: { note: string } | null;
    onOpenChange: (open: boolean) => void;
  }) => (
    <div data-testid="expense-delete-confirm-dialog">
      <span>{expense?.note ?? ""}</span>
      <button type="button" onClick={() => onOpenChange(false)}>
        Close delete dialog
      </button>
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
  default: () => <button type="button">Jump to top</button>,
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

  it("keeps only one expense item action surface open", async () => {
    globalThis.React = React;

    const user = userEvent.setup();
    const queryClient = buildClient();
    const params = { limit: 30 };
    const teaExpense = {
      ...firstExpense,
      id: 2,
      note: "Tea",
    };
    const payload: InfiniteData<ExpenseListResult, number> = {
      pageParams: [0],
      pages: [buildPage([{ ...firstExpense, note: "Coffee" }, teaExpense])],
    };

    queryClient.setQueryData(queries.expenses.list(params).queryKey, payload);

    render(
      <QueryClientProvider client={queryClient}>
        <ExpenseList />
      </QueryClientProvider>
    );

    const items = screen.getAllByTestId("expense-item");
    expect(items[0]).toHaveAttribute("data-action-open", "false");
    expect(items[1]).toHaveAttribute("data-action-open", "false");

    await user.click(
      screen.getByRole("button", { name: "Open actions Coffee" })
    );

    expect(items[0]).toHaveAttribute("data-action-open", "true");
    expect(items[1]).toHaveAttribute("data-action-open", "false");

    await user.click(screen.getByRole("button", { name: "Open actions Tea" }));

    expect(items[0]).toHaveAttribute("data-action-open", "false");
    expect(items[1]).toHaveAttribute("data-action-open", "true");
  });

  it("keeps the newly opened action surface active after a stale row close", async () => {
    globalThis.React = React;

    const user = userEvent.setup();
    const queryClient = buildClient();
    const params = { limit: 30 };
    const teaExpense = {
      ...firstExpense,
      id: 2,
      note: "Tea",
    };
    const payload: InfiniteData<ExpenseListResult, number> = {
      pageParams: [0],
      pages: [buildPage([{ ...firstExpense, note: "Coffee" }, teaExpense])],
    };

    queryClient.setQueryData(queries.expenses.list(params).queryKey, payload);

    render(
      <QueryClientProvider client={queryClient}>
        <ExpenseList />
      </QueryClientProvider>
    );

    const items = screen.getAllByTestId("expense-item");

    await user.click(
      screen.getByRole("button", { name: "Open actions Coffee" })
    );
    await user.click(screen.getByRole("button", { name: "Open actions Tea" }));
    await user.click(
      screen.getByRole("button", { name: "Close actions Coffee" })
    );

    expect(items[0]).toHaveAttribute("data-action-open", "false");
    expect(items[1]).toHaveAttribute("data-action-open", "true");
  });

  it("opens one shared delete dialog for the selected expense", async () => {
    globalThis.React = React;

    const user = userEvent.setup();
    const queryClient = buildClient();
    const params = { limit: 30 };
    const payload: InfiniteData<ExpenseListResult, number> = {
      pageParams: [0],
      pages: [buildPage([{ ...firstExpense, note: "Coffee" }])],
    };

    queryClient.setQueryData(queries.expenses.list(params).queryKey, payload);

    render(
      <QueryClientProvider client={queryClient}>
        <ExpenseList />
      </QueryClientProvider>
    );

    expect(screen.getAllByTestId("expense-delete-confirm-dialog")).toHaveLength(
      1
    );
    expect(
      screen.getByTestId("expense-delete-confirm-dialog")
    ).not.toHaveTextContent("Coffee");

    await user.click(
      screen.getByRole("button", { name: "Open actions Coffee" })
    );
    await user.click(
      screen.getByRole("button", { name: "Request delete Coffee" })
    );

    expect(
      screen.getByTestId("expense-delete-confirm-dialog")
    ).toHaveTextContent("Coffee");

    await user.click(
      screen.getByRole("button", { name: "Close delete dialog" })
    );

    expect(
      screen.getByTestId("expense-delete-confirm-dialog")
    ).not.toHaveTextContent("Coffee");
  });

  it("disables prefetch for repeated day summary links", () => {
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

    const dayLink = screen.getByRole("link", {
      name: /Saturday, 23\/05\/2026/,
    });
    expect(dayLink).toHaveAttribute("href", "/report/day/2026-05-23");
    expect(dayLink).toHaveAttribute("data-prefetch", "false");
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

  it("gates load more while the initial expense sync cursor is missing", async () => {
    globalThis.React = React;
    await syncRepository.testing.clearSyncDb();

    let observerCallback:
      | ((entries: IntersectionObserverEntry[]) => void)
      | undefined;
    const observe = vi.fn();
    const originalIntersectionObserver = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = vi.fn((callback) => {
      observerCallback = callback;
      return {
        observe,
        unobserve: vi.fn(),
        disconnect: vi.fn(),
        root: null,
        rootMargin: "",
        thresholds: [],
        takeRecords: () => [],
      };
    }) as unknown as typeof IntersectionObserver;

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
        await screen.findByText("Syncing all expenses before loading more.")
      ).toBeInTheDocument();
      expect(observe).not.toHaveBeenCalled();

      observerCallback?.([
        { isIntersecting: true } as IntersectionObserverEntry,
      ]);

      const cachedData = queryClient.getQueryData<
        InfiniteData<ExpenseListResult, number>
      >(queries.expenses.list(params).queryKey);
      expect(cachedData?.pages).toHaveLength(1);
    } finally {
      globalThis.IntersectionObserver = originalIntersectionObserver;
      await syncRepository.testing.clearSyncDb();
    }
  });

  it("fetches the next page when the bottom sentinel intersects", async () => {
    globalThis.React = React;
    await syncRepository.testing.clearSyncDb();
    await syncRepository.metadata.setCursor(
      "expenses",
      "2026-05-24T10:00:00.000Z"
    );
    await syncRepository.records.putMany(
      Array.from({ length: 31 }, (_, index) => ({
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

    let observerCallback:
      | ((entries: IntersectionObserverEntry[]) => void)
      | undefined;
    const observe = vi.fn();
    const disconnect = vi.fn();
    const originalIntersectionObserver = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = vi.fn((callback) => {
      observerCallback = callback;
      return {
        observe,
        unobserve: vi.fn(),
        disconnect,
        root: null,
        rootMargin: "",
        thresholds: [],
        takeRecords: () => [],
      };
    }) as unknown as typeof IntersectionObserver;

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

    try {
      render(
        <QueryClientProvider client={queryClient}>
          <ExpenseList />
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(observe).toHaveBeenCalled();
      });
      observerCallback?.([
        { isIntersecting: true } as IntersectionObserverEntry,
      ]);

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
            id: 100,
            note: "Local expense 0",
          }),
        ]);
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      globalThis.IntersectionObserver = originalIntersectionObserver;
      await syncRepository.testing.clearSyncDb();
    }
  });
});
