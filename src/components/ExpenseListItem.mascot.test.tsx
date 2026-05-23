import React from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import ExpenseListItem from "./ExpenseListItem";

const quickExpenseSheetMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/lib/mutations", () => ({
  useDeleteExpenseMutation: () => ({
    mutateAsync: vi.fn(),
  }),
}));

vi.mock("motion/react", () => ({
  motion: {
    div: ({
      children,
      initial: _initial,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & { initial?: unknown }) => (
      <div {...props}>{children}</div>
    ),
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

describe("ExpenseListItem edit flow", () => {
  it("opens QuickExpenseSheet in edit mode", async () => {
    const user = userEvent.setup();

    render(
      <ExpenseListItem
        expense={{
          id: 1,
          date: "2026-04-01",
          amount: 125000,
          note: "Lunch",
          category: "Food",
          paidBy: "me",
          budgetId: null,
          budgetName: null,
        }}
      />
    );

    await user.click(screen.getAllByRole("button")[1]);

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
