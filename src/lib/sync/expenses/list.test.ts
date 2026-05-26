import { describe, expect, it } from "vitest";

import { buildExpenseListResultFromLocalRows } from "./list";
import type { LocalExpense } from "./types";

const row = (overrides: Partial<LocalExpense>): LocalExpense => ({
  entity: "expenses",
  clientId: "client-1",
  serverId: 1,
  date: "2026-05-23",
  amount: 45000,
  note: "Coffee",
  category: "Food",
  paidBy: "Cubi",
  budgetId: null,
  budgetName: null,
  syncStatus: "synced",
  lastError: null,
  updatedAt: "2026-05-24T09:00:00.000Z",
  serverUpdatedAt: "2026-05-24T09:00:00.000Z",
  ...overrides,
});

describe("local expense list builder", () => {
  it("filters by month and hides deleted rows", () => {
    const result = buildExpenseListResultFromLocalRows(
      [
        row({ clientId: "a", date: "2026-05-23" }),
        row({ clientId: "b", date: "2026-04-23" }),
        row({ clientId: "c", syncStatus: "deleted" }),
      ],
      { month: "2026-05", limit: 30 }
    );

    expect(result.rows.map((expense) => expense.note)).toEqual(["Coffee"]);
    expect(result.groupedRows).toHaveLength(1);
  });

  it("matches accent-insensitive search", () => {
    const result = buildExpenseListResultFromLocalRows(
      [row({ note: "Cà phê" })],
      { q: "ca phe", limit: 30 }
    );

    expect(result.rows).toHaveLength(1);
  });

  it("returns unique negative ids for pending rows with colliding client id hashes", () => {
    const result = buildExpenseListResultFromLocalRows(
      [
        row({ clientId: "Aa", serverId: null }),
        row({ clientId: "BB", serverId: null }),
      ],
      { limit: 30 }
    );

    const ids = result.rows.map((expense) => expense.id);

    expect(ids.every((id) => id < 0)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("carries client ids through rows and groups for pending local identity", () => {
    const result = buildExpenseListResultFromLocalRows(
      [row({ clientId: "pending-client", serverId: null })],
      { limit: 30 }
    );

    expect(result.rows[0]).toMatchObject({
      clientId: "pending-client",
      id: expect.any(Number),
    });
    expect(result.groupedRows[0]?.items[0]).toMatchObject({
      clientId: "pending-client",
    });
  });

  it("carries sync status through rows and grouped items", () => {
    const result = buildExpenseListResultFromLocalRows(
      [
        row({
          clientId: "pending-client",
          serverId: null,
          note: "Pending coffee",
          syncStatus: "pending",
          updatedAt: "2026-05-24T10:00:00.000Z",
        }),
        row({
          clientId: "failed-client",
          serverId: 2,
          note: "Failed lunch",
          syncStatus: "failed",
          updatedAt: "2026-05-24T09:00:00.000Z",
        }),
        row({
          clientId: "synced-client",
          serverId: 1,
          note: "Synced tea",
          syncStatus: "synced",
          updatedAt: "2026-05-24T08:00:00.000Z",
        }),
      ],
      { limit: 30 }
    );

    expect(result.rows.map((expense) => expense.syncStatus)).toEqual([
      "pending",
      "failed",
      "synced",
    ]);
    expect(
      result.groupedRows[0]?.items.map((expense) => expense.syncStatus)
    ).toEqual(["pending", "failed", "synced"]);
  });

  it("maps budget appearance snapshots into local list rows", () => {
    const result = buildExpenseListResultFromLocalRows([
      row({
        budgetId: 10,
        budgetName: "Meals",
        budgetIcon: "🍜",
        budgetColor: "rose",
      }),
    ]);

    expect(result.rows[0]).toMatchObject({
      budgetIcon: "🍜",
      budgetColor: "rose",
    });
  });

  it("reports hasMore when pagination leaves additional local rows", () => {
    const result = buildExpenseListResultFromLocalRows(
      [
        row({ clientId: "a", serverId: 3 }),
        row({ clientId: "b", serverId: 2 }),
        row({ clientId: "c", serverId: 1 }),
      ],
      { limit: 2 }
    );

    expect(result.rows.map((expense) => expense.id)).toEqual([3, 2]);
    expect(result.pagination).toEqual({ limit: 2, offset: 0, hasMore: true });
  });

  it("sorts same-date rows with pending rows before synced rows", () => {
    const result = buildExpenseListResultFromLocalRows(
      [
        row({ clientId: "server-10", serverId: 10, note: "Server 10" }),
        row({
          clientId: "pending-old",
          serverId: null,
          note: "Pending old",
          updatedAt: "2026-05-24T08:00:00.000Z",
        }),
        row({ clientId: "server-11", serverId: 11, note: "Server 11" }),
        row({
          clientId: "pending-new",
          serverId: null,
          note: "Pending new",
          updatedAt: "2026-05-24T10:00:00.000Z",
        }),
      ],
      { limit: 30 }
    );

    expect(result.rows.map((expense) => expense.note)).toEqual([
      "Pending new",
      "Pending old",
      "Server 11",
      "Server 10",
    ]);
  });

  it("matches all search terms across note and category without accents", () => {
    const result = buildExpenseListResultFromLocalRows(
      [
        row({ clientId: "a", note: "Cà phê sữa", category: "Ăn uống" }),
        row({ clientId: "b", note: "Cà phê sữa", category: "Cafe" }),
      ],
      { q: "ca phe an", limit: 30 }
    );

    expect(result.rows.map((expense) => expense.category)).toEqual(["Ăn uống"]);
  });

  it("applies recent mode boundaries within the active month", () => {
    const result = buildExpenseListResultFromLocalRows(
      [
        row({ clientId: "before", date: "2026-04-23", note: "Before" }),
        row({ clientId: "start", date: "2026-04-24", note: "Start" }),
        row({ clientId: "last", date: "2026-04-30", note: "Last" }),
        row({ clientId: "end", date: "2026-05-01", note: "End" }),
      ],
      { month: "2026-04", mode: "recent", recentDays: 7, limit: 30 }
    );

    expect(result.rows.map((expense) => expense.note)).toEqual([
      "Last",
      "Start",
    ]);
    expect(result.isRecent).toBe(true);
    expect(result.effectiveRecentDays).toBe(7);
  });
});
