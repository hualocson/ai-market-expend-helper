import React from "react";

import type { MonthlyReportInsights as MonthlyReportInsightsData } from "@/lib/reports/monthly-insights";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

type BudgetVarianceRow =
  MonthlyReportInsightsData["budgetVariance"]["rows"][number];

const budgetRow = (
  overrides: Partial<BudgetVarianceRow>
): BudgetVarianceRow => ({
  budgetId: overrides.budgetId ?? 100,
  name: overrides.name ?? "Budget row",
  icon: overrides.icon ?? "💸",
  color: overrides.color ?? "amber",
  period: overrides.period ?? "week",
  periodStartDate: overrides.periodStartDate ?? "2026-05-05",
  periodEndDate: overrides.periodEndDate ?? "2026-05-11",
  allowance: overrides.allowance ?? 700_000,
  assignedSpend: overrides.assignedSpend ?? 100_000,
  variance: overrides.variance ?? 600_000,
  percentUsed: overrides.percentUsed ?? 14.3,
  status: overrides.status ?? "under",
});

const denseWeeklyRows: BudgetVarianceRow[] = [
  budgetRow({
    budgetId: 1,
    name: "Week 1 over",
    status: "over",
    assignedSpend: 900_000,
    allowance: 700_000,
    variance: -200_000,
    percentUsed: 128.6,
    periodStartDate: "2026-05-05",
    periodEndDate: "2026-05-11",
  }),
  budgetRow({
    budgetId: 2,
    name: "Week 2 near",
    status: "near",
    assignedSpend: 620_000,
    allowance: 700_000,
    variance: 80_000,
    percentUsed: 88.6,
    periodStartDate: "2026-05-12",
    periodEndDate: "2026-05-18",
  }),
  budgetRow({
    budgetId: 3,
    name: "Week 1 large",
    status: "under",
    assignedSpend: 500_000,
    allowance: 700_000,
    variance: 200_000,
    percentUsed: 71.4,
    periodStartDate: "2026-05-05",
    periodEndDate: "2026-05-11",
  }),
  budgetRow({
    budgetId: 4,
    name: "Week 2 medium",
    status: "under",
    assignedSpend: 300_000,
    allowance: 700_000,
    variance: 400_000,
    percentUsed: 42.9,
    periodStartDate: "2026-05-12",
    periodEndDate: "2026-05-18",
  }),
  budgetRow({
    budgetId: 5,
    name: "Week 3 medium",
    status: "under",
    assignedSpend: 250_000,
    allowance: 700_000,
    variance: 450_000,
    percentUsed: 35.7,
    periodStartDate: "2026-05-19",
    periodEndDate: "2026-05-25",
  }),
  budgetRow({
    budgetId: 6,
    name: "Week 4 hidden",
    status: "under",
    assignedSpend: 200_000,
    allowance: 700_000,
    variance: 500_000,
    percentUsed: 28.6,
    periodStartDate: "2026-05-26",
    periodEndDate: "2026-05-31",
  }),
  budgetRow({
    budgetId: 7,
    name: "Week 1 smallest",
    status: "under",
    assignedSpend: 50_000,
    allowance: 700_000,
    variance: 650_000,
    percentUsed: 7.1,
    periodStartDate: "2026-05-05",
    periodEndDate: "2026-05-11",
  }),
];

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

  it("shows a prioritized collapsed budget subset when many weekly budgets exist", () => {
    render(
      <MonthlyReportInsights
        insights={{
          ...baseInsights,
          budgetVariance: {
            summary: {
              totalAllowance: 4_900_000,
              totalAssignedSpend: 2_820_000,
              totalVariance: 2_080_000,
              unassignedSpend: 0,
            },
            rows: denseWeeklyRows,
          },
        }}
      />
    );

    expect(screen.getByText("7 budgets")).toBeInTheDocument();
    expect(screen.getByText("1 over")).toBeInTheDocument();
    expect(screen.getByText("1 near")).toBeInTheDocument();
    expect(screen.getByText("Week 1 over")).toBeInTheDocument();
    expect(screen.getByText("Week 2 near")).toBeInTheDocument();
    expect(screen.getByText("Week 1 large")).toBeInTheDocument();
    expect(screen.getByText("Week 2 medium")).toBeInTheDocument();
    expect(screen.getByText("Week 3 medium")).toBeInTheDocument();
    expect(screen.queryByText("Week 4 hidden")).not.toBeInTheDocument();
    expect(screen.queryByText("Week 1 smallest")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show all 2 more budgets" })
    ).toBeInTheDocument();
  });

  it("expands dense weekly budgets into one-line icon rollups", async () => {
    const user = userEvent.setup();

    render(
      <MonthlyReportInsights
        insights={{
          ...baseInsights,
          budgetVariance: {
            summary: {
              totalAllowance: 4_900_000,
              totalAssignedSpend: 2_820_000,
              totalVariance: 2_080_000,
              unassignedSpend: 0,
            },
            rows: denseWeeklyRows,
          },
        }}
      />
    );

    await user.click(
      screen.getByRole("button", { name: "Show all 2 more budgets" })
    );

    const firstWeek = screen.getByLabelText("Budget rollup May 5-11");
    expect(within(firstWeek).getByText("May 5-11")).toBeInTheDocument();
    expect(within(firstWeek).getByText("3 budgets")).toBeInTheDocument();
    expect(within(firstWeek).getByText("1 over")).toBeInTheDocument();
    expect(within(firstWeek).getByText(/1\.450\.000/)).toBeInTheDocument();
    expect(firstWeek).not.toHaveTextContent("·");
    expect(firstWeek.textContent).not.toContain("•");

    expect(screen.getByText("Week 4 hidden")).toBeInTheDocument();
    expect(screen.getByText("Week 1 smallest")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show fewer budget rows" })
    ).toBeInTheDocument();
  });

  it("keeps monthly budgets coherent when mixed with dense weekly budgets", async () => {
    const user = userEvent.setup();
    const monthlyRow = budgetRow({
      budgetId: 50,
      name: "Monthly rent",
      period: "month",
      status: "under",
      assignedSpend: 1_000_000,
      allowance: 3_100_000,
      variance: 2_100_000,
      percentUsed: 32.3,
      periodStartDate: "2026-05-01",
      periodEndDate: "2026-05-31",
    });

    render(
      <MonthlyReportInsights
        insights={{
          ...baseInsights,
          budgetVariance: {
            summary: {
              totalAllowance: 8_000_000,
              totalAssignedSpend: 3_820_000,
              totalVariance: 4_180_000,
              unassignedSpend: 0,
            },
            rows: [monthlyRow, ...denseWeeklyRows],
          },
        }}
      />
    );

    await user.click(
      screen.getByRole("button", { name: "Show all 3 more budgets" })
    );

    expect(screen.getByText("Monthly budgets")).toBeInTheDocument();
    expect(screen.getByText("Monthly rent")).toBeInTheDocument();
    expect(screen.getByLabelText("Budget rollup May 5-11")).toBeInTheDocument();
  });
});
