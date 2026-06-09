import React, { type ReactNode } from "react";

import { Category } from "@/enums";
import type {
  BudgetCloneNextPeriodInput,
  BudgetListItem,
} from "@/types/budget-weekly";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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
    DrawerContent: ({
      children,
      className,
    }: {
      children: ReactNode;
      className?: string;
    }) => {
      const drawer = React.useContext(DrawerContext);

      if (!drawer.open) {
        return (
          <div
            data-testid="clone-preview-drawer-placeholder"
            className={className}
            hidden
          >
            {children}
          </div>
        );
      }

      return (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="clone-preview-drawer"
          className={className}
        >
          {children}
        </div>
      );
    },
    DrawerDescription: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    DrawerFooter: ({
      children,
      className,
    }: {
      children: ReactNode;
      className?: string;
    }) => (
      <div data-testid="clone-preview-drawer-footer" className={className}>
        {children}
      </div>
    ),
    DrawerHeader: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    DrawerTitle: ({
      children,
      className,
    }: {
      children: ReactNode;
      className?: string;
    }) => <h2 className={className}>{children}</h2>,
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
    ).toHaveClass("text-left");
    expect(drawer).toHaveClass(
      "quick-expense-drawer-morph",
      "h-dvh",
      "rounded-none!"
    );
    expect(
      within(drawer).queryByRole("button", { name: "Close clone drawer" })
    ).not.toBeInTheDocument();
    expect(
      within(drawer).queryByRole("button", { name: "Cancel clone" })
    ).not.toBeInTheDocument();
    expect(within(drawer).getByTestId("clone-preview-header")).toHaveClass(
      "px-4",
      "pb-3"
    );
    expect(within(drawer).getByTestId("clone-preview-header")).not.toHaveClass(
      "pt-6"
    );
    expect(within(drawer).getByText("07 Jun - 13 Jun")).toBeInTheDocument();
    expect(within(drawer).getByText("14 Jun - 20 Jun")).toBeInTheDocument();
    expect(within(drawer).getByText("Coffee")).toBeInTheDocument();
    expect(within(drawer).getByText("Exists")).toBeInTheDocument();
    expect(within(drawer).getAllByText("Groceries").length).toBeGreaterThan(0);
    expect(within(drawer).getByLabelText("Clone amount")).toHaveValue(
      "1.000.000"
    );
    expect(within(drawer).getByLabelText("Clone amount")).toHaveClass(
      "text-4xl",
      "font-semibold",
      "tracking-tight"
    );
    expect(
      Array.from(drawer.querySelectorAll("div")).some((element) =>
        element.classList.contains("bg-card/80")
      )
    ).toBe(false);

    const scrollList = within(drawer).getByTestId("clone-budget-scroll-list");
    expect(scrollList).toHaveClass("snap-x", "snap-mandatory", "scroll-px-4");

    const selectedBudgetButton = within(drawer).getByRole("button", {
      name: /groceries/i,
    });
    expect(selectedBudgetButton).toHaveClass(
      "w-[65svw]",
      "min-w-[65svw]",
      "snap-start"
    );
    expect(selectedBudgetButton).toHaveClass("bg-emerald-400/14");
    expect(
      within(selectedBudgetButton).getByLabelText("Vietnamese dong")
    ).toBeInTheDocument();

    const footer = within(drawer).getByTestId("clone-preview-drawer-footer");
    expect(footer).toHaveClass("flex-row", "gap-3");
    const footerButtons = within(footer).getAllByRole("button");
    expect(footerButtons.map((button) => button.textContent)).toEqual([
      "Cancel",
      "Confirm clone",
    ]);
    expect(
      within(footer).getByRole("button", { name: "Confirm clone" })
    ).toHaveClass("flex-1");
    expect(within(footer).getByRole("button", { name: "Cancel" })).toHaveClass(
      "flex-1"
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

  it("scrolls the selected budget to the left of the horizontal list", async () => {
    const user = userEvent.setup();
    const scrollTo = vi.fn();

    render(
      <BudgetClonePreviewDrawer
        preview={{
          ...preview,
          budgets: [
            ...preview.budgets,
            budget({
              id: 3,
              name: "Travel",
              amount: 750_000,
              color: "sky",
            }),
          ],
        }}
        isPending={false}
        onOpenChange={vi.fn()}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    const list = screen.getByTestId("clone-budget-scroll-list");
    const travelButton = screen.getByRole("button", { name: /travel/i });

    Object.defineProperty(list, "scrollLeft", {
      configurable: true,
      value: 24,
      writable: true,
    });
    Object.defineProperty(list, "scrollTo", {
      configurable: true,
      value: scrollTo,
    });

    vi.spyOn(list, "getBoundingClientRect").mockReturnValue({
      left: 20,
    } as DOMRect);
    const getComputedStyleSpy = vi
      .spyOn(window, "getComputedStyle")
      .mockReturnValue({
        paddingLeft: "16px",
      } as CSSStyleDeclaration);
    vi.spyOn(travelButton, "getBoundingClientRect").mockReturnValue({
      left: 190,
    } as DOMRect);

    await user.click(travelButton);

    await waitFor(() => {
      expect(scrollTo).toHaveBeenCalledWith({
        behavior: "smooth",
        left: 178,
      });
    });

    getComputedStyleSpy.mockRestore();
  });

  it("focuses the amount input when selecting a budget", async () => {
    const user = userEvent.setup();

    render(
      <BudgetClonePreviewDrawer
        preview={{
          ...preview,
          budgets: [
            ...preview.budgets,
            budget({
              id: 3,
              name: "Travel",
              amount: 750_000,
              color: "sky",
            }),
          ],
        }}
        isPending={false}
        onOpenChange={vi.fn()}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    const amountInput = screen.getByLabelText("Clone amount");

    expect(amountInput).not.toHaveFocus();

    await user.click(screen.getByRole("button", { name: /travel/i }));

    await waitFor(() => {
      expect(amountInput).toHaveFocus();
    });
  });

  it("selects the nearest budget when the horizontal list is scrolled", async () => {
    vi.useFakeTimers();
    let getComputedStyleSpy:
      | ReturnType<typeof vi.spyOn<typeof window, "getComputedStyle">>
      | undefined;

    try {
      render(
        <BudgetClonePreviewDrawer
          preview={{
            ...preview,
            budgets: [
              ...preview.budgets,
              budget({
                id: 3,
                name: "Travel",
                amount: 750_000,
                color: "sky",
              }),
            ],
          }}
          isPending={false}
          onOpenChange={vi.fn()}
          onCancel={vi.fn()}
          onConfirm={vi.fn()}
        />
      );

      const list = screen.getByTestId("clone-budget-scroll-list");
      const groceriesButton = screen.getByRole("button", {
        name: /groceries/i,
      });
      const travelButton = screen.getByRole("button", { name: /travel/i });
      const amountInput = screen.getByLabelText("Clone amount");

      getComputedStyleSpy = vi
        .spyOn(window, "getComputedStyle")
        .mockReturnValue({
          paddingLeft: "16px",
        } as CSSStyleDeclaration);

      vi.spyOn(list, "getBoundingClientRect").mockReturnValue({
        left: 20,
      } as DOMRect);
      vi.spyOn(groceriesButton, "getBoundingClientRect").mockReturnValue({
        left: 180,
      } as DOMRect);
      vi.spyOn(travelButton, "getBoundingClientRect").mockReturnValue({
        left: 38,
      } as DOMRect);

      act(() => {
        vi.advanceTimersByTime(400);
      });

      fireEvent.scroll(list);

      act(() => {
        vi.advanceTimersByTime(120);
      });

      expect(travelButton).toHaveAttribute("aria-pressed", "true");
      expect(amountInput).toHaveValue("750.000");
    } finally {
      getComputedStyleSpy?.mockRestore();
      vi.useRealTimers();
    }
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
    expect(amountInput).toHaveValue("1.250.000");
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
    expect(screen.getByLabelText("Clone amount")).toHaveValue("1.000.000");
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

  it("normalizes a pasted negative amount like the quick expense amount input", async () => {
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

    const amountInput = screen.getByLabelText("Clone amount");
    await user.clear(amountInput);
    await user.paste("-100");

    expect(amountInput).toHaveValue("100");
    expect(amountInput).not.toHaveAttribute("aria-invalid");
    expect(
      screen.getByRole("button", { name: "Confirm clone" })
    ).not.toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Confirm clone" }));

    expect(onConfirm).toHaveBeenCalledWith({
      period: "week",
      sourceStartDate: "2026-06-07",
      budgets: [{ sourceBudgetId: 2, amount: 100 }],
    });
  });

  it("normalizes a pasted non-finite-looking amount", async () => {
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

    expect(amountInput).toHaveValue("1.309");
    expect(
      screen.getByRole("button", { name: "Confirm clone" })
    ).not.toBeDisabled();
  });

  it("keeps placeholder content mounted when there is no preview", () => {
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

    const placeholder = screen.getByTestId("clone-preview-drawer-placeholder");
    expect(placeholder).toHaveClass(
      "quick-expense-drawer-morph",
      "h-dvh",
      "rounded-none!"
    );
    expect(
      within(placeholder).getByText("No source period")
    ).toBeInTheDocument();
    expect(
      within(placeholder).getByText("No target period")
    ).toBeInTheDocument();
    expect(
      within(placeholder).getByText("No clone preview is available.")
    ).toBeInTheDocument();
  });
});
