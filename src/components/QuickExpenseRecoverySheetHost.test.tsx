import React from "react";

import { Category, PaidBy } from "@/enums";
import type { BudgetWeeklyOption } from "@/lib/queries/budget-weekly";
import {
  type TQuickExpenseRecoveryEntry,
  useQuickExpenseRecoveryStore,
} from "@/stores/quick-expense-recovery-store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsStoreProvider } from "@/components/providers/StoreProvider";

import QuickExpenseRecoverySheetHost from "./QuickExpenseRecoverySheetHost";

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

const originalGlobalReact = (globalThis as unknown as Record<string, unknown>)
  .React;

const buildRecoveryEntry = (
  override: Partial<TQuickExpenseRecoveryEntry> = {}
): TQuickExpenseRecoveryEntry => ({
  operationId: "recovery-1",
  mode: "create",
  draft: {
    date: "20/05/2026",
    amount: 45000,
    note: "Recovered lunch",
    category: Category.FOOD,
    budgetId: null,
    paidBy: PaidBy.OTHER,
  },
  payload: {
    date: "20/05/2026",
    amount: 45000,
    note: "Recovered lunch",
    category: Category.FOOD,
    budgetId: null,
    paidBy: PaidBy.OTHER,
  },
  status: "failed",
  createdAt: Date.now(),
  ...override,
});

const renderHost = () => {
  (globalThis as unknown as Record<string, unknown>).React = React;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <SettingsStoreProvider>
        <QuickExpenseRecoverySheetHost />
      </SettingsStoreProvider>
    </QueryClientProvider>
  );
};

describe("QuickExpenseRecoverySheetHost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    weeklyBudgetOptionsMock.mockResolvedValue([]);
    useQuickExpenseRecoveryStore.setState({
      entries: {},
      activeRecoveryOperationId: null,
    });
  });

  afterEach(() => {
    if (typeof originalGlobalReact === "undefined") {
      Reflect.deleteProperty(globalThis, "React");
    } else {
      (globalThis as unknown as Record<string, unknown>).React =
        originalGlobalReact;
    }
  });

  it("opens a failed create recovery with the submitted draft", async () => {
    useQuickExpenseRecoveryStore.setState({
      entries: {
        "create-1": buildRecoveryEntry({
          operationId: "create-1",
          mode: "create",
        }),
      },
      activeRecoveryOperationId: "create-1",
    });

    renderHost();

    expect(
      await screen.findByPlaceholderText(/what did you spend on/i)
    ).toHaveValue("Recovered lunch");
    expect(screen.getByPlaceholderText("0")).toHaveValue("45.000");
    expect(
      screen.getByRole("button", { name: /save expense/i })
    ).toBeInTheDocument();
  });

  it("opens a failed edit recovery and preserves transaction id on submit", async () => {
    const user = userEvent.setup();
    useQuickExpenseRecoveryStore.setState({
      entries: {
        "edit-1": buildRecoveryEntry({
          operationId: "edit-1",
          mode: "edit",
          transactionId: 42,
          draft: {
            date: "21/05/2026",
            amount: 90000,
            note: "Recovered court",
            category: Category.BADMINTON,
            budgetId: null,
            paidBy: PaidBy.EMBE,
          },
          payload: {
            date: "21/05/2026",
            amount: 90000,
            note: "Recovered court",
            category: Category.BADMINTON,
            budgetId: null,
            paidBy: PaidBy.EMBE,
          },
        }),
      },
      activeRecoveryOperationId: "edit-1",
    });

    renderHost();

    expect(
      await screen.findByPlaceholderText(/what did you spend on/i)
    ).toHaveValue("Recovered court");
    expect(screen.getByPlaceholderText("0")).toHaveValue("90.000");

    await user.click(screen.getByRole("button", { name: /update expense/i }));

    expect(
      Object.values(useQuickExpenseRecoveryStore.getState().entries)
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          mode: "edit",
          transactionId: 42,
          status: "queued",
          draft: expect.objectContaining({
            amount: 90000,
            note: "Recovered court",
          }),
        }),
      ])
    );
  });

  it("clears active recovery when the sheet closes", async () => {
    const user = userEvent.setup();
    useQuickExpenseRecoveryStore.setState({
      entries: {
        "create-1": buildRecoveryEntry({
          operationId: "create-1",
          mode: "create",
        }),
      },
      activeRecoveryOperationId: "create-1",
    });

    renderHost();

    await user.click(await screen.findByRole("button", { name: /close/i }));

    await waitFor(() =>
      expect(
        useQuickExpenseRecoveryStore.getState().activeRecoveryOperationId
      ).toBeNull()
    );
  });

  it("renders nothing when active id is missing or entry is not failed", () => {
    useQuickExpenseRecoveryStore.setState({
      entries: {},
      activeRecoveryOperationId: "missing",
    });

    const { unmount } = renderHost();

    expect(
      screen.queryByPlaceholderText(/what did you spend on/i)
    ).not.toBeInTheDocument();
    unmount();

    useQuickExpenseRecoveryStore.setState({
      entries: {
        "queued-1": buildRecoveryEntry({
          operationId: "queued-1",
          status: "queued",
        }),
      },
      activeRecoveryOperationId: "queued-1",
    });
    renderHost();

    expect(
      screen.queryByPlaceholderText(/what did you spend on/i)
    ).not.toBeInTheDocument();
  });
});
