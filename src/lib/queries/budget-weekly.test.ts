import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import {
  budgetWeeklyOptionsQueryKey,
  invalidateBudgetWeeklyOptionsCache,
} from "./budget-weekly";

describe("budget weekly query helpers", () => {
  it("invalidates all weekly budget option caches", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    const weekA = budgetWeeklyOptionsQueryKey("2026-03-30");
    const weekB = budgetWeeklyOptionsQueryKey("2026-04-06");
    const otherKey = ["budgets", "overview"] as const;

    queryClient.setQueryData(weekA, [{ id: 1, name: "Food" }]);
    queryClient.setQueryData(weekB, [{ id: 2, name: "Travel" }]);
    queryClient.setQueryData(otherKey, { budgets: [] });

    await invalidateBudgetWeeklyOptionsCache(queryClient);

    expect(queryClient.getQueryState(weekA)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(weekB)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(otherKey)?.isInvalidated).not.toBe(true);
  });
});
