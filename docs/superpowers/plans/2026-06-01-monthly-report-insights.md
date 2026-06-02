# Monthly Report Insights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand `/report` into a guided monthly review with month-over-month trends, assigned-budget variance, inferred merchants from notes, and passive recurring spend detection.

**Architecture:** Add a pure monthly-insights helper module and integrate it into the existing `getMonthlyReport()` service. Keep the current `/api/reports/monthly` route and `queries.reports.monthly()` path, then render the new `report.insights` sections in focused dark-mode mobile components before the existing category and payer breakdowns.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Drizzle ORM, TanStack Query, `@lukemorales/query-key-factory`, Tailwind v4, Recharts, Vitest, React Testing Library.

---

## File Structure

- Create `src/lib/reports/monthly-insights.ts`: pure date math, trend aggregation, budget variance, merchant inference, and recurring detection.
- Create `src/lib/reports/monthly-insights.test.ts`: unit coverage for all pure insight rules.
- Modify `src/lib/services/reports.ts`: add insight types to `MonthlyReport`, query the wider data window, and call `buildMonthlyReportInsights()`.
- Modify `src/lib/services/reports.test.ts`: cover the expanded monthly report shape at the service boundary.
- Modify `src/lib/queries/read-fetchers.test.ts`: verify the monthly report fetcher still calls the same route and accepts the expanded payload.
- Modify `src/app/api/read-routes.test.ts`: verify `/api/reports/monthly` returns the expanded payload unchanged.
- Create `src/components/report/MonthlyPulseCard.tsx`: render current spend, previous-month delta, and 3-month average context.
- Create `src/components/report/BudgetVarianceCard.tsx`: render assigned budget variance summary and top rows.
- Create `src/components/report/MonthTrendChart.tsx`: render compact 6-month trend bars.
- Create `src/components/report/TopMerchantsCard.tsx`: render inferred note merchant groups.
- Create `src/components/report/RecurringSpendCard.tsx`: render passive recurring candidates.
- Create `src/components/report/MonthlyReportInsights.tsx`: compose the five insight cards in narrative order.
- Create `src/components/report/MonthlyReportInsights.test.tsx`: component coverage for populated and empty states.
- Modify `src/components/MonthlyReportContent.tsx`: insert `MonthlyReportInsights` before existing category and payer sections.
- Modify `src/components/MonthlyReportContent.test.tsx`: seed `insights` and assert the narrative sections render before legacy report content.

## Task 1: Add Pure Monthly Insight Helpers

**Files:**
- Create: `src/lib/reports/monthly-insights.ts`
- Create: `src/lib/reports/monthly-insights.test.ts`

- [ ] **Step 1: Write failing tests for trends, proration, merchants, and recurring detection**

Create `src/lib/reports/monthly-insights.test.ts`:

```ts
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
    color: "slate" | "rose" | "orange" | "amber" | "yellow" | "lime" | "green" | "emerald" | "teal" | "cyan" | "sky" | "blue" | "indigo" | "violet" | "purple" | "fuchsia" | "pink";
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
    expect(insights.pulse.previousMonthTotal).toBe(400_000);
    expect(insights.pulse.previousMonthDelta).toBe(100_000);
    expect(insights.pulse.previousMonthDeltaPercent).toBe(25);
    expect(insights.pulse.priorThreeMonthAverage).toBe(300_000);
    expect(insights.pulse.priorThreeMonthDelta).toBe(200_000);
    expect(insights.monthTrend.map((point) => point.month)).toEqual([
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
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
        expense({ id: 1, date: "2026-05-01", amount: 80_000, note: "Cà phê Highlands 80k" }),
        expense({ id: 2, date: "2026-05-02", amount: 90_000, note: "Cafe Highlands" }),
        expense({ id: 3, date: "2026-05-03", amount: 30_000, note: "Grab Bike" }),
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
        expense({ id: 2, date: "2026-04-05", amount: 99_000, note: "Spotify monthly" }),
        expense({ id: 3, date: "2026-05-05", amount: 99_000, note: "Spotify" }),
        expense({ id: 4, date: "2026-04-10", amount: 120_000, note: "Netflix" }),
        expense({ id: 5, date: "2026-05-10", amount: 120_000, note: "Netflix" }),
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
});
```

- [ ] **Step 2: Run helper tests and verify failure**

Run:

```bash
rtk bun run test src/lib/reports/monthly-insights.test.ts
```

Expected: FAIL because `src/lib/reports/monthly-insights.ts` does not exist.

- [ ] **Step 3: Implement monthly insights helpers**

Create `src/lib/reports/monthly-insights.ts`:

