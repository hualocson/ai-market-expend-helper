import { afterEach, describe, expect, it, vi } from "vitest";

import { POST as postBudgetTransfer } from "./budgets/transfer/route";
import {
  DELETE as deleteExpense,
  PATCH as patchExpense,
} from "./expenses/[id]/route";
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
  revalidatePath: vi.fn(),
  setExpenseBudget: vi.fn(),
  softDeleteExpense: vi.fn(),
  transferBudgetAmount: vi.fn(),
  updateBudget: vi.fn(),
  updateExpense: vi.fn(),
}));

vi.mock("@/db/queries", () => ({
  createExpense: mocks.createExpense,
  softDeleteExpense: mocks.softDeleteExpense,
  updateExpense: mocks.updateExpense,
}));

vi.mock("@/db/budget-queries", () => ({
  createBudget: mocks.createBudget,
  deleteBudget: mocks.deleteBudget,
  setExpenseBudget: mocks.setExpenseBudget,
  updateBudget: mocks.updateBudget,
}));

vi.mock("@/lib/services/budget-transfer", () => ({
  transferBudgetAmount: mocks.transferBudgetAmount,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
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

  it("updates an expense with a validated payload", async () => {
    const payload = {
      date: "23/05/2026",
      note: "Lunch",
      amount: 85000,
      category: "Food",
      paidBy: "Embe",
      budgetId: 2,
    };
    const updated = { id: 5, ...payload };
    mocks.updateExpense.mockResolvedValue(updated);

    const response = await patchExpense(
      jsonRequest("http://localhost/api/expenses/5", payload),
      { params: { id: "5" } }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(updated);
    expect(mocks.updateExpense).toHaveBeenCalledWith(5, payload);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/budgets");
  });

  it("returns 400 for an invalid expense id", async () => {
    const response = await patchExpense(
      jsonRequest("http://localhost/api/expenses/0", {
        date: "23/05/2026",
        note: "Lunch",
        amount: 85000,
        category: "Food",
        paidBy: "Embe",
        budgetId: null,
      }),
      { params: { id: "0" } }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid expense id",
    });
    expect(mocks.updateExpense).not.toHaveBeenCalled();
  });

  it("returns 404 when updating a missing expense", async () => {
    mocks.updateExpense.mockRejectedValue(new Error("Expense not found"));

    const response = await patchExpense(
      jsonRequest("http://localhost/api/expenses/5", {
        date: "23/05/2026",
        note: "Lunch",
        amount: 85000,
        category: "Food",
        paidBy: "Embe",
        budgetId: null,
      }),
      { params: { id: "5" } }
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Expense not found",
    });
  });

  it("soft deletes an expense", async () => {
    const deleted = { id: 5, isDeleted: true };
    mocks.softDeleteExpense.mockResolvedValue(deleted);

    const response = await deleteExpense(
      new Request("http://localhost/api/expenses/5", { method: "DELETE" }),
      { params: { id: "5" } }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(deleted);
    expect(mocks.softDeleteExpense).toHaveBeenCalledWith(5);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/budgets");
  });

  it("returns 404 when deleting a missing expense", async () => {
    mocks.softDeleteExpense.mockResolvedValue(undefined);

    const response = await deleteExpense(
      new Request("http://localhost/api/expenses/5", { method: "DELETE" }),
      { params: { id: "5" } }
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Expense not found",
    });
  });

  it("returns 404 when deleting an already deleted expense", async () => {
    mocks.softDeleteExpense.mockResolvedValue(undefined);

    const response = await deleteExpense(
      new Request("http://localhost/api/expenses/5", { method: "DELETE" }),
      { params: { id: "5" } }
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Expense not found",
    });
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

  it("transfers budget amount with a validated payload", async () => {
    const payload = { fromBudgetId: 1, toBudgetId: 2, amount: 50000 };
    mocks.transferBudgetAmount.mockResolvedValue({ ok: true });

    const response = await postBudgetTransfer(
      jsonRequest("http://localhost/api/budgets/transfer", payload)
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.transferBudgetAmount).toHaveBeenCalledWith(payload);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/budgets");
  });

  it("returns 400 for an invalid budget transfer payload", async () => {
    const response = await postBudgetTransfer(
      jsonRequest("http://localhost/api/budgets/transfer", {
        fromBudgetId: 1,
        toBudgetId: 1,
        amount: 50000,
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid payload",
    });
    expect(mocks.transferBudgetAmount).not.toHaveBeenCalled();
  });

  it("returns 404 when transferring from or to a missing budget", async () => {
    mocks.transferBudgetAmount.mockResolvedValue({
      ok: false,
      code: "NOT_FOUND",
    });

    const response = await postBudgetTransfer(
      jsonRequest("http://localhost/api/budgets/transfer", {
        fromBudgetId: 1,
        toBudgetId: 2,
        amount: 50000,
      })
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Budget not found",
    });
  });

  it("returns 400 when transfer source has insufficient amount", async () => {
    mocks.transferBudgetAmount.mockResolvedValue({
      ok: false,
      code: "INSUFFICIENT_CAP",
    });

    const response = await postBudgetTransfer(
      jsonRequest("http://localhost/api/budgets/transfer", {
        fromBudgetId: 1,
        toBudgetId: 2,
        amount: 50000,
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Insufficient source budget amount",
    });
  });
});
