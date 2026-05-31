import { Category } from "@/enums";
import { describe, expect, it, vi } from "vitest";

import { parseSearchWithOpenRouter } from "./parse-search";

const okResponse = (content: unknown) =>
  new Response(
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify(content) } }],
    }),
    { status: 200 }
  );

const budgets = [{ id: 7, name: "Coffee", category: Category.FOOD }];

describe("parseSearchWithOpenRouter", () => {
  it("returns a validated filter on success", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(
        okResponse({ categories: [Category.FOOD], hasBudget: false })
      );
    const result = await parseSearchWithOpenRouter({
      input: "coffee no budget",
      todayMonth: "2026-05",
      budgets,
      apiKey: "k",
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.filter.categories).toEqual([Category.FOOD]);
      expect(result.filter.hasBudget).toBe(false);
    }
  });

  it("drops budgetIds that are not in the provided budget list", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(okResponse({ budgetIds: [7, 999] }));
    const result = await parseSearchWithOpenRouter({
      input: "coffee budget",
      todayMonth: "2026-05",
      budgets,
      apiKey: "k",
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.filter.budgetIds).toEqual([7]);
    }
  });

  it("drops hasBudget when budgetIds is present (collision rule)", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(okResponse({ budgetIds: [7], hasBudget: false }));
    const result = await parseSearchWithOpenRouter({
      input: "coffee budget without budget",
      todayMonth: "2026-05",
      budgets,
      apiKey: "k",
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.filter.budgetIds).toEqual([7]);
      expect(result.filter.hasBudget).toBeUndefined();
    }
  });

  it("falls back to text search when the request fails", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("network"));
    const result = await parseSearchWithOpenRouter({
      input: "weird query",
      todayMonth: "2026-05",
      budgets,
      apiKey: "k",
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(result.status).toBe("fallback");
    if (result.status === "fallback") {
      expect(result.prefill.q).toBe("weird query");
      expect(result.reason).toBe("request_failed");
    }
  });
});