```ts
import dayjs from "@/configs/date";
import type { BudgetColorId } from "@/lib/budget-appearance";

export type MonthlyInsightExpense = {
  id: number;
  amount: number;
  date: string;
  note: string;
  category: string;
  paidBy: string;
  budgetId: number | null;
};

export type MonthlyInsightBudget = {
  id: number;
  name: string;
  amount: number;
  icon: string;
  color: BudgetColorId;
  period: "week" | "month" | "custom";
  periodStartDate: string;
  periodEndDate: string | null;
};

export type MonthlyPulse = {
  selectedMonth: string;
  selectedTotal: number;
  previousMonth: string;
  previousMonthTotal: number;
  previousMonthDelta: number | null;
  previousMonthDeltaPercent: number | null;
  priorThreeMonthAverage: number;
  priorThreeMonthDelta: number | null;
  priorThreeMonthDeltaPercent: number | null;
  hasPreviousMonth: boolean;
  hasPriorThreeMonthBaseline: boolean;
};

export type MonthTrendPoint = {
  month: string;
  total: number;
  isSelected: boolean;
};

export type BudgetVarianceStatus = "under" | "near" | "over" | "no-allowance";

export type BudgetVarianceRow = {
  budgetId: number;
  name: string;
  icon: string;
  color: BudgetColorId;
  period: "week" | "month";
  periodStartDate: string;
  periodEndDate: string;
  allowance: number;
  assignedSpend: number;
  variance: number;
  percentUsed: number | null;
  status: BudgetVarianceStatus;
};

export type BudgetVarianceSummary = {
  summary: {
    totalAllowance: number;
    totalAssignedSpend: number;
    totalVariance: number;
    unassignedSpend: number;
  };
  rows: BudgetVarianceRow[];
};

export type InferredMerchantSummary = {
  key: string;
  label: string;
  total: number;
  count: number;
  representativeNotes: string[];
  topCategory: string | null;
  topPaidBy: string | null;
};

export type RecurringSpendCandidate = {
  key: string;
  label: string;
  cadence: "weekly" | "biweekly" | "monthly" | "near-monthly";
  confidence: "high";
  matchedExpenseIds: number[];
  evidenceDates: string[];
  representativeNotes: string[];
  averageAmount: number;
  selectedMonthImpact: number;
};

export type MonthlyReportInsights = {
  pulse: MonthlyPulse;
  budgetVariance: BudgetVarianceSummary;
  monthTrend: MonthTrendPoint[];
  topMerchants: InferredMerchantSummary[];
  recurringSpend: RecurringSpendCandidate[];
};

type BuildMonthlyReportInsightsInput = {
  selectedMonth: string;
  expenses: MonthlyInsightExpense[];
  budgets: MonthlyInsightBudget[];
};

const startOfMonth = (month: string) => dayjs(`${month}-01`).startOf("month");
const monthKey = (date: dayjs.Dayjs) => date.format("YYYY-MM");
const dateKey = (date: dayjs.Dayjs) => date.format("YYYY-MM-DD");
const isInsideMonth = (date: string, month: string) => monthKey(dayjs(date)) === month;
const roundCurrency = (value: number) => Math.round(value);
const roundPercent = (value: number) => Math.round(value * 1000) / 10;

const percentDelta = (current: number, baseline: number) =>
  baseline > 0 ? roundPercent((current - baseline) / baseline) : null;

const totalForMonth = (expenses: MonthlyInsightExpense[], month: string) =>
  expenses
    .filter((item) => isInsideMonth(item.date, month))
    .reduce((sum, item) => sum + item.amount, 0);

const buildPulse = (
  selectedMonth: string,
  expenses: MonthlyInsightExpense[]
): MonthlyPulse => {
  const selectedStart = startOfMonth(selectedMonth);
  const previousMonth = monthKey(selectedStart.subtract(1, "month"));
  const priorMonths = [1, 2, 3].map((offset) =>
    monthKey(selectedStart.subtract(offset, "month"))
  );
  const selectedTotal = totalForMonth(expenses, selectedMonth);
  const previousMonthTotal = totalForMonth(expenses, previousMonth);
  const priorTotals = priorMonths.map((month) => totalForMonth(expenses, month));
  const priorThreeMonthAverage =
    priorTotals.reduce((sum, value) => sum + value, 0) / priorTotals.length;
  const hasPreviousMonth = previousMonthTotal > 0;
  const hasPriorThreeMonthBaseline = priorThreeMonthAverage > 0;

  return {
    selectedMonth,
    selectedTotal,
    previousMonth,
    previousMonthTotal,
    previousMonthDelta: hasPreviousMonth ? selectedTotal - previousMonthTotal : null,
    previousMonthDeltaPercent: percentDelta(selectedTotal, previousMonthTotal),
    priorThreeMonthAverage,
    priorThreeMonthDelta: hasPriorThreeMonthBaseline
      ? selectedTotal - priorThreeMonthAverage
      : null,
    priorThreeMonthDeltaPercent: percentDelta(selectedTotal, priorThreeMonthAverage),
    hasPreviousMonth,
    hasPriorThreeMonthBaseline,
  };
};

const buildTrend = (
  selectedMonth: string,
  expenses: MonthlyInsightExpense[]
): MonthTrendPoint[] => {
  const selectedStart = startOfMonth(selectedMonth);
  return Array.from({ length: 6 }, (_, index) => {
    const month = monthKey(selectedStart.subtract(5 - index, "month"));
    return {
      month,
      total: totalForMonth(expenses, month),
      isSelected: month === selectedMonth,
    };
  });
};

const inclusiveDays = (start: dayjs.Dayjs, end: dayjs.Dayjs) =>
  end.diff(start, "day") + 1;

const overlapDays = (
  firstStart: dayjs.Dayjs,
  firstEnd: dayjs.Dayjs,
  secondStart: dayjs.Dayjs,
  secondEnd: dayjs.Dayjs
) => {
  const start = firstStart.isAfter(secondStart) ? firstStart : secondStart;
  const end = firstEnd.isBefore(secondEnd) ? firstEnd : secondEnd;
  return end.isBefore(start, "day") ? 0 : inclusiveDays(start, end);
};

const getBudgetStatus = (
  allowance: number,
  assignedSpend: number
): BudgetVarianceStatus => {
  if (allowance <= 0) return "no-allowance";
  if (assignedSpend > allowance) return "over";
  if (assignedSpend / allowance >= 0.8) return "near";
  return "under";
};

const buildBudgetVariance = (
  selectedMonth: string,
  expenses: MonthlyInsightExpense[],
  budgets: MonthlyInsightBudget[]
): BudgetVarianceSummary => {
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = monthStart.endOf("month");
  const selectedExpenses = expenses.filter((item) =>
    isInsideMonth(item.date, selectedMonth)
  );
  const assignedSpendByBudget = new Map<number, number>();
  let unassignedSpend = 0;

  selectedExpenses.forEach((item) => {
    if (item.budgetId === null) {
      unassignedSpend += item.amount;
      return;
    }
    assignedSpendByBudget.set(
      item.budgetId,
      (assignedSpendByBudget.get(item.budgetId) ?? 0) + item.amount
    );
  });

  const rows = budgets
    .filter((budget) => budget.period === "week" || budget.period === "month")
    .map((budget) => {
      const periodStart = dayjs(budget.periodStartDate);
      const periodEnd = budget.periodEndDate
        ? dayjs(budget.periodEndDate)
        : periodStart.endOf(budget.period === "month" ? "month" : "week");
      const daysInPeriod = inclusiveDays(periodStart, periodEnd);
      const daysInMonth = overlapDays(periodStart, periodEnd, monthStart, monthEnd);
      const allowance = roundCurrency((budget.amount * daysInMonth) / daysInPeriod);
      const assignedSpend = assignedSpendByBudget.get(budget.id) ?? 0;
      const percentUsed =
        allowance > 0 ? roundPercent(assignedSpend / allowance) : null;
      return {
        budgetId: budget.id,
        name: budget.name,
        icon: budget.icon,
        color: budget.color,
        period: budget.period,
        periodStartDate: dateKey(periodStart),
        periodEndDate: dateKey(periodEnd),
        allowance,
        assignedSpend,
        variance: allowance - assignedSpend,
        percentUsed,
        status: getBudgetStatus(allowance, assignedSpend),
      };
    })
    .filter((row) => row.allowance > 0 || row.assignedSpend > 0)
    .sort((a, b) => b.assignedSpend - a.assignedSpend || b.allowance - a.allowance);

  const totalAllowance = rows.reduce((sum, row) => sum + row.allowance, 0);
  const totalAssignedSpend = rows.reduce((sum, row) => sum + row.assignedSpend, 0);

  return {
    summary: {
      totalAllowance,
      totalAssignedSpend,
      totalVariance: totalAllowance - totalAssignedSpend,
      unassignedSpend,
    },
    rows,
  };
};

const stripDiacritics = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");

const titleCase = (value: string) =>
  value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export const normalizeMerchantNote = (note: string) => {
  const cleaned = note
    .trim()
    .replace(/\bcafe\b/gi, "ca phe")
    .replace(/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g, " ")
    .replace(/\b\d+(?:[.,]\d{3})*(?:k|tr|₫|d|vnd)?\b/gi, " ")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\b(ck|chuyen khoan|pay|paid|momo|zalopay|the|card)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const label = titleCase(cleaned).slice(0, 48);
  const key = stripDiacritics(cleaned)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .split("-")
    .slice(0, 3)
    .join("-");

  return {
    key: key || "unknown",
    label: label || "Unknown",
  };
};

const mostFrequent = (values: string[]) => {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
};

const buildTopMerchants = (
  selectedMonth: string,
  expenses: MonthlyInsightExpense[]
): InferredMerchantSummary[] => {
  const groups = new Map<string, MonthlyInsightExpense[]>();
  expenses
    .filter((item) => isInsideMonth(item.date, selectedMonth))
    .forEach((item) => {
      const { key } = normalizeMerchantNote(item.note);
      groups.set(key, [...(groups.get(key) ?? []), item]);
    });

  return Array.from(groups.entries())
    .map(([key, rows]) => {
      const labels = rows.map((row) => normalizeMerchantNote(row.note).label);
      return {
        key,
        label: mostFrequent(labels) ?? labels[0] ?? "Unknown",
        total: rows.reduce((sum, row) => sum + row.amount, 0),
        count: rows.length,
        representativeNotes: Array.from(new Set(rows.map((row) => row.note))).slice(0, 3),
        topCategory: mostFrequent(rows.map((row) => row.category)),
        topPaidBy: mostFrequent(rows.map((row) => row.paidBy)),
      };
    })
    .filter((item) => item.key !== "unknown")
    .sort((a, b) => b.total - a.total || b.count - a.count)
    .slice(0, 5);
};

const amountIsStable = (rows: MonthlyInsightExpense[]) => {
  const average = rows.reduce((sum, row) => sum + row.amount, 0) / rows.length;
  const maxDelta = Math.max(...rows.map((row) => Math.abs(row.amount - average)));
  return average > 0 && maxDelta / average <= 0.2;
};

const detectCadence = (rows: MonthlyInsightExpense[]) => {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const gaps = sorted.slice(1).map((row, index) =>
    dayjs(row.date).diff(dayjs(sorted[index].date), "day")
  );
  const averageGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  const stable = gaps.every((gap) => Math.abs(gap - averageGap) <= 4);
  if (!stable) return null;
  if (averageGap >= 6 && averageGap <= 8) return "weekly";
  if (averageGap >= 13 && averageGap <= 16) return "biweekly";
  if (averageGap >= 28 && averageGap <= 31) return "monthly";
  if (averageGap >= 25 && averageGap <= 35) return "near-monthly";
  return null;
};

const buildRecurringSpend = (
  selectedMonth: string,
  expenses: MonthlyInsightExpense[]
): RecurringSpendCandidate[] => {
  const groups = new Map<string, MonthlyInsightExpense[]>();
  expenses.forEach((item) => {
    const { key } = normalizeMerchantNote(item.note);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  });

  return Array.from(groups.entries())
    .flatMap(([key, rows]) => {
      if (key === "unknown" || rows.length < 3 || !amountIsStable(rows)) {
        return [];
      }
      const cadence = detectCadence(rows);
      if (!cadence) return [];
      const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
      const averageAmount = roundCurrency(
        sorted.reduce((sum, row) => sum + row.amount, 0) / sorted.length
      );
      const labels = sorted.map((row) => normalizeMerchantNote(row.note).label);
      return [
        {
          key,
          label: mostFrequent(labels) ?? labels[0] ?? "Unknown",
          cadence,
          confidence: "high" as const,
          matchedExpenseIds: sorted.map((row) => row.id),
          evidenceDates: sorted.map((row) => row.date),
          representativeNotes: Array.from(new Set(sorted.map((row) => row.note))).slice(0, 3),
          averageAmount,
          selectedMonthImpact: sorted
            .filter((row) => isInsideMonth(row.date, selectedMonth))
            .reduce((sum, row) => sum + row.amount, 0),
        },
      ];
    })
    .sort((a, b) => b.selectedMonthImpact - a.selectedMonthImpact || b.averageAmount - a.averageAmount)
    .slice(0, 5);
};

export const buildMonthlyReportInsights = ({
  selectedMonth,
  expenses,
  budgets,
}: BuildMonthlyReportInsightsInput): MonthlyReportInsights => ({
  pulse: buildPulse(selectedMonth, expenses),
  budgetVariance: buildBudgetVariance(selectedMonth, expenses, budgets),
  monthTrend: buildTrend(selectedMonth, expenses),
  topMerchants: buildTopMerchants(selectedMonth, expenses),
  recurringSpend: buildRecurringSpend(selectedMonth, expenses),
});
```

