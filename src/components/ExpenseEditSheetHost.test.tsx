import React from "react";

import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ExpenseEditSheetHost from "./ExpenseEditSheetHost";

const quickExpenseSheetMock = vi.hoisted(() => vi.fn());
const deleteExpenseMutationMock = vi.hoisted(() => vi.fn());
const deleteExpenseIsPendingMock = vi.hoisted(() => ({ value: false }));
const toastMock = vi.hoisted(() => ({
  loading: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/components/QuickExpenseSheet", () => ({
  default: (props: Record<string, unknown>) => {
    quickExpenseSheetMock(props);
    return props.open ? <div data-testid="quick-expense-sheet" /> : null;
  },
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

const expense = {
  id: 7,
  clientId: "pending-client-1",
  date: "2026-05-23",
  amount: 120000,
  note: "Coffee beans",
  category: "Groceries",
  paidBy: "Loc",
  budgetId: 3,
  budgetName: "Home food",
};

beforeEach(() => {
  vi.clearAllMocks();
  deleteExpenseIsPendingMock.value = false;
  deleteExpenseMutationMock.mockResolvedValue({ id: expense.id });
  toastMock.loading.mockReturnValue("loading-toast");
});

describe("ExpenseEditSheetHost", () => {
  it("passes the selected expense to one controlled edit sheet", () => {
    const onOpenChange = vi.fn();

    render(
      <ExpenseEditSheetHost
        expense={expense}
        open
        onOpenChange={onOpenChange}
      />
    );

    expect(quickExpenseSheetMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        mode: "edit",
        open: true,
        showTrigger: false,
        transactionId: expense.id,
        initialExpense: {
          clientId: "pending-client-1",
          date: "23/05/2026",
          amount: 120000,
          note: "Coffee beans",
          category: "Groceries",
          paidBy: "Loc",
          budgetId: 3,
          budgetName: "Home food",
        },
        onOpenChange,
        onConfirmDelete: expect.any(Function),
      })
    );
  });

  it("deletes the selected expense from the edit sheet confirmation flow", async () => {
    render(
      <ExpenseEditSheetHost expense={expense} open onOpenChange={vi.fn()} />
    );

    const props = quickExpenseSheetMock.mock.calls.at(-1)?.[0] as {
      onConfirmDelete?: () => Promise<void>;
    };

    await act(async () => {
      await props.onConfirmDelete?.();
    });

    expect(toastMock.loading).toHaveBeenCalledWith("Deleting expense...");
    expect(deleteExpenseMutationMock).toHaveBeenCalledWith({
      id: expense.id,
      clientId: "pending-client-1",
    });
    expect(toastMock.success).toHaveBeenCalledWith("Expense deleted.", {
      id: "loading-toast",
    });
  });
});
