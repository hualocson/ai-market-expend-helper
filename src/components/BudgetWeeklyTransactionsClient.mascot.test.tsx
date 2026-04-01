import React from "react";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import BudgetWeeklyTransactionsClient from "./BudgetWeeklyTransactionsClient";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/app/actions/budget-weekly-actions", () => ({
  setTransactionBudgetEntry: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/components/ExpenseItemIcon", () => ({
  default: ({ category }: { category: string }) => (
    <div data-testid="expense-item-icon">{category}</div>
  ),
}));

vi.mock("@/components/TransactionsSearch", () => ({
  default: () => <div data-testid="transactions-search" />,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
    function InputMock(props, ref) {
      return <input ref={ref} {...props} />;
    }
  ),
}));

vi.mock("@/components/ui/drawer", () => {
  const DrawerContext = React.createContext<{
    open: boolean;
    onOpenChange?: (open: boolean) => void;
  } | null>(null);

  const Drawer = ({
    children,
    open = false,
    onOpenChange,
  }: {
    children: ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => (
    <DrawerContext.Provider value={{ open, onOpenChange }}>
      <div>{children}</div>
    </DrawerContext.Provider>
  );

  const DrawerContent = ({ children }: { children: ReactNode }) => {
    const drawer = React.useContext(DrawerContext);

    if (!drawer?.open) {
      return null;
    }

    return <div role="dialog">{children}</div>;
  };

  const wrap = (Tag: keyof JSX.IntrinsicElements) => {
    function WrappedComponent({ children }: { children: ReactNode }) {
      return <Tag>{children}</Tag>;
    }

    return WrappedComponent;
  };

  return {
    Drawer,
    DrawerContent,
    DrawerDescription: wrap("div"),
    DrawerFooter: wrap("div"),
    DrawerHeader: wrap("div"),
    DrawerTitle: wrap("h2"),
  };
});

describe("BudgetWeeklyTransactionsClient mascot companion", () => {
  it("renders the mascot companion in the assign drawer header", async () => {
    const user = userEvent.setup();

    render(
      <BudgetWeeklyTransactionsClient
        budgets={[{ id: 1, name: "Groceries" }]}
        transactions={[
          {
            id: 11,
            amount: 42000,
            category: "Food",
            date: "2026-04-01",
            note: "Taxi",
            budgetId: null,
            budgetName: null,
          },
        ]}
      />
    );

    await user.click(screen.getByRole("button", { name: /taxi/i }));

    expect(
      screen.getByRole("heading", { name: /assign budget/i })
    ).toBeInTheDocument();
    expect(screen.getByTestId("dialog-companion-slot")).toBeInTheDocument();
    expect(screen.getByTestId("idle-mascot")).toBeInTheDocument();
  });
});
