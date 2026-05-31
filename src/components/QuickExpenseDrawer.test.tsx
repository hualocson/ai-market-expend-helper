import React from "react";

import dayjs from "@/configs/date";
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

import QuickExpenseDrawer, {
  type TQuickExpenseDrawerProps,
} from "./QuickExpenseDrawer";

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

const { hapticsMock } = vi.hoisted(() => ({
  hapticsMock: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    selection: vi.fn(),
    impact: vi.fn(),
    trigger: vi.fn(),
  },
}));

vi.mock("@/hooks/useAppHaptics", () => ({
  useAppHaptics: () => hapticsMock,
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
const originalMatchMedia = window.matchMedia;

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
  category: Category.OTHER,
  ...override,
});

const installVisualViewport = (height: number) => {
  const visualViewport = new EventTarget() as VisualViewport;
  Object.defineProperties(visualViewport, {
    height: { configurable: true, value: height },
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
  return visualViewport;
};

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
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
  hapticsMock.success.mockReset();
  hapticsMock.warning.mockReset();
  hapticsMock.error.mockReset();
  hapticsMock.selection.mockReset();
  hapticsMock.impact.mockReset();
  hapticsMock.trigger.mockReset();
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
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: originalMatchMedia,
  });
  if (typeof originalGlobalReact === "undefined") {
    Reflect.deleteProperty(globalThis, "React");
  } else {
    (globalThis as unknown as Record<string, unknown>).React =
      originalGlobalReact;
  }
});

const renderDrawer = (props: Partial<TQuickExpenseDrawerProps> = {}) => {
  (globalThis as unknown as Record<string, unknown>).React = React;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const renderWithProps = (nextProps: Partial<TQuickExpenseDrawerProps>) => (
    <QueryClientProvider client={client}>
      <SettingsStoreProvider>
        <QuickExpenseDrawer {...nextProps} />
      </SettingsStoreProvider>
    </QueryClientProvider>
  );
  const result = render(renderWithProps(props));

  return {
    ...result,
    rerenderDrawer: (nextProps: Partial<TQuickExpenseDrawerProps>) =>
      result.rerender(renderWithProps(nextProps)),
  };
};

describe("QuickExpenseDrawer — open/close", () => {
  it("opens when the trigger is clicked and focuses the note input", async () => {
    const user = userEvent.setup();
    renderDrawer();

    expect(
      screen.queryByPlaceholderText(/what did you spend on/i)
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /add expense/i }));

    const note = await screen.findByPlaceholderText(/what did you spend on/i);
    await waitFor(() => expect(note).toHaveFocus());
  });

  it("calls the trigger click callback when the trigger is clicked", async () => {
    const user = userEvent.setup();
    const onTriggerClick = vi.fn();
    renderDrawer({ onTriggerClick });

    await user.click(screen.getByRole("button", { name: /add expense/i }));

    expect(onTriggerClick).toHaveBeenCalledTimes(1);
  });

  it("does not render a hidden keyboard primer input", async () => {
    const user = userEvent.setup();
    renderDrawer();

    await user.click(screen.getByRole("button", { name: /add expense/i }));

    await screen.findByPlaceholderText(/what did you spend on/i);
    expect(
      document.querySelector('input[aria-hidden="true"][tabindex="-1"]')
    ).not.toBeInTheDocument();
  });

  it("uses the quick expense morph entrance surface", async () => {
    const user = userEvent.setup();
    renderDrawer();

    await user.click(screen.getByRole("button", { name: /add expense/i }));

    const drawer = await screen.findByRole("dialog");

    expect(drawer).toHaveClass("quick-expense-drawer-morph");
    expect(drawer).toHaveClass(
      "data-[vaul-drawer-direction=bottom]:mt-0",
      "data-[vaul-drawer-direction=bottom]:max-h-none"
    );
  });

  it("uses the quick expense overlay class for the full-screen drawer", async () => {
    const user = userEvent.setup();
    renderDrawer();

    await user.click(screen.getByRole("button", { name: /add expense/i }));

    await screen.findByRole("dialog");
    expect(document.querySelector('[data-slot="drawer-overlay"]')).toHaveClass(
      "quick-expense-drawer-overlay"
    );
  });
});

