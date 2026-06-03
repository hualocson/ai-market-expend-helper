import { Category } from "@/enums";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseExpenseWithOpenRouter } from "./parse-expense";

const createOpenRouterResponse = (
  content: unknown,
  ok = true,
  overrides: Record<string, unknown> = {}
) =>
  ({
    ok,
    status: ok ? 200 : 429,
    statusText: ok ? "OK" : "Too Many Requests",
    headers: new Headers(),
    json: vi.fn().mockResolvedValue({
      choices: [{ message: { content } }],
      ...overrides,
    }),
  }) as unknown as Response;

const budgets = [
  { id: 1, name: "Ăn uống", category: Category.FOOD },
  { id: 2, name: "Cà phê", category: Category.FOOD },
  { id: 3, name: "Xăng xe", category: Category.TRANSPORT },
];

describe("parseExpenseWithOpenRouter", () => {
  beforeEach(() => {
    vi.spyOn(console, "debug").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("returns a high-confidence draft with a provided budget id", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      createOpenRouterResponse(
        JSON.stringify({
          date: "29/05/2026",
          amount: 35000,
          note: "Cà phê sữa đá",
          budgetId: 2,
          confidence: "high",
          reason: "Matched coffee wording to Cà phê.",
        })
      )
    );

    await expect(
      parseExpenseWithOpenRouter({
        input: "cf sua da 35k sang nay",
        budgets,
        today: "29/05/2026",
        apiKey: "test-key",
        fetchFn,
      })
    ).resolves.toEqual({
      status: "success",
      originalInput: "cf sua da 35k sang nay",
      expense: {
        date: "29/05/2026",
        amount: 35000,
        note: "Cà phê sữa đá",
        budgetId: 2,
        confidence: "high",
        reason: "Matched coffee wording to Cà phê.",
      },
    });
    const body = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect(body.messages[0].content).toContain(
      "Budget name is the primary signal"
    );
    expect(body.messages[0].content).toContain(
      "category is only secondary context"
    );
  });

  it("accepts a null budgetId (no plausible match)", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      createOpenRouterResponse(
        JSON.stringify({
          date: "29/05/2026",
          amount: 50000,
          note: "Mua sách",
          budgetId: null,
          confidence: "low",
          reason: "No budget matched books.",
        })
      )
    );

    await expect(
      parseExpenseWithOpenRouter({
        input: "sach 50k",
        budgets,
        today: "29/05/2026",
        apiKey: "test-key",
        fetchFn,
      })
    ).resolves.toMatchObject({
      status: "success",
      expense: { budgetId: null, confidence: "low" },
    });
  });

  it("falls back when the model returns a budget id not in the list", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      createOpenRouterResponse(
        JSON.stringify({
          date: "29/05/2026",
          amount: 35000,
          note: "Cà phê",
          budgetId: 99,
          confidence: "high",
          reason: "invented",
        })
      )
    );

    await expect(
      parseExpenseWithOpenRouter({
        input: "cf 35k",
        budgets,
        today: "29/05/2026",
        apiKey: "test-key",
        fetchFn,
      })
    ).resolves.toMatchObject({
      status: "fallback",
      reason: "schema_mismatch",
    });
  });

  it("falls back when amount is below the 1000 VND minimum", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      createOpenRouterResponse(
        JSON.stringify({
          date: "29/05/2026",
          amount: 35,
          note: "Cà phê",
          budgetId: 2,
          confidence: "high",
          reason: "ok",
        })
      )
    );

    await expect(
      parseExpenseWithOpenRouter({
        input: "cf 35",
        budgets,
        today: "29/05/2026",
        apiKey: "test-key",
        fetchFn,
      })
    ).resolves.toMatchObject({
      status: "fallback",
      reason: "schema_mismatch",
    });
  });

  it("falls back when amount is fractional", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      createOpenRouterResponse(
        JSON.stringify({
          date: "29/05/2026",
          amount: 35000.5,
          note: "Cà phê",
          budgetId: 2,
          confidence: "high",
          reason: "ok",
        })
      )
    );

    await expect(
      parseExpenseWithOpenRouter({
        input: "cf 35k",
        budgets,
        today: "29/05/2026",
        apiKey: "test-key",
        fetchFn,
      })
    ).resolves.toMatchObject({ status: "fallback", reason: "schema_mismatch" });
  });

  it("returns fallback for invalid JSON, extracting an amount from input", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(createOpenRouterResponse("not-json"));

    await expect(
      parseExpenseWithOpenRouter({
        input: "coffee 45k",
        budgets,
        today: "29/05/2026",
        apiKey: "test-key",
        fetchFn,
      })
    ).resolves.toMatchObject({
      status: "fallback",
      reason: "invalid_json",
      prefill: { note: "coffee 45k", amount: 45000 },
    });
  });

  it("returns fallback when the upstream request fails", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("network down"));

    await expect(
      parseExpenseWithOpenRouter({
        input: "Milk 25k",
        budgets,
        today: "29/05/2026",
        apiKey: "test-key",
        fetchFn,
      })
    ).resolves.toMatchObject({
      status: "fallback",
      reason: "request_failed",
      prefill: { note: "Milk 25k", amount: 25000 },
    });
  });

  it("returns fallback when the model content is empty", async () => {
    const fetchFn = vi.fn().mockResolvedValue(createOpenRouterResponse(""));

    await expect(
      parseExpenseWithOpenRouter({
        input: "Bread 20k",
        budgets,
        today: "29/05/2026",
        apiKey: "test-key",
        fetchFn,
      })
    ).resolves.toMatchObject({ status: "fallback", reason: "empty_response" });
  });

  it("returns request_failed when the upstream returns a non-OK status", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(createOpenRouterResponse("", false));

    await expect(
      parseExpenseWithOpenRouter({
        input: "cf 35k",
        budgets,
        today: "29/05/2026",
        apiKey: "test-key",
        fetchFn,
      })
    ).resolves.toMatchObject({ status: "fallback", reason: "request_failed" });
  });

  it("logs the OpenRouter response payload", async () => {
    const debugSpy = vi.mocked(console.debug);
    const content = JSON.stringify({
      date: "29/05/2026",
      amount: 35000,
      note: "Cà phê",
      budgetId: 2,
      confidence: "high",
      reason: "ok",
    });
    const fetchFn = vi
      .fn()
      .mockResolvedValue(createOpenRouterResponse(content));

    await parseExpenseWithOpenRouter({
      input: "cf 35k",
      budgets,
      today: "29/05/2026",
      apiKey: "test-key",
      fetchFn,
    });

    expect(debugSpy).toHaveBeenCalledWith(
      "[parse-expense] openrouter response",
      expect.objectContaining({
        ok: true,
        status: 200,
        statusText: "OK",
        models: ["google/gemma-4-31b-it:free", "openai/gpt-oss-120b:free"],
        payload: {
          choices: [{ message: { content } }],
        },
      })
    );
  });

  it("logs the resolved OpenRouter model and provider when present", async () => {
    const debugSpy = vi.mocked(console.debug);
    const content = JSON.stringify({
      date: "29/05/2026",
      amount: 35000,
      note: "Cà phê",
      budgetId: 2,
      confidence: "high",
      reason: "ok",
    });
    const fetchFn = vi.fn().mockResolvedValue(
      createOpenRouterResponse(content, true, {
        model: "openai/gpt-oss-120b:free",
        provider: "OpenAI",
      })
    );

    await parseExpenseWithOpenRouter({
      input: "cf 35k",
      budgets,
      today: "29/05/2026",
      apiKey: "test-key",
      fetchFn,
    });

    expect(debugSpy).toHaveBeenCalledWith(
      "[parse-expense] openrouter response",
      expect.objectContaining({
        resolvedModel: "openai/gpt-oss-120b:free",
        resolvedProvider: "OpenAI",
      })
    );
  });

  it("logs the OpenRouter non-OK response metadata", async () => {
    const debugSpy = vi.mocked(console.debug);
    const fetchFn = vi
      .fn()
      .mockResolvedValue(createOpenRouterResponse("", false));

    await parseExpenseWithOpenRouter({
      input: "cf 35k",
      budgets,
      today: "29/05/2026",
      apiKey: "test-key",
      fetchFn,
    });

    expect(debugSpy).toHaveBeenLastCalledWith(
      "[parse-expense] openrouter response",
      expect.objectContaining({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        models: ["google/gemma-4-31b-it:free", "openai/gpt-oss-120b:free"],
      })
    );
  });

  it("retries a temporary OpenRouter 503 before falling back", async () => {
    const retryResponse = {
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      headers: new Headers({ "Retry-After": "0" }),
    } as Response;
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(retryResponse)
      .mockResolvedValueOnce(
        createOpenRouterResponse(
          JSON.stringify({
            date: "29/05/2026",
            amount: 35000,
            note: "Cà phê",
            budgetId: 2,
            confidence: "high",
            reason: "ok",
          })
        )
      );

    await expect(
      parseExpenseWithOpenRouter({
        input: "cf 35k",
        budgets,
        today: "29/05/2026",
        apiKey: "test-key",
        fetchFn,
      })
    ).resolves.toMatchObject({
      status: "success",
      expense: {
        amount: 35000,
        note: "Cà phê",
        budgetId: 2,
      },
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("sends budget name and category context in the prompt", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      createOpenRouterResponse(
        JSON.stringify({
          date: "29/05/2026",
          amount: 35000,
          note: "Cà phê",
          budgetId: 2,
          confidence: "high",
          reason: "ok",
        })
      )
    );

    await parseExpenseWithOpenRouter({
      input: "cf 35k",
      budgets,
      today: "29/05/2026",
      apiKey: "test-key",
      fetchFn,
    });

    const body = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    const userMessage = body.messages[1].content as string;
    expect(userMessage).toContain("Cà phê");
    expect(userMessage).toContain(Category.FOOD);
    expect(userMessage).toContain("id 2");
  });

  it("defaults a null date to today", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      createOpenRouterResponse(
        JSON.stringify({
          date: null,
          amount: 35000,
          note: "Cà phê sữa đá",
          budgetId: 2,
          confidence: "high",
          reason: "Matched coffee.",
        })
      )
    );

    await expect(
      parseExpenseWithOpenRouter({
        input: "cf sua da 35k",
        budgets,
        today: "30/05/2026",
        apiKey: "test-key",
        fetchFn,
      })
    ).resolves.toMatchObject({
      status: "success",
      expense: { date: "30/05/2026", confidence: "high" },
    });
  });

  it("defaults an omitted date to today", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      createOpenRouterResponse(
        JSON.stringify({
          amount: 35000,
          note: "Cà phê sữa đá",
          budgetId: 2,
          confidence: "high",
          reason: "Matched coffee.",
        })
      )
    );

    await expect(
      parseExpenseWithOpenRouter({
        input: "cf sua da 35k",
        budgets,
        today: "30/05/2026",
        apiKey: "test-key",
        fetchFn,
      })
    ).resolves.toMatchObject({
      status: "success",
      expense: { date: "30/05/2026" },
    });
  });

  it("defaults an empty-string date to today", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      createOpenRouterResponse(
        JSON.stringify({
          date: "",
          amount: 35000,
          note: "Cà phê sữa đá",
          budgetId: 2,
          confidence: "high",
          reason: "Matched coffee.",
        })
      )
    );

    await expect(
      parseExpenseWithOpenRouter({
        input: "cf sua da 35k",
        budgets,
        today: "30/05/2026",
        apiKey: "test-key",
        fetchFn,
      })
    ).resolves.toMatchObject({
      status: "success",
      expense: { date: "30/05/2026" },
    });
  });

  it("injects today into the prompt for relative date resolution", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      createOpenRouterResponse(
        JSON.stringify({
          date: "29/05/2026",
          amount: 35000,
          note: "Cà phê",
          budgetId: 2,
          confidence: "high",
          reason: "ok",
        })
      )
    );

    await parseExpenseWithOpenRouter({
      input: "cf hom qua 35k",
      budgets,
      today: "30/05/2026",
      apiKey: "test-key",
      fetchFn,
    });

    const body = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    const userMessage = body.messages[1].content as string;
    expect(userMessage).toContain("Today is 30/05/2026");
  });
});
