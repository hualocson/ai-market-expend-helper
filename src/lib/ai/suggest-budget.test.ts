import { describe, expect, it, vi } from "vitest";

import { MissingOpenRouterApiKeyError, suggestBudget } from "./suggest-budget";
import type { SuggestBudgetCandidate } from "./suggest-budget-contract";

const budgets: SuggestBudgetCandidate[] = [
  {
    id: 1,
    name: "Groceries",
    amount: 3000000,
    spent: 1200000,
    remaining: 1800000,
    period: "month",
  },
  {
    id: 2,
    name: "Coffee",
    amount: 500000,
    spent: 120000,
    remaining: 380000,
    period: "month",
  },
  {
    id: 3,
    name: "Transport",
    amount: 1000000,
    spent: 450000,
    remaining: 550000,
    period: "month",
  },
];

const createResponse = (content: unknown, ok = true) =>
  ({
    ok,
    json: vi.fn().mockResolvedValue({
      choices: [{ message: { content } }],
    }),
  }) as unknown as Response;

describe("suggestBudget", () => {
  it("returns no_match when note is empty or no budgets are provided", async () => {
    await expect(
      suggestBudget({ note: "   ", budgets, apiKey: "test-key" })
    ).resolves.toEqual({
      status: "no_match",
      reason: "Enter a note to suggest a budget.",
    });

    await expect(
      suggestBudget({ note: "coffee", budgets: [], apiKey: "test-key" })
    ).resolves.toEqual({
      status: "no_match",
      reason: "No budgets are available for this expense.",
    });
  });

  it("returns a deterministic high-confidence match without calling the provider", async () => {
    const fetchFn = vi.fn();

    await expect(
      suggestBudget({
        note: "coffee with team",
        budgets,
        apiKey: "test-key",
        fetchFn,
      })
    ).resolves.toEqual({
      status: "success",
      budgetId: 2,
      confidence: "high",
      reason: "The note contains the budget name Coffee.",
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("does not require an api key for no-match or deterministic results", async () => {
    const fetchFn = vi.fn();

    await expect(
      suggestBudget({ note: "coffee", budgets: [], fetchFn })
    ).resolves.toEqual({
      status: "no_match",
      reason: "No budgets are available for this expense.",
    });

    await expect(
      suggestBudget({
        note: "coffee with team",
        budgets,
        fetchFn,
      })
    ).resolves.toEqual({
      status: "success",
      budgetId: 2,
      confidence: "high",
      reason: "The note contains the budget name Coffee.",
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("throws when provider fallback needs a missing api key", async () => {
    await expect(
      suggestBudget({
        note: "weekly market refill",
        budgets,
      })
    ).rejects.toBeInstanceOf(MissingOpenRouterApiKeyError);
  });

  it("does not deterministically match a budget name inside another word", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      createResponse(
        JSON.stringify({
          status: "no_match",
          reason: "The note is a card payment, not car spending.",
        })
      )
    );

    await expect(
      suggestBudget({
        note: "card payment",
        budgets: [
          {
            id: 10,
            name: "Car",
            amount: 2000000,
            spent: 500000,
            remaining: 1500000,
            period: "month",
          },
        ],
        apiKey: "test-key",
        fetchFn,
      })
    ).resolves.toEqual({
      status: "no_match",
      reason: "The note is a card payment, not car spending.",
    });
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it("does not deterministically match a one-character budget name", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      createResponse(
        JSON.stringify({
          status: "no_match",
          reason: "One-character budget names are too ambiguous.",
        })
      )
    );

    await expect(
      suggestBudget({
        note: "buy a snack",
        budgets: [
          {
            id: 11,
            name: "A",
            amount: 300000,
            spent: 50000,
            remaining: 250000,
            period: "month",
          },
        ],
        apiKey: "test-key",
        fetchFn,
      })
    ).resolves.toEqual({
      status: "no_match",
      reason: "One-character budget names are too ambiguous.",
    });
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it("uses the provider when overlapping budget names are ambiguous", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      createResponse(
        JSON.stringify({
          status: "success",
          budgetId: 21,
          confidence: "medium",
          reason: "The more specific coffee budget fits.",
        })
      )
    );

    await expect(
      suggestBudget({
        note: "coffee beans refill",
        budgets: [
          {
            id: 20,
            name: "Coffee",
            amount: 500000,
            spent: 120000,
            remaining: 380000,
            period: "month",
          },
          {
            id: 21,
            name: "Coffee Beans",
            amount: 400000,
            spent: 100000,
            remaining: 300000,
            period: "month",
          },
        ],
        apiKey: "test-key",
        fetchFn,
      })
    ).resolves.toEqual({
      status: "success",
      budgetId: 21,
      confidence: "medium",
      reason: "The more specific coffee budget fits.",
    });
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it("uses the provider when deterministic matching is inconclusive", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      createResponse(
        JSON.stringify({
          status: "success",
          budgetId: 1,
          confidence: "medium",
          reason: "The note is about household food.",
        })
      )
    );

    await expect(
      suggestBudget({
        note: "weekly market refill",
        budgets,
        apiKey: "test-key",
        fetchFn,
      })
    ).resolves.toEqual({
      status: "success",
      budgetId: 1,
      confidence: "medium",
      reason: "The note is about household food.",
    });
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it("returns fallback when the provider invents a budget id", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      createResponse(
        JSON.stringify({
          status: "success",
          budgetId: 99,
          confidence: "high",
          reason: "Invented budget.",
        })
      )
    );

    await expect(
      suggestBudget({
        note: "weekly market refill",
        budgets,
        apiKey: "test-key",
        fetchFn,
      })
    ).resolves.toEqual({
      status: "fallback",
      reason: "schema_mismatch",
    });
  });

  it("passes no_match through from the provider", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      createResponse(
        JSON.stringify({
          status: "no_match",
          reason: "The note is too ambiguous.",
        })
      )
    );

    await expect(
      suggestBudget({
        note: "misc thing",
        budgets,
        apiKey: "test-key",
        fetchFn,
      })
    ).resolves.toEqual({
      status: "no_match",
      reason: "The note is too ambiguous.",
    });
  });

  it("returns fallback for provider request failures", async () => {
    await expect(
      suggestBudget({
        note: "weekly market refill",
        budgets,
        apiKey: "test-key",
        fetchFn: vi.fn().mockRejectedValue(new Error("network down")),
      })
    ).resolves.toEqual({
      status: "fallback",
      reason: "request_failed",
    });
  });
});
