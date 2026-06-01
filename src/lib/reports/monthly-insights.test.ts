import { describe, expect, it } from "vitest";

import {
  buildMonthlyReportInsights,
  normalizeMerchantNote,
} from "./monthly-insights";

const expense = (
  overrides: Partial<{
    id: number;
    amount: number;
    date: string;
    note: string;
    category: string;
    paidBy: string;
    budgetId: number | null;
  }>
) => ({
  id: overrides.id ?? 1,
  amount: overrides.amount ?? 100_000,
  date: overrides.date ?? "2026-05-10",
  note: overrides.note ?? "Coffee Highlands 100k",
  category: overrides.category ?? "Food",
  paidBy: overrides.paidBy ?? "Loc",
  budgetId: overrides.budgetId ?? null,
});

const budget = (
  overrides: Partial<{
    id: number;
    name: string;
    amount: number;
    icon: string;
    color:
      | "slate"
      | "rose"
      | "orange"
      | "amber"
      | "yellow"
      | "lime"
      | "green"
      | "emerald"
      | "teal"
      | "cyan"
      | "sky"
      | "blue"
      | "indigo"
      | "violet"
      | "purple"
      | "fuchsia"
      | "pink";
    period: "week" | "month" | "custom";
    periodStartDate: string;
    periodEndDate: string | null;
  }>
) => ({
  id: overrides.id ?? 10,
  name: overrides.name ?? "Coffee",
  amount: overrides.amount ?? 700_000,
  icon: overrides.icon ?? "☕",
  color: overrides.color ?? "amber",
  period: overrides.period ?? "week",
  periodStartDate: overrides.periodStartDate ?? "2026-04-27",
  periodEndDate: overrides.periodEndDate ?? "2026-05-03",
});

