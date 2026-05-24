import React from "react";

import { Category, PaidBy } from "@/enums";
import { dispatchExpensePrefill } from "@/lib/expense-prefill";
import type { BudgetWeeklyOption } from "@/lib/queries/budget-weekly";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsStoreProvider } from "@/components/providers/StoreProvider";

import QuickExpenseSheet, {
  type TQuickExpenseSheetProps,
} from "./QuickExpenseSheet";

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  loading: vi.fn(),
}));

const recoveryStoreMock = vi.hoisted(() => ({
  clear: vi.fn(),
}));

const mutationMocks = vi.hoisted(() => ({
  createMutateAsync: vi.fn(),
  updateMutateAsync: vi.fn(),
}));

vi.mock("@/stores/quick-expense-recovery-store", async () => {
  const actual = await vi.importActual<
    typeof import("@/stores/quick-expense-recovery-store")
  >("@/stores/quick-expense-recovery-store");

  return {
    ...actual,
    useQuickExpenseRecoveryStore: (selector: (state: unknown) => unknown) =>
      selector({
        clear: recoveryStoreMock.clear,
      }),
  };
});

vi.mock("@/lib/mutations", () => ({
  useCreateExpenseMutation: () => ({
    mutateAsync: mutationMocks.createMutateAsync,
  }),
  useUpdateExpenseMutation: () => ({
    mutateAsync: mutationMocks.updateMutateAsync,
  }),
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
const originalVisualViewport = window.visualViewport;
const originalInnerHeight = window.innerHeight;

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

beforeEach(() => {
  vi.clearAllMocks();
  toastMock.loading.mockReturnValue("loading-toast");
  mutationMocks.createMutateAsync.mockResolvedValue({
    clientId: "expense-client-1",
  });
  mutationMocks.updateMutateAsync.mockResolvedValue({
    clientId: "expense-client-1",
  });
  weeklyBudgetOptionsMock.mockResolvedValue([]);
});

afterEach(() => {
  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    value: originalVisualViewport,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: originalInnerHeight,
  });
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
  const renderWithProps = (nextProps: Partial<TQuickExpenseSheetProps>) => (
    <QueryClientProvider client={client}>
      <SettingsStoreProvider>
        <QuickExpenseSheet {...nextProps} />
      </SettingsStoreProvider>
    </QueryClientProvider>
  );
  const result = render(renderWithProps(props));

  return {
    ...result,
    rerenderSheet: (nextProps: Partial<TQuickExpenseSheetProps>) =>
      result.rerender(renderWithProps(nextProps)),
  };
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

  it("uses the quick expense morph entrance surface", async () => {
    const user = userEvent.setup();
    renderSheet();

    await user.click(screen.getByRole("button", { name: /add expense/i }));

    expect(await screen.findByRole("dialog")).toHaveClass(
      "quick-expense-sheet-morph"
    );
  });

  it("uses the quick expense overlay class for the full-screen sheet", async () => {
    const user = userEvent.setup();
    renderSheet();

    await user.click(screen.getByRole("button", { name: /add expense/i }));

    await screen.findByRole("dialog");
    expect(document.querySelector('[data-slot="sheet-overlay"]')).toHaveClass(
      "quick-expense-sheet-overlay"
    );
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

  it("hides amount suggestions after applying a suggestion", async () => {
    const user = await openSheet();
    const amount = screen.getByPlaceholderText("0") as HTMLInputElement;
    await user.click(amount);
    await user.keyboard("5");
    await user.click(screen.getByRole("button", { name: /5[.,]?000$/ }));

    expect(amount.value).toMatch(/5[.,]?000/);
    expect(amount).not.toHaveFocus();
    expect(
      screen.queryByRole("group", { name: /amount suggestions/i })
    ).not.toBeInTheDocument();
  });

  it("hides amount suggestions when the amount input loses focus", async () => {
    const user = await openSheet();
    const amount = screen.getByPlaceholderText("0");
    await user.click(amount);
    await user.keyboard("5");
    expect(
      screen.getByRole("group", { name: /amount suggestions/i })
    ).toBeInTheDocument();

    await user.click(screen.getByPlaceholderText(/what did you spend on/i));

    expect(
      screen.queryByRole("group", { name: /amount suggestions/i })
    ).not.toBeInTheDocument();
  });

  it("positions amount suggestions above the software keyboard", async () => {
    const visualViewport = new EventTarget() as VisualViewport;
    Object.defineProperties(visualViewport, {
      height: { configurable: true, value: 544 },
      offsetTop: { configurable: true, value: 0 },
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 800,
    });
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: visualViewport,
    });

    const user = await openSheet();
    const amount = screen.getByPlaceholderText("0");
    await user.click(amount);
    act(() => {
      visualViewport.dispatchEvent(new Event("resize"));
    });
    await user.keyboard("5");

    const suggestions = screen.getByRole("group", {
      name: /amount suggestions/i,
    });

    expect(suggestions).toHaveClass("fixed");
    expect(suggestions).toHaveClass(
      "no-scrollbar",
      "flex-nowrap",
      "overflow-x-auto"
    );
    expect(suggestions).toHaveStyle({
      bottom: "calc(256px + env(safe-area-inset-bottom) + 8px)",
    });
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

  it("calls the local-first create mutation with the submitted draft and closes", async () => {
    const user = await openSheet();
    await user.type(
      screen.getByPlaceholderText(/what did you spend on/i),
      "Retry lunch"
    );
    const amount = screen.getByPlaceholderText("0");
    await user.click(amount);
    await user.keyboard("12000");
    await user.click(screen.getByRole("button", { name: /save expense/i }));

    await waitFor(() =>
      expect(mutationMocks.createMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 12000,
          note: "Retry lunch",
          date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          category: "Food",
          paidBy: expect.any(String),
          budgetId: null,
        })
      )
    );
    expect(
      screen.queryByPlaceholderText(/what did you spend on/i)
    ).not.toBeInTheDocument();
  });

  it("closes immediately after dispatching a local-first create", async () => {
    let resolveCreate: (value: { clientId: string }) => void = () => {};
    mutationMocks.createMutateAsync.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      })
    );
    const user = await openSheet();

    await user.click(screen.getByPlaceholderText("0"));
    await user.keyboard("12000");
    await user.click(screen.getByRole("button", { name: /save expense/i }));

    await waitFor(() =>
      expect(mutationMocks.createMutateAsync).toHaveBeenCalled()
    );
    expect(
      screen.queryByPlaceholderText(/what did you spend on/i)
    ).not.toBeInTheDocument();

    await act(async () => {
      resolveCreate({ clientId: "expense-client-1" });
    });
  });

  it("opens create mode with a recovery draft after rerender", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { rerenderSheet } = renderSheet({
      open: false,
      onOpenChange,
      showTrigger: false,
    });

    rerenderSheet({
      open: true,
      onOpenChange,
      showTrigger: false,
      recoveryDraft: {
        clientId: "expense-client-1",
        date: "20/05/2026",
        amount: 45000,
        note: "Recovered lunch",
        category: Category.FOOD,
        budgetId: null,
        paidBy: PaidBy.OTHER,
      },
    });

    expect(
      await screen.findByPlaceholderText(/what did you spend on/i)
    ).toHaveValue("Recovered lunch");
    expect(screen.getByPlaceholderText("0")).toHaveValue("45.000");

    await user.click(screen.getByRole("button", { name: /save expense/i }));

    await waitFor(() =>
      expect(mutationMocks.createMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: "expense-client-1",
          date: "2026-05-20",
          amount: 45000,
          note: "Recovered lunch",
        })
      )
    );
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

    expect(weeklyBudgetOptionsMock).not.toHaveBeenCalledWith(
      expect.any(String),
      "2026-05-20"
    );

    await user.click(screen.getByRole("button", { name: /done/i }));

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

    await waitFor(() =>
      expect(mutationMocks.createMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ budgetId: null })
      )
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

  it("does not autofocus the note field when edit mode opens", async () => {
    renderEditSheet();

    const note = await screen.findByPlaceholderText(/what did you spend on/i);

    expect(note).not.toHaveFocus();
  });

  it("calls the local-first update mutation with the submitted draft and closes", async () => {
    const user = userEvent.setup();
    weeklyBudgetOptionsMock.mockResolvedValue([
      budgetOption({ id: 2, name: "Sports week" }),
    ]);
    const { onOpenChange } = renderEditSheet();

    await user.click(screen.getByRole("button", { name: /^update$/i }));

    await waitFor(() =>
      expect(mutationMocks.updateMutateAsync).toHaveBeenCalledWith({
        id: 42,
        input: expect.objectContaining({
          date: "2026-05-20",
          amount: 150000,
          note: "Badminton court",
          category: "Badminton",
          paidBy: "Embe",
          budgetId: 2,
        }),
      })
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders edit footer with Update and an icon-only delete action", async () => {
    const user = userEvent.setup();
    const onConfirmDelete = vi.fn();
    renderEditSheet({ onConfirmDelete });

    expect(
      screen.getByRole("button", { name: /^update$/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /update expense/i })
    ).not.toBeInTheDocument();

    const deleteButton = screen.getByRole("button", {
      name: /delete expense/i,
    });
    expect(deleteButton).toHaveTextContent(/^$/);
    expect(deleteButton).toHaveAttribute("data-variant", "outline");

    await user.click(deleteButton);

    expect(screen.getByRole("dialog", { name: /delete this expense/i }));
    expect(
      screen.getByPlaceholderText(/what did you spend on/i)
    ).toBeInTheDocument();
    expect(onConfirmDelete).not.toHaveBeenCalled();
  });

  it("keeps the edit sheet open when canceling delete confirmation", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderEditSheet({ onConfirmDelete: vi.fn() });

    await user.click(screen.getByRole("button", { name: /delete expense/i }));
    const confirmDialog = screen.getByRole("dialog", {
      name: /delete this expense/i,
    });

    await user.click(
      within(confirmDialog).getByRole("button", { name: /keep it/i })
    );

    expect(
      screen.queryByRole("dialog", { name: /delete this expense/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/what did you spend on/i)
    ).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("shows the expense details in the delete confirmation", async () => {
    const user = userEvent.setup();
    renderEditSheet({ onConfirmDelete: vi.fn() });

    await user.click(screen.getByRole("button", { name: /delete expense/i }));
    const confirmDialog = screen.getByRole("dialog", {
      name: /delete this expense/i,
    });

    expect(within(confirmDialog).getByText("20/05/2026")).toBeInTheDocument();
    expect(within(confirmDialog).getByText("Badminton")).toBeInTheDocument();
    expect(within(confirmDialog).getByText(/150[.,]?000/)).toBeInTheDocument();
    expect(
      within(confirmDialog).getByText("Badminton court")
    ).toBeInTheDocument();
  });

  it("confirms delete and closes the edit sheet", async () => {
    const user = userEvent.setup();
    const onConfirmDelete = vi.fn();
    const { onOpenChange } = renderEditSheet({ onConfirmDelete });

    await user.click(screen.getByRole("button", { name: /delete expense/i }));
    const confirmDialog = screen.getByRole("dialog", {
      name: /delete this expense/i,
    });
    await user.click(
      within(confirmDialog).getByRole("button", { name: /delete expense/i })
    );

    expect(onConfirmDelete).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(
      screen.queryByRole("dialog", { name: /delete this expense/i })
    ).not.toBeInTheDocument();
  });

  it("does not submit edit mode without a transaction id", async () => {
    const user = userEvent.setup();
    renderEditSheet({ transactionId: undefined });

    await user.click(screen.getByRole("button", { name: /^update$/i }));

    expect(mutationMocks.updateMutateAsync).not.toHaveBeenCalled();
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
