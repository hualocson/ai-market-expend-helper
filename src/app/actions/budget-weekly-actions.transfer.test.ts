import { describe, expect, it, vi, beforeEach } from "vitest";

const updateMock = vi.fn(() => ({ set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(undefined) }));
const selectMock = vi.fn();
const transactionMock = vi.fn();

vi.mock("@/db", () => ({
  db: {
    transaction: (cb: (tx: unknown) => Promise<unknown>) => transactionMock(cb),
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { transferBudgetAmount } from "./budget-weekly-actions";

describe("transferBudgetAmount — input validation", () => {
  beforeEach(() => {
    transactionMock.mockReset();
    transactionMock.mockImplementation(async () => undefined);
  });

  it("rejects when fromBudgetId equals toBudgetId", async () => {
    await expect(
      transferBudgetAmount({ fromBudgetId: 1, toBudgetId: 1, amount: 100 })
    ).rejects.toThrow(/different/i);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("rejects non-positive amount", async () => {
    await expect(
      transferBudgetAmount({ fromBudgetId: 1, toBudgetId: 2, amount: 0 })
    ).rejects.toThrow();
    await expect(
      transferBudgetAmount({ fromBudgetId: 1, toBudgetId: 2, amount: -5 })
    ).rejects.toThrow();
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("rejects non-integer ids", async () => {
    await expect(
      transferBudgetAmount({ fromBudgetId: 1.5, toBudgetId: 2, amount: 100 })
    ).rejects.toThrow();
    expect(transactionMock).not.toHaveBeenCalled();
  });
});

describe("transferBudgetAmount — transaction behavior", () => {
  beforeEach(() => {
    transactionMock.mockReset();
  });

  it("debits source and credits destination by the transferred amount", async () => {
    const updates: Array<{ amount: number }> = [];

    transactionMock.mockImplementation(async (cb) => {
      const tx = {
        select: () => ({
          from: () => ({
            where: () =>
              Promise.resolve([
                { id: 1, amount: 100_000 },
                { id: 2, amount: 50_000 },
              ]),
          }),
        }),
        update: () => ({
          set: (patch: { amount: number }) => {
            updates.push(patch);
            return { where: () => Promise.resolve(undefined) };
          },
        }),
      };
      await cb(tx);
    });

    await transferBudgetAmount({ fromBudgetId: 1, toBudgetId: 2, amount: 30_000 });

    expect(updates).toEqual([{ amount: 70_000 }, { amount: 80_000 }]);
  });

  it("throws 'Source has insufficient cap' when amount exceeds source.amount", async () => {
    transactionMock.mockImplementation(async (cb) => {
      const tx = {
        select: () => ({
          from: () => ({
            where: () =>
              Promise.resolve([
                { id: 1, amount: 10_000 },
                { id: 2, amount: 50_000 },
              ]),
          }),
        }),
        update: () => ({
          set: () => ({ where: () => Promise.resolve(undefined) }),
        }),
      };
      await cb(tx);
    });

    await expect(
      transferBudgetAmount({ fromBudgetId: 1, toBudgetId: 2, amount: 30_000 })
    ).rejects.toThrow("Source has insufficient cap");
  });

  it("throws 'Budget not found' when one of the budgets is missing", async () => {
    transactionMock.mockImplementation(async (cb) => {
      const tx = {
        select: () => ({
          from: () => ({
            where: () => Promise.resolve([{ id: 1, amount: 100_000 }]),
          }),
        }),
        update: () => ({
          set: () => ({ where: () => Promise.resolve(undefined) }),
        }),
      };
      await cb(tx);
    });

    await expect(
      transferBudgetAmount({ fromBudgetId: 1, toBudgetId: 2, amount: 30_000 })
    ).rejects.toThrow("Budget not found");
  });
});
