import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ExpenseListItem, { type ExpenseListItemData } from "./ExpenseListItem";

vi.mock("@/components/ExpenseItemIcon", () => ({
  default: ({ category }: { category: string }) => (
    <div data-testid="expense-item-icon">{category}</div>
  ),
}));

vi.mock("@/components/PaidByIcon", () => ({
  default: ({ paidBy }: { paidBy: string }) => (
    <div data-testid="paid-by-icon">{paidBy}</div>
  ),
}));

const expense: ExpenseListItemData = {
  id: 1,
  clientId: "pending-client-1",
  date: "2026-04-01",
  amount: 125000,
  note: "Lunch",
  category: "Food",
  paidBy: "me",
  budgetId: null,
  budgetName: null,
  budgetIcon: null,
  budgetColor: null,
};

type ExpenseFixture = typeof expense & {
  syncStatus?: "synced" | "pending" | "failed";
};

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });

const renderWithQueryClient = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return render(ui, { wrapper: Wrapper });
};

const renderItem = ({
  onEditExpense = vi.fn(),
  overrides = {},
}: {
  onEditExpense?: (expense: ExpenseListItemData) => void;
  overrides?: Partial<ExpenseFixture>;
} = {}) => {
  const item = { ...expense, ...overrides };

  renderWithQueryClient(
    <ExpenseListItem expense={item} onEditExpense={onEditExpense} />
  );

  return { expense: item, onEditExpense };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ExpenseListItem edit flow", () => {
  it("does not mount swipe action buttons", () => {
    renderItem();

    expect(
      screen.queryByRole("button", { name: "Duplicate expense" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Edit expense$/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Delete expense" })
    ).not.toBeInTheDocument();
  });

  it("requests edit from the parent host when tapping the item", async () => {
    const user = userEvent.setup();
    const { onEditExpense } = renderItem();

    await user.click(screen.getByText("Lunch"));

    expect(onEditExpense).toHaveBeenCalledTimes(1);
    expect(onEditExpense).toHaveBeenCalledWith(expense);
  });

  it("does not configure the row for horizontal drag", () => {
    renderItem();

    expect(
      screen.getByRole("button", { name: /edit expense lunch/i })
    ).not.toHaveAttribute("data-drag");
  });
});

describe("ExpenseListItem visual metadata", () => {
  it("renders category as an icon badge with the category name", () => {
    renderItem();

    const categoryBadge = screen.getByLabelText("Category: Food");

    expect(categoryBadge).toHaveTextContent("Food");
    expect(screen.getAllByTestId("expense-item-icon")).toHaveLength(2);
  });

  it("uses the assigned budget icon in the leading icon slot", () => {
    renderItem({
      onEditExpense: vi.fn(),
      overrides: {
        budgetId: 7,
        budgetName: "Meals",
        budgetIcon: "🍜",
        budgetColor: "rose",
      },
    });

    expect(screen.getByLabelText("Category: Food")).toHaveTextContent("Food");
    expect(screen.getAllByText("🍜")).toHaveLength(1);

    const budgetName = screen.getByLabelText("Budget: Meals");

    expect(budgetName).toHaveTextContent("Meals");
    expect(budgetName).toHaveClass("text-muted-foreground");
    expect(budgetName).not.toHaveClass("bg-rose-400/14");
  });
});

describe("ExpenseListItem sync status indicator", () => {
  it("does not render a sync dot for synced or missing status", () => {
    const onEditExpense = vi.fn();
    const { rerender } = renderWithQueryClient(
      <ExpenseListItem
        expense={{ ...expense, syncStatus: "synced" }}
        onEditExpense={onEditExpense}
      />
    );

    expect(screen.queryByLabelText(/sync/i)).not.toBeInTheDocument();

    rerender(
      <ExpenseListItem
        expense={{ ...expense, syncStatus: undefined }}
        onEditExpense={onEditExpense}
      />
    );

    expect(screen.queryByLabelText(/sync/i)).not.toBeInTheDocument();
  });

  it("renders the pending sync dot before the paid-by icon", () => {
    renderItem({
      onEditExpense: vi.fn(),
      overrides: { syncStatus: "pending" },
    });

    const indicator = screen.getByLabelText("Sync pending");
    const paidByIcon = screen.getByTestId("paid-by-icon");

    expect(indicator).toHaveAttribute("title", "Sync pending");
    expect(indicator).toHaveClass("bg-slate-400");
    expect(
      indicator.compareDocumentPosition(paidByIcon) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("renders the failed sync dot before the paid-by icon", () => {
    renderItem({ onEditExpense: vi.fn(), overrides: { syncStatus: "failed" } });

    const indicator = screen.getByLabelText("Sync failed");
    const paidByIcon = screen.getByTestId("paid-by-icon");

    expect(indicator).toHaveAttribute("title", "Sync failed");
    expect(indicator).toHaveClass("bg-destructive");
    expect(
      indicator.compareDocumentPosition(paidByIcon) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});
