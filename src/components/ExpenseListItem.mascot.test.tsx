import React from "react";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import ExpenseListItem from "./ExpenseListItem";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/app/actions/expense-actions", () => ({
  deleteExpenseEntry: vi.fn(),
  updateExpenseEntry: vi.fn(),
}));

vi.mock("motion/react", () => ({
  motion: {
    div: ({ children, initial: _initial, ...props }: React.HTMLAttributes<HTMLDivElement> & { initial?: unknown }) => (
      <div {...props}>{children}</div>
    ),
  },
}));

vi.mock("@/components/ManualExpenseForm", () => ({
  default: React.forwardRef(function ManualExpenseFormMock(_, ref) {
    React.useImperativeHandle(ref, () => ({ submit: vi.fn() }));
    return <div data-testid="manual-expense-form" />;
  }),
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

vi.mock("@/components/ui/sheet", () => {
  const SheetContext = React.createContext<{
    open: boolean;
    onOpenChange?: (open: boolean) => void;
  } | null>(null);

  const Sheet = ({
    children,
    open = false,
    onOpenChange,
  }: {
    children: ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => (
    <SheetContext.Provider value={{ open, onOpenChange }}>
      <div>{children}</div>
    </SheetContext.Provider>
  );

  const SheetContent = ({ children }: { children: ReactNode }) => {
    const sheet = React.useContext(SheetContext);

    if (!sheet?.open) {
      return null;
    }

    return <div role="dialog">{children}</div>;
  };

  return {
    Sheet,
    SheetContent,
    SheetDescription: ({ children }: { children: ReactNode }) => (
      <p>{children}</p>
    ),
    SheetFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    SheetHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    SheetTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  };
});

describe("ExpenseListItem mascot companion", () => {
  it("renders the mascot companion in the edit sheet flow", async () => {
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

    expect(
      screen.getByRole("heading", { name: /edit expense/i })
    ).toBeInTheDocument();
    expect(screen.getByTestId("dialog-companion-slot")).toBeInTheDocument();
    expect(screen.getByTestId("idle-mascot")).toBeInTheDocument();
  });
});
