import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getDailyReport,
  getMonthlyReport,
  summarizePaidByCategoryTotals,
} from "./reports";

const dbMocks = vi.hoisted(() => ({
  select: vi.fn(),
}));

const budgetReportMocks = vi.hoisted(() => ({
  getWeeklyBudgetReport: vi.fn(),
}));

const drizzleMocks = vi.hoisted(() => ({
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  desc: vi.fn((value: unknown) => ({ type: "desc", value })),
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  gte: vi.fn((...args: unknown[]) => ({ type: "gte", args })),
  isNull: vi.fn((...args: unknown[]) => ({ type: "isNull", args })),
  lt: vi.fn((...args: unknown[]) => ({ type: "lt", args })),
  lte: vi.fn((...args: unknown[]) => ({ type: "lte", args })),
  or: vi.fn((...args: unknown[]) => ({ type: "or", args })),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    mapWith: vi.fn(() => ({ type: "mapped-sql", strings, values })),
    strings,
    type: "sql",
    values,
  })),
}));

vi.mock("@/db", () => ({
  db: {
    select: dbMocks.select,
  },
}));

vi.mock("@/db/budget-queries", () => ({
  getWeeklyBudgetReport: budgetReportMocks.getWeeklyBudgetReport,
}));

vi.mock("drizzle-orm", () => drizzleMocks);

const mockSelectRows = (
  rows: unknown[],
  options: { terminalWhere?: boolean } = {}
) => {
  const chain = {
    from: vi.fn(() => chain),
    groupBy: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    orderBy: vi.fn(() => rows),
    where: vi.fn(() => (options.terminalWhere ? rows : chain)),
  };

  return chain;
};

