import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  deleteBudget,
  getWeeklyBudgetReport,
  setExpenseBudget,
  updateBudget,
} from "./budget-queries";

const dbMocks = vi.hoisted(() => ({
  deleteReturning: vi.fn(),
  deleteWhere: vi.fn(),
  select: vi.fn(),
  updateSet: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    delete: vi.fn(() => ({
      where: dbMocks.deleteWhere,
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

describe("getWeeklyBudgetReport", () => {
  it("includes budget appearance on transaction rows with budget metadata", async () => {
    const budgetRows = [
      {
        id: 10,
        name: "Meals",
        icon: "🍜",
        color: "rose",
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
