import dayjs from "@/configs/date";
import type { BudgetColorId } from "@/lib/budget-appearance";

/**
 * Service-owned read model for insight calculations.
 * Callers must provide non-deleted expenses only.
 */
export type MonthlyInsightExpense = {
  id: number;
  amount: number;
  date: string;
  note: string;
  category: string;
  paidBy: string;
  budgetId: number | null;
  isDeleted?: false;
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
const isInsideMonth = (date: string, month: string) =>
  monthKey(dayjs(date)) === month;
const roundCurrency = (value: number) => Math.round(value);
const roundPercent = (value: number) => Math.round(value * 1000) / 10;

const percentDelta = (current: number, baseline: number) =>
  baseline > 0 ? roundPercent((current - baseline) / baseline) : null;

const totalForMonth = (expenses: MonthlyInsightExpense[], month: string) =>
  expenses
    .filter((item) => isInsideMonth(item.date, month))
    .reduce((sum, item) => sum + item.amount, 0);

const hasExpenseHistoryAtOrBeforeMonth = (
  expenses: MonthlyInsightExpense[],
  month: string
) => {
  const monthEndKey = dateKey(startOfMonth(month).endOf("month"));

  return expenses.some((item) => item.date <= monthEndKey);
};

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
  const priorTotals = priorMonths.map((month) =>
    totalForMonth(expenses, month)
  );
  const earliestPriorMonth = priorMonths[priorMonths.length - 1];
  const hasCompletePriorThreeMonthHistory = Boolean(
    earliestPriorMonth &&
    hasExpenseHistoryAtOrBeforeMonth(expenses, earliestPriorMonth)
  );
  const priorThreeMonthAverage = hasCompletePriorThreeMonthHistory
    ? priorTotals.reduce((sum, value) => sum + value, 0) / priorTotals.length
    : 0;
  const hasPreviousMonth =
    previousMonthTotal > 0 ||
    hasExpenseHistoryAtOrBeforeMonth(expenses, previousMonth);
  const hasPriorThreeMonthBaseline =
    hasCompletePriorThreeMonthHistory && priorThreeMonthAverage > 0;

  return {
    selectedMonth,
    selectedTotal,
    previousMonth,
    previousMonthTotal,
    previousMonthDelta: hasPreviousMonth
      ? selectedTotal - previousMonthTotal
      : null,
    previousMonthDeltaPercent: percentDelta(selectedTotal, previousMonthTotal),
    priorThreeMonthAverage,
    priorThreeMonthDelta: hasPriorThreeMonthBaseline
      ? selectedTotal - priorThreeMonthAverage
      : null,
    priorThreeMonthDeltaPercent: percentDelta(
      selectedTotal,
      priorThreeMonthAverage
    ),
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
  if (allowance <= 0) {
    return "no-allowance";
  }
  if (assignedSpend > allowance) {
    return "over";
  }
  if (assignedSpend / allowance >= 0.8) {
    return "near";
  }
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
      const daysInMonth = overlapDays(
        periodStart,
        periodEnd,
        monthStart,
        monthEnd
      );

      if (daysInMonth === 0) {
        return null;
      }

      const allowance = roundCurrency(
        (budget.amount * daysInMonth) / daysInPeriod
      );
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
    .filter((row): row is BudgetVarianceRow => row !== null)
    .sort(
      (a, b) => b.assignedSpend - a.assignedSpend || b.allowance - a.allowance
    );

  const totalAllowance = rows.reduce((sum, row) => sum + row.allowance, 0);
  const totalAssignedSpend = rows.reduce(
    (sum, row) => sum + row.assignedSpend,
    0
  );

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
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d");

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
    .replace(
      /\b(ck|chuyen khoan|pay|paid|momo|zalopay|the|card|weekly|biweekly|monthly|hang thang)\b/gi,
      " "
    )
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
  return (
    Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  );
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
        representativeNotes: Array.from(
          new Set(rows.map((row) => row.note))
        ).slice(0, 3),
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
  const maxDelta = Math.max(
    ...rows.map((row) => Math.abs(row.amount - average))
  );
  return average > 0 && maxDelta / average <= 0.2;
};

const detectCadence = (rows: MonthlyInsightExpense[]) => {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const gaps = sorted
    .slice(1)
    .map((row, index) =>
      dayjs(row.date).diff(dayjs(sorted[index].date), "day")
    );
  const averageGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  const stable = gaps.every((gap) => Math.abs(gap - averageGap) <= 4);

  if (!stable) {
    return null;
  }
  if (averageGap >= 6 && averageGap <= 8) {
    return "weekly";
  }
  if (averageGap >= 13 && averageGap <= 16) {
    return "biweekly";
  }
  if (averageGap >= 28 && averageGap <= 31) {
    return "monthly";
  }
  if (averageGap >= 25 && averageGap <= 35) {
    return "near-monthly";
  }

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
      if (!cadence) {
        return [];
      }

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
          representativeNotes: Array.from(
            new Set(sorted.map((row) => row.note))
          ).slice(0, 3),
          averageAmount,
          selectedMonthImpact: sorted
            .filter((row) => isInsideMonth(row.date, selectedMonth))
            .reduce((sum, row) => sum + row.amount, 0),
        },
      ];
    })
    .sort(
      (a, b) =>
        b.selectedMonthImpact - a.selectedMonthImpact ||
        b.averageAmount - a.averageAmount
    )
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
