import { Category } from "@/enums";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  cloneBudgetsToNextPeriod,
  createBudget,
  deleteBudget,
  getWeeklyBudgetReport,
  setExpenseBudget,
  updateBudget,
} from "./budget-queries";

const dbMocks = vi.hoisted(() => ({
  deleteReturning: vi.fn(),
  deleteWhere: vi.fn(),
  insertValues: vi.fn(),
  insertReturning: vi.fn(),
  select: vi.fn(),
  updateSet: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    delete: vi.fn(() => ({
      where: dbMocks.deleteWhere,
    })),
    insert: vi.fn(() => ({
      values: dbMocks.insertValues,
    })),
    select: dbMocks.select,
    update: vi.fn(() => ({
      set: dbMocks.updateSet,
    })),
  },
}));

const mockSelectRows = (rows: unknown[]) => {
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(() => rows),
  };
  dbMocks.select.mockReturnValue(chain);
};

const mockSelectResultQueue = (results: unknown[][]) => {
  const queue = [...results];
  dbMocks.select.mockImplementation(() => {
    const rows = queue.shift() ?? [];
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => rows),
      limit: vi.fn(() => rows),
    };

    return chain;
  });
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("setExpenseBudget", () => {
  it("touches the expense timestamp when clearing a budget assignment", async () => {
    mockSelectRows([
      {
        id: 5,
        date: "2026-05-23",
        isDeleted: false,
      },
    ]);
    dbMocks.updateSet.mockReturnValue({
      where: vi.fn(),
    });

    await setExpenseBudget({ expenseId: 5, budgetId: null });

    expect(dbMocks.deleteWhere).toHaveBeenCalled();
    expect(dbMocks.updateSet).toHaveBeenCalledWith({
      updatedAt: expect.any(Date),
    });
  });
});

describe("deleteBudget", () => {
  it("touches linked expense timestamps before deleting the budget", async () => {
    const updateWhere = vi.fn();
    dbMocks.updateSet.mockReturnValue({
      where: updateWhere,
    });
    dbMocks.deleteReturning.mockResolvedValue([{ id: 10 }]);
    dbMocks.deleteWhere.mockReturnValue({
      returning: dbMocks.deleteReturning,
    });

    await deleteBudget(10);

    expect(dbMocks.updateSet).toHaveBeenCalledWith({
      updatedAt: expect.any(Date),
    });
    expect(updateWhere).toHaveBeenCalled();
    expect(dbMocks.deleteWhere).toHaveBeenCalled();
    expect(dbMocks.deleteReturning).toHaveBeenCalled();
  });
});

describe("updateBudget", () => {
  it("touches linked expense timestamps when updating appearance metadata", async () => {
    const touchWhere = vi.fn();
    const budgetWhere = vi.fn();
    const budgetReturning = vi.fn().mockResolvedValue([{ id: 10 }]);
    dbMocks.updateSet
      .mockReturnValueOnce({
        where: budgetWhere,
      })
      .mockReturnValueOnce({
        where: touchWhere,
      });
    budgetWhere.mockReturnValue({
      returning: budgetReturning,
    });

    await updateBudget(10, { icon: "🍜", color: "rose" });

    expect(dbMocks.updateSet).toHaveBeenNthCalledWith(1, {
      icon: "🍜",
      color: "rose",
    });
    expect(budgetWhere).toHaveBeenCalled();
    expect(budgetReturning).toHaveBeenCalled();
    expect(dbMocks.updateSet).toHaveBeenNthCalledWith(2, {
      updatedAt: expect.any(Date),
    });
    expect(touchWhere).toHaveBeenCalled();
  });
});

describe("createBudget category", () => {
  it("persists the category on insert", async () => {
    dbMocks.insertReturning.mockResolvedValue([{ id: 1 }]);
    dbMocks.insertValues.mockReturnValue({
      returning: dbMocks.insertReturning,
    });

    await createBudget({
      name: "Coffee",
      icon: "💰",
      color: "lime",
      category: Category.FOOD,
      amount: 200_000,
      period: "week",
      periodStartDate: "2026-05-11",
      periodEndDate: null,
    });

    expect(dbMocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ category: Category.FOOD })
    );
  });
});

