import React, { type ReactNode } from "react";

import { Category } from "@/enums";
import type { BudgetListItem } from "@/types/budget-weekly";
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
      within(drawer).getByRole("heading", { name: "Preview budget clone" })
    ).toBeInTheDocument();
    expect(within(drawer).getByText("07 Jun - 13 Jun")).toBeInTheDocument();
    expect(within(drawer).getByText("14 Jun - 20 Jun")).toBeInTheDocument();
    expect(within(drawer).getByText("Coffee")).toBeInTheDocument();
    expect(within(drawer).getByText("Already exists")).toBeInTheDocument();
    expect(within(drawer).getByText("Groceries")).toBeInTheDocument();
    expect(within(drawer).getByText("Will clone")).toBeInTheDocument();
    expect(within(drawer).getByText("1 to clone")).toBeInTheDocument();
    expect(within(drawer).getByText("1 already exists")).toBeInTheDocument();
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
    expect(onConfirm).toHaveBeenCalledTimes(1);
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
