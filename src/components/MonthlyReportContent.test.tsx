import React from "react";

import { queries } from "@/lib/queries";
import type { MonthlyReport } from "@/lib/services/reports";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import MonthlyReportContent from "./MonthlyReportContent";

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

vi.mock("@/components/ExpenseMonthTabs", () => ({
  default: ({
    items,
  }: {
    items: Array<{ isActive: boolean; label: string }>;
  }) => (
    <div data-testid="month-tabs">
      {items.find((item) => item.isActive)?.label}
    </div>
  ),
}));

vi.mock("@/components/PaidByIcon", () => ({
  default: ({ paidBy }: { paidBy: string }) => (
    <span data-testid="paid-by-icon">{paidBy}</span>
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

describe("MonthlyReportContent", () => {
  it("renders hydrated monthly report data without an immediate fetch", () => {
    globalThis.React = React;

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 60 * 1000,
        },
      },
    });
    const payload: MonthlyReport = {
      activeMonth: "2026-05",
      categoryTotals: [
        { category: "Food", total: 250_000 },
        { category: "Transport", total: 100_000 },
      ],
      insights: {
        pulse: {
          selectedMonth: "2026-05",
          selectedTotal: 350_000,
          previousMonth: "2026-04",
          previousMonthTotal: 300_000,
          previousMonthDelta: 50_000,
          previousMonthDeltaPercent: 16.7,
          priorThreeMonthAverage: 250_000,
          priorThreeMonthDelta: 100_000,
          priorThreeMonthDeltaPercent: 40,
          hasPreviousMonth: true,
          hasPriorThreeMonthBaseline: true,
        },
        budgetVariance: {
          summary: {
            totalAllowance: 500_000,
            totalAssignedSpend: 350_000,
            totalVariance: 150_000,
            unassignedSpend: 0,
          },
          rows: [],
        },
        monthTrend: [{ month: "2026-05", total: 350_000, isSelected: true }],
        topMerchants: [],
        recurringSpend: [],
      },
      paidByCategoryTotals: [
        { paidBy: "Loc", category: "Food", total: 150_000 },
        { paidBy: "Sachi", category: "Food", total: 100_000 },
      ],
      paidByTotalSpent: 350_000,
      paidByTotals: [
        { paidBy: "Loc", total: 200_000 },
        { paidBy: "Sachi", total: 150_000 },
      ],
    };
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    queryClient.setQueryData(
      queries.reports.monthly("2026-05").queryKey,
      payload
    );

    render(
      <QueryClientProvider client={queryClient}>
        <MonthlyReportContent selectedMonth="2026-05" />
      </QueryClientProvider>
    );

    expect(screen.getByRole("heading", { name: "Report" })).toBeInTheDocument();
    expect(screen.getByText("May 2026")).toBeInTheDocument();
    expect(screen.getByTestId("month-tabs")).toHaveTextContent("May");
    expect(screen.getByText("Monthly pulse")).toBeInTheDocument();
    expect(screen.getByText("Budget variance")).toBeInTheDocument();
    expect(screen.getByText("6-month trend")).toBeInTheDocument();
    expect(screen.getByText("May 2026 - All")).toBeInTheDocument();
    expect(screen.getByText("May 2026 - Loc")).toBeInTheDocument();
    expect(screen.getByText("May 2026 - Sachi")).toBeInTheDocument();
    expect(screen.getByText("Spending by payer")).toBeInTheDocument();
    expect(screen.getAllByText("350.000").length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
