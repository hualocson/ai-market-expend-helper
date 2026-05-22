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
  it("includes target date in option query keys", () => {
    expect(
      budgetWeeklyOptionsQueryKey("2026-05-17", "2026-05-20")
    ).not.toEqual(budgetWeeklyOptionsQueryKey("2026-05-17", "2026-05-22"));
  });

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
            period: "month",
            periodStartDate: "2026-03-01",
            periodEndDate: "2026-03-31",
            amount: 1000,
            spent: 200,
            remaining: 800,
          },
          {
            id: 2,
            name: "Monthly April",
            period: "month",
            periodStartDate: "2026-04-01",
            periodEndDate: "2026-04-30",
            amount: 1500,
            spent: 1700,
            remaining: -200,
          },
          {
            id: 3,
            name: "Week 30/03-05/04",
            period: "week",
            periodStartDate: "2026-03-30",
            periodEndDate: "2026-04-05",
            amount: 500,
            spent: 0,
            remaining: 500,
          },
        ],
      }),
    } as unknown as Response);

    const options = await fetchWeeklyBudgetOptions("2026-03-30", "2026-04-01");

    expect(options).toEqual([
      {
        id: 2,
        name: "Monthly April",
        period: "month",
        periodStartDate: "2026-04-01",
        periodEndDate: "2026-04-30",
        amount: 1500,
        spent: 1700,
        remaining: -200,
      },
      {
        id: 3,
        name: "Week 30/03-05/04",
        period: "week",
        periodStartDate: "2026-03-30",
        periodEndDate: "2026-04-05",
        amount: 500,
        spent: 0,
        remaining: 500,
      },
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
            period: "month",
            periodStartDate: "2026-03-01",
            periodEndDate: "2026-03-31",
            amount: 800,
            spent: 100,
            remaining: 700,
          },
          {
            id: 2,
            name: "Monthly April",
            period: "month",
            periodStartDate: "2026-04-01",
            periodEndDate: "2026-04-30",
            // amount/spent/remaining intentionally omitted
          },
        ],
      }),
    } as unknown as Response);

    const options = await fetchWeeklyBudgetOptions("2026-03-30");

    expect(options).toEqual([
      {
        id: 1,
        name: "Monthly March",
        period: "month",
        periodStartDate: "2026-03-01",
        periodEndDate: "2026-03-31",
        amount: 800,
        spent: 100,
        remaining: 700,
      },
      {
        id: 2,
        name: "Monthly April",
        period: "month",
        periodStartDate: "2026-04-01",
        periodEndDate: "2026-04-30",
        amount: 0,
        spent: 0,
        remaining: 0,
      },
    ]);
  });
});
