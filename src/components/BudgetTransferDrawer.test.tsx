import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import BudgetTransferDrawer from "./BudgetTransferDrawer";
import type { BudgetListItem } from "@/types/budget-weekly";

const transferMock = vi.fn();

vi.mock("@/app/actions/budget-weekly-actions", () => ({
  transferBudgetAmount: (...args: unknown[]) => transferMock(...args),
}));

const invalidateQueriesMock = vi.fn();
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: (...args: unknown[]) => invalidateQueriesMock(...args),
  }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

const makeBudget = (overrides: Partial<BudgetListItem> = {}): BudgetListItem => ({
  id: 1,
  name: "Groceries",
  amount: 100_000,
  spent: 0,
  remaining: 100_000,
  period: "week",
  periodStartDate: "2026-04-27",
  periodEndDate: null,
  ...overrides,
});

beforeEach(() => {
  transferMock.mockReset();
  invalidateQueriesMock.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
});

describe("BudgetTransferDrawer", () => {
  it("disables submit until a source is picked and amount is valid", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const destination = makeBudget({ id: 1, name: "Groceries", amount: 100_000 });
    const source = makeBudget({ id: 2, name: "Dining", amount: 200_000 });

    render(
      <BudgetTransferDrawer
        open
        onOpenChange={() => {}}
        destination={destination}
        budgets={[destination, source]}
      />
    );

    expect(screen.getByRole("button", { name: /move funds/i })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /select source budget/i }));
    fireEvent.click(screen.getByRole("button", { name: /Dining/i }));

    expect(screen.getByRole("button", { name: /move funds/i, hidden: true })).toBeDisabled();

    await user.type(screen.getByLabelText(/amount/i), "30000");

    expect(screen.getByRole("button", { name: /move funds/i, hidden: true })).not.toBeDisabled();
  });

  it("excludes the destination from the source picker", async () => {
    const destination = makeBudget({ id: 1, name: "Groceries" });
    const source = makeBudget({ id: 2, name: "Dining" });

    render(
      <BudgetTransferDrawer
        open
        onOpenChange={() => {}}
        destination={destination}
        budgets={[destination, source]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /select source budget/i }));

    const list = screen.getByRole("list", { name: /source budgets/i });
    expect(within(list).queryByText(/Groceries/i)).toBeNull();
    expect(within(list).getByText(/Dining/i)).toBeInTheDocument();
  });

  it("renders zero-cap source as disabled", async () => {
    const destination = makeBudget({ id: 1 });
    const empty = makeBudget({ id: 2, name: "Empty", amount: 0, remaining: 0 });

    render(
      <BudgetTransferDrawer
        open
        onOpenChange={() => {}}
        destination={destination}
        budgets={[destination, empty]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /select source budget/i }));
    expect(screen.getByRole("button", { name: /Empty/i })).toBeDisabled();
  });

  it("shows warning banner and flips submit label when source goes below spent", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const destination = makeBudget({ id: 1 });
    const source = makeBudget({ id: 2, name: "Travel", amount: 100_000, spent: 80_000, remaining: 20_000 });

    render(
      <BudgetTransferDrawer
        open
        onOpenChange={() => {}}
        destination={destination}
        budgets={[destination, source]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /select source budget/i }));
    fireEvent.click(screen.getByRole("button", { name: /Travel/i }));
    await user.type(screen.getByLabelText(/amount/i), "50000");

    expect(screen.getByText(/will go .* over budget/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /move funds anyway/i, hidden: true })
    ).toBeInTheDocument();
  });

  it("shows empty state when no other budgets exist", () => {
    const destination = makeBudget({ id: 1 });
    render(
      <BudgetTransferDrawer
        open
        onOpenChange={() => {}}
        destination={destination}
        budgets={[destination]}
      />
    );
    expect(screen.getByText(/no other budgets to pull from/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /move funds/i })).toBeNull();
  });

  it("disables submit when amount exceeds source.amount", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const destination = makeBudget({ id: 1 });
    const source = makeBudget({ id: 2, name: "Snacks", amount: 20_000 });

    render(
      <BudgetTransferDrawer
        open
        onOpenChange={() => {}}
        destination={destination}
        budgets={[destination, source]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /select source budget/i }));
    fireEvent.click(screen.getByRole("button", { name: /Snacks/i }));
    await user.type(screen.getByLabelText(/amount/i), "30000");

    expect(
      screen.getByRole("button", { name: /move funds/i, hidden: true })
    ).toBeDisabled();
    expect(screen.getByText(/cannot move more than/i)).toBeInTheDocument();
  });

  it("on success: invalidates overview + both transaction caches, toasts success, closes drawer", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    transferMock.mockResolvedValue({ ok: true });
    const onOpenChange = vi.fn();
    const destination = makeBudget({ id: 1, name: "Groceries" });
    const source = makeBudget({ id: 2, name: "Dining", amount: 200_000 });

    render(
      <BudgetTransferDrawer
        open
        onOpenChange={onOpenChange}
        destination={destination}
        budgets={[destination, source]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /select source budget/i }));
    fireEvent.click(screen.getByRole("button", { name: /Dining/i }));
    await user.type(screen.getByLabelText(/amount/i), "30000");
    await user.click(screen.getByRole("button", { name: /^move funds$/i, hidden: true }));

    expect(transferMock).toHaveBeenCalledWith({
      fromBudgetId: 2,
      toBudgetId: 1,
      amount: 30_000,
    });
    expect(toastSuccess).toHaveBeenCalledWith("Funds moved.");
    expect(invalidateQueriesMock).toHaveBeenCalledTimes(3);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("on INSUFFICIENT_CAP: shows specific toast and keeps drawer open", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    transferMock.mockResolvedValue({ ok: false, code: "INSUFFICIENT_CAP" });
    const onOpenChange = vi.fn();
    const destination = makeBudget({ id: 1 });
    const source = makeBudget({ id: 2, name: "Dining", amount: 200_000 });

    render(
      <BudgetTransferDrawer
        open
        onOpenChange={onOpenChange}
        destination={destination}
        budgets={[destination, source]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /select source budget/i }));
    fireEvent.click(screen.getByRole("button", { name: /Dining/i }));
    await user.type(screen.getByLabelText(/amount/i), "30000");
    await user.click(screen.getByRole("button", { name: /^move funds$/i, hidden: true }));

    expect(toastError).toHaveBeenCalledWith(
      "That budget no longer has enough to move. Try a smaller amount."
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("on NOT_FOUND: shows specific toast and keeps drawer open", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    transferMock.mockResolvedValue({ ok: false, code: "NOT_FOUND" });
    const onOpenChange = vi.fn();
    const destination = makeBudget({ id: 1 });
    const source = makeBudget({ id: 2, name: "Dining", amount: 200_000 });

    render(
      <BudgetTransferDrawer
        open
        onOpenChange={onOpenChange}
        destination={destination}
        budgets={[destination, source]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /select source budget/i }));
    fireEvent.click(screen.getByRole("button", { name: /Dining/i }));
    await user.type(screen.getByLabelText(/amount/i), "30000");
    await user.click(screen.getByRole("button", { name: /^move funds$/i, hidden: true }));

    expect(toastError).toHaveBeenCalledWith("Source budget no longer exists.");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
