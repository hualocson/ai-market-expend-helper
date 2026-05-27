import {
  SUGGEST_BUDGET_MAX_BUDGETS,
  SUGGEST_BUDGET_NOTE_MAX_LENGTH,
} from "@/lib/ai/suggest-budget-contract";
import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const { suggestBudget } = vi.hoisted(() => ({ suggestBudget: vi.fn() }));

vi.mock("@/lib/ai/suggest-budget", () => ({ suggestBudget }));

const budgets = [
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
] as const;

const createRequest = (body: unknown) =>
  new Request("http://localhost/api/ai/suggest-budget", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("POST /api/ai/suggest-budget", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    suggestBudget.mockReset();
    delete process.env.OPENROUTER_API_KEY;
  });

  it("returns 400 for an invalid payload", async () => {
    const response = await POST(createRequest({ note: "", budgets }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: "INVALID_PAYLOAD",
        message: "Invalid payload",
      },
    });
    expect(suggestBudget).not.toHaveBeenCalled();
  });

  it("returns 400 for an oversized note", async () => {
    const response = await POST(
      createRequest({
        note: "a".repeat(SUGGEST_BUDGET_NOTE_MAX_LENGTH + 1),
        budgets,
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
    expect(suggestBudget).not.toHaveBeenCalled();
  });

  it("returns 400 for an oversized budget list", async () => {
    const response = await POST(
      createRequest({
        note: "coffee with team",
        budgets: Array.from(
          { length: SUGGEST_BUDGET_MAX_BUDGETS + 1 },
          (_, index) => ({
            ...budgets[0],
            id: index + 1,
            name: `Budget ${index + 1}`,
          })
        ),
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
    expect(suggestBudget).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON", async () => {
    const response = await POST(createRequest("{"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: "INVALID_PAYLOAD",
        message: "Invalid payload",
      },
    });
    expect(suggestBudget).not.toHaveBeenCalled();
  });

  it("returns suggestion success data for a valid payload", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    const suggestion = {
      status: "success",
      budgetId: 2,
      confidence: "high",
      reason: "The note is about coffee.",
    } as const;
    suggestBudget.mockResolvedValue(suggestion);

    const response = await POST(
      createRequest({ note: "coffee with team", budgets })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: suggestion,
    });
    expect(suggestBudget).toHaveBeenCalledWith({
      note: "coffee with team",
      budgets,
      apiKey: "test-key",
    });
  });

  it("returns no_match data as a success envelope", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    const suggestion = {
      status: "no_match",
      reason: "The note is too ambiguous.",
    } as const;
    suggestBudget.mockResolvedValue(suggestion);

    const response = await POST(createRequest({ note: "misc thing", budgets }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: suggestion,
    });
  });

  it("returns fallback data as a success envelope", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    const suggestion = {
      status: "fallback",
      reason: "request_failed",
    } as const;
    suggestBudget.mockResolvedValue(suggestion);

    const response = await POST(
      createRequest({ note: "weekly market refill", budgets })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: suggestion,
    });
  });

  it("returns 500 when OPENROUTER_API_KEY is missing", async () => {
    const response = await POST(
      createRequest({ note: "coffee with team", budgets })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: "SUGGEST_BUDGET_FAILED",
        message: "Missing OPENROUTER_API_KEY",
      },
    });
    expect(suggestBudget).not.toHaveBeenCalled();
  });

  it("returns 500 when suggestion unexpectedly fails", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    suggestBudget.mockRejectedValue(new Error("OpenRouter failed"));

    const response = await POST(
      createRequest({ note: "coffee with team", budgets })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: "SUGGEST_BUDGET_FAILED",
        message: "Failed to suggest budget",
      },
    });
    expect(consoleErrorSpy).toHaveBeenCalledOnce();
  });
});
