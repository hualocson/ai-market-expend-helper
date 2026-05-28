import React, { type ReactNode } from "react";

import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import BudgetWeeklyBudgetsClient from "./BudgetWeeklyBudgetsClient";

const queryMocks = vi.hoisted(() => ({
  refetchOverview: vi.fn(),
  useInfiniteQuery: vi.fn(),
  useQuery: vi.fn(),
  useSuspenseQuery: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useInfiniteQuery: queryMocks.useInfiniteQuery,
  useQuery: queryMocks.useQuery,
  useSuspenseQuery: queryMocks.useSuspenseQuery,
}));

vi.mock("@/lib/mutations", () => ({
  useCreateBudgetMutation: () => ({ mutateAsync: vi.fn() }),
  useDeleteBudgetMutation: () => ({ mutateAsync: vi.fn() }),
  useUpdateBudgetMutation: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogContent: () => null,
  DialogDescription: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogFooter: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@/components/ui/drawer", () => ({
  Drawer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerClose: ({ children }: { children: ReactNode }) => (
    <button type="button">{children}</button>
  ),
  DrawerContent: () => null,
  DrawerDescription: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DrawerFooter: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DrawerHeader: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DrawerTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@/components/BudgetTransferDrawer", () => ({
  default: () => null,
}));

vi.mock("@/components/DatePickerSheet", () => ({
  default: () => null,
}));

vi.mock("@/components/ExpenseItemIcon", () => ({
  default: () => null,
}));

vi.mock("@/components/PaidByIcon", () => ({
  default: () => null,
  getPaidByPalette: vi.fn(() => ({
    bg: "",
    border: "",
    fg: "",
    text: "",
  })),
}));

const originalGlobalReact = globalThis.React;

beforeEach(() => {
  globalThis.React = React;
  queryMocks.refetchOverview.mockReset();
  queryMocks.useInfiniteQuery.mockReset();
  queryMocks.useQuery.mockReset();
  queryMocks.useSuspenseQuery.mockReset();
  queryMocks.useSuspenseQuery.mockReturnValue({
    data: { budgets: [] },
    error: null,
    isError: false,
    refetch: queryMocks.refetchOverview,
  });
  queryMocks.useInfiniteQuery.mockReturnValue({
    data: { pages: [], pageParams: [] },
    error: null,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isError: false,
    isFetching: false,
    isFetchingNextPage: false,
    isPending: false,
  });
});

afterEach(() => {
  if (typeof originalGlobalReact === "undefined") {
    Reflect.deleteProperty(globalThis, "React");
    return;
  }

  globalThis.React = originalGlobalReact;
});

describe("BudgetWeeklyBudgetsClient", () => {
  it("reads the budget overview with useSuspenseQuery", () => {
    render(<BudgetWeeklyBudgetsClient weekStartDate="2026-04-01" />);

    expect(queryMocks.useSuspenseQuery).toHaveBeenCalled();
    expect(queryMocks.useQuery).not.toHaveBeenCalled();
  });
});