describe("report services", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    dbMocks.select.mockReset();
    budgetReportMocks.getWeeklyBudgetReport.mockReset();
    Object.values(drizzleMocks).forEach((mock) => mock.mockClear());
  });

  it("summarizes monthly payer/category totals for report cards", () => {
    expect(
      summarizePaidByCategoryTotals([
        { category: "Food", paidBy: "Cubi", total: 200 },
        { category: "Food", paidBy: "Embe", total: 100 },
        { category: "Transport", paidBy: "Cubi", total: 50 },
      ])
    ).toEqual({
      categoryTotals: [
        { category: "Food", total: 300 },
        { category: "Transport", total: 50 },
      ],
      paidByTotals: [
        { paidBy: "Cubi", total: 250 },
        { paidBy: "Embe", total: 100 },
      ],
      paidByTotalSpent: 350,
    });
  });

  it("returns monthly report insights from expense and budget history", async () => {
    dbMocks.select
      .mockReturnValueOnce(
        mockSelectRows([{ category: "Food", paidBy: "Loc", total: 500_000 }])
      )
      .mockReturnValueOnce(
        mockSelectRows(
          [
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
          ],
          { terminalWhere: true }
        )
      )
      .mockReturnValueOnce(
        mockSelectRows(
          [
            {
              id: 10,
              name: "Subscriptions",
              amount: 310_000,
              icon: "🎧",
              color: "violet",
              period: "month",
              periodStartDate: "2026-01-01",
              periodEndDate: null,
            },
          ],
          { terminalWhere: true }
        )
      );

    const result = await getMonthlyReport("2026-05");

    expect(result.insights.pulse.selectedTotal).toBe(99_000);
    expect(result.insights.budgetVariance.rows[0]).toMatchObject({
      budgetId: 10,
      allowance: 310_000,
      assignedSpend: 99_000,
    });
    expect(drizzleMocks.isNull).toHaveBeenCalledTimes(1);
    expect(drizzleMocks.or).toHaveBeenCalledWith(
      expect.objectContaining({ type: "isNull" }),
      expect.objectContaining({ type: "gte" })
    );
    expect(result.insights.topMerchants[0]).toMatchObject({
      key: "spotify",
      total: 99_000,
    });
    expect(result.insights.recurringSpend[0]).toMatchObject({
      key: "spotify",
      cadence: "monthly",
    });
  });

  it("includes open-ended weekly budgets that started before the selected month", async () => {
    dbMocks.select
      .mockReturnValueOnce(
        mockSelectRows([{ category: "Food", paidBy: "Loc", total: 500_000 }])
      )
      .mockReturnValueOnce(
        mockSelectRows(
          [
            {
              id: 1,
              date: "2026-05-10",
              amount: 500_000,
              note: "Groceries",
              category: "Food",
              paidBy: "Loc",
              budgetId: 10,
            },
          ],
          { terminalWhere: true }
        )
      )
      .mockReturnValueOnce(
        mockSelectRows(
          [
            {
              id: 10,
              name: "Groceries",
              amount: 700_000,
              icon: "🛒",
              color: "green",
              period: "week",
              periodStartDate: "2026-04-14",
              periodEndDate: null,
            },
          ],
          { terminalWhere: true }
        )
      );

    const result = await getMonthlyReport("2026-05");

    expect(result.insights.budgetVariance.rows).toEqual([
      expect.objectContaining({
        budgetId: 10,
        period: "week",
        allowance: 3_100_000,
        assignedSpend: 500_000,
        variance: 2_600_000,
        status: "under",
      }),
    ]);
    expect(result.insights.budgetVariance.summary).toMatchObject({
      totalAllowance: 3_100_000,
      totalAssignedSpend: 500_000,
      totalVariance: 2_600_000,
    });
  });

  it("prorates open-ended monthly budgets that start inside the selected month", async () => {
    dbMocks.select
      .mockReturnValueOnce(
        mockSelectRows([{ category: "Bills", paidBy: "Loc", total: 800_000 }])
      )
      .mockReturnValueOnce(
        mockSelectRows(
          [
            {
              id: 1,
              date: "2026-05-20",
              amount: 800_000,
              note: "Rent",
              category: "Bills",
              paidBy: "Loc",
              budgetId: 10,
            },
          ],
          { terminalWhere: true }
        )
      )
      .mockReturnValueOnce(
        mockSelectRows(
          [
            {
              id: 10,
              name: "Rent",
              amount: 3_100_000,
              icon: "🏠",
              color: "blue",
              period: "month",
              periodStartDate: "2026-05-15",
              periodEndDate: null,
            },
          ],
          { terminalWhere: true }
        )
      );

    const result = await getMonthlyReport("2026-05");

    expect(result.insights.budgetVariance.rows).toEqual([
      expect.objectContaining({
        budgetId: 10,
        period: "month",
        periodStartDate: "2026-05-15",
        periodEndDate: "2026-05-31",
        allowance: 1_700_000,
        assignedSpend: 800_000,
        variance: 900_000,
        status: "under",
      }),
    ]);
  });

  it("returns daily expense rows with joined budget appearance", async () => {
    budgetReportMocks.getWeeklyBudgetReport.mockResolvedValue({
      budgets: [],
    });
    dbMocks.select
      .mockReturnValueOnce(mockSelectRows([{ category: "Food", total: 100 }]))
      .mockReturnValueOnce(
        mockSelectRows([
          {
            id: 1,
            date: "2026-05-23",
            amount: 100,
            note: "Noodles",
            category: "Food",
            paidBy: "Cubi",
            budgetId: 10,
            budgetName: "Meals",
            budgetIcon: "🍜",
            budgetColor: "rose",
          },
          {
            id: 2,
            date: "2026-05-23",
            amount: 50,
            note: "Coffee",
            category: "Food",
            paidBy: "Embe",
            budgetId: null,
            budgetName: null,
            budgetIcon: null,
            budgetColor: null,
          },
        ])
      )
      .mockReturnValueOnce(
        mockSelectRows([{ total: 150 }], { terminalWhere: true })
      );

    const result = await getDailyReport("2026-05-23");

    expect(result.dailyExpenses).toMatchObject([
      {
        budgetId: 10,
        budgetName: "Meals",
        budgetIcon: "🍜",
        budgetColor: "rose",
      },
      {
        budgetId: null,
        budgetName: null,
        budgetIcon: null,
        budgetColor: null,
      },
    ]);
  });
});