describe("QuickExpenseDrawer — controlled create initial expense", () => {
  it("hydrates create mode from initialExpense when controlled open", async () => {
    renderDrawer({
      showTrigger: false,
      open: true,
      onOpenChange: vi.fn(),
      initialExpense: {
        date: "30/05/2026",
        amount: 35000,
        note: "Cà phê sữa đá",
        category: Category.FOOD,
        paidBy: PaidBy.CUBI,
        budgetId: 2,
        budgetName: "Cà phê",
        budgetIcon: "☕",
        budgetColor: "lime",
      },
    });

    expect(
      await screen.findByPlaceholderText(/what did you spend on/i)
    ).toHaveValue("Cà phê sữa đá");
    expect(
      (screen.getByPlaceholderText("0") as HTMLInputElement).value
    ).toMatch(/35[.,]?000/);
  });

  it("refreshes the controlled create draft when initialExpense changes", async () => {
    const { rerenderDrawer } = renderDrawer({
      showTrigger: false,
      open: true,
      onOpenChange: vi.fn(),
      initialExpense: {
        id: 1,
        date: "30/05/2026",
        amount: 35000,
        note: "Cà phê",
        category: Category.FOOD,
        paidBy: PaidBy.CUBI,
        budgetId: null,
      },
    });

    expect(
      await screen.findByPlaceholderText(/what did you spend on/i)
    ).toHaveValue("Cà phê");

    rerenderDrawer({
      showTrigger: false,
      open: true,
      onOpenChange: vi.fn(),
      initialExpense: {
        id: 2,
        date: "30/05/2026",
        amount: 25000,
        note: "Bánh mì",
        category: Category.FOOD,
        paidBy: PaidBy.EMBE,
        budgetId: null,
      },
    });

    expect(
      await screen.findByPlaceholderText(/what did you spend on/i)
    ).toHaveValue("Bánh mì");
    expect(
      (screen.getByPlaceholderText("0") as HTMLInputElement).value
    ).toMatch(/25[.,]?000/);
  });

  it("calls onSuccess with the local expense returned by create", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    const localExpense = {
      entity: "expenses",
      clientId: "client-created",
      serverId: null,
      date: "2026-05-30",
      amount: 35000,
      note: "Cà phê",
      category: Category.FOOD,
      paidBy: PaidBy.CUBI,
      budgetId: null,
      budgetName: null,
      budgetIcon: null,
      budgetColor: null,
      syncStatus: "pending",
      lastError: null,
      updatedAt: "2026-05-30T00:00:00.000Z",
      serverUpdatedAt: null,
    };
    mutationMocks.createMutateAsync.mockResolvedValueOnce(localExpense);

    renderDrawer({
      showTrigger: false,
      open: true,
      onOpenChange: vi.fn(),
      onSuccess,
      initialExpense: {
        date: "30/05/2026",
        amount: 35000,
        note: "Cà phê",
        category: Category.FOOD,
        paidBy: PaidBy.CUBI,
        budgetId: null,
      },
    });

    await user.click(
      await screen.findByRole("button", { name: /^save expense$/i })
    );

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(localExpense));
  });
});

