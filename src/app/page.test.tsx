import React, { type PropsWithChildren } from "react";

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Home from "./page";

const prefetchQueryMock = vi.hoisted(() => vi.fn());
const prefetchInfiniteQueryMock = vi.hoisted(() => vi.fn());
const getDashboardMonthlySummaryMock = vi.hoisted(() => vi.fn());
const getExpenseListMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/get-query-client", () => ({
  getQueryClient: () => ({
    prefetchQuery: prefetchQueryMock,
    prefetchInfiniteQuery: prefetchInfiniteQueryMock,
  }),
}));

vi.mock("@/lib/services/dashboard", () => ({
  getDashboardMonthlySummary: getDashboardMonthlySummaryMock,
}));

vi.mock("@/lib/services/expenses", () => ({
  getExpenseList: getExpenseListMock,
}));

vi.mock("@tanstack/react-query", () => ({
  HydrationBoundary: ({ children }: PropsWithChildren) => (
    <div data-testid="hydration-boundary">{children}</div>
  ),
  dehydrate: vi.fn(() => ({ dehydrated: true })),
}));

vi.mock("@/components/ExpenseList", () => ({
  default: () => <div data-testid="expense-list" />,
}));

vi.mock("@/components/SpendingDashboardHeader", () => ({
  default: () => <div data-testid="dashboard-header" />,
}));

const originalGlobalReact = globalThis.React;

beforeEach(() => {
  globalThis.React = React;
});

afterEach(() => {
  if (typeof originalGlobalReact === "undefined") {
    Reflect.deleteProperty(globalThis, "React");
  } else {
    globalThis.React = originalGlobalReact;
  }
});

describe("Home page", () => {
  it("prefetches dashboard summary without hydrating expenses from the server", async () => {
    prefetchQueryMock.mockResolvedValue(undefined);
    prefetchInfiniteQueryMock.mockResolvedValue(undefined);

    render(await Home());

    expect(prefetchQueryMock).toHaveBeenCalledTimes(1);
    expect(prefetchQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: expect.arrayContaining(["dashboard", "monthlySummary"]),
        queryFn: expect.any(Function),
      })
    );
    expect(prefetchInfiniteQueryMock).not.toHaveBeenCalled();
    expect(getExpenseListMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("dashboard-header")).toBeInTheDocument();
    expect(screen.getByTestId("expense-list")).toBeInTheDocument();
  });
});
