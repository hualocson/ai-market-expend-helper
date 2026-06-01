import React from "react";

import type { MonthlyReportInsights as MonthlyReportInsightsData } from "@/lib/reports/monthly-insights";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import MonthlyReportInsights from "./MonthlyReportInsights";

const baseInsights: MonthlyReportInsightsData = {
  pulse: {
    selectedMonth: "2026-05",
    selectedTotal: 500_000,
    previousMonth: "2026-04",
    previousMonthTotal: 400_000,
    previousMonthDelta: 100_000,
    previousMonthDeltaPercent: 25,
    priorThreeMonthAverage: 300_000,
    priorThreeMonthDelta: 200_000,
    priorThreeMonthDeltaPercent: 66.7,
    hasPreviousMonth: true,
    hasPriorThreeMonthBaseline: true,
  },
  budgetVariance: {
    summary: {
      totalAllowance: 1_000_000,
      totalAssignedSpend: 500_000,
      totalVariance: 500_000,
      unassignedSpend: 50_000,
    },
    rows: [
      {
        budgetId: 1,
        name: "Coffee",
        icon: "☕",
        color: "amber",
        period: "month",
        periodStartDate: "2026-05-01",
        periodEndDate: "2026-05-31",
        allowance: 1_000_000,
        assignedSpend: 500_000,
        variance: 500_000,
        percentUsed: 50,
        status: "under",
      },
    ],
  },
  monthTrend: [
    { month: "2026-04", total: 400_000, isSelected: false },
    { month: "2026-05", total: 500_000, isSelected: true },
  ],
  topMerchants: [
    {
      key: "ca-phe-highlands",
      label: "Cà Phê Highlands",
      total: 170_000,
      count: 2,
      representativeNotes: ["Cà phê Highlands 80k"],
      topCategory: "Food",
      topPaidBy: "Loc",
    },
  ],
  recurringSpend: [
    {
      key: "spotify",
      label: "Spotify",
      cadence: "monthly",
      confidence: "high",
      matchedExpenseIds: [1, 2, 3],
      evidenceDates: ["2026-03-05", "2026-04-05", "2026-05-05"],
      representativeNotes: ["Spotify"],
      averageAmount: 99_000,
      selectedMonthImpact: 99_000,
    },
  ],
};

describe("MonthlyReportInsights", () => {
  it("renders the monthly insight narrative", () => {
    render(<MonthlyReportInsights insights={baseInsights} />);

    expect(screen.getByText("Monthly pulse")).toBeInTheDocument();
    expect(screen.getByText("Budget variance")).toBeInTheDocument();
    expect(screen.getByText("6-month trend")).toBeInTheDocument();
    expect(screen.getByText("Top merchants from notes")).toBeInTheDocument();
    expect(screen.getByText("Recurring spend")).toBeInTheDocument();
    expect(screen.getByText("Cà Phê Highlands")).toBeInTheDocument();
    expect(screen.getByText("Spotify")).toBeInTheDocument();
  });

  it("renders neutral empty states", () => {
    render(
      <MonthlyReportInsights
        insights={{
          ...baseInsights,
          budgetVariance: {
            summary: {
              totalAllowance: 0,
              totalAssignedSpend: 0,
              totalVariance: 0,
              unassignedSpend: 0,
            },
            rows: [],
          },
          monthTrend: [],
          topMerchants: [],
          recurringSpend: [],
        }}
      />
    );

    expect(
      screen.getByText("No assigned budget spend this month.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("No merchant groups found for this month.")
    ).toBeInTheDocument();
    expect(screen.getByText("No monthly trend data yet.")).toBeInTheDocument();
    expect(
      screen.getByText("No recurring patterns detected yet.")
    ).toBeInTheDocument();
  });

  it("renders rows with unusually large VND values", () => {
    const extremeAmount = 123_456_789_012_345;

    render(
      <MonthlyReportInsights
        insights={{
          ...baseInsights,
          pulse: {
            ...baseInsights.pulse,
            previousMonthTotal: extremeAmount,
            priorThreeMonthAverage: extremeAmount,
          },
          budgetVariance: {
            summary: {
              totalAllowance: extremeAmount,
              totalAssignedSpend: extremeAmount,
              totalVariance: 0,
              unassignedSpend: extremeAmount,
            },
            rows: [
              {
                ...baseInsights.budgetVariance.rows[0],
                assignedSpend: extremeAmount,
              },
            ],
          },
          topMerchants: [
            {
              ...baseInsights.topMerchants[0],
              total: extremeAmount,
            },
          ],
          recurringSpend: [
            {
              ...baseInsights.recurringSpend[0],
              averageAmount: extremeAmount,
              selectedMonthImpact: extremeAmount,
            },
          ],
        }}
      />
    );

    expect(screen.getByText("Coffee")).toBeInTheDocument();
    expect(screen.getByText("Cà Phê Highlands")).toBeInTheDocument();
    expect(screen.getByText("Spotify")).toBeInTheDocument();
    expect(screen.getAllByText("123.456.789.012.345").length).toBeGreaterThan(
      0
    );
    expect(screen.getByText("Previous month").nextElementSibling).toHaveClass(
      "max-w-full",
      "flex-wrap",
      "break-all"
    );
    expect(screen.getByText("3-month avg").nextElementSibling).toHaveClass(
      "max-w-full",
      "flex-wrap",
      "break-all"
    );
    expect(screen.getByText("Unassigned spend").parentElement).toHaveClass(
      "flex-col",
      "items-start",
      "sm:flex-row"
    );
  });
});
