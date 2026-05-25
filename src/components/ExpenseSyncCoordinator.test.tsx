import React, { type PropsWithChildren } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ExpenseSyncCoordinator from "./ExpenseSyncCoordinator";

const requestExpenseSyncMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/sync/expenses/scheduler", () => ({
  requestExpenseSync: requestExpenseSyncMock,
}));

const renderCoordinator = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return render(<ExpenseSyncCoordinator />, { wrapper });
};

describe("ExpenseSyncCoordinator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not emit console errors for background sync failures", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    requestExpenseSyncMock.mockRejectedValue(
      new Error("Failed to sync expenses")
    );

    renderCoordinator();

    await waitFor(() =>
      expect(requestExpenseSyncMock).toHaveBeenCalledTimes(1)
    );
    await waitFor(() => expect(consoleError).not.toHaveBeenCalled());
  });

  it("requests queued sync on mount, online, and focus", async () => {
    requestExpenseSyncMock.mockResolvedValue(undefined);

    renderCoordinator();
    await waitFor(() =>
      expect(requestExpenseSyncMock).toHaveBeenCalledTimes(1)
    );

    window.dispatchEvent(new Event("online"));
    window.dispatchEvent(new Event("focus"));

    await waitFor(() =>
      expect(requestExpenseSyncMock).toHaveBeenCalledTimes(3)
    );
  });
});
