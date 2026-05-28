import React from "react";

import { Category, PaidBy } from "@/enums";
import { dispatchExpensePrefill } from "@/lib/expense-prefill";
import type { BudgetWeeklyOption } from "@/lib/queries/budget-weekly";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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
  suggestBudgetMutateAsync: vi.fn(),
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
  useSuggestBudgetMutation: () => ({
    mutateAsync: mutationMocks.suggestBudgetMutateAsync,
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
  icon: "🍜",
  color: "rose",
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
  mutationMocks.suggestBudgetMutateAsync.mockResolvedValue({
    status: "no_match",
    reason: "No provided budget clearly fits this note.",
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

  it("does not render a hidden keyboard primer input", async () => {
    const user = userEvent.setup();
    renderSheet();

    await user.click(screen.getByRole("button", { name: /add expense/i }));

    await screen.findByPlaceholderText(/what did you spend on/i);
    expect(
      document.querySelector('input[aria-hidden="true"][tabindex="-1"]')
    ).not.toBeInTheDocument();
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

  it("renders the date and paid-by trigger buttons plus the budget chip row", async () => {
    await openSheet();
    expect(screen.getByRole("button", { name: /^date:/i })).toBeInTheDocument();
    expect(
      screen.getByRole("radiogroup", { name: /^budget$/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /no budget/i, pressed: true })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^paid by:/i })
    ).toBeInTheDocument();
  });

  it("opens date and paid-by picker drawers from canceled pointer down", async () => {
    const user = await openSheet();
    const note = screen.getByPlaceholderText(/what did you spend on/i);
    note.focus();

    const dateDefaultWasNotPrevented = fireEvent.pointerDown(
      screen.getByRole("button", { name: /^date:/i }),
      { cancelable: true }
    );
    expect(dateDefaultWasNotPrevented).toBe(false);
    expect(
      await screen.findByRole("dialog", { name: /^date$/i })
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: /done/i }));

    note.focus();
    const paidByDefaultWasNotPrevented = fireEvent.pointerDown(
      screen.getByRole("button", { name: /^paid by:/i }),
      { cancelable: true }
    );
    expect(paidByDefaultWasNotPrevented).toBe(false);
    expect(
      await screen.findByRole("dialog", { name: /^paid by$/i })
    ).toBeVisible();
  });

  it("blurs the active input while opening a picker drawer", async () => {
    await openSheet();
    const note = screen.getByPlaceholderText(/what did you spend on/i);
    note.focus();

    fireEvent.pointerDown(screen.getByRole("button", { name: /^date:/i }), {
      cancelable: true,
    });

    expect(
      await screen.findByRole("dialog", { name: /^date$/i })
    ).toBeVisible();
    expect(note).not.toHaveFocus();
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

  it("keeps amount focused after applying a suggestion", async () => {
    const user = await openSheet();
    const amount = screen.getByPlaceholderText("0") as HTMLInputElement;
    await user.click(amount);
    await user.keyboard("5");
    await user.click(screen.getByRole("button", { name: /5[.,]?000$/ }));

    expect(amount.value).toMatch(/5[.,]?000/);
    expect(amount).toHaveFocus();
    expect(
      screen.getByRole("group", { name: /amount suggestions/i })
    ).toBeInTheDocument();
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
      bottom: "calc(256px + 8px)",
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

  it("renders the collapsed budget chip row and expands then selects a budget", async () => {
    weeklyBudgetOptionsMock.mockResolvedValue([
      budgetOption({ id: 3, name: "Food week" }),
      budgetOption({ id: 4, name: "Rent month", period: "month" }),
    ]);
    const user = await openSheet();
    const noBudgetChip = screen.getByRole("button", {
      name: /no budget/i,
      pressed: true,
    });
    expect(noBudgetChip).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /food week/i })
    ).not.toBeInTheDocument();

    await user.click(noBudgetChip);
    await user.click(await screen.findByRole("button", { name: /food week/i }));

    const selectedBudgetChip = screen.getByRole("button", {
      name: /food week/i,
      pressed: true,
    });
    expect(selectedBudgetChip).toBeInTheDocument();
    expect(selectedBudgetChip).toHaveClass("bg-rose-400/14", "text-rose-300");
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /rent month/i })
      ).not.toBeInTheDocument()
    );
  });

  it("restores note focus after closing the date picker opened from note focus", async () => {
    const user = await openSheet();
    const note = screen.getByPlaceholderText(/what did you spend on/i);

    await user.click(note);
    await user.click(screen.getByRole("button", { name: /^date:/i }));
    await user.click(await screen.findByRole("button", { name: /done/i }));

    await waitFor(() => expect(note).toHaveFocus());
  });

  it("keeps amount focus after selecting a budget chip from amount focus", async () => {
    weeklyBudgetOptionsMock.mockResolvedValue([
      budgetOption({ id: 3, name: "Food week" }),
    ]);
    const user = await openSheet();
    const amount = screen.getByPlaceholderText("0");

    await user.click(amount);
    await user.click(screen.getByRole("button", { name: /no budget/i }));
    await user.click(await screen.findByRole("button", { name: /food week/i }));

    await waitFor(() => expect(amount).toHaveFocus());
  });

  it("does not force note or amount focus when closing paid-by without a focused input", async () => {
    const user = await openSheet();
    const note = screen.getByPlaceholderText(/what did you spend on/i);
    const amount = screen.getByPlaceholderText("0");

    note.blur();
    await user.click(screen.getByRole("button", { name: /^paid by:/i }));
    await user.click(await screen.findByRole("button", { name: /done/i }));

    await waitFor(() => expect(note).not.toHaveFocus());
    expect(amount).not.toHaveFocus();
  });
});

