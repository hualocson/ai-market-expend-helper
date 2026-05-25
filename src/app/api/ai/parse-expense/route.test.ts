import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const { parseExpenseWithOpenRouter } = vi.hoisted(() => ({
  parseExpenseWithOpenRouter: vi.fn(),
}));

vi.mock("@/lib/ai/parse-expense", () => ({
  parseExpenseWithOpenRouter,
}));

describe("POST /api/ai/parse-expense", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    parseExpenseWithOpenRouter.mockReset();
    delete process.env.OPENROUTER_API_KEY;
  });

  it("returns 400 for an invalid payload", async () => {
    const response = await POST(
      new Request("http://localhost/api/ai/parse-expense", {
        method: "POST",
        body: JSON.stringify({ input: "" }),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: "INVALID_PAYLOAD",
        message: "Invalid payload",
      },
    });
  });

  it("returns 400 for a non-string input", async () => {
    const response = await POST(
      new Request("http://localhost/api/ai/parse-expense", {
        method: "POST",
        body: JSON.stringify({ input: 123 }),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: "INVALID_PAYLOAD",
        message: "Invalid payload",
      },
    });
  });

  it("returns 400 for malformed JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/ai/parse-expense", {
        method: "POST",
        body: "{",
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: "INVALID_PAYLOAD",
        message: "Invalid payload",
      },
    });
  });

  it("returns parser success payload for valid input", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    const expectedParseResult = {
      status: "success",
      originalInput: "Lunch 120k today",
      expense: {
        date: "12/04/2026",
        amount: 120000,
        note: "Lunch",
        category: "Food",
      },
    };
    parseExpenseWithOpenRouter.mockResolvedValue(expectedParseResult);

    const response = await POST(
      new Request("http://localhost/api/ai/parse-expense", {
        method: "POST",
        body: JSON.stringify({ input: "Lunch 120k today" }),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: expectedParseResult,
    });
    expect(parseExpenseWithOpenRouter).toHaveBeenCalledWith({
      input: "Lunch 120k today",
      apiKey: "test-key",
    });
  });

  it("returns parser fallback payload unchanged", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    const fallbackPayload = {
      status: "fallback",
      originalInput: "Taxi 85k",
      prefill: {
        note: "Taxi 85k",
        amount: 85000,
      },
      reason: "schema_mismatch",
    } as const;

    parseExpenseWithOpenRouter.mockResolvedValue(fallbackPayload);

    const response = await POST(
      new Request("http://localhost/api/ai/parse-expense", {
        method: "POST",
        body: JSON.stringify({ input: "Taxi 85k" }),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: fallbackPayload,
    });
  });

  it("returns 500 when OPENROUTER_API_KEY is missing", async () => {
    const response = await POST(
      new Request("http://localhost/api/ai/parse-expense", {
        method: "POST",
        body: JSON.stringify({ input: "Lunch 120k today" }),
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: "PARSE_EXPENSE_FAILED",
        message: "Missing OPENROUTER_API_KEY",
      },
    });
  });

  it("returns 500 when parsing unexpectedly fails", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    parseExpenseWithOpenRouter.mockRejectedValue(
      new Error("OpenRouter failed")
    );

    const response = await POST(
      new Request("http://localhost/api/ai/parse-expense", {
        method: "POST",
        body: JSON.stringify({ input: "Lunch 120k today" }),
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: "PARSE_EXPENSE_FAILED",
        message: "Failed to parse expense",
      },
    });
  });
});
