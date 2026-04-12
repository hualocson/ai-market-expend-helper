import { describe, expect, it, vi } from "vitest";

import { Category } from "@/enums";

import { parseExpenseWithOpenRouter } from "./parse-expense";

const createOpenRouterResponse = (content: string, ok = true) =>
  ({
    ok,
    json: vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content,
          },
        },
      ],
    }),
  }) as unknown as Response;

describe("parseExpenseWithOpenRouter", () => {
  it("returns success for valid JSON that normalizes to Category", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      createOpenRouterResponse(
        JSON.stringify({
          date: "12/04/2026",
          amount: 120000,
          note: "Lunch",
          category: "Food",
        })
      )
    );

    await expect(
      parseExpenseWithOpenRouter({
        input: "Lunch 120k today",
        apiKey: "test-key",
        fetchFn,
      })
    ).resolves.toEqual({
      status: "success",
      originalInput: "Lunch 120k today",
      expense: {
        date: "12/04/2026",
        amount: 120000,
        note: "Lunch",
        category: Category.FOOD,
      },
    });
  });

  it("returns fallback when the model does not return valid JSON", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(createOpenRouterResponse("not-json-at-all"));

    await expect(
      parseExpenseWithOpenRouter({
        input: "coffee 45k",
        apiKey: "test-key",
        fetchFn,
      })
    ).resolves.toMatchObject({
      status: "fallback",
      originalInput: "coffee 45k",
      reason: "invalid_json",
      prefill: {
        note: "coffee 45k",
      },
    });
  });

  it("returns fallback when category is not part of the exact enum", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      createOpenRouterResponse(
        JSON.stringify({
          date: "12/04/2026",
          amount: 45000,
          note: "Taxi",
          category: "Travel",
        })
      )
    );

    await expect(
      parseExpenseWithOpenRouter({
        input: "Taxi 45k",
        apiKey: "test-key",
        fetchFn,
      })
    ).resolves.toMatchObject({
      status: "fallback",
      originalInput: "Taxi 45k",
      reason: "schema_mismatch",
    });
  });

  it("returns fallback when the upstream request fails", async () => {
    const fetchFn = vi.fn().mockResolvedValue(createOpenRouterResponse("", false));

    await expect(
      parseExpenseWithOpenRouter({
        input: "Milk 25k",
        apiKey: "test-key",
        fetchFn,
      })
    ).resolves.toMatchObject({
      status: "fallback",
      originalInput: "Milk 25k",
      reason: "request_failed",
    });
  });

  it("returns fallback when the model response is empty", async () => {
    const fetchFn = vi.fn().mockResolvedValue(createOpenRouterResponse(""));

    await expect(
      parseExpenseWithOpenRouter({
        input: "Bread 20k",
        apiKey: "test-key",
        fetchFn,
      })
    ).resolves.toMatchObject({
      status: "fallback",
      originalInput: "Bread 20k",
      reason: "empty_response",
    });
  });
});
