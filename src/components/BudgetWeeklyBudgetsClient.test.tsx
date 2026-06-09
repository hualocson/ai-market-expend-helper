import React, { type ReactNode } from "react";

import { Category } from "@/enums";
import type { BudgetListItem } from "@/types/budget-weekly";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import BudgetWeeklyBudgetsClient from "./BudgetWeeklyBudgetsClient";

const queryMocks = vi.hoisted(() => ({
  refetchOverview: vi.fn(),
  useInfiniteQuery: vi.fn(),
  useQuery: vi.fn(),
  useSuspenseQuery: vi.fn(),
}));

const mutationMocks = vi.hoisted(() => ({
  cloneBudgetMutateAsync: vi.fn(),
  createBudgetMutateAsync: vi.fn(),
  deleteBudgetMutateAsync: vi.fn(),
  updateBudgetMutateAsync: vi.fn(),
}));

const toastMocks = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useInfiniteQuery: queryMocks.useInfiniteQuery,
  useQuery: queryMocks.useQuery,
  useSuspenseQuery: queryMocks.useSuspenseQuery,
}));

vi.mock("@/lib/mutations", () => ({
  useCloneBudgetsToNextPeriodMutation: () => ({
    isPending: false,
    mutateAsync: mutationMocks.cloneBudgetMutateAsync,
  }),
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

vi.mock("sonner", () => ({
  toast: toastMocks,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ui/select", () => {
  const SelectContext = React.createContext<{
    onValueChange?: (value: string) => void;
    value?: string;
  }>({});

  return {
    Select: ({
      children,
      onValueChange,
      value,
    }: {
      children: ReactNode;
      onValueChange?: (value: string) => void;
      value?: string;
    }) => (
      <SelectContext.Provider value={{ onValueChange, value }}>
        <div>{children}</div>
      </SelectContext.Provider>
    ),
    SelectContent: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    SelectItem: ({
      children,
      value,
    }: {
      children: ReactNode;
      value: string;
    }) => {
      const select = React.useContext(SelectContext);

      return (
        <button
          type="button"
          role="option"
          aria-selected={select.value === value}
          onClick={() => select.onValueChange?.(value)}
        >
          {children}
        </button>
      );
    },
    SelectTrigger: ({
      children,
      "aria-label": ariaLabel,
    }: {
      children: ReactNode;
      "aria-label"?: string;
    }) => (
      <button type="button" role="combobox" aria-label={ariaLabel}>
        {children}
      </button>
    ),
    SelectValue: ({ placeholder }: { placeholder?: string }) => {
      const select = React.useContext(SelectContext);

      return <span>{select.value ?? placeholder}</span>;
    },
  };
});

vi.mock("@/components/ui/dialog", () => {
  const DialogContext = React.createContext<{
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }>({});

  return {
    Dialog: ({
      children,
      onOpenChange,
      open,
    }: {
      children: ReactNode;
      onOpenChange?: (open: boolean) => void;
      open?: boolean;
    }) => (
      <DialogContext.Provider value={{ open, onOpenChange }}>
        <div>{children}</div>
      </DialogContext.Provider>
    ),
    DialogContent: ({ children }: { children: ReactNode }) => {
      const dialog = React.useContext(DialogContext);

      if (!dialog.open) {
        return null;
      }

      return (
        <div role="dialog" aria-modal="true">
          {children}
        </div>
      );
    },
    DialogDescription: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    DialogFooter: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    DialogHeader: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  };
});

vi.mock("@/components/ui/drawer", () => {
  const DrawerContext = React.createContext<{
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }>({});

  return {
    Drawer: ({
      children,
      onOpenChange,
      open,
    }: {
      children: ReactNode;
      onOpenChange?: (open: boolean) => void;
      open?: boolean;
    }) => (
      <DrawerContext.Provider value={{ open, onOpenChange }}>
        <div>{children}</div>
      </DrawerContext.Provider>
    ),
    DrawerClose: ({ children }: { children: ReactNode }) => (
      <button type="button">{children}</button>
    ),
    DrawerContent: ({ children }: { children: ReactNode }) => {
      const drawer = React.useContext(DrawerContext);

      if (!drawer.open) {
        return null;
      }

      return (
        <div role="dialog" aria-modal="true" data-testid="clone-preview-drawer">
          {children}
        </div>
      );
    },
    DrawerDescription: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    DrawerFooter: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    DrawerHeader: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    DrawerTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  };
});

vi.mock("@/components/BudgetTransferDrawer", () => ({
  default: () => null,
}));

vi.mock("@/components/DatePickerSheet", () => ({
  default: () => null,
}));

vi.mock("@/components/ExpenseItemIcon", () => ({
  default: () => null,
}));

vi.mock("@/components/PaidByIcon", () => ({
  default: () => null,
  getPaidByPalette: vi.fn(() => ({
    bg: "",
    border: "",
    fg: "",
    text: "",
  })),
}));

const originalGlobalReact = globalThis.React;

const overviewWithBudgets = {
  summary: {
    totalBudget: 5_200_000,
    totalSpent: 0,
    totalRemaining: 5_200_000,
    budgetCount: 3,
  },
  budgets: [
    {
      id: 1,
      name: "Coffee",
      icon: "☕",
      color: "lime",
      category: Category.FOOD,
      amount: 200_000,
      spent: 0,
      remaining: 200_000,
      period: "week",
      periodStartDate: "2026-06-07",
      periodEndDate: "2026-06-13",
    },
    {
      id: 2,
      name: "Groceries",
      icon: "🛒",
      color: "emerald",
      category: Category.FOOD,
      amount: 1_000_000,
      spent: 0,
      remaining: 1_000_000,
      period: "week",
      periodStartDate: "2026-06-07",
      periodEndDate: "2026-06-13",
    },
    {
      id: 3,
      name: "Rent",
      icon: "🏠",
      color: "sky",
      category: Category.HOME,
      amount: 4_000_000,
      spent: 0,
      remaining: 4_000_000,
      period: "month",
      periodStartDate: "2020-01-01",
      periodEndDate: "2020-01-31",
    },
  ] satisfies BudgetListItem[],
};

beforeEach(() => {
  globalThis.React = React;
  mutationMocks.cloneBudgetMutateAsync.mockReset();
  mutationMocks.createBudgetMutateAsync.mockReset();
  mutationMocks.deleteBudgetMutateAsync.mockReset();
  mutationMocks.updateBudgetMutateAsync.mockReset();
  queryMocks.refetchOverview.mockReset();
  queryMocks.useInfiniteQuery.mockReset();
  queryMocks.useQuery.mockReset();
  queryMocks.useSuspenseQuery.mockReset();
  toastMocks.error.mockReset();
  toastMocks.success.mockReset();
  queryMocks.useSuspenseQuery.mockReturnValue({
    data: { budgets: [] },
    error: null,
    isError: false,
    refetch: queryMocks.refetchOverview,
  });
  queryMocks.useInfiniteQuery.mockReturnValue({
    data: { pages: [], pageParams: [] },
    error: null,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isError: false,
    isFetching: false,
    isFetchingNextPage: false,
    isPending: false,
  });
});

afterEach(() => {
  if (typeof originalGlobalReact === "undefined") {
    Reflect.deleteProperty(globalThis, "React");
    return;
  }

  globalThis.React = originalGlobalReact;
});

describe("BudgetWeeklyBudgetsClient", () => {
  it("reads the budget overview with useSuspenseQuery", () => {
    render(<BudgetWeeklyBudgetsClient weekStartDate="2026-04-01" />);

    expect(queryMocks.useSuspenseQuery).toHaveBeenCalled();
    expect(queryMocks.useQuery).not.toHaveBeenCalled();
  });

  it("renders clone as an icon-only action beside add budget in the header", () => {
    queryMocks.useSuspenseQuery.mockReturnValue({
      data: overviewWithBudgets,
      error: null,
      isError: false,
      refetch: queryMocks.refetchOverview,
    });

    render(<BudgetWeeklyBudgetsClient weekStartDate="2026-06-07" />);

    const actions = screen.getByRole("group", { name: "Budget actions" });
    const cloneButton = within(actions).getByRole("button", {
      name: "Clone to next week",
    });

    expect(actions).toHaveClass("h-11", "rounded-full", "p-1");
    expect(
      within(actions).getByRole("button", { name: "Add budget" })
    ).toBeInTheDocument();
    expect(cloneButton).toHaveClass("size-9", "rounded-full");
    expect(
      within(actions).getByRole("button", { name: "Add budget" })
    ).toHaveClass("size-9", "rounded-full");
    expect(cloneButton).toHaveTextContent("");
    expect(
      screen.getAllByRole("button", { name: "Clone to next week" })
    ).toHaveLength(1);
  });

  it("previews the selected weekly group before cloning", async () => {
    const user = userEvent.setup();
    queryMocks.useSuspenseQuery.mockReturnValue({
      data: {
        ...overviewWithBudgets,
        budgets: [
          ...overviewWithBudgets.budgets,
          {
            ...overviewWithBudgets.budgets[0],
            id: 4,
            periodStartDate: "2026-06-14",
            periodEndDate: "2026-06-20",
          },
        ],
      },
      error: null,
      isError: false,
      refetch: queryMocks.refetchOverview,
    });

    render(<BudgetWeeklyBudgetsClient weekStartDate="2026-06-07" />);

    await user.click(
      screen.getByRole("button", { name: "Clone to next week" })
    );

    expect(mutationMocks.cloneBudgetMutateAsync).not.toHaveBeenCalled();
    const preview = screen.getByTestId("clone-preview-drawer");
    expect(
      within(preview).getByRole("heading", { name: "Clone budgets" })
    ).toBeInTheDocument();
    expect(within(preview).getByText("07 Jun - 13 Jun")).toBeInTheDocument();
    expect(within(preview).getByText("14 Jun - 20 Jun")).toBeInTheDocument();
    expect(within(preview).getByText("Coffee")).toBeInTheDocument();
    expect(within(preview).getByText("Exists")).toBeInTheDocument();
    expect(within(preview).getAllByText("Groceries").length).toBeGreaterThan(0);
    expect(
      within(preview).getByText("Total clone amount is")
    ).toBeInTheDocument();
  });

  it("clones the selected weekly group after confirmation and switches to the target week", async () => {
    const user = userEvent.setup();
    queryMocks.useSuspenseQuery.mockReturnValue({
      data: overviewWithBudgets,
      error: null,
      isError: false,
      refetch: queryMocks.refetchOverview,
    });
    mutationMocks.cloneBudgetMutateAsync.mockResolvedValue({
      period: "week",
      sourceStartDate: "2026-06-07",
      sourceEndDate: "2026-06-13",
      targetStartDate: "2026-06-14",
      targetEndDate: "2026-06-20",
      sourceCount: 2,
      createdCount: 2,
      skippedCount: 0,
      createdBudgetIds: [10, 11],
    });

    render(<BudgetWeeklyBudgetsClient weekStartDate="2026-06-07" />);

    await user.click(
      screen.getByRole("button", { name: "Clone to next week" })
    );
    await user.click(screen.getByRole("button", { name: "Confirm clone" }));

    expect(mutationMocks.cloneBudgetMutateAsync).toHaveBeenCalledWith({
      period: "week",
      sourceStartDate: "2026-06-07",
      budgets: [
        { sourceBudgetId: 1, amount: 200_000 },
        { sourceBudgetId: 2, amount: 1_000_000 },
      ],
    });
    expect(toastMocks.success).toHaveBeenCalledWith(
      "2 budgets cloned to next week."
    );
    expect(
      screen.getByRole("option", { name: "14 Jun - 20 Jun", selected: true })
    ).toBeInTheDocument();
  });

  it("clones with edited budget amounts from the preview drawer", async () => {
    const user = userEvent.setup();
    queryMocks.useSuspenseQuery.mockReturnValue({
      data: overviewWithBudgets,
      error: null,
      isError: false,
      refetch: queryMocks.refetchOverview,
    });
    mutationMocks.cloneBudgetMutateAsync.mockResolvedValue({
      period: "week",
      sourceStartDate: "2026-06-07",
      sourceEndDate: "2026-06-13",
      targetStartDate: "2026-06-14",
      targetEndDate: "2026-06-20",
      sourceCount: 2,
      createdCount: 2,
      skippedCount: 0,
      createdBudgetIds: [10, 11],
    });

    render(<BudgetWeeklyBudgetsClient weekStartDate="2026-06-07" />);

    await user.click(
      screen.getByRole("button", { name: "Clone to next week" })
    );
    const preview = screen.getByTestId("clone-preview-drawer");
    await user.click(
      within(preview).getByRole("button", { name: /budget: groceries/i })
    );
    const amountInput = screen.getByLabelText("Clone amount");
    await user.clear(amountInput);
    await user.type(amountInput, "1500000");
    await user.click(screen.getByRole("button", { name: "Confirm clone" }));

    expect(mutationMocks.cloneBudgetMutateAsync).toHaveBeenCalledWith({
      period: "week",
      sourceStartDate: "2026-06-07",
      budgets: [
        { sourceBudgetId: 1, amount: 200_000 },
        { sourceBudgetId: 2, amount: 1_500_000 },
      ],
    });
  });

  it("shows skipped count after weekly clone conflicts", async () => {
    const user = userEvent.setup();
    queryMocks.useSuspenseQuery.mockReturnValue({
      data: overviewWithBudgets,
      error: null,
      isError: false,
      refetch: queryMocks.refetchOverview,
    });
    mutationMocks.cloneBudgetMutateAsync.mockResolvedValue({
      period: "week",
      sourceStartDate: "2026-06-07",
      sourceEndDate: "2026-06-13",
      targetStartDate: "2026-06-14",
      targetEndDate: "2026-06-20",
      sourceCount: 2,
      createdCount: 1,
      skippedCount: 1,
      createdBudgetIds: [10],
    });

    render(<BudgetWeeklyBudgetsClient weekStartDate="2026-06-07" />);
    await user.click(
      screen.getByRole("button", { name: "Clone to next week" })
    );
    await user.click(screen.getByRole("button", { name: "Confirm clone" }));

    expect(toastMocks.success).toHaveBeenCalledWith(
      "1 budget cloned to next week. 1 already existed."
    );
  });

  it("clones a selected monthly group and switches to the target month", async () => {
    const user = userEvent.setup();
    queryMocks.useSuspenseQuery.mockReturnValue({
      data: overviewWithBudgets,
      error: null,
      isError: false,
      refetch: queryMocks.refetchOverview,
    });
    mutationMocks.cloneBudgetMutateAsync.mockResolvedValue({
      period: "month",
      sourceStartDate: "2020-01-01",
      sourceEndDate: "2020-01-31",
      targetStartDate: "2020-02-01",
      targetEndDate: "2020-02-29",
      sourceCount: 1,
      createdCount: 1,
      skippedCount: 0,
      createdBudgetIds: [30],
    });

    render(<BudgetWeeklyBudgetsClient weekStartDate="2026-06-07" />);
    await user.click(screen.getByRole("option", { name: "Monthly" }));
    await user.click(screen.getByRole("option", { name: "Jan 2020" }));
    await user.click(
      screen.getByRole("button", { name: "Clone to next month" })
    );
    await user.click(screen.getByRole("button", { name: "Confirm clone" }));

    expect(mutationMocks.cloneBudgetMutateAsync).toHaveBeenCalledWith({
      period: "month",
      sourceStartDate: "2020-01-01",
      budgets: [{ sourceBudgetId: 3, amount: 4_000_000 }],
    });
    expect(toastMocks.success).toHaveBeenCalledWith(
      "1 budget cloned to next month."
    );
    expect(
      screen.getByRole("option", { name: "Feb 2020" })
    ).toBeInTheDocument();
  });

  it("does not show clone action on custom tab", async () => {
    const user = userEvent.setup();
    queryMocks.useSuspenseQuery.mockReturnValue({
      data: overviewWithBudgets,
      error: null,
      isError: false,
      refetch: queryMocks.refetchOverview,
    });

    render(<BudgetWeeklyBudgetsClient weekStartDate="2026-06-07" />);
    await user.click(screen.getByRole("option", { name: "Custom" }));

    expect(
      screen.queryByRole("button", { name: /clone to next/i })
    ).not.toBeInTheDocument();
  });

  it("leaves period unchanged and shows an error toast when clone fails", async () => {
    const user = userEvent.setup();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    queryMocks.useSuspenseQuery.mockReturnValue({
      data: overviewWithBudgets,
      error: null,
      isError: false,
      refetch: queryMocks.refetchOverview,
    });
    mutationMocks.cloneBudgetMutateAsync.mockRejectedValue(
      new Error("Failed to clone budgets")
    );

    render(<BudgetWeeklyBudgetsClient weekStartDate="2026-06-07" />);
    await user.click(
      screen.getByRole("button", { name: "Clone to next week" })
    );
    await user.click(screen.getByRole("button", { name: "Confirm clone" }));

    expect(toastMocks.error).toHaveBeenCalledWith("Failed to clone budgets.");
    expect(
      screen.getByRole("option", { name: "07 Jun - 13 Jun", selected: true })
    ).toBeInTheDocument();
    consoleError.mockRestore();
  });
});
