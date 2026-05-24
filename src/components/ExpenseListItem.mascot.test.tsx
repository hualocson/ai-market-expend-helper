import React from "react";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ExpenseListItem from "./ExpenseListItem";

const quickExpenseSheetMock = vi.hoisted(() => vi.fn());
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

vi.mock("@/components/QuickExpenseSheet", () => ({
  default: (props: Record<string, unknown>) => {
    quickExpenseSheetMock(props);
    return props.open ? <div data-testid="quick-expense-sheet" /> : null;
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

const renderItem = () => <ExpenseListItem expense={expense} />;

beforeEach(() => {
  vi.clearAllMocks();
  deleteExpenseIsPendingMock.value = false;
  deleteExpenseMutationMock.mockResolvedValue({ id: 1 });
  toastMock.loading.mockReturnValue("loading-toast");
});

describe("ExpenseListItem edit flow", () => {
  it("opens QuickExpenseSheet in edit mode when tapping the item", async () => {
    const user = userEvent.setup();

    render(renderItem());

    await user.click(screen.getByText("Lunch"));

    expect(screen.getByTestId("quick-expense-sheet")).toBeInTheDocument();
    expect(quickExpenseSheetMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        mode: "edit",
        open: true,
        transactionId: 1,
      })
    );
  });

  it("does not open edit from the drag click that follows a swipe", async () => {
    const user = userEvent.setup();

    render(renderItem());

    const item = screen.getByRole("button", { name: /edit expense lunch/i });
    fireEvent.dragStart(item);
    await user.click(item);

    expect(screen.queryByTestId("quick-expense-sheet")).not.toBeInTheDocument();
  });

  it("opens QuickExpenseSheet in edit mode", async () => {
    const user = userEvent.setup();

    render(renderItem());

    await user.click(screen.getByRole("button", { name: /edit expense$/i }));

    expect(screen.getByTestId("quick-expense-sheet")).toBeInTheDocument();
    expect(quickExpenseSheetMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        mode: "edit",
        open: true,
        showTrigger: false,
        transactionId: 1,
        initialExpense: expect.objectContaining({
          date: "01/04/2026",
          amount: 125000,
          note: "Lunch",
          category: "Food",
          paidBy: "me",
          budgetId: null,
        }),
      })
    );
  });
});

describe("ExpenseListItem delete flow", () => {
  it("shows a loading toast and replaces it on successful delete", async () => {
    const user = userEvent.setup();

    render(renderItem());

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

    render(renderItem());

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

    render(renderItem());

    const actionDeleteButton = screen.getAllByRole("button")[2];
    expect(actionDeleteButton).toBeDisabled();

    await user.click(actionDeleteButton);
    expect(deleteExpenseMutationMock).not.toHaveBeenCalled();
    expect(toastMock.loading).not.toHaveBeenCalled();
  });
});
