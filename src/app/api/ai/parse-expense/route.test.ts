import { afterEach, describe, expect, it, vi } from "vitest";

const { parseExpenseWithOpenRouter } = vi.hoisted(() => ({
  parseExpenseWithOpenRouter: vi.fn(),
}));

vi.mock("@/lib/ai/parse-expense", () => ({
  parseExpenseWithOpenRouter,
}));

import { POST } from "./route";

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
      error: "Invalid payload",
    });
  });

  it("returns parser success payload for valid input", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    parseExpenseWithOpenRouter.mockResolvedValue({
      status: "success",
      originalInput: "Lunch 120k today",
      expense: {
        date: "12/04/2026",
        amount: 120000,
        note: "Lunch",
        category: "Food",
      },
    });

    const response = await POST(
      new Request("http://localhost/api/ai/parse-expense", {
        method: "POST",
        body: JSON.stringify({ input: "Lunch 120k today" }),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "success",
    });
    expect(parseExpenseWithOpenRouter).toHaveBeenCalledWith({
      input: "Lunch 120k today",
      apiKey: "test-key",
    });
  });

  it("returns parser fallback payload unchanged", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    parseExpenseWithOpenRouter.mockResolvedValue({
      status: "fallback",
      originalInput: "Taxi 85k",
      prefill: {
        note: "Taxi 85k",
        amount: 85000,
      },
      reason: "schema_mismatch",
    });

    const response = await POST(
      new Request("http://localhost/api/ai/parse-expense", {
        method: "POST",
        body: JSON.stringify({ input: "Taxi 85k" }),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "fallback",
      reason: "schema_mismatch",
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
      error: "Missing OPENROUTER_API_KEY",
    });
  });
});
