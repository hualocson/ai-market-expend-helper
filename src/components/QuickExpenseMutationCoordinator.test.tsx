import React, { type PropsWithChildren } from "react";

import { Category, PaidBy } from "@/enums";
import {
  QUICK_EXPENSE_RECOVERY_TTL_MS,
  useQuickExpenseRecoveryStore,
  type TQuickExpenseRecoveryEntry,
  type TQuickExpensePayload,
} from "@/stores/quick-expense-recovery-store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import QuickExpenseMutationCoordinator from "./QuickExpenseMutationCoordinator";

const mutationMocks = vi.hoisted(() => ({
  createMutateAsync: vi.fn(),
  updateMutateAsync: vi.fn(),
}));

const toastMock = vi.hoisted(() => ({
  loading: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

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

const payload: TQuickExpensePayload = {
  date: "2026-05-23",
  amount: 45000,
  note: "Coffee",
  category: Category.FOOD,
  paidBy: PaidBy.CUBI,
  budgetId: null,
};

const buildEntry = (
  overrides: Partial<TQuickExpenseRecoveryEntry> = {}
): TQuickExpenseRecoveryEntry => ({
  operationId: "quick-expense-op",
  mode: "create",
  draft: payload,
  payload,
  status: "queued",
  createdAt: Date.now(),
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

const enqueue = (entry: TQuickExpenseRecoveryEntry) => {
  act(() => {
    useQuickExpenseRecoveryStore.getState().enqueue(entry);
  });
};

const deferred = <T,>() => {
  let resolve: (value: T) => void = () => {};
  let reject: (error: unknown) => void = () => {};
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
};

describe("QuickExpenseMutationCoordinator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    toastMock.loading.mockReturnValue("loading-toast");
    mutationMocks.createMutateAsync.mockResolvedValue({ id: 1 });
    mutationMocks.updateMutateAsync.mockResolvedValue({ id: 2 });
    useQuickExpenseRecoveryStore.setState({
      entries: {},
      activeRecoveryOperationId: null,
    });
  });

  it("starts a queued create operation and clears it on success", async () => {
    const entry = buildEntry();
    enqueue(entry);

    renderCoordinator();

    await waitFor(() =>
      expect(mutationMocks.createMutateAsync).toHaveBeenCalledWith(payload)
    );
    await waitFor(() =>
      expect(useQuickExpenseRecoveryStore.getState().entries[entry.operationId])
        .toBeUndefined()
    );
  });

  it("starts a queued edit operation and clears it on success", async () => {
    const entry = buildEntry({
      mode: "edit",
      transactionId: 123,
      operationId: "quick-expense-edit",
    });
    enqueue(entry);

    renderCoordinator();

    await waitFor(() =>
      expect(mutationMocks.updateMutateAsync).toHaveBeenCalledWith({
        id: 123,
        input: payload,
      })
    );
    await waitFor(() =>
      expect(useQuickExpenseRecoveryStore.getState().entries[entry.operationId])
        .toBeUndefined()
    );
  });

  it("creates a loading toast and reuses its stored id for success", async () => {
    const entry = buildEntry();
    toastMock.loading.mockReturnValue("toast-123");
    enqueue(entry);

    renderCoordinator();

    await waitFor(() =>
      expect(toastMock.loading).toHaveBeenCalledWith("Adding expense...")
    );
    await waitFor(() =>
      expect(toastMock.success).toHaveBeenCalledWith("Expense added", {
        id: "toast-123",
      })
    );
  });

  it("marks failed operations and wires Reopen to the recovery entry", async () => {
    const entry = buildEntry();
    mutationMocks.createMutateAsync.mockRejectedValue(new Error("Network down"));
    enqueue(entry);

    renderCoordinator();

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith(
        "Network down",
        expect.objectContaining({
          id: "loading-toast",
          action: expect.objectContaining({ label: "Reopen" }),
        })
      )
    );

    const failedEntry =
      useQuickExpenseRecoveryStore.getState().entries[entry.operationId];
    expect(failedEntry).toMatchObject({ status: "failed" });

    const options = toastMock.error.mock.calls[0]?.[1] as {
      action: { onClick: () => void };
    };
    act(() => {
      options.action.onClick();
    });

    expect(
      useQuickExpenseRecoveryStore.getState().activeRecoveryOperationId
    ).toBe(entry.operationId);
  });

  it("shows success and clears when the loading toast id is missing", async () => {
    const entry = buildEntry();
    toastMock.loading.mockReturnValue(undefined);
    enqueue(entry);

    renderCoordinator();

    await waitFor(() =>
      expect(toastMock.success).toHaveBeenCalledWith(
        "Expense added",
        expect.objectContaining({ id: undefined })
      )
    );
    expect(
      useQuickExpenseRecoveryStore.getState().entries[entry.operationId]
    ).toBeUndefined();
  });

  it("shows error and marks failed when the loading toast id is missing", async () => {
    const entry = buildEntry({ mode: "edit", transactionId: 321 });
    toastMock.loading.mockReturnValue(undefined);
    mutationMocks.updateMutateAsync.mockRejectedValue("bad response");
    enqueue(entry);

    renderCoordinator();

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith(
        "Failed to update expense",
        expect.objectContaining({ id: undefined })
      )
    );
    expect(
      useQuickExpenseRecoveryStore.getState().entries[entry.operationId]
    ).toMatchObject({ status: "failed" });
  });

  it("marks edit entries without a transaction id failed and wires Reopen", async () => {
    const entry = buildEntry({
      mode: "edit",
      operationId: "quick-expense-invalid-edit",
    });
    enqueue(entry);

    renderCoordinator();

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith(
        "Failed to update expense",
        expect.objectContaining({
          id: "loading-toast",
          action: expect.objectContaining({ label: "Reopen" }),
        })
      )
    );

    expect(mutationMocks.updateMutateAsync).not.toHaveBeenCalled();
    expect(
      useQuickExpenseRecoveryStore.getState().entries[entry.operationId]
    ).toMatchObject({ status: "failed" });

    const options = toastMock.error.mock.calls[0]?.[1] as {
      action: { onClick: () => void };
    };
    act(() => {
      options.action.onClick();
    });

    expect(
      useQuickExpenseRecoveryStore.getState().activeRecoveryOperationId
    ).toBe(entry.operationId);
  });

  it("does not process entries already marked running", async () => {
    enqueue(buildEntry({ status: "running" }));

    renderCoordinator();

    await waitFor(() =>
      expect(mutationMocks.createMutateAsync).not.toHaveBeenCalled()
    );
    expect(mutationMocks.updateMutateAsync).not.toHaveBeenCalled();
    expect(toastMock.loading).not.toHaveBeenCalled();
  });

  it("prunes expired entries before processing queued operations", async () => {
    const expiredEntry = buildEntry({
      operationId: "quick-expense-expired",
      createdAt: Date.now() - QUICK_EXPENSE_RECOVERY_TTL_MS - 1,
    });
    enqueue(expiredEntry);

    renderCoordinator();

    await waitFor(() =>
      expect(
        useQuickExpenseRecoveryStore.getState().entries[
          expiredEntry.operationId
        ]
      ).toBeUndefined()
    );
    expect(mutationMocks.createMutateAsync).not.toHaveBeenCalled();
    expect(toastMock.loading).not.toHaveBeenCalled();
  });

  it("does not duplicate the same queued entry while it is in flight", async () => {
    const inFlight = deferred<{ id: number }>();
    mutationMocks.createMutateAsync.mockReturnValue(inFlight.promise);
    const entry = buildEntry();
    enqueue(entry);

    const { rerender } = renderCoordinator();

    await waitFor(() =>
      expect(mutationMocks.createMutateAsync).toHaveBeenCalledTimes(1)
    );

    rerender(<QuickExpenseMutationCoordinator />);

    await waitFor(() =>
      expect(mutationMocks.createMutateAsync).toHaveBeenCalledTimes(1)
    );

    await act(async () => {
      inFlight.resolve({ id: 1 });
      await inFlight.promise;
    });
  });
});
