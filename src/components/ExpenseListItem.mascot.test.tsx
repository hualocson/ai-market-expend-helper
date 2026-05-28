import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ExpenseListItem, { type ExpenseListItemData } from "./ExpenseListItem";

const dispatchExpensePrefillMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/expense-prefill", () => ({
  dispatchExpensePrefill: dispatchExpensePrefillMock,
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

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });

const renderWithQueryClient = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return render(ui, { wrapper: Wrapper });
};

const renderItem = ({
  actionOpen = false,
  onActionOpenChange = vi.fn(),
  onDeleteExpense = vi.fn(),
  onEditExpense = vi.fn(),
  overrides = {},
}: {
  actionOpen?: boolean;
  onActionOpenChange?: (open: boolean) => void;
  onDeleteExpense?: (expense: ExpenseListItemData) => void;
  onEditExpense?: (expense: ExpenseListItemData) => void;
  overrides?: Partial<ExpenseFixture>;
} = {}) => {
  const item = { ...expense, ...overrides };

  renderWithQueryClient(
    <ExpenseListItem
      actionOpen={actionOpen}
      expense={item}
      onActionOpenChange={onActionOpenChange}
      onDeleteExpense={onDeleteExpense}
      onEditExpense={onEditExpense}
    />
  );

  return { expense: item, onActionOpenChange, onDeleteExpense, onEditExpense };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ExpenseListItem edit flow", () => {
  it("does not mount secondary action buttons while closed", () => {
    renderItem();

    expect(
      screen.queryByRole("button", { name: "Duplicate expense" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Edit expense$/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Delete expense" })
    ).not.toBeInTheDocument();
  });

  it("mounts secondary action buttons only when controlled open", () => {
    renderItem({ actionOpen: true });

    expect(
      screen.getByRole("button", { name: "Duplicate expense" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Edit expense$/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete expense" })
    ).toBeInTheDocument();
  });

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

  it("requests edit from the parent host from the open row edit action", async () => {
    const user = userEvent.setup();
    const { onActionOpenChange, onEditExpense } = renderItem({
      actionOpen: true,
    });

    await user.click(screen.getByRole("button", { name: /^Edit expense$/i }));

    expect(onEditExpense).toHaveBeenCalledTimes(1);
    expect(onEditExpense).toHaveBeenCalledWith(expense);
    expect(onActionOpenChange).toHaveBeenCalledWith(false);
  });

  it("dispatches quick expense prefill from the open row duplicate action", async () => {
    const user = userEvent.setup();
    const { onActionOpenChange } = renderItem({ actionOpen: true });

    await user.click(screen.getByRole("button", { name: "Duplicate expense" }));

    expect(dispatchExpensePrefillMock).toHaveBeenCalledTimes(1);
    expect(dispatchExpensePrefillMock).toHaveBeenCalledWith({
      amount: expense.amount,
      note: expense.note,
      category: expense.category,
      source: "repeat_entry",
    });
    expect(onActionOpenChange).toHaveBeenCalledWith(false);
  });

  it("requests shared delete confirmation from the open row delete action", async () => {
    const user = userEvent.setup();
    const { onActionOpenChange, onDeleteExpense } = renderItem({
      actionOpen: true,
    });

    await user.click(screen.getByRole("button", { name: "Delete expense" }));

    expect(onDeleteExpense).toHaveBeenCalledTimes(1);
    expect(onDeleteExpense).toHaveBeenCalledWith(expense);
    expect(onActionOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("ExpenseListItem open coordination", () => {
  it("keeps a closed row closed when another row opens", () => {
    const { onActionOpenChange } = renderItem({ actionOpen: false });

    window.dispatchEvent(
      new CustomEvent("expense-list-item-open", { detail: expense.id + 1 })
    );

    expect(onActionOpenChange).not.toHaveBeenCalled();
  });

  it("closes an open row when another row opens", () => {
    const { onActionOpenChange } = renderItem({ actionOpen: true });

    window.dispatchEvent(
      new CustomEvent("expense-list-item-open", { detail: expense.id + 1 })
    );

    expect(onActionOpenChange).toHaveBeenCalledTimes(1);
    expect(onActionOpenChange).toHaveBeenCalledWith(false);
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
    renderItem({
      onEditExpense: vi.fn(),
      overrides: {
        budgetId: 7,
        budgetName: "Meals",
        budgetIcon: "🍜",
        budgetColor: "rose",
      },
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
    const { rerender } = renderWithQueryClient(
      <ExpenseListItem
        actionOpen={false}
        expense={{ ...expense, syncStatus: "synced" }}
        onActionOpenChange={vi.fn()}
        onDeleteExpense={vi.fn()}
        onEditExpense={onEditExpense}
      />
    );

    expect(screen.queryByLabelText(/sync/i)).not.toBeInTheDocument();

    rerender(
      <ExpenseListItem
        actionOpen={false}
        expense={{ ...expense, syncStatus: undefined }}
        onActionOpenChange={vi.fn()}
        onDeleteExpense={vi.fn()}
        onEditExpense={onEditExpense}
      />
    );

    expect(screen.queryByLabelText(/sync/i)).not.toBeInTheDocument();
  });

  it("renders the pending sync dot before the paid-by icon", () => {
    renderItem({
      onEditExpense: vi.fn(),
      overrides: { syncStatus: "pending" },
    });

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
    renderItem({ onEditExpense: vi.fn(), overrides: { syncStatus: "failed" } });

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
