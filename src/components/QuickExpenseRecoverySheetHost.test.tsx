import React from "react";

import { Category, PaidBy } from "@/enums";
import type { BudgetWeeklyOption } from "@/lib/queries/budget-weekly";
import type {
  ExpenseOutboxOperation,
  LocalExpense,
} from "@/lib/sync/expenses/types";
import { useQuickExpenseRecoveryStore } from "@/stores/quick-expense-recovery-store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsStoreProvider } from "@/components/providers/StoreProvider";

import QuickExpenseRecoverySheetHost from "./QuickExpenseRecoverySheetHost";

const mutationMocks = vi.hoisted(() => ({
  createMutateAsync: vi.fn(),
  updateMutateAsync: vi.fn(),
}));

vi.mock("@/lib/mutations", () => ({
  useCreateExpenseMutation: () => ({
    mutateAsync: mutationMocks.createMutateAsync,
  }),
  useUpdateExpenseMutation: () => ({
    mutateAsync: mutationMocks.updateMutateAsync,
  }),
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

const originalGlobalReact = (globalThis as unknown as Record<string, unknown>)
  .React;

const localExpense: LocalExpense = {
  entity: "expenses",
  clientId: "expense-client-1",
  serverId: null,
  date: "20/05/2026",
  amount: 45000,
  note: "Recovered lunch",
  category: Category.FOOD,
  budgetId: null,
  budgetName: null,
  paidBy: PaidBy.OTHER,
  syncStatus: "failed",
  lastError: "Invalid payload",
  updatedAt: "2026-05-24T09:00:00.000Z",
  serverUpdatedAt: null,
};

const buildOperation = (
  override: Partial<ExpenseOutboxOperation> = {}
): ExpenseOutboxOperation => ({
  operationId: "recovery-1",
  entity: "expenses",
  type: "create",
  clientId: localExpense.clientId,
  serverId: localExpense.serverId,
  payload: localExpense,
  createdAt: "2026-05-24T09:00:00.000Z",
  attemptCount: 1,
  lastAttemptAt: "2026-05-24T09:01:00.000Z",
  lastError: "Invalid payload",
  ...override,
});

const activateRecovery = (operation: ExpenseOutboxOperation) => {
  useQuickExpenseRecoveryStore
    .getState()
    .syncFailedOutboxEntries([operation], Date.parse(operation.createdAt));
  useQuickExpenseRecoveryStore
    .getState()
    .setActiveRecovery(operation.operationId);
};

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
    mutationMocks.createMutateAsync.mockResolvedValue({
      clientId: "expense-client-1",
    });
    mutationMocks.updateMutateAsync.mockResolvedValue({
      clientId: "expense-client-1",
    });
    weeklyBudgetOptionsMock.mockResolvedValue([]);
    useQuickExpenseRecoveryStore.setState({
      entries: {},
      activeRecoveryOperationId: null,
      dismissedErrorsByOperationId: {},
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

  it("opens a failed create recovery with the failed outbox draft", async () => {
    activateRecovery(buildOperation());

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
    activateRecovery(
      buildOperation({
        operationId: "edit-1",
        type: "update",
        serverId: 42,
        payload: {
          ...localExpense,
          serverId: 42,
          date: "21/05/2026",
          amount: 90000,
          note: "Recovered court",
          category: Category.BADMINTON,
          paidBy: PaidBy.EMBE,
        },
      })
    );

    renderHost();

    expect(
      await screen.findByPlaceholderText(/what did you spend on/i)
    ).toHaveValue("Recovered court");
    expect(screen.getByPlaceholderText("0")).toHaveValue("90.000");

    await user.click(screen.getByRole("button", { name: /^update$/i }));

    await waitFor(() =>
      expect(mutationMocks.updateMutateAsync).toHaveBeenCalledWith({
        id: 42,
        input: expect.objectContaining({
          clientId: "expense-client-1",
          amount: 90000,
          note: "Recovered court",
        }),
      })
    );
  });

  it("clears active recovery when the sheet closes", async () => {
    const user = userEvent.setup();
    activateRecovery(buildOperation());

    renderHost();

    await user.click(await screen.findByRole("button", { name: /close/i }));

    await waitFor(() =>
      expect(
        useQuickExpenseRecoveryStore.getState().activeRecoveryOperationId
      ).toBeNull()
    );
  });

  it("renders nothing when active id is missing", () => {
    useQuickExpenseRecoveryStore.setState({
      entries: {},
      activeRecoveryOperationId: "missing",
      dismissedErrorsByOperationId: {},
    });

    renderHost();

    expect(
      screen.queryByPlaceholderText(/what did you spend on/i)
    ).not.toBeInTheDocument();
  });
});
