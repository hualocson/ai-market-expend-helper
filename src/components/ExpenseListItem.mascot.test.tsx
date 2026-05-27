import React from "react";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ExpenseListItem, { type ExpenseListItemData } from "./ExpenseListItem";

const deleteExpenseMutationMock = vi.hoisted(() => vi.fn());
const deleteExpenseIsPendingMock = vi.hoisted(() => ({ value: false }));
const toastMock = vi.hoisted(() => ({
  loading: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/lib/mutations", () => ({
  useDeleteExpenseMutation: () => ({
    mutateAsync: deleteExpenseMutationMock,
    isPending: deleteExpenseIsPendingMock.value,
  }),
}));

vi.mock("sonner", () => ({
  toast: toastMock,
}));

vi.mock("motion/react", () => ({
  motion: {
    div: ({
      children,
      animate: _animate,
      drag: _drag,
      dragConstraints: _dragConstraints,
      dragDirectionLock: _dragDirectionLock,
      dragElastic: _dragElastic,
      dragTransition: _dragTransition,
      initial: _initial,
      transition: _transition,
      whileDrag: _whileDrag,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & {
      animate?: unknown;
      drag?: unknown;
      dragConstraints?: unknown;
      dragDirectionLock?: unknown;
      dragElastic?: unknown;
      dragTransition?: unknown;
      initial?: unknown;
      transition?: unknown;
      whileDrag?: unknown;
    }) => <div {...props}>{children}</div>,
  },
}));

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

const renderItem = (
  onEditExpense = vi.fn(),
  overrides: Partial<ExpenseFixture> = {}
) => {
  const item = { ...expense, ...overrides };

  render(<ExpenseListItem expense={item} onEditExpense={onEditExpense} />);
  return { expense: item, onEditExpense };
};

beforeEach(() => {
  vi.clearAllMocks();
  deleteExpenseIsPendingMock.value = false;
  deleteExpenseMutationMock.mockResolvedValue({ id: 1 });
  toastMock.loading.mockReturnValue("loading-toast");
});

describe("ExpenseListItem edit flow", () => {
  it("requests edit from the parent host when tapping the item", async () => {
    const user = userEvent.setup();
    const { onEditExpense } = renderItem();

    await user.click(screen.getByText("Lunch"));

    expect(onEditExpense).toHaveBeenCalledTimes(1);
    expect(onEditExpense).toHaveBeenCalledWith(expense);
  });

  it("does not open edit from the drag click that follows a swipe", async () => {
    const user = userEvent.setup();
    const { onEditExpense } = renderItem();

    const item = screen.getByRole("button", { name: /edit expense lunch/i });
    fireEvent.dragStart(item);
    await user.click(item);

    expect(onEditExpense).not.toHaveBeenCalled();
  });

  it("requests edit from the parent host from the swipe edit action", async () => {
    const user = userEvent.setup();
    const { onEditExpense } = renderItem();

    await user.click(screen.getByRole("button", { name: /edit expense$/i }));

    expect(onEditExpense).toHaveBeenCalledTimes(1);
    expect(onEditExpense).toHaveBeenCalledWith(expense);
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
    renderItem(vi.fn(), {
      budgetId: 7,
      budgetName: "Meals",
      budgetIcon: "🍜",
      budgetColor: "rose",
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
    const { rerender } = render(
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
    renderItem(vi.fn(), { syncStatus: "pending" });

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
    renderItem(vi.fn(), { syncStatus: "failed" });

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

describe("ExpenseListItem delete flow", () => {
  it("shows a loading toast and replaces it on successful delete", async () => {
    const user = userEvent.setup();

    renderItem();

    await user.click(screen.getAllByRole("button")[2]);
    await user.click(screen.getByRole("button", { name: "Delete expense" }));

    expect(toastMock.loading).toHaveBeenCalledWith("Deleting expense...");
    expect(deleteExpenseMutationMock).toHaveBeenCalledWith({
      id: 1,
      clientId: "pending-client-1",
    });
    await waitFor(() =>
      expect(toastMock.success).toHaveBeenCalledWith("Expense deleted.", {
        id: "loading-toast",
      })
    );
  });

  it("replaces the loading toast on delete failure", async () => {
    const user = userEvent.setup();
    deleteExpenseMutationMock.mockRejectedValue(new Error("Network down"));
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    renderItem();

    await user.click(screen.getAllByRole("button")[2]);
    await user.click(screen.getByRole("button", { name: "Delete expense" }));

    expect(toastMock.loading).toHaveBeenCalledWith("Deleting expense...");
    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith(
        "Failed to delete expense.",
        { id: "loading-toast" }
      )
    );

    consoleErrorSpy.mockRestore();
  });

  it("disables delete actions while the mutation is pending", async () => {
    const user = userEvent.setup();
    deleteExpenseIsPendingMock.value = true;

    renderItem();

    const actionDeleteButton = screen.getAllByRole("button")[2];
    expect(actionDeleteButton).toBeDisabled();

    await user.click(actionDeleteButton);
    expect(deleteExpenseMutationMock).not.toHaveBeenCalled();
    expect(toastMock.loading).not.toHaveBeenCalled();
  });
});