- [ ] **Step 4: Run helper tests and verify pass**

Run:

```bash
rtk bun run test src/lib/reports/monthly-insights.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit helper module**

```bash
rtk git add src/lib/reports/monthly-insights.ts src/lib/reports/monthly-insights.test.ts
rtk git commit -m "feat(report): add monthly insight calculations"
```

## Task 2: Integrate Insights Into Monthly Report Service

**Files:**
- Modify: `src/lib/services/reports.ts`
- Modify: `src/lib/services/reports.test.ts`

- [ ] **Step 1: Write failing service tests for expanded monthly report**

Add this test to `src/lib/services/reports.test.ts`:

```ts
import { getMonthlyReport } from "./reports";

it("returns monthly report insights from expense and budget history", async () => {
  dbMocks.select
    .mockReturnValueOnce(
      mockSelectRows([
        { category: "Food", paidBy: "Loc", total: 500_000 },
      ])
    )
    .mockReturnValueOnce(
      mockSelectRows([
        {
          id: 1,
          date: "2026-03-05",
          amount: 99_000,
          note: "Spotify",
          category: "Entertainment",
          paidBy: "Loc",
          budgetId: 10,
        },
        {
          id: 2,
          date: "2026-04-05",
          amount: 99_000,
          note: "Spotify monthly",
          category: "Entertainment",
          paidBy: "Loc",
          budgetId: 10,
        },
        {
          id: 3,
          date: "2026-05-05",
          amount: 99_000,
          note: "Spotify",
          category: "Entertainment",
          paidBy: "Loc",
          budgetId: 10,
        },
      ])
    )
    .mockReturnValueOnce(
      mockSelectRows([
        {
          id: 10,
          name: "Subscriptions",
          amount: 310_000,
          icon: "🎧",
          color: "violet",
          period: "month",
          periodStartDate: "2026-05-01",
          periodEndDate: "2026-05-31",
        },
      ])
    );

  const result = await getMonthlyReport("2026-05");

  expect(result.insights.pulse.selectedTotal).toBe(99_000);
  expect(result.insights.budgetVariance.rows[0]).toMatchObject({
    budgetId: 10,
    allowance: 310_000,
    assignedSpend: 99_000,
  });
  expect(result.insights.topMerchants[0]).toMatchObject({
    key: "spotify",
    total: 99_000,
  });
  expect(result.insights.recurringSpend[0]).toMatchObject({
    key: "spotify",
    cadence: "monthly",
  });
});
```

- [ ] **Step 2: Run service tests and verify failure**

Run:

```bash
rtk bun run test src/lib/services/reports.test.ts
```

Expected: FAIL because `MonthlyReport` has no `insights` field and `getMonthlyReport()` does not query history or budgets yet.

- [ ] **Step 3: Add insight imports and types to `reports.ts`**

In `src/lib/services/reports.ts`, add imports:

```ts
import {
  buildMonthlyReportInsights,
  type MonthlyInsightBudget,
  type MonthlyInsightExpense,
  type MonthlyReportInsights,
} from "@/lib/reports/monthly-insights";
```

Update `MonthlyReport`:

```ts
export type MonthlyReport = {
  activeMonth: string;
  categoryTotals: CategoryTotal[];
  insights: MonthlyReportInsights;
  paidByCategoryTotals: PaidByCategoryTotal[];
  paidByTotalSpent: number;
  paidByTotals: PaidByTotal[];
};
```

- [ ] **Step 4: Query insight expenses and overlapping budgets in `getMonthlyReport()`**

Inside `getMonthlyReport()`, after `normalizedTotals` is created and before the return, add:

```ts
  const selectedMonthStartKey = startOfMonth.format("YYYY-MM-DD");
  const selectedMonthEndKey = activeMonth.endOf("month").format("YYYY-MM-DD");
  const recurringWindowStartKey = activeMonth
    .endOf("month")
    .subtract(180, "day")
    .format("YYYY-MM-DD");
  const trendWindowStartKey = activeMonth
    .startOf("month")
    .subtract(5, "month")
    .format("YYYY-MM-DD");
  const insightWindowStartKey =
    recurringWindowStartKey < trendWindowStartKey
      ? recurringWindowStartKey
      : trendWindowStartKey;

  const insightExpenseRows = await db
    .select({
      id: expenses.id,
      date: expenses.date,
      amount: expenses.amount,
      note: expenses.note,
      category: expenses.category,
      paidBy: expenses.paidBy,
      budgetId: expenseBudgets.budgetId,
    })
    .from(expenses)
    .leftJoin(expenseBudgets, eq(expenseBudgets.expenseId, expenses.id))
    .where(
      and(
        eq(expenses.isDeleted, false),
        gte(expenses.date, insightWindowStartKey),
        lt(expenses.date, endOfMonth.format("YYYY-MM-DD"))
      )
    );

  const insightBudgetRows = await db
    .select({
      id: budgets.id,
      name: budgets.name,
      amount: budgets.amount,
      icon: budgets.icon,
      color: budgets.color,
      period: budgets.period,
      periodStartDate: budgets.periodStartDate,
      periodEndDate: budgets.periodEndDate,
    })
    .from(budgets)
    .where(
      and(
        lte(budgets.periodStartDate, selectedMonthEndKey),
        gte(budgets.periodEndDate, selectedMonthStartKey)
      )
    );

  const insightExpenses: MonthlyInsightExpense[] = insightExpenseRows.map(
    (row) => ({
      id: Number(row.id),
      date: String(row.date),
      amount: Number(row.amount ?? 0),
      note: row.note ?? "",
      category: row.category ?? "",
      paidBy: row.paidBy ?? "",
      budgetId: row.budgetId === null ? null : Number(row.budgetId),
    })
  );

  const insightBudgets: MonthlyInsightBudget[] = insightBudgetRows.map(
    (row) => ({
      id: Number(row.id),
      name: row.name,
      amount: Number(row.amount ?? 0),
      icon: normalizeBudgetIcon(row.icon),
      color: normalizeBudgetColor(row.color),
      period: row.period,
      periodStartDate: dayjs(row.periodStartDate).format("YYYY-MM-DD"),
      periodEndDate: row.periodEndDate
        ? dayjs(row.periodEndDate).format("YYYY-MM-DD")
        : null,
    })
  );

  const insights = buildMonthlyReportInsights({
    selectedMonth: activeMonth.format("YYYY-MM"),
    expenses: insightExpenses,
    budgets: insightBudgets,
  });
