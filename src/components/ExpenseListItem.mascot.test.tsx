import React from "react";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ExpenseListItem from "./ExpenseListItem";

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

const expense = {
  id: 1,
  date: "2026-04-01",
  amount: 125000,
  note: "Lunch",
  category: "Food",
  paidBy: "me",
  budgetId: null,
  budgetName: null,
};

const renderItem = (onEditExpense = vi.fn()) => {
  render(<ExpenseListItem expense={expense} onEditExpense={onEditExpense} />);
  return { onEditExpense };
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

describe("ExpenseListItem delete flow", () => {
  it("shows a loading toast and replaces it on successful delete", async () => {
    const user = userEvent.setup();

    renderItem();

    await user.click(screen.getAllByRole("button")[2]);
    await user.click(screen.getByRole("button", { name: "Delete expense" }));

    expect(toastMock.loading).toHaveBeenCalledWith("Deleting expense...");
    expect(deleteExpenseMutationMock).toHaveBeenCalledWith(1);
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