describe("QuickExpenseSheet — budget suggestion", () => {
  const suggestionBudgets = [
    budgetOption({
      id: 7,
      name: "Coffee",
      icon: "☕",
      color: "amber",
      period: "week",
      periodStartDate: "2026-05-25",
      periodEndDate: "2026-05-31",
      amount: 300000,
      spent: 125000,
      remaining: 175000,
    }),
    budgetOption({
      id: 8,
      name: "Transport",
      icon: "🚕",
      color: "sky",
      period: "month",
      periodStartDate: "2026-05-01",
      periodEndDate: "2026-05-31",
      amount: 800000,
      spent: 250000,
      remaining: 550000,
    }),
  ];

  const openSheetWithBudgets = async (
    budgets: BudgetWeeklyOption[] = suggestionBudgets
  ) => {
    weeklyBudgetOptionsMock.mockResolvedValue(budgets);
    const user = userEvent.setup();
    renderSheet();
    await user.click(screen.getByRole("button", { name: /add expense/i }));
    await waitFor(() =>
      expect(
        screen.getByRole("radiogroup", { name: /^budget$/i })
      ).toHaveAttribute("aria-busy", "false")
    );
    return user;
  };

  it("sends budget candidates on note blur and preselects a high-confidence match", async () => {
    const user = await openSheetWithBudgets();
    mutationMocks.suggestBudgetMutateAsync.mockResolvedValue({
      status: "success",
      budgetId: 7,
      confidence: "high",
      reason: "Coffee team expense",
    });

    const note = screen.getByPlaceholderText(/what did you spend on/i);
    await user.type(note, "coffee with team");
    await user.tab();

    await waitFor(() =>
      expect(mutationMocks.suggestBudgetMutateAsync).toHaveBeenCalledWith({
        note: "coffee with team",
        budgets: [
          {
            id: 7,
            name: "Coffee",
            amount: 300000,
            spent: 125000,
            remaining: 175000,
            period: "week",
            periodStartDate: "2026-05-25",
            periodEndDate: "2026-05-31",
          },
          {
            id: 8,
            name: "Transport",
            amount: 800000,
            spent: 250000,
            remaining: 550000,
            period: "month",
            periodStartDate: "2026-05-01",
            periodEndDate: "2026-05-31",
          },
        ],
      })
    );

    expect(
      await screen.findByRole("button", { name: /coffee/i, pressed: true })
    ).toBeInTheDocument();
    expect(mutationMocks.createMutateAsync).not.toHaveBeenCalled();
    expect(mutationMocks.updateMutateAsync).not.toHaveBeenCalled();
  });

  it("shows a left-side loading indicator while suggesting a budget", async () => {
    let resolveSuggestion!: (value: { status: "no_match" }) => void;
    mutationMocks.suggestBudgetMutateAsync.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSuggestion = resolve;
        })
    );
    const user = await openSheetWithBudgets();

    const note = screen.getByPlaceholderText(/what did you spend on/i);
    await user.type(note, "coffee with team");
    await user.tab();

    await waitFor(() =>
      expect(mutationMocks.suggestBudgetMutateAsync).toHaveBeenCalled()
    );

    const budgetList = screen.getByRole("radiogroup", { name: /^budget$/i });
    const indicator = within(budgetList).getByLabelText("Suggesting budget");
    expect(indicator).toHaveAttribute("role", "status");
    expect(budgetList.firstElementChild).toBe(indicator);
    expect(indicator).not.toHaveTextContent("Suggesting");

    await act(async () => {
      resolveSuggestion({ status: "no_match" });
    });

    await waitFor(() =>
      expect(
        within(budgetList).queryByLabelText("Suggesting budget")
      ).not.toBeInTheDocument()
    );
  });

  it("does not request a duplicate suggestion for the same note and candidates", async () => {
    const user = await openSheetWithBudgets();

    const note = screen.getByPlaceholderText(/what did you spend on/i);
    await user.type(note, "shared note");
    await user.tab();

    await waitFor(() =>
      expect(mutationMocks.suggestBudgetMutateAsync).toHaveBeenCalledTimes(1)
    );

    await user.click(note);
    await user.tab();

    expect(mutationMocks.suggestBudgetMutateAsync).toHaveBeenCalledTimes(1);
  });

  it("does not request the same note again when only the date changes", async () => {
    weeklyBudgetOptionsMock.mockResolvedValue([suggestionBudgets[0]]);
    const user = userEvent.setup();
    renderSheet();
    await user.click(screen.getByRole("button", { name: /add expense/i }));
    await waitFor(() =>
      expect(
        screen.getByRole("radiogroup", { name: /^budget$/i })
      ).toHaveAttribute("aria-busy", "false")
    );

    const note = screen.getByPlaceholderText(/what did you spend on/i);
    await user.type(note, "shared note");
    await user.tab();

    await waitFor(() =>
      expect(mutationMocks.suggestBudgetMutateAsync).toHaveBeenCalledTimes(1)
    );

    await user.click(screen.getByRole("button", { name: /^date:/i }));
    await user.click(
      await screen.findByRole("button", { name: /pick mocked date/i })
    );
    await user.click(screen.getByRole("button", { name: /done/i }));

    await waitFor(() =>
      expect(weeklyBudgetOptionsMock).toHaveBeenCalledWith(
        expect.any(String),
        "2026-05-20"
      )
    );

    await user.click(note);
    await user.tab();

    expect(mutationMocks.suggestBudgetMutateAsync).toHaveBeenCalledTimes(1);
  });

  it("does not overwrite a manually selected budget with a later AI suggestion", async () => {
    const user = await openSheetWithBudgets();
    mutationMocks.suggestBudgetMutateAsync.mockResolvedValue({
      status: "success",
      budgetId: 8,
      confidence: "high",
      reason: "Transport expense",
    });

    await user.click(screen.getByRole("button", { name: /no budget/i }));
    await user.click(await screen.findByRole("button", { name: /coffee/i }));

    expect(
      screen.getByRole("button", { name: /coffee/i, pressed: true })
    ).toBeInTheDocument();

    const note = screen.getByPlaceholderText(/what did you spend on/i);
    await user.type(note, "taxi to office");
    await user.tab();

    expect(mutationMocks.suggestBudgetMutateAsync).not.toHaveBeenCalled();

    expect(
      screen.getByRole("button", { name: /coffee/i, pressed: true })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /transport/i, pressed: true })
    ).not.toBeInTheDocument();
  });

  it("ignores a suggestion response when the note changed after blur", async () => {
    let resolveSuggestion!: (value: {
      status: "success";
      budgetId: number;
      confidence: "high";
      reason: string;
    }) => void;
    mutationMocks.suggestBudgetMutateAsync.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSuggestion = resolve;
        })
    );
    const user = await openSheetWithBudgets();

    const note = screen.getByPlaceholderText(/what did you spend on/i);
    await user.type(note, "coffee with team");
    await user.tab();
    await waitFor(() =>
      expect(mutationMocks.suggestBudgetMutateAsync).toHaveBeenCalled()
    );

    await user.click(note);
    await user.clear(note);
    await user.type(note, "taxi home");

    await act(async () => {
      resolveSuggestion({
        status: "success",
        budgetId: 7,
        confidence: "high",
        reason: "Coffee team expense",
      });
    });

    expect(
      screen.getByRole("button", { name: /no budget/i, pressed: true })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /coffee/i, pressed: true })
    ).not.toBeInTheDocument();
  });

  it("does not overwrite a manually cleared No budget selection with a later AI suggestion", async () => {
    const user = await openSheetWithBudgets();
    mutationMocks.suggestBudgetMutateAsync.mockResolvedValue({
      status: "success",
      budgetId: 8,
      confidence: "high",
      reason: "Transport expense",
    });

    await user.click(screen.getByRole("button", { name: /no budget/i }));
    await user.click(await screen.findByRole("button", { name: /coffee/i }));
    await user.click(screen.getByRole("button", { name: /coffee/i }));
    await user.click(await screen.findByRole("button", { name: /no budget/i }));

    expect(
      screen.getByRole("button", { name: /no budget/i, pressed: true })
    ).toBeInTheDocument();

    const note = screen.getByPlaceholderText(/what did you spend on/i);
    await user.click(note);
    await user.type(note, "taxi to office");
    await user.tab();

    expect(mutationMocks.suggestBudgetMutateAsync).not.toHaveBeenCalled();

    expect(
      screen.getByRole("button", { name: /no budget/i, pressed: true })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /transport/i, pressed: true })
    ).not.toBeInTheDocument();
  });

  it("suggests the same note again after candidate budgets change", async () => {
    weeklyBudgetOptionsMock.mockImplementation(
      async (_weekStart, targetDate) =>
        targetDate === "2026-05-20"
          ? [suggestionBudgets[1]]
          : [suggestionBudgets[0]]
    );
    mutationMocks.suggestBudgetMutateAsync
      .mockResolvedValueOnce({
        status: "success",
        budgetId: 7,
        confidence: "high",
        reason: "Coffee team expense",
      })
      .mockResolvedValueOnce({
        status: "success",
        budgetId: 8,
        confidence: "high",
        reason: "Transport expense",
      });
    const user = userEvent.setup();
    renderSheet();
    await user.click(screen.getByRole("button", { name: /add expense/i }));
    await waitFor(() =>
      expect(
        screen.getByRole("radiogroup", { name: /^budget$/i })
      ).toHaveAttribute("aria-busy", "false")
    );

    const note = screen.getByPlaceholderText(/what did you spend on/i);
    await user.type(note, "shared note");
    await user.tab();

    await waitFor(() =>
      expect(mutationMocks.suggestBudgetMutateAsync).toHaveBeenCalledTimes(1)
    );

    await user.click(screen.getByRole("button", { name: /^date:/i }));
    await user.click(
      await screen.findByRole("button", { name: /pick mocked date/i })
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
        screen.getByRole("button", { name: /no budget/i, pressed: true })
      ).toBeInTheDocument()
    );

    await user.click(note);
    await user.tab();

    await waitFor(() =>
      expect(mutationMocks.suggestBudgetMutateAsync).toHaveBeenCalledTimes(2)
    );
    expect(mutationMocks.suggestBudgetMutateAsync).toHaveBeenLastCalledWith({
      note: "shared note",
      budgets: [
        {
          id: 8,
          name: "Transport",
          amount: 800000,
          spent: 250000,
          remaining: 550000,
          period: "month",
          periodStartDate: "2026-05-01",
          periodEndDate: "2026-05-31",
        },
      ],
    });
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

  it("passes the selected budget name to the local-first create mutation", async () => {
    weeklyBudgetOptionsMock.mockResolvedValue([
      budgetOption({ id: 3, name: "Food week" }),
    ]);
    const user = await openSheet();

    await user.click(screen.getByRole("button", { name: /no budget/i }));
    await user.click(await screen.findByRole("button", { name: /food week/i }));
    await user.type(
      screen.getByPlaceholderText(/what did you spend on/i),
      "Budget lunch"
    );
    const amount = screen.getByPlaceholderText("0");
    await user.click(amount);
    await user.keyboard("12000");
    await user.click(screen.getByRole("button", { name: /save expense/i }));

    await waitFor(() =>
      expect(mutationMocks.createMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 12000,
          note: "Budget lunch",
          budgetId: 3,
          budgetName: "Food week",
          budgetIcon: "🍜",
          budgetColor: "rose",
        })
      )
    );
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

  it("shows create success toast after the local write resolves", async () => {
    let resolveCreate: (value: { clientId: string }) => void = () => {};
    weeklyBudgetOptionsMock.mockResolvedValue([
      budgetOption({ id: 3, name: "Food week" }),
    ]);
    mutationMocks.createMutateAsync.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      })
    );
    const user = await openSheet();

    await user.click(screen.getByRole("button", { name: /no budget/i }));
    await user.click(await screen.findByRole("button", { name: /food week/i }));
    await user.type(
      screen.getByPlaceholderText(/what did you spend on/i),
      "Budget lunch"
    );
    await user.click(screen.getByPlaceholderText("0"));
    await user.keyboard("12000");
    await user.click(screen.getByRole("button", { name: /save expense/i }));

    await waitFor(() =>
      expect(mutationMocks.createMutateAsync).toHaveBeenCalled()
    );
    expect(toastMock.success).not.toHaveBeenCalled();

    await act(async () => {
      resolveCreate({ clientId: "expense-client-1" });
    });

    await waitFor(() => expect(toastMock.success).toHaveBeenCalled());
    const [message, options] = toastMock.success.mock.calls.at(-1) ?? [];
    expect(options).toMatchObject({ icon: null });

    const toastContent = render(message as React.ReactElement);
    expect(toastContent.container).toHaveTextContent("🍜");
    expect(toastContent.container).toHaveTextContent("Budget lunch");
    expect(toastContent.container).toHaveTextContent("12.000₫");
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
        budgetName: null,
        budgetIcon: null,
        budgetColor: null,
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

    await user.click(screen.getByRole("button", { name: /no budget/i }));
    await user.click(await screen.findByRole("button", { name: /food week/i }));
    expect(
      screen.getByRole("button", { name: /food week/i, pressed: true })
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
        screen.getByRole("button", { name: /no budget/i, pressed: true })
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

  it("shows edit success toast after the local write resolves", async () => {
    let resolveUpdate: (value: { clientId: string }) => void = () => {};
    mutationMocks.updateMutateAsync.mockReturnValue(
      new Promise((resolve) => {
        resolveUpdate = resolve;
      })
    );
    const user = userEvent.setup();
    weeklyBudgetOptionsMock.mockResolvedValue([
      budgetOption({ id: 2, name: "Sports week" }),
    ]);
    renderEditSheet();

    await user.click(screen.getByRole("button", { name: /^update$/i }));

    await waitFor(() =>
      expect(mutationMocks.updateMutateAsync).toHaveBeenCalled()
    );
    expect(toastMock.success).not.toHaveBeenCalled();

    await act(async () => {
      resolveUpdate({ clientId: "expense-client-1" });
    });

    await waitFor(() =>
      expect(toastMock.success).toHaveBeenCalledWith("Expense updated.")
    );
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
