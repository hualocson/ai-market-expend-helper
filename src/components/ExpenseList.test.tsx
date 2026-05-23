import React from "react";

import { queries } from "@/lib/queries";
import type { ExpenseListResult } from "@/lib/services/expenses";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
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
  it("renders hydrated expense list data without an immediate fetch", () => {
    globalThis.React = React;

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 60 * 1000,
        },
      },
    });
    const params = { month: "2026-05", q: "coffee" };
    const payload: ExpenseListResult = {
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
      trimmedSearch: "coffee",
    };
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    queryClient.setQueryData(queries.expenses.list(params).queryKey, payload);

    render(
      <QueryClientProvider client={queryClient}>
        <ExpenseList
          selectedMonth="2026-05"
          searchQuery="coffee"
          monthTabBasePath="/transactions"
        />
      </QueryClientProvider>
    );

    expect(
      screen.getByRole("heading", { name: "Search results" })
    ).toBeInTheDocument();
    expect(screen.getByText('Matching "coffee"')).toBeInTheDocument();
    expect(screen.getByText("1 items")).toBeInTheDocument();
    expect(screen.getByTestId("expense-item")).toHaveTextContent(
      "Coffee beans"
    );
    expect(screen.getByText(/-120\.000/)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
