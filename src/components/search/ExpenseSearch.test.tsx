import React from "react";

import { Category } from "@/enums";
import { queries } from "@/lib/queries";
import { parseSearchRequest } from "@/lib/queries/parse-search";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
    return (
      <div
        data-testid={
          props.presentation === "search-drawer"
            ? "drawer-expense-list"
            : "home-expense-list"
        }
      />
    );
  },
}));

const renderWithClient = (ui: React.ReactNode) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData(queries.budgets.overview.queryKey, { budgets: [] });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
};

beforeEach(() => {
  listProps.mockClear();
  vi.mocked(parseSearchRequest).mockClear();
});

describe("ExpenseSearch", () => {
  it("renders a home search pill and an unfiltered home list by default", () => {
    renderWithClient(<ExpenseSearch />);

    expect(
      screen.getByRole("button", { name: /open expense search/i })
    ).toBeInTheDocument();
    expect(screen.getByTestId("home-expense-list")).toBeInTheDocument();
    expect(screen.queryByTestId("drawer-expense-list")).not.toBeInTheDocument();
    expect(listProps).toHaveBeenCalledWith(
      expect.not.objectContaining({
        searchQuery: expect.any(String),
      })
    );
  });

  it("opens the drawer, parses a submitted query, and passes filters to the drawer list", async () => {
    renderWithClient(<ExpenseSearch />);

    await userEvent.click(
      screen.getByRole("button", { name: /open expense search/i })
    );

    const input = await screen.findByRole("searchbox", {
      name: /search expenses/i,
    });
    await waitFor(() => expect(input).toHaveFocus());

    fireEvent.change(input, { target: { value: "coffee no budget" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() =>
      expect(screen.getByText("No budget")).toBeInTheDocument()
    );
    await waitFor(() =>
      expect(listProps).toHaveBeenCalledWith(
        expect.objectContaining({
          presentation: "search-drawer",
          hasBudget: false,
          categories: [Category.FOOD],
        })
      )
    );
    expect(parseSearchRequest).toHaveBeenCalledTimes(1);
  });

  it("keeps q in the input instead of rendering a raw text chip", async () => {
    vi.mocked(parseSearchRequest).mockResolvedValueOnce({
      status: "fallback",
      originalInput: "coffee",
      reason: "request_failed",
      prefill: { q: "coffee" },
    });

    renderWithClient(<ExpenseSearch />);

    await userEvent.click(
      screen.getByRole("button", { name: /open expense search/i })
    );
    const input = await screen.findByPlaceholderText(/search expenses/i);
    fireEvent.change(input, { target: { value: "coffee" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() =>
      expect(listProps).toHaveBeenCalledWith(
        expect.objectContaining({
          presentation: "search-drawer",
          searchQuery: "coffee",
        })
      )
    );
    expect(screen.getByDisplayValue("coffee")).toBeInTheDocument();
    expect(screen.queryByText(/text:/i)).not.toBeInTheDocument();
  });

  it("closes to the normal Home list but restores drawer state on reopen", async () => {
    renderWithClient(<ExpenseSearch />);

    await userEvent.click(
      screen.getByRole("button", { name: /open expense search/i })
    );
    const input = await screen.findByPlaceholderText(/search expenses/i);
    fireEvent.change(input, { target: { value: "coffee no budget" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() =>
      expect(screen.getByText("No budget")).toBeInTheDocument()
    );

    await userEvent.click(
      screen.getByRole("button", { name: /close search/i })
    );
    expect(screen.queryByTestId("drawer-expense-list")).not.toBeInTheDocument();
    expect(screen.getByTestId("home-expense-list")).toBeInTheDocument();

    const latestHomeListCall = [...listProps.mock.calls]
      .reverse()
      .find(([props]) => props.presentation !== "search-drawer")?.[0];
    expect(latestHomeListCall).toEqual(
      expect.not.objectContaining({
        hasBudget: false,
        categories: [Category.FOOD],
      })
    );

    await userEvent.click(
      screen.getByRole("button", { name: /open expense search/i })
    );

    expect(screen.getByDisplayValue("coffee no budget")).toBeInTheDocument();
    expect(screen.getByText("No budget")).toBeInTheDocument();
    expect(screen.getByTestId("drawer-expense-list")).toBeInTheDocument();
  });

  it("removes structured chips without another AI parse", async () => {
    renderWithClient(<ExpenseSearch />);

    await userEvent.click(
      screen.getByRole("button", { name: /open expense search/i })
    );
    const input = await screen.findByPlaceholderText(/search expenses/i);
    fireEvent.change(input, { target: { value: "coffee no budget" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() =>
      expect(screen.getByText("No budget")).toBeInTheDocument()
    );
    await userEvent.click(
      screen.getByRole("button", { name: /remove No budget/i })
    );

    expect(parseSearchRequest).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(listProps).toHaveBeenCalledWith(
        expect.objectContaining({
          presentation: "search-drawer",
          hasBudget: undefined,
        })
      )
    );
  });

  it("clears the search input and active filters from the inline clear button", async () => {
    renderWithClient(<ExpenseSearch />);

    await userEvent.click(
      screen.getByRole("button", { name: /open expense search/i })
    );
    const input = await screen.findByRole("searchbox", {
      name: /search expenses/i,
    });
    fireEvent.change(input, { target: { value: "coffee no budget" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() =>
      expect(screen.getByText("No budget")).toBeInTheDocument()
    );

    await userEvent.click(
      screen.getByRole("button", { name: /clear search/i })
    );

    expect(parseSearchRequest).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue("");
    expect(screen.queryByText("No budget")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(listProps).toHaveBeenCalledWith(
        expect.objectContaining({
          presentation: "search-drawer",
          searchQuery: undefined,
          hasBudget: undefined,
          categories: undefined,
        })
      )
    );
  });
});
