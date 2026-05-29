import React from "react";

import { Category } from "@/enums";
import type { BudgetListItem } from "@/types/budget-weekly";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import BudgetFormDrawer from "./BudgetFormDrawer";

const mutationMocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/mutations", () => ({
  useCreateBudgetMutation: () => ({ mutateAsync: mutationMocks.create }),
  useUpdateBudgetMutation: () => ({ mutateAsync: mutationMocks.update }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

const groceryBudget = (): BudgetListItem => ({
  id: 7,
  name: "Groceries",
  icon: "🛒",
  color: "emerald",
  category: Category.FOOD,
  amount: 500_000,
  spent: 120_000,
  remaining: 380_000,
  period: "week",
  periodStartDate: "2026-05-04",
  periodEndDate: null,
});

beforeEach(() => {
  mutationMocks.create.mockReset().mockResolvedValue(undefined);
  mutationMocks.update.mockReset().mockResolvedValue(undefined);
  toastSuccess.mockReset();
  toastError.mockReset();
});

describe("BudgetFormDrawer", () => {
  it("shows create defaults and disables submit until valid", () => {
    render(
      <BudgetFormDrawer
        open
        onOpenChange={vi.fn()}
        budget={null}
        weekStartDate="2026-05-11"
        onMoveFunds={vi.fn()}
      />
    );

    expect(
      screen.getByRole("heading", { name: /new budget/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create budget/i })
    ).toBeDisabled();
  });

  it("submits a create payload and closes on success", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <BudgetFormDrawer
        open
        onOpenChange={onOpenChange}
        budget={null}
        weekStartDate="2026-05-11"
        onMoveFunds={vi.fn()}
      />
    );

    await user.type(screen.getByLabelText(/budget name/i), "Coffee");
    await user.type(screen.getByLabelText(/amount/i), "200000");
    await user.click(screen.getByRole("button", { name: /create budget/i }));

    expect(mutationMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Coffee", amount: 200_000 })
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("prefills name and amount in edit mode", () => {
    render(
      <BudgetFormDrawer
        open
        onOpenChange={vi.fn()}
        budget={groceryBudget()}
        weekStartDate="2026-05-11"
        onMoveFunds={vi.fn()}
      />
    );

    expect(
      screen.getByRole("heading", { name: /edit budget/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/budget name/i)).toHaveValue("Groceries");
    expect(screen.getByRole("button", { name: /save changes/i })).toBeEnabled();
  });

  it("invokes onMoveFunds and closes from the edit link", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onMoveFunds = vi.fn();
    const budget = groceryBudget();

    render(
      <BudgetFormDrawer
        open
        onOpenChange={onOpenChange}
        budget={budget}
        weekStartDate="2026-05-11"
        onMoveFunds={onMoveFunds}
      />
    );

    await user.click(
      screen.getByRole("button", { name: /move from another budget/i })
    );

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onMoveFunds).toHaveBeenCalledWith(budget);
  });

  it("renders the category picker defaulting to Other", () => {
    render(
      <BudgetFormDrawer
        open
        onOpenChange={vi.fn()}
        budget={null}
        weekStartDate="2026-05-11"
        onMoveFunds={vi.fn()}
      />
    );
    const group = screen.getByRole("radiogroup", { name: "Category" });
    expect(group).toBeInTheDocument();
    expect(within(group).getByText("Other")).toBeInTheDocument();
  });

  it("changes category selection when a different chip is picked", async () => {
    const user = userEvent.setup();

    render(
      <BudgetFormDrawer
        open
        onOpenChange={vi.fn()}
        budget={null}
        weekStartDate="2026-05-11"
        onMoveFunds={vi.fn()}
      />
    );

    const group = screen.getByRole("radiogroup", { name: "Category" });

    // Collapsed by default — only the active "Other" chip is visible
    const otherChip = within(group).getByRole("button", { name: /other/i });
    expect(otherChip).toHaveAttribute("aria-pressed", "true");

    // First click expands the full list
    await user.click(otherChip);

    // Second click selects "Food"
    await user.click(within(group).getByRole("button", { name: /^food$/i }));

    // After selection the picker collapses; the active chip now shows "Food"
    const foodChip = within(group).getByRole("button", { name: /^food$/i });
    expect(foodChip).toHaveAttribute("aria-pressed", "true");
  });
});
