import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteBudget, setExpenseBudget } from "./budget-queries";

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