describe("QuickExpenseDrawer — fields", () => {
  const openDrawer = async () => {
    const user = userEvent.setup();
    renderDrawer();
    await user.click(screen.getByRole("button", { name: /add expense/i }));
    return user;
  };

  it("renders the date and paid-by trigger buttons plus the budget chip row", async () => {
    await openDrawer();
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
    const user = await openDrawer();
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
    await openDrawer();
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
    const user = await openDrawer();
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
    const user = await openDrawer();
    const amount = screen.getByPlaceholderText("0") as HTMLInputElement;
    await user.click(amount);
    await user.keyboard("5");
    await user.click(screen.getByRole("button", { name: /5[.,]?000$/ }));
    expect(amount.value).toMatch(/5[.,]?000/);
  });

  it("keeps amount focused after applying a suggestion", async () => {
    const user = await openDrawer();
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
    const user = await openDrawer();
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
    const visualViewport = installVisualViewport(544);

    const user = await openDrawer();
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
    expect(suggestions).toHaveClass("fixed", "flex", "items-center", "gap-2");
    expect(suggestions).toHaveStyle({
      bottom: "calc(256px + 8px)",
    });
  });

  it("pins an icon-only submit button at the end of the keyboard suggestion row", async () => {
    const visualViewport = installVisualViewport(544);

    const user = await openDrawer();
    const amount = screen.getByPlaceholderText("0");
    await user.click(amount);
    act(() => {
      visualViewport.dispatchEvent(new Event("resize"));
    });
    await user.keyboard("5");

    const row = screen.getByRole("group", {
      name: /amount suggestions/i,
    });
    const suggestionStrip = within(row).getByTestId("amount-suggestion-scroll");
    const saveButtons = screen.getAllByRole("button", {
      name: /^save expense$/i,
    });

    expect(suggestionStrip).toHaveClass("min-w-0", "flex-1", "overflow-x-auto");
    expect(saveButtons).toHaveLength(1);
    expect(saveButtons[0]).toHaveTextContent(/^$/);
    expect(saveButtons[0]).toHaveClass("shrink-0", "rounded-full");
    expect(saveButtons[0]).toHaveAttribute("aria-label", "Save expense");
  });

  it("renders the collapsed category chip row and expands then toggles active chip", async () => {
    const user = await openDrawer();
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
    const user = await openDrawer();
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
    const user = await openDrawer();
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
    const user = await openDrawer();
    const amount = screen.getByPlaceholderText("0");

    await user.click(amount);
    await user.click(screen.getByRole("button", { name: /no budget/i }));
    await user.click(await screen.findByRole("button", { name: /food week/i }));

    await waitFor(() => expect(amount).toHaveFocus());
  });

  it("does not force note or amount focus when closing paid-by without a focused input", async () => {
    const user = await openDrawer();
    const note = screen.getByPlaceholderText(/what did you spend on/i);
    const amount = screen.getByPlaceholderText("0");

    note.blur();
    await user.click(screen.getByRole("button", { name: /^paid by:/i }));
    await user.click(await screen.findByRole("button", { name: /done/i }));

    await waitFor(() => expect(note).not.toHaveFocus());
    expect(amount).not.toHaveFocus();
  });
});