```

Also add `asc` to the `drizzle-orm` import only if the final query uses it. Keep the query unordered if no ordering is needed.

- [ ] **Step 5: Return `insights`**

Update the `getMonthlyReport()` return:

```ts
  return {
    activeMonth: activeMonth.format("YYYY-MM"),
    categoryTotals,
    insights,
    paidByCategoryTotals: normalizedTotals,
    paidByTotalSpent,
    paidByTotals,
  };
```

- [ ] **Step 6: Run service tests and fix mock chain gaps**

Run:

```bash
rtk bun run test src/lib/services/reports.test.ts
```

Expected: PASS. If the test fails because `mockSelectRows()` lacks a chain method used by the new query, add that method to the local test helper in `src/lib/services/reports.test.ts`:

```ts
const chain = {
  from: vi.fn(() => chain),
  groupBy: vi.fn(() => chain),
  leftJoin: vi.fn(() => chain),
  orderBy: vi.fn(() => rows),
  where: vi.fn(() => (options.terminalWhere ? rows : chain)),
};
```

Keep only methods actually used by `getMonthlyReport()` and `getDailyReport()`.

- [ ] **Step 7: Commit service integration**

```bash
rtk git add src/lib/services/reports.ts src/lib/services/reports.test.ts
rtk git commit -m "feat(report): include monthly insights in report service"
```

## Task 3: Cover API And Query Boundaries

**Files:**
- Modify: `src/app/api/read-routes.test.ts`
- Modify: `src/lib/queries/read-fetchers.test.ts`

- [ ] **Step 1: Add expanded payload to monthly route test**

Find the existing monthly report route test in `src/app/api/read-routes.test.ts` and use this payload shape:

```ts
const monthlyReportPayload = {
  activeMonth: "2026-05",
  categoryTotals: [],
  insights: {
    pulse: {
      selectedMonth: "2026-05",
      selectedTotal: 500000,
      previousMonth: "2026-04",
      previousMonthTotal: 400000,
      previousMonthDelta: 100000,
      previousMonthDeltaPercent: 25,
      priorThreeMonthAverage: 300000,
      priorThreeMonthDelta: 200000,
      priorThreeMonthDeltaPercent: 66.7,
      hasPreviousMonth: true,
      hasPriorThreeMonthBaseline: true,
    },
    budgetVariance: {
      summary: {
        totalAllowance: 1000000,
        totalAssignedSpend: 500000,
        totalVariance: 500000,
        unassignedSpend: 0,
      },
      rows: [],
    },
    monthTrend: [],
    topMerchants: [],
    recurringSpend: [],
  },
  paidByCategoryTotals: [],
  paidByTotalSpent: 0,
  paidByTotals: [],
};
```

Assert:

```ts
mocks.getMonthlyReport.mockResolvedValue(monthlyReportPayload);

