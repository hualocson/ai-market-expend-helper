import React from "react";

import {
  createExpenseEntry,
  updateExpenseEntry,
} from "@/app/actions/expense-actions";
import { PaidBy } from "@/enums";
import { dispatchExpensePrefill } from "@/lib/expense-prefill";
import type { BudgetWeeklyOption } from "@/lib/queries/budget-weekly";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsStoreProvider } from "@/components/providers/StoreProvider";

import QuickExpenseSheet, {
  type TQuickExpenseSheetProps,
} from "./QuickExpenseSheet";

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/app/actions/expense-actions", () => ({
  createExpenseEntry: vi.fn().mockResolvedValue({ id: 1 }),
  updateExpenseEntry: vi.fn().mockResolvedValue({ id: 1 }),
}));

vi.mock("sonner", () => ({
  toast: toastMock,
}));

const weeklyBudgetOptionsMock = vi.hoisted(() =>
  vi
    .fn<
      (weekStart: string, targetDate?: string) => Promise<BudgetWeeklyOption[]>
    >()
    .mockResolvedValue([])
);

vi.mock("@/lib/queries", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/queries")>("@/lib/queries");
  const options = Object.assign(
    (weekStart: string, targetDate?: string) => ({
      queryKey: ["budgetWeekly", "options", weekStart, targetDate],
      queryFn: () => weeklyBudgetOptionsMock(weekStart, targetDate),
    }),
    { _def: ["budgetWeekly", "options"] }
  );

  return {
    ...actual,
    queries: {
      ...actual.queries,
      budgetWeekly: {
        ...actual.queries.budgetWeekly,
        options,
      },
    },
  };
});

vi.mock("@/components/ui/date-picker", () => ({
  default: ({ onChange }: { onChange?: (date: Date | undefined) => void }) => (
    <button type="button" onClick={() => onChange?.(new Date(2026, 4, 20))}>
      Pick mocked date
    </button>
  ),
}));

const originalGlobalReact = (globalThis as unknown as Record<string, unknown>)
  .React;

const budgetOption = (
  override: Partial<BudgetWeeklyOption> = {}
): BudgetWeeklyOption => ({
  id: 1,
  name: "Food week",
  period: "week",
  periodStartDate: "2026-05-17",
  periodEndDate: "2026-05-23",
  amount: 100000,
  spent: 0,
  remaining: 100000,
  ...override,
});

const savedExpense = (id: number) => ({
  id,
  date: "2026-05-20",
  amount: 1,
  note: "",
  category: "Food",
  paidBy: PaidBy.OTHER,
  createdAt: new Date("2026-05-20T00:00:00.000Z"),
  updatedAt: new Date("2026-05-20T00:00:00.000Z"),
  isDeleted: false,
  deletedAt: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createExpenseEntry).mockResolvedValue(savedExpense(1));
  vi.mocked(updateExpenseEntry).mockResolvedValue(savedExpense(1));
  weeklyBudgetOptionsMock.mockResolvedValue([]);
});

afterEach(() => {
  if (typeof originalGlobalReact === "undefined") {
    Reflect.deleteProperty(globalThis, "React");
  } else {
    (globalThis as unknown as Record<string, unknown>).React =
      originalGlobalReact;
  }
});

const renderSheet = (props: Partial<TQuickExpenseSheetProps> = {}) => {
  (globalThis as unknown as Record<string, unknown>).React = React;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SettingsStoreProvider>
        <QuickExpenseSheet {...props} />
      </SettingsStoreProvider>
    </QueryClientProvider>
  );
};

describe("QuickExpenseSheet — open/close", () => {
  it("opens when the trigger is clicked and focuses the note input", async () => {
    const user = userEvent.setup();
    renderSheet();

    expect(
      screen.queryByPlaceholderText(/what did you spend on/i)
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /add expense/i }));

    const note = await screen.findByPlaceholderText(/what did you spend on/i);
    await waitFor(() => expect(note).toHaveFocus());
  });
});

describe("QuickExpenseSheet — fields", () => {
  const openSheet = async () => {
    const user = userEvent.setup();
    renderSheet();
    await user.click(screen.getByRole("button", { name: /add expense/i }));
    return user;
  };

  it("renders the date / budget / paid-by trigger buttons", async () => {
    await openSheet();
    expect(screen.getByRole("button", { name: /^date:/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^budget:/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^paid by:/i })
    ).toBeInTheDocument();
  });

  it("shows suggestion chips when amount > 0", async () => {
    const user = await openSheet();
    const amount = screen.getByPlaceholderText("0");
    await user.click(amount);
    await user.keyboard("5");
    expect(screen.getByRole("button", { name: /50$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /500$/ })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /5[.,]?000$/ })
    ).toBeInTheDocument();
  });

  it("applies a suggestion chip to the amount input", async () => {
    const user = await openSheet();
    const amount = screen.getByPlaceholderText("0") as HTMLInputElement;
    await user.click(amount);
    await user.keyboard("5");
    await user.click(screen.getByRole("button", { name: /5[.,]?000$/ }));
    expect(amount.value).toMatch(/5[.,]?000/);
  });

  it("renders the collapsed category chip row and expands then toggles active chip", async () => {
    const user = await openSheet();
    const foodChip = screen.getByRole("button", {
      name: /food/i,
      pressed: true,
    });
    expect(foodChip).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /transport/i })
    ).not.toBeInTheDocument();

    await user.click(foodChip);
    await user.click(screen.getByRole("button", { name: /transport/i }));

    expect(
      screen.getByRole("button", { name: /transport/i, pressed: true })
    ).toBeInTheDocument();
  });
});

