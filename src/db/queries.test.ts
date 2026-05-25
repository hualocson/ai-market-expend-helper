import { PaidBy } from "@/enums";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createExpense } from "./queries";

const mocks = vi.hoisted(() => ({
  db: {
    insert: vi.fn(),
  },
  setExpenseBudget: vi.fn(),
}));

vi.mock("./index", () => ({
  db: mocks.db,
}));

vi.mock("./budget-queries", () => ({
  setExpenseBudget: mocks.setExpenseBudget,
}));

const mockInsertReturning = (row: { id: number }) => {
  const returning = vi.fn().mockResolvedValue([row]);
  const onConflictDoUpdate = vi.fn(() => ({ returning }));
  const values = vi.fn(() => ({ onConflictDoUpdate, returning }));

  mocks.db.insert.mockReturnValue({ values });

  return { onConflictDoUpdate, returning, values };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createExpense", () => {
  it("clears an existing budget assignment when an idempotent create payload includes budgetId null", async () => {
    mockInsertReturning({ id: 42 });

    await createExpense({
      clientId: "expense-client-1",
      date: "23/05/2026",
      note: "Coffee",
      amount: 45000,
      category: "Food",
      paidBy: PaidBy.CUBI,
      budgetId: null,
    });

    expect(mocks.setExpenseBudget).toHaveBeenCalledWith({
      expenseId: 42,
      budgetId: null,
    });
  });
});
