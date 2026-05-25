import { afterEach, describe, expect, it, vi } from "vitest";

import { getExpenseChangesSince, pushExpenseOperations } from "./expense-sync";

const dbMocks = vi.hoisted(() => ({
  select: vi.fn(),
  selectWhere: vi.fn(),
}));

const expenseMutationMocks = vi.hoisted(() => ({
  createExpense: vi.fn(),
  softDeleteExpense: vi.fn(),
  updateExpense: vi.fn(),
}));

const drizzleMocks = vi.hoisted(() => ({
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  gt: vi.fn((...args: unknown[]) => ({ type: "gt", args })),
  isNotNull: vi.fn((value: unknown) => ({ type: "isNotNull", value })),
  lte: vi.fn((...args: unknown[]) => ({ type: "lte", args })),
  or: vi.fn((...args: unknown[]) => ({ type: "or", args })),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    type: "sql",
    strings,
    values,
  })),
}));

vi.mock("@/db", () => ({
  db: {
    select: dbMocks.select,
  },
}));

vi.mock("@/db/queries", () => ({
  createExpense: expenseMutationMocks.createExpense,
  softDeleteExpense: expenseMutationMocks.softDeleteExpense,
  updateExpense: expenseMutationMocks.updateExpense,
}));

vi.mock("drizzle-orm", () => drizzleMocks);

const mockSelectRows = (rows: unknown[] | Promise<unknown[]>) => {
  const chain = {
    from: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    where: dbMocks.selectWhere,
  };

  dbMocks.select.mockReturnValue(chain);
  dbMocks.selectWhere.mockReturnValue(rows);

  return chain;
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  dbMocks.select.mockReset();
  dbMocks.selectWhere.mockReset();
  expenseMutationMocks.createExpense.mockReset();
  expenseMutationMocks.softDeleteExpense.mockReset();
  expenseMutationMocks.updateExpense.mockReset();
  Object.values(drizzleMocks).forEach((mock) => mock.mockClear());
});

describe("expense sync service", () => {
  it("uses a high-water cursor captured before selecting changes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-24T10:00:00.000Z"));

    mockSelectRows(
      Promise.resolve().then(() => {
        vi.setSystemTime(new Date("2026-05-24T10:05:00.000Z"));
        return [];
      })
    );

    const result = await getExpenseChangesSince("2026-05-24T09:00:00.000Z");

    expect(result.cursor).toBe("2026-05-24T10:00:00.000Z");
  });

  it("bounds updated and deleted cursor predicates against the matching high-water timestamp", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-24T10:00:00.000Z"));
    mockSelectRows([]);

    await getExpenseChangesSince("2026-05-24T09:00:00.000Z");

    const whereClause = dbMocks.selectWhere.mock.calls[0]?.[0];
    expect(whereClause).toMatchObject({
      type: "or",
      args: [
        {
          type: "and",
          args: [
            { type: "gt", args: [expect.anything(), expect.any(Date)] },
            { type: "lte", args: [expect.anything(), expect.any(Date)] },
          ],
        },
        {
          type: "and",
          args: [
            { type: "gt", args: [expect.anything(), expect.any(Date)] },
            { type: "lte", args: [expect.anything(), expect.any(Date)] },
          ],
        },
      ],
    });
  });

  it("pushes create operations and returns canonical sync rows", async () => {
    expenseMutationMocks.createExpense.mockResolvedValue({ id: 7 });
    mockSelectRows([
      {
        id: 7,
        clientId: "client-1",
        date: "2026-05-23",
        amount: 45000,
        note: "Coffee",
        category: "Food",
        paidBy: "Cubi",
        budgetId: null,
        budgetName: null,
        updatedAt: new Date("2026-05-24T10:00:00.000Z"),
        deletedAt: null,
        isDeleted: false,
      },
    ]);

    const result = await pushExpenseOperations([
      {
        operationId: "op-1",
        type: "create",
        clientId: "client-1",
        serverId: null,
        payload: {
          clientId: "client-1",
          date: "23/05/2026",
          amount: 45000,
          note: "Coffee",
          category: "Food",
          paidBy: "Cubi",
          budgetId: null,
        },
      },
    ]);

    expect(expenseMutationMocks.createExpense).toHaveBeenCalledWith({
      clientId: "client-1",
      date: "23/05/2026",
      amount: 45000,
      note: "Coffee",
      category: "Food",
      paidBy: "Cubi",
      budgetId: null,
    });
    expect(result).toEqual({
      results: [
        {
          operationId: "op-1",
          ok: true,
          row: {
            id: 7,
            clientId: "client-1",
            date: "2026-05-23",
            amount: 45000,
            note: "Coffee",
            category: "Food",
            paidBy: "Cubi",
            budgetId: null,
            budgetName: null,
            updatedAt: "2026-05-24T10:00:00.000Z",
            deletedAt: null,
            isDeleted: false,
          },
        },
      ],
    });
  });

  it("normalizes ISO local dates before pushing creates to expense mutations", async () => {
    expenseMutationMocks.createExpense.mockResolvedValue({ id: 7 });
    mockSelectRows([
      {
        id: 7,
        clientId: "client-1",
        date: "2026-05-23",
        amount: 45000,
        note: "Coffee",
        category: "Food",
        paidBy: "Cubi",
        budgetId: null,
        budgetName: null,
        updatedAt: new Date("2026-05-24T10:00:00.000Z"),
        deletedAt: null,
        isDeleted: false,
      },
    ]);

    await pushExpenseOperations([
      {
        operationId: "op-1",
        type: "create",
        clientId: "client-1",
        serverId: null,
        payload: {
          clientId: "client-1",
          date: "2026-05-23",
          amount: 45000,
          note: "Coffee",
          category: "Food",
          paidBy: "Cubi",
          budgetId: null,
        },
      },
    ]);

    expect(expenseMutationMocks.createExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        date: "23/05/2026",
      })
    );
  });
});