const response = await getMonthlyReport(
  new Request("http://localhost/api/reports/monthly?month=2026-05")
);

expect(response.status).toBe(200);
await expect(response.json()).resolves.toEqual({
  success: true,
  data: monthlyReportPayload,
});
expect(mocks.getMonthlyReport).toHaveBeenCalledWith("2026-05");
```

- [ ] **Step 2: Run route tests**

Run:

```bash
rtk bun run test src/app/api/read-routes.test.ts
```

Expected: PASS because the route returns the service payload unchanged.

- [ ] **Step 3: Update monthly fetcher test payload**

In `src/lib/queries/read-fetchers.test.ts`, replace the existing `monthlyPayload` in `"fetches monthly and daily reports"` with:

```ts
const monthlyPayload = {
  activeMonth: "2026-05",
  categoryTotals: [],
  insights: {
    pulse: {
      selectedMonth: "2026-05",
      selectedTotal: 0,
      previousMonth: "2026-04",
      previousMonthTotal: 0,
      previousMonthDelta: null,
      previousMonthDeltaPercent: null,
      priorThreeMonthAverage: 0,
      priorThreeMonthDelta: null,
      priorThreeMonthDeltaPercent: null,
      hasPreviousMonth: false,
      hasPriorThreeMonthBaseline: false,
    },
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
  },
  paidByCategoryTotals: [],
  paidByTotalSpent: 0,
  paidByTotals: [],
};
```

- [ ] **Step 4: Run query fetcher tests**

Run:

```bash
rtk bun run test src/lib/queries/read-fetchers.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit API/query boundary tests**

