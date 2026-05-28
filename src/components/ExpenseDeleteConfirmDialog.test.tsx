import React from "react";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ExpenseDeleteConfirmDialog from "./ExpenseDeleteConfirmDialog";
import type { ExpenseListItemData } from "./ExpenseListItem";

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

vi.mock("@/components/ExpenseItemIcon", () => ({
  default: ({ category }: { category: string }) => (
    <div data-testid="expense-item-icon">{category}</div>
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

beforeEach(() => {
  vi.clearAllMocks();
  deleteExpenseIsPendingMock.value = false;
  deleteExpenseMutationMock.mockResolvedValue({ id: 1 });
  toastMock.loading.mockReturnValue("loading-toast");
});

describe("ExpenseDeleteConfirmDialog", () => {
  it("renders closed when no expense is selected", () => {
    render(
      <ExpenseDeleteConfirmDialog expense={null} onOpenChange={vi.fn()} />
    );

    expect(
      screen.queryByRole("heading", { name: "Delete this expense?" })
    ).not.toBeInTheDocument();
  });

  it("closes without deleting when keeping the expense", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <ExpenseDeleteConfirmDialog
        expense={expense}
        onOpenChange={onOpenChange}
      />
    );

    await user.click(screen.getByRole("button", { name: "Keep it" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(deleteExpenseMutationMock).not.toHaveBeenCalled();
  });

  it("deletes the selected expense and closes on success", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <ExpenseDeleteConfirmDialog
        expense={expense}
        onOpenChange={onOpenChange}
      />
    );

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
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps the dialog open and shows an error when delete fails", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const error = new Error("Delete failed");
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    deleteExpenseMutationMock.mockRejectedValue(error);

    render(
      <ExpenseDeleteConfirmDialog
        expense={expense}
        onOpenChange={onOpenChange}
      />
    );

    try {
      await user.click(screen.getByRole("button", { name: "Delete expense" }));

      await waitFor(() => expect(consoleErrorSpy).toHaveBeenCalledWith(error));
      expect(toastMock.error).toHaveBeenCalledWith(
        "Failed to delete expense.",
        {
          id: "loading-toast",
        }
      );
      expect(onOpenChange).not.toHaveBeenCalledWith(false);
      expect(
        screen.getByRole("heading", { name: "Delete this expense?" })
      ).toBeVisible();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("disables both actions while delete is pending", () => {
    deleteExpenseIsPendingMock.value = true;

    render(
      <ExpenseDeleteConfirmDialog expense={expense} onOpenChange={vi.fn()} />
    );

    expect(screen.getByRole("button", { name: "Keep it" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Delete expense" })
    ).toBeDisabled();
  });

  it("ignores shell close attempts while delete is pending", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    deleteExpenseIsPendingMock.value = true;

    render(
      <ExpenseDeleteConfirmDialog
        expense={expense}
        onOpenChange={onOpenChange}
      />
    );

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(
      screen.getByRole("heading", { name: "Delete this expense?" })
    ).toBeVisible();
  });

  it("ignores rapid duplicate delete activations before pending state rerenders", () => {
    const onOpenChange = vi.fn();
    deleteExpenseMutationMock.mockImplementation(() => new Promise(() => {}));

    render(
      <ExpenseDeleteConfirmDialog
        expense={expense}
        onOpenChange={onOpenChange}
      />
    );

    const deleteButton = screen.getByRole("button", {
      name: "Delete expense",
    });
    fireEvent.click(deleteButton);
    fireEvent.click(deleteButton);

    expect(toastMock.loading).toHaveBeenCalledTimes(1);
    expect(deleteExpenseMutationMock).toHaveBeenCalledTimes(1);
    expect(deleteExpenseMutationMock).toHaveBeenCalledWith({
      id: 1,
      clientId: "pending-client-1",
    });
  });
});