describe("QuickExpenseDrawer — budget suggestion", () => {
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
      category: Category.ENTERTAINMENT,
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
      category: Category.TRANSPORT,
    }),
  ];

  const openDrawerWithBudgets = async (
    budgets: BudgetWeeklyOption[] = suggestionBudgets
  ) => {
    weeklyBudgetOptionsMock.mockResolvedValue(budgets);
    const user = userEvent.setup();
    renderDrawer();
    await user.click(screen.getByRole("button", { name: /add expense/i }));
    await waitFor(() =>
      expect(
        screen.getByRole("radiogroup", { name: /^budget$/i })
      ).toHaveAttribute("aria-busy", "false")
    );
    return user;
  };

  it("sends budget candidates on note blur and preselects a high-confidence match", async () => {
    const user = await openDrawerWithBudgets();
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
    const user = await openDrawerWithBudgets();

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

  it("triggers error haptics when the AI budget suggestion returns no_match", async () => {
    mutationMocks.suggestBudgetMutateAsync.mockResolvedValue({
      status: "no_match",
      reason: "No provided budget matches this note.",
    });
    const user = await openDrawerWithBudgets();

    const note = screen.getByPlaceholderText(/what did you spend on/i);
    await user.type(note, "office supplies");
    await user.tab();

    await waitFor(() =>
      expect(mutationMocks.suggestBudgetMutateAsync).toHaveBeenCalled()
    );
    expect(hapticsMock.error).toHaveBeenCalledTimes(1);
    expect(hapticsMock.warning).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: /no budget/i, pressed: true })
    ).toBeInTheDocument();
  });

  it("does not request a duplicate suggestion for the same note and candidates", async () => {
    const user = await openDrawerWithBudgets();

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
    renderDrawer();
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
    const user = await openDrawerWithBudgets();
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
    const user = await openDrawerWithBudgets();

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
    const user = await openDrawerWithBudgets();
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
    renderDrawer();
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

  it("applies the suggested budget's category to the expense", async () => {
    const user = await openDrawerWithBudgets();
    mutationMocks.suggestBudgetMutateAsync.mockResolvedValue({
      status: "success",
      budgetId: 7,
      confidence: "high",
      reason: "Coffee expense",
    });

    const note = screen.getByPlaceholderText(/what did you spend on/i);
    await user.type(note, "coffee with team");
    await user.tab();

    const budgetGroup = screen.getByRole("radiogroup", { name: /^budget$/i });
    expect(
      await within(budgetGroup).findByRole("button", {
        name: /coffee/i,
        pressed: true,
      })
    ).toBeInTheDocument();

    const categoryGroup = screen.getByRole("radiogroup", {
      name: /^category$/i,
    });
    expect(
      within(categoryGroup).getByRole("button", { name: /entertainment/i })
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("applies a manually selected budget's category to the expense", async () => {
    const user = await openDrawerWithBudgets();

    const budgetGroup = screen.getByRole("radiogroup", { name: /^budget$/i });
    await user.click(
      within(budgetGroup).getByRole("button", { name: /no budget/i })
    );
    await user.click(
      await within(budgetGroup).findByRole("button", { name: /coffee/i })
    );

    const categoryGroup = screen.getByRole("radiogroup", {
      name: /^category$/i,
    });
    expect(
      within(categoryGroup).getByRole("button", { name: /entertainment/i })
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("does not overwrite a user-selected category when a budget is applied", async () => {
    const user = await openDrawerWithBudgets();

    const categoryGroup = screen.getByRole("radiogroup", {
      name: /^category$/i,
    });
    await user.click(
      within(categoryGroup).getByRole("button", { name: /food/i })
    );
    await user.click(
      await within(categoryGroup).findByRole("button", { name: /giving/i })
    );

    const budgetGroup = screen.getByRole("radiogroup", { name: /^budget$/i });
    await user.click(
      within(budgetGroup).getByRole("button", { name: /no budget/i })
    );
    await user.click(
      await within(budgetGroup).findByRole("button", { name: /coffee/i })
    );

    expect(
      within(categoryGroup).getByRole("button", { name: /giving/i })
    ).toHaveAttribute("aria-pressed", "true");
  });
});

describe("QuickExpenseDrawer — submit", () => {
  const openDrawer = async () => {
    const user = userEvent.setup();
    renderDrawer();
    await user.click(screen.getByRole("button", { name: /add expense/i }));
    return user;
  };

  it("disables submit when amount is zero", async () => {
    await openDrawer();
    expect(
      screen.getByRole("button", { name: /save expense/i })
    ).toBeDisabled();
  });

  it("calls the local-first create mutation with the submitted draft and closes", async () => {
    const user = await openDrawer();
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
    const user = await openDrawer();

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
    const user = await openDrawer();

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

  it("triggers medium impact haptics when the save button is pressed", async () => {
    let resolveCreate: (value: { clientId: string }) => void = () => {};
    mutationMocks.createMutateAsync.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      })
    );
    const user = await openDrawer();

    await user.click(screen.getByPlaceholderText("0"));
    await user.keyboard("12000");
    await user.click(screen.getByRole("button", { name: /save expense/i }));

    expect(hapticsMock.impact).toHaveBeenCalledWith("medium");
    expect(hapticsMock.success).not.toHaveBeenCalled();

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
    const user = await openDrawer();

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
    expect(hapticsMock.success).not.toHaveBeenCalled();
    expect(hapticsMock.error).not.toHaveBeenCalled();
    const [message, options] = toastMock.success.mock.calls.at(-1) ?? [];
    expect(options).toMatchObject({ icon: null });

    const toastContent = render(message as React.ReactElement);
    expect(toastContent.container).toHaveTextContent("🍜");
    expect(toastContent.container).toHaveTextContent("Budget lunch");
    expect(toastContent.container).toHaveTextContent("12.000₫");
  });

  it("does not trigger result haptics after the local create write fails", async () => {
    let rejectCreate: (reason?: unknown) => void = () => {};
    mutationMocks.createMutateAsync.mockReturnValue(
      new Promise((_, reject) => {
        rejectCreate = reject;
      })
    );
    const user = await openDrawer();

    await user.click(screen.getByPlaceholderText("0"));
    await user.keyboard("12000");
    await user.click(screen.getByRole("button", { name: /save expense/i }));

    await waitFor(() =>
      expect(mutationMocks.createMutateAsync).toHaveBeenCalled()
    );
    expect(toastMock.error).not.toHaveBeenCalled();

    await act(async () => {
      rejectCreate(new Error("local write failed"));
    });

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith("Failed to add expense")
    );
    expect(hapticsMock.error).not.toHaveBeenCalled();
    expect(hapticsMock.success).not.toHaveBeenCalled();
  });

  it("opens create mode with a recovery draft after rerender", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { rerenderDrawer } = renderDrawer({
      open: false,
      onOpenChange,
      showTrigger: false,
    });

    rerenderDrawer({
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
    renderDrawer();
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

describe("QuickExpenseDrawer — keep open", () => {
  const openDrawer = async () => {
    const user = userEvent.setup();
    renderDrawer();
    await user.click(screen.getByRole("button", { name: /add expense/i }));
    return user;
  };

  it("shows the keep-open toggle in create mode", async () => {
    await openDrawer();
    expect(
      screen.getByRole("switch", { name: /create more/i })
    ).toBeInTheDocument();
  });

  it("keeps the drawer open and resets the draft after saving when enabled", async () => {
    const user = await openDrawer();

    await user.click(screen.getByRole("switch", { name: /create more/i }));

    // Change the date to a non-today value to prove it carries over.
    await user.click(screen.getByRole("button", { name: /^date:/i }));
    await user.click(
      await screen.findByRole("button", { name: /pick mocked date/i })
    );
    await user.click(screen.getByRole("button", { name: /done/i }));

    await user.type(
      screen.getByPlaceholderText(/what did you spend on/i),
      "First item"
    );
    await user.click(screen.getByPlaceholderText("0"));
    await user.keyboard("12000");
    await user.click(screen.getByRole("button", { name: /save expense/i }));

    await waitFor(() =>
      expect(mutationMocks.createMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 12000, note: "First item" })
      )
    );

    const note = screen.getByPlaceholderText(/what did you spend on/i);
    expect(note).toBeInTheDocument();
    expect(note).toHaveValue("");
    expect(screen.getByPlaceholderText("0")).toHaveValue("");
    await waitFor(() => expect(note).toHaveFocus());
    expect(
      screen.getByRole("button", { name: /date: 20\/05/i })
    ).toBeInTheDocument();
  });

  it("closes after saving when keep-open is off", async () => {
    const user = await openDrawer();

    await user.type(
      screen.getByPlaceholderText(/what did you spend on/i),
      "Single item"
    );
    await user.click(screen.getByPlaceholderText("0"));
    await user.keyboard("12000");
    await user.click(screen.getByRole("button", { name: /save expense/i }));

    await waitFor(() =>
      expect(mutationMocks.createMutateAsync).toHaveBeenCalled()
    );
    expect(
      screen.queryByPlaceholderText(/what did you spend on/i)
    ).not.toBeInTheDocument();
  });

  it("hides the keep-open toggle in edit mode", async () => {
    renderDrawer({
      mode: "edit",
      open: true,
      showTrigger: false,
      transactionId: 42,
      initialExpense: {
        date: "2026-05-20",
        amount: 150000,
        note: "Badminton court",
        category: "Badminton",
        paidBy: "Embe",
        budgetId: 2,
      },
    });

    await screen.findByPlaceholderText(/what did you spend on/i);
    expect(
      screen.queryByRole("switch", { name: /create more/i })
    ).not.toBeInTheDocument();
  });

  it("hides the keep-open toggle in recovery mode", async () => {
    const { rerenderDrawer } = renderDrawer({
      open: false,
      showTrigger: false,
    });

    rerenderDrawer({
      open: true,
      showTrigger: false,
      recoveryOperationId: "op-1",
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

    await screen.findByPlaceholderText(/what did you spend on/i);
    expect(
      screen.queryByRole("switch", { name: /create more/i })
    ).not.toBeInTheDocument();
  });
});

describe("QuickExpenseDrawer — edit mode", () => {
  const editExpense = {
    date: "2026-05-20",
    amount: 150000,
    note: "Badminton court",
    category: "Badminton",
    paidBy: "Embe",
    budgetId: 2,
  };

  const renderEditDrawer = (props: Partial<TQuickExpenseDrawerProps> = {}) => {
    const onOpenChange = vi.fn();
    const onSuccess = vi.fn();
    renderDrawer({
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

    renderEditDrawer();

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
    renderEditDrawer();

    const note = await screen.findByPlaceholderText(/what did you spend on/i);

    expect(note).not.toHaveFocus();
  });

  it("calls the local-first update mutation with the submitted draft and closes", async () => {
    const user = userEvent.setup();
    weeklyBudgetOptionsMock.mockResolvedValue([
      budgetOption({ id: 2, name: "Sports week" }),
    ]);
    const { onOpenChange } = renderEditDrawer();

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
    renderEditDrawer();

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
    expect(hapticsMock.success).not.toHaveBeenCalled();
    expect(hapticsMock.error).not.toHaveBeenCalled();
  });

  it("triggers medium impact haptics when the update button is pressed", async () => {
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
    renderEditDrawer();

    await user.click(screen.getByRole("button", { name: /^update$/i }));

    expect(hapticsMock.impact).toHaveBeenCalledWith("medium");
    expect(hapticsMock.success).not.toHaveBeenCalled();

    await act(async () => {
      resolveUpdate({ clientId: "expense-client-1" });
    });
  });

  it("renders edit footer with Update and an icon-only delete action", async () => {
    const user = userEvent.setup();
    const onConfirmDelete = vi.fn();
    renderEditDrawer({ onConfirmDelete });

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

  it("moves the edit submit action into the keyboard row as an icon-only button", async () => {
    const visualViewport = installVisualViewport(544);
    const user = userEvent.setup();
    renderEditDrawer();

    await user.click(screen.getByPlaceholderText("0"));
    act(() => {
      visualViewport.dispatchEvent(new Event("resize"));
    });

    const row = screen.getByRole("group", {
      name: /amount suggestions/i,
    });
    const updateButtons = screen.getAllByRole("button", {
      name: /^update expense$/i,
    });

    expect(within(row).getByRole("button", { name: /^update expense$/i }));
    expect(updateButtons).toHaveLength(1);
    expect(updateButtons[0]).toHaveTextContent(/^$/);
    expect(updateButtons[0]).toHaveClass("shrink-0", "rounded-full");
    expect(
      screen.queryByRole("button", { name: /^update$/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /delete expense/i })
    ).toBeInTheDocument();
  });

  it("keeps the edit sheet open when canceling delete confirmation", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderEditDrawer({ onConfirmDelete: vi.fn() });

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
    renderEditDrawer({ onConfirmDelete: vi.fn() });

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
    const { onOpenChange } = renderEditDrawer({ onConfirmDelete });

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
    renderEditDrawer({ transactionId: undefined });

    await user.click(screen.getByRole("button", { name: /^update$/i }));

    expect(mutationMocks.updateMutateAsync).not.toHaveBeenCalled();
    expect(toastMock.error).toHaveBeenCalledWith("Failed to update expense");
  });

  it("does not change the category when the budget changes in edit mode", async () => {
    weeklyBudgetOptionsMock.mockResolvedValue([
      budgetOption({
        id: 2,
        name: "Sports week",
        category: Category.BADMINTON,
      }),
      budgetOption({ id: 7, name: "Coffee", category: Category.ENTERTAINMENT }),
    ]);
    const user = userEvent.setup();
    renderEditDrawer();
    await screen.findByPlaceholderText(/what did you spend on/i);

    const budgetGroup = screen.getByRole("radiogroup", { name: /^budget$/i });
    await user.click(
      await within(budgetGroup).findByRole("button", { name: /sports week/i })
    );
    await user.click(
      await within(budgetGroup).findByRole("button", { name: /coffee/i })
    );

    const categoryGroup = screen.getByRole("radiogroup", {
      name: /^category$/i,
    });
    expect(
      within(categoryGroup).getByRole("button", { name: /badminton/i })
    ).toHaveAttribute("aria-pressed", "true");
  });
});

describe("QuickExpenseDrawer — prefill", () => {
  it("opens and populates fields when EXPENSE_PREFILL_EVENT fires", async () => {
    renderDrawer();
    expect(
      screen.queryByPlaceholderText(/what did you spend on/i)
    ).not.toBeInTheDocument();

    act(() => {
      dispatchExpensePrefill({
        amount: 25000,
        note: "Lunch",
      });
    });

    const note = await screen.findByPlaceholderText(/what did you spend on/i);
    expect(note).toHaveValue("Lunch");
    const amount = screen.getByPlaceholderText("0") as HTMLInputElement;
    expect(amount.value).toMatch(/25[.,]?000/);
  });
});

describe("QuickExpenseDrawer — AI prefill", () => {
  const today = dayjs().format("DD/MM/YYYY");

  it("applies an AI budget prefill and does not re-suggest", async () => {
    weeklyBudgetOptionsMock.mockResolvedValue([
      budgetOption({
        id: 2,
        name: "Cà phê",
        icon: "☕",
        color: "amber",
        category: Category.FOOD,
      }),
    ]);
    renderDrawer();

    act(() => {
      dispatchExpensePrefill({
        amount: 35000,
        note: "Cà phê sữa đá",
        date: today,
        budgetId: 2,
        budgetName: "Cà phê",
        budgetIcon: "☕",
        budgetColor: "amber",
        source: "ai",
      });
    });

    const note = await screen.findByPlaceholderText(/what did you spend on/i);
    expect(note).toHaveValue("Cà phê sữa đá");
    const amount = screen.getByPlaceholderText("0") as HTMLInputElement;
    expect(amount.value).toMatch(/35[.,]?000/);

    // The prefilled AI budget must stay selected once the options resolve.
    expect(
      await screen.findByRole("button", { name: /cà phê/i, pressed: true })
    ).toBeInTheDocument();

    // No suggestion fires as a direct result of the prefill flow.
    expect(mutationMocks.suggestBudgetMutateAsync).not.toHaveBeenCalled();

    // A later note blur must not trigger re-suggestion: the ai-prefill source
    // is locked, so the prefilled AI budget stays selected and no suggest
    // request is dispatched as a result of the blur.
    fireEvent.blur(note);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /cà phê/i, pressed: true })
      ).toBeInTheDocument()
    );
    expect(mutationMocks.suggestBudgetMutateAsync).not.toHaveBeenCalled();
  });

  it("lets the drawer suggest when prefilled budgetId is null", async () => {
    weeklyBudgetOptionsMock.mockResolvedValue([
      budgetOption({
        id: 7,
        name: "Coffee",
        icon: "☕",
        color: "amber",
        category: Category.ENTERTAINMENT,
      }),
    ]);
    mutationMocks.suggestBudgetMutateAsync.mockResolvedValue({
      status: "success",
      budgetId: 7,
      confidence: "high",
      reason: "Coffee expense",
    });
    renderDrawer();

    act(() => {
      dispatchExpensePrefill({
        amount: 50000,
        note: "Mua sách",
        budgetId: null,
        source: "ai",
      });
    });

    const note = await screen.findByPlaceholderText(/what did you spend on/i);
    expect(note).toHaveValue("Mua sách");
    const amount = screen.getByPlaceholderText("0") as HTMLInputElement;
    expect(amount.value).toMatch(/50[.,]?000/);

    // budgetId null means no AI lock; the drawer remains free to suggest.
    expect(
      screen.getByRole("button", { name: /no budget/i, pressed: true })
    ).toBeInTheDocument();

    await waitFor(() =>
      expect(
        screen.getByRole("radiogroup", { name: /^budget$/i })
      ).toHaveAttribute("aria-busy", "false")
    );

    fireEvent.blur(note);

    await waitFor(() =>
      expect(mutationMocks.suggestBudgetMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ note: "Mua sách" })
      )
    );
  });
});
