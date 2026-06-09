import React, { type ReactNode } from "react";

import { Category } from "@/enums";
import type {
  BudgetCloneNextPeriodInput,
  BudgetListItem,
} from "@/types/budget-weekly";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import BudgetClonePreviewDrawer, {
  type BudgetClonePreview,
} from "./BudgetClonePreviewDrawer";

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

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

vi.mock("@/components/BudgetBadge", () => ({
  default: ({ name }: { name: string }) => <span>{name}</span>,
}));

vi.mock("@/components/ExpenseItemIcon", () => ({
  default: () => null,
}));

const budget = (overrides: Partial<BudgetListItem> = {}): BudgetListItem => ({
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
  ...overrides,
});

const preview: BudgetClonePreview = {
  period: "week",
  sourceStartDate: "2026-06-07",
  sourceLabel: "07 Jun - 13 Jun",
  targetLabel: "14 Jun - 20 Jun",
  targetNavigationKey: "2026-06-14",
  targetToastLabel: "next week",
  budgets: [
    budget(),
    budget({
      id: 2,
      name: "Groceries",
      amount: 1_000_000,
      color: "emerald",
    }),
  ],
  existingBudgetNames: new Set(["coffee"]),
};

describe("BudgetClonePreviewDrawer", () => {
  it("renders clone preview content in a drawer", () => {
    render(
      <BudgetClonePreviewDrawer
        preview={preview}
        isPending={false}
        onOpenChange={vi.fn()}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    const drawer = screen.getByTestId("clone-preview-drawer");
    expect(
      within(drawer).getByRole("heading", { name: "Clone budgets" })
    ).toBeInTheDocument();
    expect(within(drawer).getByText("07 Jun - 13 Jun")).toBeInTheDocument();
    expect(within(drawer).getByText("14 Jun - 20 Jun")).toBeInTheDocument();
    expect(within(drawer).getByText("Coffee")).toBeInTheDocument();
    expect(within(drawer).getByText("Exists")).toBeInTheDocument();
    expect(within(drawer).getAllByText("Groceries").length).toBeGreaterThan(0);
    expect(within(drawer).getByLabelText("Clone amount")).toHaveValue(
      "1000000"
    );
  });

  it("forwards cancel and confirm actions", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    render(
      <BudgetClonePreviewDrawer
        preview={preview}
        isPending={false}
        onOpenChange={vi.fn()}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Confirm clone" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith({
      period: "week",
      sourceStartDate: "2026-06-07",
      budgets: [{ sourceBudgetId: 2, amount: 1_000_000 }],
    });
  });

  it("edits the selected clone amount and submits cloneable budgets", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn<(input: BudgetCloneNextPeriodInput) => void>();

    render(
      <BudgetClonePreviewDrawer
        preview={preview}
        isPending={false}
        onOpenChange={vi.fn()}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />
    );

    await user.click(screen.getByRole("button", { name: /groceries/i }));
    const amountInput = screen.getByLabelText("Clone amount");
    await user.clear(amountInput);
    await user.type(amountInput, "1250000");
    await user.click(screen.getByRole("button", { name: "Confirm clone" }));

    expect(onConfirm).toHaveBeenCalledWith({
      period: "week",
      sourceStartDate: "2026-06-07",
      budgets: [{ sourceBudgetId: 2, amount: 1_250_000 }],
    });
  });

  it("submits default amounts when the user does not edit", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn<(input: BudgetCloneNextPeriodInput) => void>();

    render(
      <BudgetClonePreviewDrawer
        preview={preview}
        isPending={false}
        onOpenChange={vi.fn()}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />
    );

    await user.click(screen.getByRole("button", { name: "Confirm clone" }));

    expect(onConfirm).toHaveBeenCalledWith({
      period: "week",
      sourceStartDate: "2026-06-07",
      budgets: [{ sourceBudgetId: 2, amount: 1_000_000 }],
    });
  });

  it("keeps existing target budgets skipped and non-editable", () => {
    render(
      <BudgetClonePreviewDrawer
        preview={preview}
        isPending={false}
        onOpenChange={vi.fn()}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /coffee/i })).toBeDisabled();
    expect(screen.getByText("Exists")).toBeInTheDocument();
    expect(screen.getByLabelText("Clone amount")).toHaveValue("1000000");
  });

  it("disables confirm for an empty amount", async () => {
    const user = userEvent.setup();

    render(
      <BudgetClonePreviewDrawer
        preview={preview}
        isPending={false}
        onOpenChange={vi.fn()}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    const amountInput = screen.getByLabelText("Clone amount");
    await user.clear(amountInput);

    expect(
      screen.getByRole("button", { name: "Confirm clone" })
    ).toBeDisabled();
  });

  it("keeps a pasted negative amount invalid", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <BudgetClonePreviewDrawer
        preview={preview}
        isPending={false}
        onOpenChange={vi.fn()}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />
    );

    const amountInput = screen.getByLabelText("Clone amount");
    await user.clear(amountInput);
    await user.paste("-100");

    expect(amountInput).toHaveValue("-100");
    expect(amountInput).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Enter a valid clone amount.")).toHaveAttribute(
      "id",
      "clone-budget-amount-error"
    );
    expect(amountInput).toHaveAccessibleDescription(
      "Enter a valid clone amount."
    );
    expect(
      screen.getByRole("button", { name: "Confirm clone" })
    ).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Confirm clone" }));

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("keeps a pasted non-finite amount invalid", async () => {
    const user = userEvent.setup();

    render(
      <BudgetClonePreviewDrawer
        preview={preview}
        isPending={false}
        onOpenChange={vi.fn()}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    const amountInput = screen.getByLabelText("Clone amount");
    await user.clear(amountInput);
    await user.paste("1e309");

    expect(amountInput).toHaveValue("1e309");
    expect(
      screen.getByRole("button", { name: "Confirm clone" })
    ).toBeDisabled();
  });

  it("does not render content when there is no preview", () => {
    render(
      <BudgetClonePreviewDrawer
        preview={null}
        isPending={false}
        onOpenChange={vi.fn()}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(
      screen.queryByTestId("clone-preview-drawer")
    ).not.toBeInTheDocument();
  });
});
