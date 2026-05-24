import React from "react";

import { queries } from "@/lib/queries";
import type { DailyReport } from "@/lib/services/reports";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import DailyReportContent from "./DailyReportContent";

vi.mock("motion/react", () => ({
  motion: {
    div: ({
      animate,
      children,
      initial,
      transition,
      variants,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>) => {
      void animate;
      void initial;
      void transition;
      void variants;

      return <div {...props}>{children}</div>;
    },
  },
  useReducedMotion: () => true,
}));

vi.mock("@/components/CategorySpendPieChart", () => ({
  default: ({ monthLabel }: { monthLabel: string }) => (
    <div data-testid="category-chart">{monthLabel}</div>
  ),
}));

vi.mock("@/components/ExpenseListItem", () => ({
  default: ({ expense }: { expense: { note: string } }) => (
    <div data-testid="expense-item">{expense.note}</div>
  ),
}));

const originalGlobalReact = globalThis.React;

afterEach(() => {
  vi.restoreAllMocks();

  if (typeof originalGlobalReact === "undefined") {
    Reflect.deleteProperty(globalThis, "React");
    return;
  }

  globalThis.React = originalGlobalReact;
});

describe("DailyReportContent", () => {
  it("renders hydrated daily report data without an immediate fetch", () => {
    globalThis.React = React;

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 60 * 1000,
        },
      },
    });
    const payload: DailyReport = {
      activeDate: "2026-05-23",
      dailyCategoryTotals: [{ category: "Food", total: 120_000 }],
      dailyExpenses: [
        {
          id: 1,
          date: "2026-05-23",
          amount: 120_000,
          note: "Lunch",
          category: "Food",
          paidBy: "Loc",
          budgetId: null,
          budgetName: null,
        },
      ],
      dailyRemaining: 30_000,
      dailyTarget: 150_000,
      dateKey: "2026-05-23",
      dayIndex: 6,
      expectedSpendToDate: 900_000,
      hasWeeklyBudget: true,
      monthKey: "2026-05",
      paceDelta: -100_000,
      paceProgress: 0.6,
      paceStatus: "On pace",
      totalSpentToday: 120_000,
      weekEndKey: "2026-05-24",
      weekLabel: "18 May - 24 May",
      weekSpentToDate: 800_000,
      weekStartKey: "2026-05-18",
      weeklyBudgetTotal: 1_050_000,
    };
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    queryClient.setQueryData(
      queries.reports.daily("2026-05-23").queryKey,
      payload
    );

    render(
      <QueryClientProvider client={queryClient}>
        <DailyReportContent date="2026-05-23" />
      </QueryClientProvider>
    );

    expect(
      screen.getByRole("heading", { name: "Daily report" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "" })).toHaveAttribute("href", "/");
    expect(screen.getByText("Saturday, 23 May 2026")).toBeInTheDocument();
    expect(screen.getByText(/-120\.000/)).toBeInTheDocument();
    expect(screen.getByText("1 transactions")).toBeInTheDocument();
    expect(screen.getByText("Day 6 of 7")).toBeInTheDocument();
    expect(screen.getAllByText("On pace")).toHaveLength(2);
    expect(screen.getByText("23 May 2026")).toBeInTheDocument();
    expect(screen.getByTestId("expense-item")).toHaveTextContent("Lunch");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