describe("cloneBudgetsToNextPeriod", () => {
  beforeEach(() => {
    dbMocks.insertReturning.mockResolvedValue([]);
    dbMocks.insertValues.mockReturnValue({
      returning: dbMocks.insertReturning,
    });
  });

  it("clones weekly budget definitions to the next Sunday-starting week", async () => {
    mockSelectResultQueue([
      [
        {
          id: 1,
          name: "Coffee",
          icon: "☕",
          color: "lime",
          category: Category.FOOD,
          amount: 200000,
          period: "week",
          periodStartDate: "2026-06-07",
          periodEndDate: "2026-06-13",
        },
      ],
      [],
    ]);
    dbMocks.insertReturning.mockResolvedValue([{ id: 20 }]);

    const result = await cloneBudgetsToNextPeriod({
      period: "week",
      sourceStartDate: "2026-06-09",
    });

    expect(dbMocks.insertValues).toHaveBeenCalledWith([
      expect.objectContaining({
        name: "Coffee",
        icon: "☕",
        color: "lime",
        category: Category.FOOD,
        amount: 200000,
        period: "week",
        periodStartDate: "2026-06-14",
        periodEndDate: "2026-06-20",
      }),
    ]);
    expect(result).toEqual({
      period: "week",
      sourceStartDate: "2026-06-07",
      sourceEndDate: "2026-06-13",
      targetStartDate: "2026-06-14",
      targetEndDate: "2026-06-20",
      sourceCount: 1,
      createdCount: 1,
      skippedCount: 0,
      createdBudgetIds: [20],
    });
  });

  it("clones monthly budget definitions to the next month", async () => {
    mockSelectResultQueue([
      [
        {
          id: 2,
          name: "Rent",
          icon: "🏠",
          color: "sky",
          category: Category.HOME,
          amount: 8000000,
          period: "month",
          periodStartDate: "2026-06-01",
          periodEndDate: "2026-06-30",
        },
      ],
      [],
    ]);
    dbMocks.insertReturning.mockResolvedValue([{ id: 30 }]);

    const result = await cloneBudgetsToNextPeriod({
      period: "month",
      sourceStartDate: "2026-06-18",
    });

    expect(dbMocks.insertValues).toHaveBeenCalledWith([
      expect.objectContaining({
        name: "Rent",
        amount: 8000000,
        period: "month",
        periodStartDate: "2026-07-01",
        periodEndDate: "2026-07-31",
      }),
    ]);
    expect(result.targetStartDate).toBe("2026-07-01");
    expect(result.targetEndDate).toBe("2026-07-31");
  });

  it("skips target budgets with the same normalized name", async () => {
    mockSelectResultQueue([
      [
        {
          id: 1,
          name: " Coffee ",
          icon: "☕",
          color: "lime",
          category: Category.FOOD,
          amount: 200000,
          period: "week",
          periodStartDate: "2026-06-07",
          periodEndDate: "2026-06-13",
        },
      ],
      [{ id: 10, name: "coffee" }],
    ]);

    const result = await cloneBudgetsToNextPeriod({
      period: "week",
      sourceStartDate: "2026-06-07",
    });

    expect(dbMocks.insertValues).not.toHaveBeenCalled();
    expect(result.createdCount).toBe(0);
    expect(result.skippedCount).toBe(1);
  });

  it("returns zero counts when there are no source budgets", async () => {
    mockSelectResultQueue([[], []]);

    const result = await cloneBudgetsToNextPeriod({
      period: "week",
      sourceStartDate: "2026-06-07",
    });

    expect(dbMocks.insertValues).not.toHaveBeenCalled();
    expect(result).toEqual({
      period: "week",
      sourceStartDate: "2026-06-07",
      sourceEndDate: "2026-06-13",
      targetStartDate: "2026-06-14",
      targetEndDate: "2026-06-20",
      sourceCount: 0,
      createdCount: 0,
      skippedCount: 0,
      createdBudgetIds: [],
    });
  });
});

describe("updateBudget category", () => {
  it("updates category without touching linked expenses", async () => {
    const budgetWhere = vi.fn();
    const budgetReturning = vi.fn().mockResolvedValue([{ id: 10 }]);
    dbMocks.updateSet.mockReturnValueOnce({ where: budgetWhere });
    budgetWhere.mockReturnValue({ returning: budgetReturning });

    await updateBudget(10, { category: Category.SHOPPING });

    expect(dbMocks.updateSet).toHaveBeenCalledTimes(1);
    expect(dbMocks.updateSet).toHaveBeenNthCalledWith(1, {
      category: Category.SHOPPING,
    });
  });
});

describe("getWeeklyBudgetReport", () => {
  it("includes budget appearance on transaction rows with budget metadata", async () => {
    const budgetRows = [
      {
        id: 10,
        name: "Meals",
        icon: "🍜",
        color: "rose",
        category: Category.FOOD,
        amount: 500000,
        period: "week",
        periodStartDate: "2026-05-18",
        periodEndDate: "2026-05-24",
      },
    ];
    const expenseRows = [
      {
        id: 50,
        date: "2026-05-20",
        note: "Dinner",
        amount: 120000,
        category: "Food",
        budgetId: 10,
        budgetName: "Meals",
        budgetIcon: "🍜",
        budgetColor: "rose",
      },
    ];
    const selectResults = [budgetRows, expenseRows];
    dbMocks.select.mockImplementation(() => {
      const rows = selectResults.shift() ?? [];
      const chain = {
        from: vi.fn(() => chain),
        leftJoin: vi.fn(() => chain),
        orderBy: vi.fn(() => rows),
        where: vi.fn(() => chain),
      };

      return chain;
    });

    const report = await getWeeklyBudgetReport("2026-05-18");

    expect(report.transactions).toEqual([
      {
        id: 50,
        date: "2026-05-20",
        note: "Dinner",
        amount: 120000,
        category: "Food",
        budgetId: 10,
        budgetName: "Meals",
        budgetIcon: "🍜",
        budgetColor: "rose",
      },
    ]);
  });
});
