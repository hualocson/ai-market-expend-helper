import { afterEach, describe, expect, it, vi } from "vitest";

import { getDailyReport, summarizePaidByCategoryTotals } from "./reports";

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
  lt: vi.fn((...args: unknown[]) => ({ type: "lt", args })),
  lte: vi.fn((...args: unknown[]) => ({ type: "lte", args })),
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
