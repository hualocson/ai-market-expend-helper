import { describe, expect, it, vi, beforeEach } from "vitest";

const updateReturningMock = vi.fn();
const selectWhereMock = vi.fn();

vi.mock("@/db", () => ({
  db: {
    update: () => ({
      set: () => ({
        where: () => ({
          returning: () => updateReturningMock(),
        }),
      }),
    }),
    select: () => ({
      from: () => ({
        where: () => selectWhereMock(),
      }),
    }),
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { transferBudgetAmount } from "./budget-weekly-actions";

describe("transferBudgetAmount — input validation", () => {
  beforeEach(() => {
    updateReturningMock.mockReset();
    selectWhereMock.mockReset();
    updateReturningMock.mockResolvedValue([{ id: 1 }, { id: 2 }]);
  });

  it("rejects when fromBudgetId equals toBudgetId", async () => {
    await expect(
      transferBudgetAmount({ fromBudgetId: 1, toBudgetId: 1, amount: 100 })
    ).rejects.toThrow(/different/i);
    expect(updateReturningMock).not.toHaveBeenCalled();
  });

  it("rejects non-positive amount", async () => {
    await expect(
      transferBudgetAmount({ fromBudgetId: 1, toBudgetId: 2, amount: 0 })
    ).rejects.toThrow();
    await expect(
      transferBudgetAmount({ fromBudgetId: 1, toBudgetId: 2, amount: -5 })
    ).rejects.toThrow();
    expect(updateReturningMock).not.toHaveBeenCalled();
  });

  it("rejects non-integer ids", async () => {
    await expect(
      transferBudgetAmount({ fromBudgetId: 1.5, toBudgetId: 2, amount: 100 })
    ).rejects.toThrow();
    expect(updateReturningMock).not.toHaveBeenCalled();
  });
});

describe("transferBudgetAmount — atomic update behavior", () => {
  beforeEach(() => {
    updateReturningMock.mockReset();
    selectWhereMock.mockReset();
  });

  it("returns { ok: true } when the update affects both rows", async () => {
    updateReturningMock.mockResolvedValue([{ id: 1 }, { id: 2 }]);

    const result = await transferBudgetAmount({
      fromBudgetId: 1,
      toBudgetId: 2,
      amount: 30_000,
    });

    expect(result).toEqual({ ok: true });
    expect(selectWhereMock).not.toHaveBeenCalled();
  });

  it("returns code: 'INSUFFICIENT_CAP' when guard tripped but both budgets exist", async () => {
    updateReturningMock.mockResolvedValue([]); // 0 rows updated
    selectWhereMock.mockResolvedValue([{ id: 1 }, { id: 2 }]); // both still present

    const result = await transferBudgetAmount({
      fromBudgetId: 1,
      toBudgetId: 2,
      amount: 30_000,
    });

    expect(result).toEqual({ ok: false, code: "INSUFFICIENT_CAP" });
  });

  it("returns code: 'NOT_FOUND' when one of the budgets is missing", async () => {
    updateReturningMock.mockResolvedValue([]);
    selectWhereMock.mockResolvedValue([{ id: 1 }]); // only one present

    const result = await transferBudgetAmount({
      fromBudgetId: 1,
      toBudgetId: 2,
      amount: 30_000,
    });

    expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
  });
});