describe("monthly report insights", () => {
  it("builds selected, previous, prior average, and six trend points", () => {
    const insights = buildMonthlyReportInsights({
      selectedMonth: "2026-05",
      expenses: [
        expense({ id: 1, date: "2026-01-10", amount: 100_000 }),
        expense({ id: 2, date: "2026-02-10", amount: 200_000 }),
        expense({ id: 3, date: "2026-03-10", amount: 300_000 }),
        expense({ id: 4, date: "2026-04-10", amount: 400_000 }),
        expense({ id: 5, date: "2026-05-10", amount: 500_000 }),
      ],
      budgets: [],
    });

    expect(insights.pulse.selectedTotal).toBe(500_000);
    expect(insights.pulse.selectedMonth).toBe("2026-05");
    expect(insights.pulse.previousMonth).toBe("2026-04");
    expect(insights.pulse.previousMonthTotal).toBe(400_000);
    expect(insights.pulse.previousMonthDelta).toBe(100_000);
    expect(insights.pulse.previousMonthDeltaPercent).toBe(25);
    expect(insights.pulse.priorThreeMonthAverage).toBe(300_000);
    expect(insights.pulse.priorThreeMonthDelta).toBe(200_000);
    expect(insights.pulse.priorThreeMonthDeltaPercent).toBe(66.7);
    expect(insights.monthTrend.map((point) => point.month)).toEqual([
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
    ]);
    expect(insights.monthTrend.map((point) => point.total)).toEqual([
      0, 100_000, 200_000, 300_000, 400_000, 500_000,
    ]);
    expect(insights.monthTrend.map((point) => point.isSelected)).toEqual([
      false,
      false,
      false,
      false,
      false,
      true,
    ]);
  });

  it("returns null percentage deltas when comparison baselines are zero", () => {
    const insights = buildMonthlyReportInsights({
      selectedMonth: "2026-05",
      expenses: [expense({ id: 1, date: "2026-05-10", amount: 500_000 })],
      budgets: [],
    });

    expect(insights.pulse.previousMonthTotal).toBe(0);
    expect(insights.pulse.previousMonthDeltaPercent).toBeNull();
    expect(insights.pulse.priorThreeMonthAverage).toBe(0);
    expect(insights.pulse.priorThreeMonthDeltaPercent).toBeNull();
  });

  it("does not treat partial previous-month history as a prior-three baseline", () => {
    const insights = buildMonthlyReportInsights({
      selectedMonth: "2026-05",
      expenses: [
        expense({ id: 1, date: "2026-04-10", amount: 300_000 }),
        expense({ id: 2, date: "2026-05-10", amount: 500_000 }),
      ],
      budgets: [],
    });

    expect(insights.pulse.hasPreviousMonth).toBe(true);
    expect(insights.pulse.previousMonthTotal).toBe(300_000);
    expect(insights.pulse.previousMonthDelta).toBe(200_000);
    expect(insights.pulse.previousMonthDeltaPercent).toBe(66.7);
    expect(insights.pulse.priorThreeMonthAverage).toBe(0);
    expect(insights.pulse.hasPriorThreeMonthBaseline).toBe(false);
    expect(insights.pulse.priorThreeMonthDelta).toBeNull();
    expect(insights.pulse.priorThreeMonthDeltaPercent).toBeNull();
  });

  it("allows zero-spend prior months when earlier prior-three history exists", () => {
    const insights = buildMonthlyReportInsights({
      selectedMonth: "2026-05",
      expenses: [
        expense({ id: 1, date: "2026-02-10", amount: 100_000 }),
        expense({ id: 2, date: "2026-03-10", amount: 100_000 }),
        expense({ id: 3, date: "2026-05-10", amount: 500_000 }),
      ],
      budgets: [],
    });

    expect(insights.pulse.priorThreeMonthAverage).toBeCloseTo(66_666.67, 2);
    expect(insights.pulse.hasPriorThreeMonthBaseline).toBe(true);
    expect(insights.pulse.priorThreeMonthDelta).toBeCloseTo(433_333.33, 2);
    expect(insights.pulse.priorThreeMonthDeltaPercent).toBe(650);
  });

  it("prorates weekly and monthly budget allowance by selected-month overlap days", () => {
    const insights = buildMonthlyReportInsights({
      selectedMonth: "2026-05",
      expenses: [
        expense({ id: 1, date: "2026-05-01", amount: 100_000, budgetId: 10 }),
        expense({ id: 2, date: "2026-05-15", amount: 600_000, budgetId: 20 }),
        expense({ id: 3, date: "2026-05-16", amount: 50_000, budgetId: null }),
      ],
      budgets: [
        budget({
          id: 10,
          name: "Boundary week",
          amount: 700_000,
          period: "week",
          periodStartDate: "2026-04-27",
          periodEndDate: "2026-05-03",
        }),
        budget({
          id: 20,
          name: "May rent",
          amount: 3_100_000,
          period: "month",
          periodStartDate: "2026-05-01",
          periodEndDate: "2026-05-31",
        }),
      ],
    });

    expect(insights.budgetVariance.summary).toEqual({
      totalAllowance: 3_400_000,
      totalAssignedSpend: 700_000,
      totalVariance: 2_700_000,
      unassignedSpend: 50_000,
    });
    expect(insights.budgetVariance.rows).toEqual([
      expect.objectContaining({
        budgetId: 20,
        allowance: 3_100_000,
        assignedSpend: 600_000,
        variance: 2_500_000,
        status: "under",
      }),
      expect.objectContaining({
        budgetId: 10,
        allowance: 300_000,
        assignedSpend: 100_000,
        variance: 200_000,
        status: "under",
      }),
    ]);
  });

  it("excludes non-overlapping budgets even when selected-month spend is assigned to them", () => {
    const insights = buildMonthlyReportInsights({
      selectedMonth: "2026-05",
      expenses: [
        expense({ id: 1, date: "2026-05-01", amount: 100_000, budgetId: 10 }),
      ],
      budgets: [
        budget({
          id: 10,
          name: "April week",
          amount: 700_000,
          period: "week",
          periodStartDate: "2026-04-14",
          periodEndDate: "2026-04-20",
        }),
      ],
    });

    expect(insights.budgetVariance.rows).toEqual([]);
    expect(insights.budgetVariance.summary).toEqual({
      totalAllowance: 0,
      totalAssignedSpend: 0,
      totalVariance: 0,
      unassignedSpend: 0,
    });
  });

  it("normalizes Vietnamese merchant notes into stable grouping keys", () => {
    expect(normalizeMerchantNote("Cà phê Highlands 80k 01/05")).toEqual({
      key: "ca-phe-highlands",
      label: "Cà Phê Highlands",
    });
    expect(normalizeMerchantNote("CK Grab Bike 35.000")).toEqual({
      key: "grab-bike",
      label: "Grab Bike",
    });
  });

  it("groups top merchants from inferred note keys", () => {
    const insights = buildMonthlyReportInsights({
      selectedMonth: "2026-05",
      expenses: [
        expense({
          id: 1,
          date: "2026-05-01",
          amount: 80_000,
          note: "Cà phê Highlands 80k",
        }),
        expense({
          id: 2,
          date: "2026-05-02",
          amount: 90_000,
          note: "Cafe Highlands",
        }),
        expense({
          id: 3,
          date: "2026-05-03",
          amount: 30_000,
          note: "Grab Bike",
        }),
      ],
      budgets: [],
    });

    expect(insights.topMerchants[0]).toEqual(
      expect.objectContaining({
        key: "ca-phe-highlands",
        total: 170_000,
        count: 2,
      })
    );
  });

  it("detects only conservative recurring candidates with three clear matches", () => {
    const insights = buildMonthlyReportInsights({
      selectedMonth: "2026-05",
      expenses: [
        expense({ id: 1, date: "2026-03-05", amount: 99_000, note: "Spotify" }),
        expense({
          id: 2,
          date: "2026-04-05",
          amount: 99_000,
          note: "Spotify monthly",
        }),
        expense({ id: 3, date: "2026-05-05", amount: 99_000, note: "Spotify" }),
        expense({
          id: 4,
          date: "2026-04-10",
          amount: 120_000,
          note: "Netflix",
        }),
        expense({
          id: 5,
          date: "2026-05-10",
          amount: 120_000,
          note: "Netflix",
        }),
      ],
      budgets: [],
    });

    expect(insights.recurringSpend).toEqual([
      expect.objectContaining({
        key: "spotify",
        cadence: "monthly",
        matchedExpenseIds: [1, 2, 3],
        averageAmount: 99_000,
      }),
    ]);
  });

  it("rejects recurring candidates when three same-key matches have inconsistent gaps", () => {
    const insights = buildMonthlyReportInsights({
      selectedMonth: "2026-05",
      expenses: [
        expense({ id: 1, date: "2026-03-01", amount: 99_000, note: "Spotify" }),
        expense({ id: 2, date: "2026-03-19", amount: 99_000, note: "Spotify" }),
        expense({ id: 3, date: "2026-05-05", amount: 99_000, note: "Spotify" }),
      ],
      budgets: [],
    });

    expect(
      insights.recurringSpend.find((candidate) => candidate.key === "spotify")
    ).toBeUndefined();
  });
});
