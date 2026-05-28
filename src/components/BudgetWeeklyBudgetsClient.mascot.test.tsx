import React from "react";
import type { ReactNode } from "react";

import {
  DEFAULT_BUDGET_COLOR,
  DEFAULT_BUDGET_ICON,
} from "@/lib/budget-appearance";
import type { BudgetListItem } from "@/types/budget-weekly";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import BudgetWeeklyBudgetsClient from "./BudgetWeeklyBudgetsClient";

const overviewData: { budgets: BudgetListItem[] } = {
  budgets: [],
};

const mutationMocks = vi.hoisted(() => ({
  createBudgetMutateAsync: vi.fn(),
  deleteBudgetMutateAsync: vi.fn(),
  updateBudgetMutateAsync: vi.fn(),
}));

beforeEach(() => {
  overviewData.budgets = [];
  mutationMocks.createBudgetMutateAsync.mockReset();
  mutationMocks.deleteBudgetMutateAsync.mockReset();
  mutationMocks.updateBudgetMutateAsync.mockReset();
});

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: overviewData,
    error: null,
    isError: false,
    isPending: false,
    refetch: vi.fn(),
  }),
  useSuspenseQuery: () => ({
    data: overviewData,
    error: null,
    isError: false,
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
}));

vi.mock("@/lib/mutations", () => ({
  useCreateBudgetMutation: () => ({
    mutateAsync: mutationMocks.createBudgetMutateAsync,
  }),
  useDeleteBudgetMutation: () => ({
    mutateAsync: mutationMocks.deleteBudgetMutateAsync,
  }),
  useUpdateBudgetMutation: () => ({
    mutateAsync: mutationMocks.updateBudgetMutateAsync,
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

  const wrap = (Tag: "div" | "h2") => {
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

  const DrawerNested = ({
    children,
    open: controlledOpen,
    onOpenChange,
  }: {
    children: ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => {
    const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
    const open = controlledOpen ?? uncontrolledOpen;
    const setOpen = onOpenChange ?? setUncontrolledOpen;

    return (
      <DrawerContext.Provider value={{ open, onOpenChange: setOpen }}>
        <div>{children}</div>
      </DrawerContext.Provider>
    );
  };

  const DrawerTrigger = ({ children }: { children: ReactNode }) => {
    const drawer = React.useContext(DrawerContext);

    if (!React.isValidElement(children)) {
      return null;
    }

    const child = children as React.ReactElement<
      React.HTMLAttributes<HTMLElement>
    >;

    return React.cloneElement(child, {
      onClick: (event: React.MouseEvent<HTMLElement>) => {
        child.props.onClick?.(event);
        drawer?.onOpenChange?.(true);
      },
    } as Partial<React.HTMLAttributes<HTMLElement>>);
  };

  const DrawerClose = ({ children }: { children: ReactNode }) => {
    const drawer = React.useContext(DrawerContext);

    return (
      <button
        type="button"
        aria-label="Close drawer"
        onClick={() => drawer?.onOpenChange?.(false)}
      >
        {children}
      </button>
    );
  };

  const DrawerContent = ({ children }: { children: ReactNode }) => {
    const drawer = React.useContext(DrawerContext);

    if (!drawer?.open) {
      return null;
    }

    return (
      <div role="dialog">
        <button
          type="button"
          aria-label="Close drawer"
          onClick={() => drawer.onOpenChange?.(false)}
        >
          Close
        </button>
        {children}
      </div>
    );
  };

  const wrap = (Tag: "div" | "h2") => {
    function WrappedComponent({ children }: { children: ReactNode }) {
      return <Tag>{children}</Tag>;
    }

    return WrappedComponent;
  };

  return {
    Drawer,
    DrawerNested,
    DrawerTrigger,
    DrawerClose,
    DrawerContent,
    DrawerDescription: wrap("div"),
    DrawerFooter: wrap("div"),
    DrawerHeader: wrap("div"),
    DrawerTitle: wrap("h2"),
  };
});

vi.mock("@/components/ui/input", () => ({
  Input: React.forwardRef<
    HTMLInputElement,
    React.InputHTMLAttributes<HTMLInputElement>
  >(function InputMock(props, ref) {
    return <input ref={ref} {...props} />;
  }),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <span>{placeholder}</span>
  ),
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
  default: React.forwardRef<
    HTMLInputElement,
    React.InputHTMLAttributes<HTMLInputElement>
  >(function AmountInputMock(props, ref) {
    return <input ref={ref} {...props} />;
  }),
}));

vi.mock("@/components/TransactionRow", () => ({
  default: () => <div data-testid="transaction-row" />,
}));

const groceryBudget = (): BudgetListItem => ({
  id: 1,
  name: "Groceries",
  icon: "🛒",
  color: "emerald",
  amount: 500000,
  spent: 120000,
  remaining: 380000,
  period: "week",
  periodStartDate: "2026-03-30",
  periodEndDate: null,
});

const openCreateDrawer = async () => {
  const user = userEvent.setup();

  render(<BudgetWeeklyBudgetsClient weekStartDate="2026-04-01" />);

  const emptyState = screen.getByText(/no weekly budgets yet/i).closest("div");

  expect(emptyState).not.toBeNull();

  await user.click(
    within(emptyState as HTMLElement).getByRole("button", {
      name: /add budget/i,
    })
  );

  return user;
};

describe("BudgetWeeklyBudgetsClient mascot companion", () => {
  it("renders the mascot companion in the create budget drawer header", async () => {
    await openCreateDrawer();

    expect(
      screen.getByRole("heading", { name: /new budget/i })
    ).toBeInTheDocument();
    expect(screen.getByTestId("dialog-companion-slot")).toBeInTheDocument();
    expect(screen.getByTestId("idle-mascot")).toBeInTheDocument();
  });

  it("renders the mascot companion in the edit budget drawer header", async () => {
    const user = userEvent.setup();

    overviewData.budgets = [groceryBudget()];

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

describe("BudgetWeeklyBudgetsClient budget appearance controls", () => {
  it("shows create defaults and submits the selected icon and color", async () => {
    const user = await openCreateDrawer();

    expect(screen.getByLabelText(/budget icon/i)).toHaveValue(
      DEFAULT_BUDGET_ICON
    );
    expect(
      screen.getByRole("button", { name: /budget color lime/i })
    ).toHaveAttribute("aria-pressed", "true");

    await user.clear(screen.getByLabelText(/budget icon/i));
    await user.type(screen.getByLabelText(/budget icon/i), "🛒");
    await user.click(
      screen.getByRole("button", { name: /budget color emerald/i })
    );
    await user.type(screen.getByLabelText(/budget name/i), "Groceries");
    await user.type(screen.getByLabelText(/amount/i), "500000");
    await user.click(screen.getByRole("button", { name: /create budget/i }));

    expect(mutationMocks.createBudgetMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Groceries",
        amount: 500000,
        icon: "🛒",
        color: "emerald",
      })
    );
  });

  it("pre-fills edit appearance from the selected budget", async () => {
    const user = userEvent.setup();

    overviewData.budgets = [groceryBudget()];

    render(<BudgetWeeklyBudgetsClient weekStartDate="2026-04-01" />);

    await user.click(screen.getByRole("button", { name: /groceries/i }));
    await user.click(screen.getByRole("button", { name: /edit budget/i }));

    expect(screen.getByLabelText(/budget icon/i)).toHaveValue("🛒");
    expect(
      screen.getByRole("button", { name: /budget color emerald/i })
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("resets create appearance to defaults after closing and reopening", async () => {
    const user = await openCreateDrawer();

    await user.clear(screen.getByLabelText(/budget icon/i));
    await user.type(screen.getByLabelText(/budget icon/i), "🛒");
    await user.click(
      screen.getByRole("button", { name: /budget color emerald/i })
    );

    expect(screen.getByLabelText(/budget icon/i)).toHaveValue("🛒");
    expect(
      screen.getByRole("button", { name: /budget color emerald/i })
    ).toHaveAttribute("aria-pressed", "true");

    await user.click(
      screen.getAllByRole("button", { name: /close drawer/i })[0]
    );

    const emptyState = screen
      .getByText(/no weekly budgets yet/i)
      .closest("div");

    expect(emptyState).not.toBeNull();

    await user.click(
      within(emptyState as HTMLElement).getByRole("button", {
        name: /add budget/i,
      })
    );

    expect(screen.getByLabelText(/budget icon/i)).toHaveValue(
      DEFAULT_BUDGET_ICON
    );
    expect(
      screen.getByRole("button", {
        name: new RegExp(`budget color ${DEFAULT_BUDGET_COLOR}`, "i"),
      })
    ).toHaveAttribute("aria-pressed", "true");
  });
});