```bash
rtk git add src/app/api/read-routes.test.ts src/lib/queries/read-fetchers.test.ts
rtk git commit -m "test(report): cover monthly insights boundaries"
```

## Task 4: Add Monthly Report Insight Components

**Files:**
- Create: `src/components/report/MonthlyPulseCard.tsx`
- Create: `src/components/report/BudgetVarianceCard.tsx`
- Create: `src/components/report/MonthTrendChart.tsx`
- Create: `src/components/report/TopMerchantsCard.tsx`
- Create: `src/components/report/RecurringSpendCard.tsx`
- Create: `src/components/report/MonthlyReportInsights.tsx`
- Create: `src/components/report/MonthlyReportInsights.test.tsx`

- [ ] **Step 1: Write component tests for populated and empty states**

Create `src/components/report/MonthlyReportInsights.test.tsx`:

```tsx
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
          topMerchants: [],
          recurringSpend: [],
        }}
      />
    );

    expect(screen.getByText("No assigned budget spend this month.")).toBeInTheDocument();
    expect(screen.getByText("No merchant groups found for this month.")).toBeInTheDocument();
    expect(screen.getByText("No recurring patterns detected yet.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run component tests and verify failure**

Run:

```bash
rtk bun run test src/components/report/MonthlyReportInsights.test.tsx
```

Expected: FAIL because the report insight components do not exist.

- [ ] **Step 3: Implement `MonthlyPulseCard`**

Create `src/components/report/MonthlyPulseCard.tsx`:

```tsx
import type { MonthlyPulse } from "@/lib/reports/monthly-insights";
import { formatVnd, formatVndSigned } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import VndSymbol from "@/components/VndSymbol";

const formatPercent = (value: number | null) =>
  value === null ? "No baseline" : `${value > 0 ? "+" : ""}${value}%`;

const DeltaIcon = ({ value }: { value: number | null }) => {
  if (value === null || value === 0) return <Minus className="size-4" />;
  return value > 0 ? (
    <ArrowUpRight className="size-4" />
  ) : (
    <ArrowDownRight className="size-4" />
  );
};

const MonthlyPulseCard = ({ pulse }: { pulse: MonthlyPulse }) => (
  <section className="border-border/70 bg-surface-2/70 rounded-2xl border p-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-foreground text-sm font-semibold">Monthly pulse</h2>
        <p className="text-muted-foreground mt-1 text-xs">
          Compared with {pulse.previousMonth}
        </p>
      </div>
      <div className="text-right">
        <div className="text-foreground text-2xl font-semibold tabular-nums">
          {formatVnd(pulse.selectedTotal)} <VndSymbol />
        </div>
      </div>
    </div>
    <div className="mt-4 grid grid-cols-2 gap-2">
      <div className="bg-background/45 rounded-xl p-3">
        <div className="text-muted-foreground text-[11px]">Previous month</div>
        <div className="text-foreground mt-1 flex items-center gap-1 text-sm font-semibold">
          <DeltaIcon value={pulse.previousMonthDelta} />
          {pulse.previousMonthDelta === null
            ? "Need history"
            : `${formatVndSigned(pulse.previousMonthDelta)} (${formatPercent(
                pulse.previousMonthDeltaPercent
              )})`}
        </div>
      </div>
      <div className="bg-background/45 rounded-xl p-3">
        <div className="text-muted-foreground text-[11px]">3-month avg</div>
        <div className="text-foreground mt-1 flex items-center gap-1 text-sm font-semibold">
          <DeltaIcon value={pulse.priorThreeMonthDelta} />
          {pulse.priorThreeMonthDelta === null
            ? "Need baseline"
            : `${formatVndSigned(pulse.priorThreeMonthDelta)} (${formatPercent(
                pulse.priorThreeMonthDeltaPercent
              )})`}
        </div>
      </div>
    </div>
  </section>
);

export default MonthlyPulseCard;
```

- [ ] **Step 4: Implement remaining card components and composer**

Create `src/components/report/BudgetVarianceCard.tsx`:

```tsx
import type { BudgetVarianceSummary } from "@/lib/reports/monthly-insights";
import { formatVnd, formatVndSigned } from "@/lib/utils";

import VndSymbol from "@/components/VndSymbol";

const BudgetVarianceCard = ({
  budgetVariance,
}: {
  budgetVariance: BudgetVarianceSummary;
}) => (
  <section className="border-border/70 bg-surface-2/70 rounded-2xl border p-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-foreground text-sm font-semibold">Budget variance</h2>
        <p className="text-muted-foreground mt-1 text-xs">
          Assigned spend vs prorated weekly and monthly budgets.
        </p>
      </div>
      <div className="text-foreground text-sm font-semibold tabular-nums">
        {formatVndSigned(budgetVariance.summary.totalVariance)} <VndSymbol />
      </div>
    </div>
    {budgetVariance.rows.length ? (
      <div className="mt-4 flex flex-col gap-3">
        {budgetVariance.rows.slice(0, 4).map((row) => (
          <div key={row.budgetId} className="flex items-center justify-between gap-3 text-sm">
            <div className="min-w-0">
              <div className="text-foreground truncate font-medium">
                {row.icon} {row.name}
              </div>
              <div className="text-muted-foreground text-xs">
                {row.period} · {row.percentUsed === null ? "No allowance" : `${row.percentUsed}% used`}
              </div>
            </div>
            <div className="text-right text-xs tabular-nums">
              <div className="text-foreground font-semibold">
                {formatVnd(row.assignedSpend)} <VndSymbol />
              </div>
              <div className="text-muted-foreground">
                of {formatVnd(row.allowance)} <VndSymbol />
              </div>
            </div>
          </div>
        ))}
      </div>
    ) : (
      <p className="text-muted-foreground mt-4 text-sm">
        No assigned budget spend this month.
      </p>
    )}
  </section>
);

