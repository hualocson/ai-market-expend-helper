import React from "react";

import { queries } from "@/lib/queries";
import type { ExpenseListResult } from "@/lib/services/expenses";
import type { InfiniteData } from "@tanstack/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ExpenseList from "./ExpenseList";

vi.mock("@/components/ExpenseListItem", () => ({
  default: ({ expense }: { expense: { note: string } }) => (
    <div data-testid="expense-item">{expense.note}</div>
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
  it("renders hydrated all-time infinite expense list data without month tabs", () => {
    globalThis.React = React;

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 60 * 1000,
        },
      },
    });
    const params = { limit: 30 };
    const payload: InfiniteData<ExpenseListResult, number> = {
      pageParams: [0],
      pages: [
        {
          activeMonth: "2026-05",
          effectiveRecentDays: 7,
          groupedRows: [
            {
              key: "2026-05-23",
              label: "Saturday, 23/05/2026",
              totalAmount: 120000,
              items: [
                {
                  id: 1,
                  date: "2026-05-23",
                  amount: 120000,
                  note: "Coffee beans",
                  category: "Groceries",
                  paidBy: "Loc",
                  budgetId: null,
                  budgetName: null,
                },
              ],
            },
          ],
          isRecent: false,
          pagination: {
            limit: 30,
            offset: 0,
            hasMore: false,
          },
          rows: [
            {
              id: 1,
              date: "2026-05-23",
              amount: 120000,
              note: "Coffee beans",
              category: "Groceries",
              paidBy: "Loc",
              budgetId: null,
              budgetName: null,
            },
          ],
        },
      ],
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

  it("fetches the next page when the bottom sentinel intersects", async () => {
    globalThis.React = React;

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

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 60 * 1000,
        },
      },
    });
    const params = { limit: 30 };
    const firstPage: ExpenseListResult = {
      activeMonth: "2026-05",
      effectiveRecentDays: 7,
      groupedRows: [
        {
          key: "2026-05-23",
          label: "Saturday, 23/05/2026",
          totalAmount: 120000,
          items: [
            {
              id: 1,
              date: "2026-05-23",
              amount: 120000,
              note: "Coffee beans",
              category: "Groceries",
              paidBy: "Loc",
              budgetId: null,
              budgetName: null,
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
          id: 1,
          date: "2026-05-23",
          amount: 120000,
          note: "Coffee beans",
          category: "Groceries",
          paidBy: "Loc",
          budgetId: null,
          budgetName: null,
        },
      ],
    };
    const secondPage: ExpenseListResult = {
      activeMonth: "2026-05",
      effectiveRecentDays: 7,
      groupedRows: [],
      isRecent: false,
      pagination: {
        limit: 30,
        offset: 30,
        hasMore: false,
      },
      rows: [],
    };
    queryClient.setQueryData<InfiniteData<ExpenseListResult, number>>(
      queries.expenses.list(params).queryKey,
      { pageParams: [0], pages: [firstPage] }
    );
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(secondPage), {
        headers: { "Content-Type": "application/json" },
      })
    );

    try {
      render(
        <QueryClientProvider client={queryClient}>
          <ExpenseList />
        </QueryClientProvider>
      );

      expect(observe).toHaveBeenCalled();
      observerCallback?.([{ isIntersecting: true } as IntersectionObserverEntry]);

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith(
          "/api/expenses?limit=30&offset=30",
          { method: "GET", cache: "no-store" }
        );
      });
    } finally {
      globalThis.IntersectionObserver = originalIntersectionObserver;
    }
  });
});