describe("QuickExpenseSheet — submit", () => {
  const openSheet = async () => {
    const user = userEvent.setup();
    renderSheet();
    await user.click(screen.getByRole("button", { name: /add expense/i }));
    return user;
  };

  it("disables submit when amount is zero", async () => {
    await openSheet();
    expect(
      screen.getByRole("button", { name: /save expense/i })
    ).toBeDisabled();
  });

  it("calls createExpenseEntry with the full draft on submit", async () => {
    const user = await openSheet();
    const amount = screen.getByPlaceholderText("0");
    await user.click(amount);
    await user.keyboard("12000");
    await user.click(screen.getByRole("button", { name: /save expense/i }));

    await waitFor(() => {
      expect(createExpenseEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 12000,
          note: "",
          category: "Food",
          paidBy: expect.any(String),
        })
      );
    });
  });

  it("clears a selected budget when the changed date no longer includes it", async () => {
    const user = userEvent.setup();
    weeklyBudgetOptionsMock.mockImplementation(
      async (_weekStart, targetDate) => {
        if (targetDate === "2026-05-20") {
          return [budgetOption({ id: 2, name: "Transport week" })];
        }
        return [budgetOption({ id: 1, name: "Food week" })];
      }
    );
    renderSheet();
    await user.click(screen.getByRole("button", { name: /add expense/i }));

    await user.click(screen.getByRole("button", { name: /^budget:/i }));
    await user.click(await screen.findByRole("button", { name: /food week/i }));
    expect(
      screen.getByRole("button", { name: /budget: selected/i })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^date:/i }));
    await user.click(
      await screen.findByRole("button", { name: /pick mocked date/i })
    );

    await waitFor(() =>
      expect(weeklyBudgetOptionsMock).toHaveBeenCalledWith(
        expect.any(String),
        "2026-05-20"
      )
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /budget: no budget/i })
      ).toBeInTheDocument()
    );

    await user.click(screen.getByPlaceholderText("0"));
    await user.keyboard("12000");
    await user.click(screen.getByRole("button", { name: /save expense/i }));

    await waitFor(() => {
      expect(createExpenseEntry).toHaveBeenCalledWith(
        expect.objectContaining({ budgetId: null })
      );
    });
  });

  it("closes the sheet after successful submit", async () => {
    const user = await openSheet();
    await user.click(screen.getByPlaceholderText("0"));
    await user.keyboard("5000");
    await user.click(screen.getByRole("button", { name: /save expense/i }));

    await waitFor(() =>
      expect(
        screen.queryByPlaceholderText(/what did you spend on/i)
      ).not.toBeInTheDocument()
    );
  });
});

describe("QuickExpenseSheet — edit mode", () => {
  const editExpense = {
    date: "2026-05-20",
    amount: 150000,
    note: "Badminton court",
    category: "Badminton",
    paidBy: "Embe",
    budgetId: 2,
  };

  const renderEditSheet = (props: Partial<TQuickExpenseSheetProps> = {}) => {
    const onOpenChange = vi.fn();
    const onSuccess = vi.fn();
    renderSheet({
      mode: "edit",
      open: true,
      onOpenChange,
      showTrigger: false,
      transactionId: 42,
      initialExpense: editExpense,
      onSuccess,
      ...props,
    });
    return { onOpenChange, onSuccess };
  };

  it("prepopulates the existing transaction fields", async () => {
    weeklyBudgetOptionsMock.mockResolvedValue([
      budgetOption({ id: 2, name: "Sports week" }),
    ]);

    renderEditSheet();

    expect(
      await screen.findByPlaceholderText(/what did you spend on/i)
    ).toHaveValue("Badminton court");
    expect(
      (screen.getByPlaceholderText("0") as HTMLInputElement).value
    ).toMatch(/150[.,]?000/);
    expect(
      screen.getByRole("button", { name: /date: 20\/05/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /paid by: embe/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /badminton/i, pressed: true })
    ).toBeInTheDocument();
    expect(await screen.findByText("Sports week")).toBeInTheDocument();
  });

  it("calls updateExpenseEntry instead of createExpenseEntry", async () => {
    const user = userEvent.setup();
    weeklyBudgetOptionsMock.mockResolvedValue([
      budgetOption({ id: 2, name: "Sports week" }),
    ]);
    const { onOpenChange, onSuccess } = renderEditSheet();

    await user.click(screen.getByRole("button", { name: /update expense/i }));

    await waitFor(() => {
      expect(updateExpenseEntry).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          date: "20/05/2026",
          amount: 150000,
          note: "Badminton court",
          category: "Badminton",
          paidBy: "Embe",
          budgetId: 2,
        })
      );
    });
    expect(createExpenseEntry).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSuccess).toHaveBeenCalled();
  });

  it("does not submit edit mode without a transaction id", async () => {
    const user = userEvent.setup();
    renderEditSheet({ transactionId: undefined });

    await user.click(screen.getByRole("button", { name: /update expense/i }));

    expect(updateExpenseEntry).not.toHaveBeenCalled();
    expect(toastMock.error).toHaveBeenCalledWith("Failed to update expense");
  });
});

describe("QuickExpenseSheet — prefill", () => {
  it("opens and populates fields when EXPENSE_PREFILL_EVENT fires", async () => {
    renderSheet();
    expect(
      screen.queryByPlaceholderText(/what did you spend on/i)
    ).not.toBeInTheDocument();

    act(() => {
      dispatchExpensePrefill({
        amount: 25000,
        note: "Lunch",
        category: "Food",
      });
    });

    const note = await screen.findByPlaceholderText(/what did you spend on/i);
    expect(note).toHaveValue("Lunch");
    const amount = screen.getByPlaceholderText("0") as HTMLInputElement;
    expect(amount.value).toMatch(/25[.,]?000/);
  });
});
