import React from "react";

import { Category } from "@/enums";
import { queries } from "@/lib/queries";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ExpenseSearch from "./ExpenseSearch";

vi.mock("@/lib/queries/parse-search", () => ({
  parseSearchRequest: vi.fn().mockResolvedValue({
    status: "success",
    originalInput: "coffee no budget",
    filter: { categories: [Category.FOOD], hasBudget: false },
  }),
}));

const listProps = vi.fn();
vi.mock("@/components/ExpenseList", () => ({
  default: (props: Record<string, unknown>) => {
    listProps(props);
    return <div data-testid="expense-list" />;
  },
}));

const renderWithClient = (ui: React.ReactNode) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  // Seed budgets overview so ExpenseSearch reads a budget list without a network call.
  queryClient.setQueryData(queries.budgets.overview.queryKey, { budgets: [] });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
};

describe("ExpenseSearch", () => {
  it("parses a query into chips and passes filters to ExpenseList", async () => {
    renderWithClient(<ExpenseSearch />);
    const input = screen.getByPlaceholderText(/search expenses/i);
    fireEvent.change(input, { target: { value: "coffee no budget" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() =>
      expect(screen.getByText("No budget")).toBeInTheDocument()
    );
    await waitFor(() =>
      expect(listProps).toHaveBeenCalledWith(
        expect.objectContaining({
          hasBudget: false,
          categories: [Category.FOOD],
        })
      )
    );
  });
});
