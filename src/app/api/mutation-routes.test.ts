import { afterEach, describe, expect, it, vi } from "vitest";

import { POST as postExpense } from "./expenses/route";
import { POST as postTransactionBudget } from "./transaction-budget/route";
import {
  DELETE as deleteWeeklyBudget,
  PATCH as patchWeeklyBudget,
} from "./weekly-budgets/[id]/route";
import { POST as postWeeklyBudget } from "./weekly-budgets/route";

const mocks = vi.hoisted(() => ({
  createBudget: vi.fn(),
  createExpense: vi.fn(),
  deleteBudget: vi.fn(),
  setExpenseBudget: vi.fn(),
  updateBudget: vi.fn(),
}));

vi.mock("@/db/queries", () => ({
  createExpense: mocks.createExpense,
}));

vi.mock("@/db/budget-queries", () => ({
  createBudget: mocks.createBudget,
  deleteBudget: mocks.deleteBudget,
  setExpenseBudget: mocks.setExpenseBudget,
  updateBudget: mocks.updateBudget,
}));

const jsonRequest = (url: string, payload: unknown) =>
  new Request(url, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "content-type": "application/json" },
  });

afterEach(() => {
  vi.restoreAllMocks();
  Object.values(mocks).forEach((mock) => mock.mockReset());
});

describe("REST mutation routes", () => {
  it("creates an expense with a validated payload", async () => {
    const payload = {
      date: "23/05/2026",
      note: "Coffee",
      amount: 45000,
      category: "Food",
      paidBy: "Cubi",
      budgetId: null,
    };
    const created = { id: 1, ...payload };
    mocks.createExpense.mockResolvedValue(created);

    const response = await postExpense(
      jsonRequest("http://localhost/api/expenses", payload)
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(created);
    expect(mocks.createExpense).toHaveBeenCalledWith(payload);
  });

  it("returns 400 for an invalid expense payload", async () => {
    const response = await postExpense(
      jsonRequest("http://localhost/api/expenses", {
        date: "23/05/2026",
        amount: 45000,
        category: "Food",
        paidBy: "Someone else",
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid payload",
    });
    expect(mocks.createExpense).not.toHaveBeenCalled();
  });

  it("creates a weekly budget with a validated payload", async () => {
    const payload = {
      name: "Groceries",
      amount: 1000000,
      period: "week",
      periodStartDate: "2026-05-18",
      periodEndDate: null,
    };
    const created = { id: 10, ...payload };
    mocks.createBudget.mockResolvedValue(created);

    const response = await postWeeklyBudget(
      jsonRequest("http://localhost/api/weekly-budgets", payload)
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(created);
    expect(mocks.createBudget).toHaveBeenCalledWith(payload);
  });

  it("returns 400 for an invalid weekly budget payload", async () => {
    const response = await postWeeklyBudget(
      jsonRequest("http://localhost/api/weekly-budgets", {
        name: "Groceries",
        amount: "1000000",
        period: "week",
        periodStartDate: "2026-05-18",
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid payload",
    });
    expect(mocks.createBudget).not.toHaveBeenCalled();
  });

  it("updates a weekly budget with a validated payload", async () => {
    const payload = { amount: 900000 };
    const updated = { id: 10, name: "Groceries", ...payload };
    mocks.updateBudget.mockResolvedValue(updated);

    const response = await patchWeeklyBudget(
      jsonRequest("http://localhost/api/weekly-budgets/10", payload),
      { params: { id: "10" } }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(updated);
    expect(mocks.updateBudget).toHaveBeenCalledWith(10, payload);
  });

  it("returns 400 for an invalid weekly budget id", async () => {
    const response = await patchWeeklyBudget(
      jsonRequest("http://localhost/api/weekly-budgets/0", { amount: 900000 }),
      { params: { id: "0" } }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid budget id",
    });
    expect(mocks.updateBudget).not.toHaveBeenCalled();
  });

  it("returns 404 when deleting a missing weekly budget", async () => {
    mocks.deleteBudget.mockResolvedValue(undefined);

    const response = await deleteWeeklyBudget(
      new Request("http://localhost/api/weekly-budgets/10", {
        method: "DELETE",
      }),
      { params: { id: "10" } }
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Budget not found",
    });
  });

  it("assigns a transaction budget with a validated payload", async () => {
    const payload = { expenseId: 5, budgetId: null };
    mocks.setExpenseBudget.mockResolvedValue(payload);

    const response = await postTransactionBudget(
      jsonRequest("http://localhost/api/transaction-budget", payload)
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(payload);
    expect(mocks.setExpenseBudget).toHaveBeenCalledWith(payload);
  });

  it("returns 400 for an invalid transaction-budget payload", async () => {
    const response = await postTransactionBudget(
      jsonRequest("http://localhost/api/transaction-budget", {
        expenseId: 5,
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid payload",
    });
    expect(mocks.setExpenseBudget).not.toHaveBeenCalled();
  });
});
