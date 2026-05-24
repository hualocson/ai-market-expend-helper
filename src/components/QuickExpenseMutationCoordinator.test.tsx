import React, { type PropsWithChildren } from "react";

import { Category, PaidBy } from "@/enums";
import * as syncRepository from "@/lib/sync/core/repository";
import type {
  ExpenseOutboxOperation,
  LocalExpense,
} from "@/lib/sync/expenses/types";
import {
  QUICK_EXPENSE_RECOVERY_TTL_MS,
  useQuickExpenseRecoveryStore,
} from "@/stores/quick-expense-recovery-store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, waitFor } from "@testing-library/react";
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import QuickExpenseMutationCoordinator from "./QuickExpenseMutationCoordinator";

const toastMock = vi.hoisted(() => ({
  error: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: toastMock,
}));

const createdAt = () => new Date().toISOString();

const localExpense: LocalExpense = {
  entity: "expenses",
  clientId: "expense-client-1",
  serverId: null,
  date: "20/05/2026",
  amount: 45000,
  note: "Recovered lunch",
  category: Category.FOOD,
  paidBy: PaidBy.CUBI,
  budgetId: null,
  budgetName: null,
  syncStatus: "failed",
  lastError: "Invalid payload",
  updatedAt: createdAt(),
  serverUpdatedAt: null,
};

const buildOperation = (
  overrides: Partial<ExpenseOutboxOperation> = {}
): ExpenseOutboxOperation => ({
  operationId: "expense-op-1",
  entity: "expenses",
  type: "create",
  clientId: localExpense.clientId,
  serverId: localExpense.serverId,
  payload: localExpense,
  createdAt: createdAt(),
  attemptCount: 1,
  lastAttemptAt: createdAt(),
  lastError: "Invalid payload",
  ...overrides,
});

const renderCoordinator = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return render(<QuickExpenseMutationCoordinator />, { wrapper });
};

describe("QuickExpenseMutationCoordinator", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    toastMock.error.mockReturnValue("toast-1");
    await syncRepository.clearSyncDb();
    useQuickExpenseRecoveryStore.setState({
      entries: {},
      activeRecoveryOperationId: null,
      dismissedErrorsByOperationId: {},
    });
  });

  it("shows a failed create outbox toast and wires Reopen to recovery", async () => {
    const operation = buildOperation();
    await syncRepository.putSyncOperation(operation);

    renderCoordinator();

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith(
        "Invalid payload",
        expect.objectContaining({
          duration: 9000,
          action: expect.objectContaining({ label: "Reopen" }),
        })
      )
    );

    expect(
      useQuickExpenseRecoveryStore.getState().entries[operation.operationId]
    ).toMatchObject({
      mode: "create",
      clientId: "expense-client-1",
      status: "failed",
      toastId: "toast-1",
    });

    const options = toastMock.error.mock.calls[0]?.[1] as {
      action: { onClick: () => void };
    };
    act(() => {
      options.action.onClick();
    });

    expect(
      useQuickExpenseRecoveryStore.getState().activeRecoveryOperationId
    ).toBe(operation.operationId);
  });

  it("maps failed update outbox operations to edit recovery entries", async () => {
    const operation = buildOperation({
      operationId: "expense-op-edit",
      type: "update",
      serverId: 42,
      payload: {
        ...localExpense,
        serverId: 42,
      },
      lastError: "Budget is invalid",
    });
    await syncRepository.putSyncOperation(operation);

    renderCoordinator();

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith(
        "Budget is invalid",
        expect.any(Object)
      )
    );
    expect(
      useQuickExpenseRecoveryStore.getState().entries[operation.operationId]
    ).toMatchObject({
      mode: "edit",
      transactionId: 42,
      clientId: "expense-client-1",
      serverId: 42,
    });
  });

  it("does not show duplicate toasts for the same failed outbox operation", async () => {
    await syncRepository.putSyncOperation(buildOperation());

    const { rerender } = renderCoordinator();

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledTimes(1));

    rerender(<QuickExpenseMutationCoordinator />);

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledTimes(1));
  });

  it("keeps current recovery entries when the failed outbox read fails", async () => {
    const operation = buildOperation();
    useQuickExpenseRecoveryStore
      .getState()
      .syncFailedOutboxEntries([operation]);
    useQuickExpenseRecoveryStore
      .getState()
      .setActiveRecovery(operation.operationId);
    const listSpy = vi
      .spyOn(syncRepository, "listQueuedSyncOperations")
      .mockRejectedValueOnce(new Error("IDB unavailable"));

    renderCoordinator();

    await waitFor(() => expect(listSpy).toHaveBeenCalled());
    expect(
      useQuickExpenseRecoveryStore.getState().entries[operation.operationId]
    ).toBeDefined();
    expect(
      useQuickExpenseRecoveryStore.getState().activeRecoveryOperationId
    ).toBe(operation.operationId);
  });

  it("shows recovery for an old queued operation when the failed attempt is recent", async () => {
    await syncRepository.putSyncOperation(
      buildOperation({
        createdAt: new Date(
          Date.now() - QUICK_EXPENSE_RECOVERY_TTL_MS - 60_000
        ).toISOString(),
        lastAttemptAt: new Date(Date.now() - 60_000).toISOString(),
      })
    );

    renderCoordinator();

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledTimes(1));
  });

  it("ignores failed outbox operations after the recovery TTL expires", async () => {
    const expiredAt = new Date(
      Date.now() - QUICK_EXPENSE_RECOVERY_TTL_MS - 1
    ).toISOString();

    await syncRepository.putSyncOperation(
      buildOperation({
        createdAt: expiredAt,
        lastAttemptAt: expiredAt,
      })
    );

    renderCoordinator();

    await waitFor(() => expect(toastMock.error).not.toHaveBeenCalled());
    expect(useQuickExpenseRecoveryStore.getState().entries).toEqual({});
  });
});