export default BudgetVarianceCard;
```

Create `src/components/report/MonthTrendChart.tsx`:

```tsx
import type { MonthTrendPoint } from "@/lib/reports/monthly-insights";
import { formatVnd } from "@/lib/utils";

const MonthTrendChart = ({ points }: { points: MonthTrendPoint[] }) => {
  const maxTotal = Math.max(...points.map((point) => point.total), 1);

  return (
    <section className="border-border/70 bg-surface-2/70 rounded-2xl border p-4">
      <h2 className="text-foreground text-sm font-semibold">6-month trend</h2>
      <div className="mt-4 flex h-28 items-end gap-2">
        {points.map((point) => (
          <div key={point.month} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div
              className={point.isSelected ? "bg-primary w-full rounded-t-lg" : "bg-muted w-full rounded-t-lg"}
              style={{ height: `${Math.max((point.total / maxTotal) * 100, 6)}%` }}
              title={`${point.month}: ${formatVnd(point.total)}`}
            />
            <span className="text-muted-foreground text-[10px]">
              {point.month.slice(5)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
};

export default MonthTrendChart;
```

Create `src/components/report/TopMerchantsCard.tsx`:

```tsx
import type { InferredMerchantSummary } from "@/lib/reports/monthly-insights";
import { formatVnd } from "@/lib/utils";

import VndSymbol from "@/components/VndSymbol";

const TopMerchantsCard = ({
  merchants,
}: {
  merchants: InferredMerchantSummary[];
}) => (
  <section className="border-border/70 bg-surface-2/70 rounded-2xl border p-4">
    <h2 className="text-foreground text-sm font-semibold">Top merchants from notes</h2>
    {merchants.length ? (
      <div className="mt-4 flex flex-col gap-3">
        {merchants.map((merchant) => (
          <div key={merchant.key} className="flex items-center justify-between gap-3 text-sm">
            <div className="min-w-0">
              <div className="text-foreground truncate font-medium">{merchant.label}</div>
              <div className="text-muted-foreground text-xs">
                {merchant.count} expenses{merchant.topCategory ? ` · ${merchant.topCategory}` : ""}
              </div>
            </div>
            <div className="text-foreground text-sm font-semibold tabular-nums">
              {formatVnd(merchant.total)} <VndSymbol />
            </div>
          </div>
        ))}
      </div>
    ) : (
      <p className="text-muted-foreground mt-4 text-sm">
        No merchant groups found for this month.
      </p>
    )}
  </section>
);

export default TopMerchantsCard;
```

Create `src/components/report/RecurringSpendCard.tsx`:

```tsx
import type { RecurringSpendCandidate } from "@/lib/reports/monthly-insights";
import { formatVnd } from "@/lib/utils";

import VndSymbol from "@/components/VndSymbol";

const RecurringSpendCard = ({
  candidates,
}: {
  candidates: RecurringSpendCandidate[];
}) => (
  <section className="border-border/70 bg-surface-2/70 rounded-2xl border p-4">
    <h2 className="text-foreground text-sm font-semibold">Recurring spend</h2>
    {candidates.length ? (
      <div className="mt-4 flex flex-col gap-3">
        {candidates.map((candidate) => (
          <div key={candidate.key} className="text-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="text-foreground font-medium">{candidate.label}</div>
              <div className="text-foreground font-semibold tabular-nums">
                {formatVnd(candidate.averageAmount)} <VndSymbol />
              </div>
            </div>
            <div className="text-muted-foreground mt-1 text-xs">
              {candidate.cadence} · {candidate.matchedExpenseIds.length} matches · {candidate.evidenceDates.join(", ")}
            </div>
          </div>
        ))}
      </div>
    ) : (
      <p className="text-muted-foreground mt-4 text-sm">
        No recurring patterns detected yet.
      </p>
    )}
  </section>
);

export default RecurringSpendCard;
```

Create `src/components/report/MonthlyReportInsights.tsx`:

```tsx
import type { MonthlyReportInsights as MonthlyReportInsightsData } from "@/lib/reports/monthly-insights";

import BudgetVarianceCard from "./BudgetVarianceCard";
import MonthlyPulseCard from "./MonthlyPulseCard";
import MonthTrendChart from "./MonthTrendChart";
import RecurringSpendCard from "./RecurringSpendCard";
import TopMerchantsCard from "./TopMerchantsCard";

const MonthlyReportInsights = ({
  insights,
}: {
  insights: MonthlyReportInsightsData;
}) => (
  <div className="flex flex-col gap-3">
    <MonthlyPulseCard pulse={insights.pulse} />
    <BudgetVarianceCard budgetVariance={insights.budgetVariance} />
    <MonthTrendChart points={insights.monthTrend} />
    <TopMerchantsCard merchants={insights.topMerchants} />
    <RecurringSpendCard candidates={insights.recurringSpend} />
  </div>
);

export default MonthlyReportInsights;
```

- [ ] **Step 5: Run component tests**

Run:

```bash
rtk bun run test src/components/report/MonthlyReportInsights.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit insight components**

```bash
rtk git add src/components/report
rtk git commit -m "feat(report): add monthly insight cards"
```

## Task 5: Wire Insight Components Into `/report`

**Files:**
- Modify: `src/components/MonthlyReportContent.tsx`
- Modify: `src/components/MonthlyReportContent.test.tsx`

- [ ] **Step 1: Update `MonthlyReportContent` test payload and expectations**

In `src/components/MonthlyReportContent.test.tsx`, add this `insights` object to the existing `payload`:

```ts
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
```

Add assertions:

```ts
expect(screen.getByText("Monthly pulse")).toBeInTheDocument();
expect(screen.getByText("Budget variance")).toBeInTheDocument();
expect(screen.getByText("6-month trend")).toBeInTheDocument();
```

- [ ] **Step 2: Run monthly content test and verify failure**

Run:

```bash
rtk bun run test src/components/MonthlyReportContent.test.tsx
```

Expected: FAIL until `MonthlyReportContent` renders the composer.

- [ ] **Step 3: Insert `MonthlyReportInsights` before legacy chart sections**

In `src/components/MonthlyReportContent.tsx`, add:

```tsx
import MonthlyReportInsights from "@/components/report/MonthlyReportInsights";
```

Inside the scroll content, before the first `CategorySpendPieChart`, insert:

```tsx
        <MonthlyReportInsights insights={report.insights} />
```

Keep existing category and payer rendering below it.

- [ ] **Step 4: Run component tests**

Run:

```bash
rtk bun run test src/components/MonthlyReportContent.test.tsx src/components/report/MonthlyReportInsights.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit report wiring**

```bash
rtk git add src/components/MonthlyReportContent.tsx src/components/MonthlyReportContent.test.tsx
rtk git commit -m "feat(report): render monthly insights"
```

## Task 6: Run Required Formatting, Lint, And Focused Tests

**Files:**
- Check all modified `.ts` and `.tsx` files from Tasks 1-5.

- [ ] **Step 1: Format modified TypeScript files**

Run:

```bash
rtk bunx prettier --write src/lib/reports/monthly-insights.ts src/lib/reports/monthly-insights.test.ts src/lib/services/reports.ts src/lib/services/reports.test.ts src/lib/queries/read-fetchers.test.ts src/app/api/read-routes.test.ts src/components/report/MonthlyPulseCard.tsx src/components/report/BudgetVarianceCard.tsx src/components/report/MonthTrendChart.tsx src/components/report/TopMerchantsCard.tsx src/components/report/RecurringSpendCard.tsx src/components/report/MonthlyReportInsights.tsx src/components/report/MonthlyReportInsights.test.tsx src/components/MonthlyReportContent.tsx src/components/MonthlyReportContent.test.tsx
```

Expected: files are rewritten or reported unchanged.

- [ ] **Step 2: Check formatting**

Run:

```bash
rtk bunx prettier --check src/lib/reports/monthly-insights.ts src/lib/reports/monthly-insights.test.ts src/lib/services/reports.ts src/lib/services/reports.test.ts src/lib/queries/read-fetchers.test.ts src/app/api/read-routes.test.ts src/components/report/MonthlyPulseCard.tsx src/components/report/BudgetVarianceCard.tsx src/components/report/MonthTrendChart.tsx src/components/report/TopMerchantsCard.tsx src/components/report/RecurringSpendCard.tsx src/components/report/MonthlyReportInsights.tsx src/components/report/MonthlyReportInsights.test.tsx src/components/MonthlyReportContent.tsx src/components/MonthlyReportContent.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run ESLint on modified files**

Run:

```bash
rtk bunx eslint src/lib/reports/monthly-insights.ts src/lib/reports/monthly-insights.test.ts src/lib/services/reports.ts src/lib/services/reports.test.ts src/lib/queries/read-fetchers.test.ts src/app/api/read-routes.test.ts src/components/report/MonthlyPulseCard.tsx src/components/report/BudgetVarianceCard.tsx src/components/report/MonthTrendChart.tsx src/components/report/TopMerchantsCard.tsx src/components/report/RecurringSpendCard.tsx src/components/report/MonthlyReportInsights.tsx src/components/report/MonthlyReportInsights.test.tsx src/components/MonthlyReportContent.tsx src/components/MonthlyReportContent.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Run focused tests**

Run:

```bash
rtk bun run test src/lib/reports/monthly-insights.test.ts src/lib/services/reports.test.ts src/lib/queries/read-fetchers.test.ts src/app/api/read-routes.test.ts src/components/report/MonthlyReportInsights.test.tsx src/components/MonthlyReportContent.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit verification fixes**

If formatting or lint changed files after the previous commits, commit those changes:

```bash
rtk git add src/lib/reports/monthly-insights.ts src/lib/reports/monthly-insights.test.ts src/lib/services/reports.ts src/lib/services/reports.test.ts src/lib/queries/read-fetchers.test.ts src/app/api/read-routes.test.ts src/components/report/MonthlyPulseCard.tsx src/components/report/BudgetVarianceCard.tsx src/components/report/MonthTrendChart.tsx src/components/report/TopMerchantsCard.tsx src/components/report/RecurringSpendCard.tsx src/components/report/MonthlyReportInsights.tsx src/components/report/MonthlyReportInsights.test.tsx src/components/MonthlyReportContent.tsx src/components/MonthlyReportContent.test.tsx
rtk git commit -m "chore(report): format monthly insights"
```

If `git status --porcelain` is empty, skip this commit.

## Task 7: Manual UI Check

**Files:**
- Verify: `/report`

- [ ] **Step 1: Start the development server**

Run:

```bash
rtk bun run dev
```

Expected: Next.js starts and prints a local URL, usually `http://localhost:3000`.

- [ ] **Step 2: Open the report page at an iPhone-sized viewport**

Use the browser at:

```txt
http://localhost:3000/report?month=2026-05
```

Expected:

- header and month tabs remain usable,
- insight cards appear before category charts,
- no text overlaps inside cards,
- empty states read neutrally when there is no data,
- existing category and payer report sections still render below insights.

- [ ] **Step 3: Stop the dev server**

Stop the server with `Ctrl-C`.

- [ ] **Step 4: Commit manual-check polish**

If the manual check required UI polish, commit it:

```bash
rtk git add src/components/report src/components/MonthlyReportContent.tsx
rtk git commit -m "style(report): polish monthly insights mobile layout"
```

If no files changed, skip this commit.

## Final Verification Before Push

- [ ] **Run production build only when preparing to push**

Run:

```bash
npm run build
```

Expected: PASS.
