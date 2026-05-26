import { syncRepository } from "@/lib/sync/core/repository";
import "fake-indexeddb/auto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { fetchExpenseList } from "./expenses";

const clientBoundExpenseModules = [
  ["expense query fetcher", "src/lib/queries/expenses.ts"],
  ["local expense list builder", "src/lib/sync/expenses/list.ts"],
] as const;

describe("expense client module boundaries", () => {
  afterEach(async () => {
    await syncRepository.testing.clearSyncDb();
  });

  it.each(clientBoundExpenseModules)(
    "%s does not import the server expense service",
    async (_label, filePath) => {
      const source = await readFile(join(process.cwd(), filePath), "utf8");

      expect(source).not.toContain("@/lib/services/expenses");
    }
  );

  it("normalizes optional local budget appearance snapshots", async () => {
    await syncRepository.records.put({
      entity: "expenses",
      clientId: "client-appearance",
      serverId: null,
      syncStatus: "pending",
      lastError: null,
      updatedAt: "2026-05-26T10:00:00.000Z",
      serverUpdatedAt: null,
      payload: {
        date: "2026-05-26",
        amount: 120000,
        note: "Lunch",
        category: "Food",
        paidBy: "Cubi",
        budgetId: 10,
        budgetName: "Meals",
        budgetIcon: "   ",
        budgetColor: "custom",
      },
    });

    const result = await fetchExpenseList({ limit: 30 });

    expect(result.rows[0]).toMatchObject({
      budgetIcon: "💰",
      budgetColor: "lime",
    });
  });
});
