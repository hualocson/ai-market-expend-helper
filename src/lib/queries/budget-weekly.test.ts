import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  budgetWeeklyOptionsQueryKey,
  fetchWeeklyBudgetOptions,
  invalidateBudgetWeeklyOptionsCache,
} from "./budget-weekly";

afterEach(() => {
  vi.restoreAllMocks();
});

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

  it("filters budget options to the selected date within the fetched week", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        budgets: [
          {
            id: 1,
            name: "Monthly March",
            periodStartDate: "2026-03-01",
            periodEndDate: "2026-03-31",
          },
          {
            id: 2,
            name: "Monthly April",
            periodStartDate: "2026-04-01",
            periodEndDate: "2026-04-30",
          },
          {
            id: 3,
            name: "Week 30/03-05/04",
            periodStartDate: "2026-03-30",
            periodEndDate: "2026-04-05",
          },
        ],
      }),
    } as unknown as Response);

    const options = await fetchWeeklyBudgetOptions("2026-03-30", "2026-04-01");

    expect(options).toEqual([
      { id: 2, name: "Monthly April" },
      { id: 3, name: "Week 30/03-05/04" },
    ]);
  });

  it("returns all fetched budget options when no target date is provided", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        budgets: [
          {
            id: 1,
            name: "Monthly March",
            periodStartDate: "2026-03-01",
            periodEndDate: "2026-03-31",
          },
          {
            id: 2,
            name: "Monthly April",
            periodStartDate: "2026-04-01",
            periodEndDate: "2026-04-30",
          },
        ],
      }),
    } as unknown as Response);

    const options = await fetchWeeklyBudgetOptions("2026-03-30");

    expect(options).toEqual([
      { id: 1, name: "Monthly March" },
      { id: 2, name: "Monthly April" },
    ]);
  });
});
