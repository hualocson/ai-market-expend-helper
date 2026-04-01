import React from "react";
import userEvent from "@testing-library/user-event";
import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import BudgetWeeklyBudgetsClient from "./BudgetWeeklyBudgetsClient";

const overviewData = {
  budgets: [],
};

beforeEach(() => {
  overviewData.budgets = [];
});

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: overviewData,
    error: null,
    isError: false,
    isPending: false,
    refetch: vi.fn(),
  }),
  useInfiniteQuery: () => ({
    data: { pages: [], pageParams: [] },
    error: null,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    isError: false,
    isFetching: false,
    isFetchingNextPage: false,
    isPending: false,
  }),
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock("@/app/actions/budget-weekly-actions", () => ({
  createWeeklyBudgetEntry: vi.fn(),
  deleteWeeklyBudgetEntry: vi.fn(),
  updateWeeklyBudgetEntry: vi.fn(),
}));

vi.mock("@/lib/queries/budget-weekly", () => ({
  invalidateBudgetWeeklyOptionsCache: vi.fn(),
}));

vi.mock("@/lib/queries/budgets", () => ({
  budgetOverviewQueryKey: ["budget-overview"],
  budgetTransactionsQueryKey: vi.fn(() => ["budget-transactions"]),
  fetchBudgetOverview: vi.fn(),
  fetchBudgetTransactions: vi.fn(),
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
  getPaidByPalette: vi.fn(() => ({
    bg: "",
    fg: "",
    border: "",
    text: "",
  })),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ui/dialog", () => {
  const DialogContext = React.createContext<{
    open: boolean;
    onOpenChange?: (open: boolean) => void;
  } | null>(null);

  const Dialog = ({
    children,
    open = false,
    onOpenChange,
  }: {
    children: ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      <div>{children}</div>
    </DialogContext.Provider>
  );

  const DialogContent = ({ children }: { children: ReactNode }) => {
    const dialog = React.useContext(DialogContext);

    if (!dialog?.open) {
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
    Dialog,
    DialogContent,
    DialogDescription: wrap("div"),
    DialogFooter: wrap("div"),
    DialogHeader: wrap("div"),
    DialogTitle: wrap("h2"),
  };
});

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

vi.mock("@/components/ui/input", () => ({
  Input: React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
    function InputMock(props, ref) {
      return <input ref={ref} {...props} />;
    }
  ),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}));

vi.mock("@/components/CalendarInput", () => ({
  default: () => <div data-testid="calendar-input" />,
}));

vi.mock("@/components/MonthlyPicker", () => ({
  default: () => <div data-testid="monthly-picker" />,
}));

vi.mock("@/components/WeekRangePicker", () => ({
  default: () => <div data-testid="week-range-picker" />,
}));

vi.mock("@/components/AmountInput", () => ({
  default: React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
    function AmountInputMock(props, ref) {
      return <input ref={ref} {...props} />;
    }
  ),
}));

vi.mock("@/components/TransactionRow", () => ({
  default: () => <div data-testid="transaction-row" />,
}));

describe("BudgetWeeklyBudgetsClient mascot companion", () => {
  it("renders the mascot companion in the create budget drawer header", async () => {
    const user = userEvent.setup();

    render(<BudgetWeeklyBudgetsClient weekStartDate="2026-04-01" />);

    const emptyState = screen.getByText(/no weekly budgets yet/i)
      .closest("div");

    expect(emptyState).not.toBeNull();

    await user.click(
      within(emptyState as HTMLElement).getByRole("button", {
        name: /add budget/i,
      })
    );

    expect(
      screen.getByRole("heading", { name: /new budget/i })
    ).toBeInTheDocument();
    expect(screen.getByTestId("dialog-companion-slot")).toBeInTheDocument();
    expect(screen.getByTestId("idle-mascot")).toBeInTheDocument();
  });

  it("renders the mascot companion in the edit budget drawer header", async () => {
    const user = userEvent.setup();

    overviewData.budgets = [
      {
        id: 1,
        name: "Groceries",
        amount: 500000,
        spent: 120000,
        remaining: 380000,
        period: "week",
        periodStartDate: "2026-03-30",
        periodEndDate: null,
      },
    ];

    render(<BudgetWeeklyBudgetsClient weekStartDate="2026-04-01" />);

    await user.click(screen.getByRole("button", { name: /groceries/i }));
    await user.click(screen.getByRole("button", { name: /edit budget/i }));

    expect(
      screen.getByRole("heading", { name: /edit budget/i })
    ).toBeInTheDocument();
    expect(screen.getByTestId("dialog-companion-slot")).toBeInTheDocument();
    expect(screen.getByTestId("idle-mascot")).toBeInTheDocument();
  });
});
