import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const { parseSearchWithOpenRouter } = vi.hoisted(() => ({
  parseSearchWithOpenRouter: vi.fn(),
}));

vi.mock("@/lib/ai/parse-search", () => ({
  parseSearchWithOpenRouter,
}));

describe("POST /api/ai/parse-search", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    parseSearchWithOpenRouter.mockReset();
    delete process.env.OPENROUTER_API_KEY;
  });

  it("returns 400 for an invalid payload", async () => {
    const response = await POST(
      new Request("http://localhost/api/ai/parse-search", {
        method: "POST",
        body: JSON.stringify({ todayMonth: "2026-05" }),
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
      new Request("http://localhost/api/ai/parse-search", {
        method: "POST",
        body: JSON.stringify({ input: 123, todayMonth: "2026-05" }),
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
      new Request("http://localhost/api/ai/parse-search", {
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

  it("returns parser success payload and forwards budgets", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    const expectedParseResult = {
      status: "success",
      originalInput: "coffee no budget",
      filter: { hasBudget: false },
    };
    parseSearchWithOpenRouter.mockResolvedValue(expectedParseResult);

    const response = await POST(
      new Request("http://localhost/api/ai/parse-search", {
        method: "POST",
        body: JSON.stringify({
          input: "coffee no budget",
          todayDate: "2026-06-01",
          todayMonth: "2026-05",
          budgets: [{ id: 2, name: "Cà phê", category: "Food" }],
        }),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: expectedParseResult,
    });
    expect(parseSearchWithOpenRouter).toHaveBeenCalledWith({
      input: "coffee no budget",
      todayDate: "2026-06-01",
      todayMonth: "2026-05",
      budgets: [{ id: 2, name: "Cà phê", category: "Food" }],
      apiKey: "test-key",
    });
  });

  it("returns 400 when a budget category is invalid", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";

    const response = await POST(
      new Request("http://localhost/api/ai/parse-search", {
        method: "POST",
        body: JSON.stringify({
          input: "coffee no budget",
          todayDate: "2026-06-01",
          todayMonth: "2026-05",
          budgets: [{ id: 2, name: "Cà phê", category: "Travel" }],
        }),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: { code: "INVALID_PAYLOAD", message: "Invalid payload" },
    });
  });

  it("returns parser fallback payload unchanged", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    const fallbackPayload = {
      status: "fallback",
      originalInput: "something unclear",
      reason: "schema_mismatch",
      prefill: { q: "something unclear" },
    } as const;

    parseSearchWithOpenRouter.mockResolvedValue(fallbackPayload);

    const response = await POST(
      new Request("http://localhost/api/ai/parse-search", {
        method: "POST",
        body: JSON.stringify({
          input: "something unclear",
          todayDate: "2026-06-01",
          todayMonth: "2026-05",
        }),
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
      new Request("http://localhost/api/ai/parse-search", {
        method: "POST",
        body: JSON.stringify({
          input: "coffee",
          todayDate: "2026-06-01",
          todayMonth: "2026-05",
        }),
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: "PARSE_SEARCH_FAILED",
        message: "Missing OPENROUTER_API_KEY",
      },
    });
  });

  it("returns 500 when parsing unexpectedly fails", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    parseSearchWithOpenRouter.mockRejectedValue(new Error("OpenRouter failed"));

    const response = await POST(
      new Request("http://localhost/api/ai/parse-search", {
        method: "POST",
        body: JSON.stringify({
          input: "coffee",
          todayDate: "2026-06-01",
          todayMonth: "2026-05",
        }),
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: "PARSE_SEARCH_FAILED",
        message: "Failed to parse search",
      },
    });
  });
});
