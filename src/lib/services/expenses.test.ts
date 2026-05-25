import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getExpenseList,
  groupExpenseRowsByDate,
  resolveExpenseListRange,
} from "./expenses";

const dbMocks = vi.hoisted(() => ({
  where: vi.fn(),
  offset: vi.fn(),
  limit: vi.fn(),
  rows: [] as unknown[],
  select: vi.fn(),
}));

const drizzleMocks = vi.hoisted(() => ({
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  desc: vi.fn((value: unknown) => ({ type: "desc", value })),
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  gte: vi.fn((...args: unknown[]) => ({ type: "gte", args })),
  lt: vi.fn((...args: unknown[]) => ({ type: "lt", args })),
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

vi.mock("drizzle-orm", () => drizzleMocks);

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  dbMocks.rows = [];
});

describe("expense services", () => {
  it("resolves recent ranges within the selected month", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-23T12:00:00Z"));

    const range = resolveExpenseListRange({
      month: "2026-05",
      mode: "recent",
      recentDays: 7,
    });

    expect(range.activeMonth.format("YYYY-MM")).toBe("2026-05");
    expect(range.rangeStart.format("YYYY-MM-DD")).toBe("2026-05-17");
    expect(range.rangeEnd.format("YYYY-MM-DD")).toBe("2026-05-24");
    expect(range.effectiveRecentDays).toBe(7);
  });

  it("groups expense rows by formatted date and totals each day", () => {
    const rows = [
      {
        id: 2,
        date: "2026-05-22",
        amount: 200,
        note: "Lunch",
        category: "Food",
        paidBy: "Cubi",
        budgetId: null,
        budgetName: null,
      },
      {
        id: 1,
        date: "2026-05-22",
        amount: 100,
        note: "Coffee",
        category: "Food",
        paidBy: "Embe",
        budgetId: 10,
        budgetName: "Meals",
      },
      {
        id: 3,
        date: "2026-05-21",
        amount: 50,
        note: "Bus",
        category: "Transport",
        paidBy: "Cubi",
        budgetId: null,
        budgetName: null,
      },
    ];

    expect(groupExpenseRowsByDate(rows)).toMatchObject([
      {
        key: "2026-05-22",
        label: "Friday, 22/05/2026",
        totalAmount: 300,
        items: [rows[0], rows[1]],
      },
      {
        key: "2026-05-21",
        label: "Thursday, 21/05/2026",
        totalAmount: 50,
        items: [rows[2]],
      },
    ]);
  });

  it("returns one requested page and reports whether more rows exist", async () => {
    const chain = {
      from: vi.fn(() => chain),
      leftJoin: vi.fn(() => chain),
      where: dbMocks.where,
      orderBy: vi.fn(() => chain),
      limit: dbMocks.limit,
      offset: dbMocks.offset,
    };
    dbMocks.select.mockReturnValue(chain);
    dbMocks.where.mockReturnValue(chain);
    dbMocks.limit.mockReturnValue(chain);
    dbMocks.offset.mockResolvedValue([
      {
        id: 3,
        clientId: "server-client-3",
        date: "2026-05-23",
        amount: 300,
        note: "Dinner",
        category: "Food",
        paidBy: "Cubi",
        budgetId: null,
        budgetName: null,
      },
      {
        id: 2,
        clientId: "server-client-2",
        date: "2026-05-22",
        amount: 200,
        note: "Lunch",
        category: "Food",
        paidBy: "Embe",
        budgetId: null,
        budgetName: null,
      },
      {
        id: 1,
        clientId: null,
        date: "2026-05-21",
        amount: 100,
        note: "Coffee",
        category: "Food",
        paidBy: "Cubi",
        budgetId: null,
        budgetName: null,
      },
    ]);

    const result = await getExpenseList({
      month: "2026-05",
      limit: 2,
      offset: 4,
    });

    expect(dbMocks.limit).toHaveBeenCalledWith(3);
    expect(dbMocks.offset).toHaveBeenCalledWith(4);
    expect(result.rows.map((row) => row.id)).toEqual([3, 2]);
    expect(result.rows.map((row) => row.clientId)).toEqual([
      "server-client-3",
      "server-client-2",
    ]);
    expect(result.pagination).toEqual({
      limit: 2,
      offset: 4,
      hasMore: true,
    });
  });

  it("does not apply month date bounds when full mode has no selected month", async () => {
    const chain = {
      from: vi.fn(() => chain),
      leftJoin: vi.fn(() => chain),
      where: dbMocks.where,
      orderBy: vi.fn(() => chain),
      limit: dbMocks.limit,
      offset: dbMocks.offset,
    };
    dbMocks.select.mockReturnValue(chain);
    dbMocks.where.mockReturnValue(chain);
    dbMocks.limit.mockReturnValue(chain);
    dbMocks.offset.mockResolvedValue([]);

    await getExpenseList({ limit: 30, offset: 0 });

    expect(drizzleMocks.gte).not.toHaveBeenCalled();
    expect(drizzleMocks.lt).not.toHaveBeenCalled();
    expect(dbMocks.where).toHaveBeenCalledWith(
      expect.objectContaining({ type: "eq" })
    );
  });
});
