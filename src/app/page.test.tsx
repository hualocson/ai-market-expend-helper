import React, { type PropsWithChildren } from "react";

import { queries } from "@/lib/queries";
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
  it("prefetches dashboard summary and the first expense page", async () => {
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
    expect(prefetchInfiniteQueryMock).toHaveBeenCalledTimes(1);
    expect(prefetchInfiniteQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: expect.arrayContaining(["expenses", "list"]),
        queryFn: expect.any(Function),
        initialPageParam: 0,
      })
    );

    const prefetchOptions = prefetchInfiniteQueryMock.mock.calls[0]?.[0] as {
      queryFn: (context: { pageParam: number }) => Promise<unknown>;
    };
    await prefetchOptions.queryFn({ pageParam: 0 });

    expect(getExpenseListMock).toHaveBeenCalledWith({ limit: 30, offset: 0 });
    expect(prefetchQueryMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        queryKey: queries.dashboard.monthlySummary().queryKey,
      })
    );
    expect(prefetchInfiniteQueryMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        queryKey: queries.expenses.list({ limit: 30 }).queryKey,
        initialPageParam: 0,
      })
    );
    expect(screen.getByTestId("dashboard-header")).toBeInTheDocument();
    expect(screen.getByTestId("expense-list")).toBeInTheDocument();
  });
});
