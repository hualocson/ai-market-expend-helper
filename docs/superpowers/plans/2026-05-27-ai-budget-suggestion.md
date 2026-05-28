# AI Budget Suggestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Suggest and preselect the best matching budget when a user blurs an expense note input.

**Architecture:** Add a reusable OpenRouter structured-output helper, then build a budget suggestion task on top of it. Expose the task through `POST /api/ai/suggest-budget`, call it through a TanStack mutation hook, and wire blur-triggered suggestions into `ManualExpenseForm` and `QuickExpenseSheet` without overriding manual budget choices.

**Tech Stack:** Next.js 15 App Router, React 19, TanStack Query mutations, Zod, Vitest, native `fetch`, OpenRouter chat completions.

---

## File Structure

- Create `src/lib/ai/core/openrouter.ts`
  - Reusable server-side OpenRouter helper for structured JSON chat completions.
- Create `src/lib/ai/core/openrouter.test.ts`
  - Unit tests for request shape, response parsing, and fallback error modes.
- Create `src/lib/ai/suggest-budget-contract.ts`
  - Request schema, response schema, TypeScript types, and shared constants.
- Create `src/lib/ai/suggest-budget.ts`
  - Deterministic matcher, prompt builder, AI call, and output validation.
- Create `src/lib/ai/suggest-budget.test.ts`
  - Unit tests for deterministic and provider-backed suggestion behavior.
- Create `src/app/api/ai/suggest-budget/route.ts`
  - API route with current `ApiResponse<T>` envelope.
- Create `src/app/api/ai/suggest-budget/route.test.ts`
  - Route tests for invalid payloads, success, no-match, fallback, and server errors.
- Modify `src/lib/mutations/index.ts`
  - Add `useSuggestBudgetMutation()` for client-side suggestion requests.
- Modify `src/lib/mutations/index.test.tsx`
  - Add mutation tests for request shape, envelope unwrapping, and error behavior.
- Modify `src/components/ManualExpenseForm.tsx`
  - Trigger suggestion on note blur and apply it only when the budget was not manually selected.
- Modify `src/components/ManualExpenseForm.quick-mode.test.tsx`
  - Add coverage for blur-triggered suggestions in the manual form.
- Modify `src/components/QuickExpenseSheet.tsx`
  - Trigger suggestion on note blur and apply it only when the budget was not manually selected.
- Modify `src/components/QuickExpenseSheet.test.tsx`
  - Add coverage for blur-triggered suggestions in the quick sheet.

## Task 1: OpenRouter Structured Output Core

**Files:**

- Create: `src/lib/ai/core/openrouter.test.ts`
- Create: `src/lib/ai/core/openrouter.ts`

- [ ] **Step 1: Write the failing OpenRouter core tests**

Create `src/lib/ai/core/openrouter.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  callOpenRouterJson,
  type OpenRouterJsonSchema,
} from "./openrouter";

const suggestionSchema = z.object({
  status: z.literal("success"),
  budgetId: z.number(),
});

const jsonSchema: OpenRouterJsonSchema = {
  name: "budget_suggestion",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["status", "budgetId"],
    properties: {
      status: { type: "string", enum: ["success"] },
      budgetId: { type: "number" },
    },
  },
};

const createResponse = (content: unknown, ok = true) =>
  ({
    ok,
    json: vi.fn().mockResolvedValue({
      choices: [{ message: { content } }],
    }),
  }) as unknown as Response;

describe("callOpenRouterJson", () => {
  it("posts a structured-output chat completion and parses valid JSON", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(createResponse(JSON.stringify({ status: "success", budgetId: 7 })));

    const result = await callOpenRouterJson({
      apiKey: "test-key",
      model: "test/model",
      messages: [{ role: "user", content: "coffee" }],
      jsonSchema,
      schema: suggestionSchema,
      fetchFn,
    });

    expect(result).toEqual({
      ok: true,
      value: { status: "success", budgetId: 7 },
    });
    expect(fetchFn).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-key",
        },
        body: expect.any(String),
      })
    );
    expect(JSON.parse(fetchFn.mock.calls[0][1].body)).toMatchObject({
      model: "test/model",
      messages: [{ role: "user", content: "coffee" }],
      response_format: {
        type: "json_schema",
        json_schema: jsonSchema,
      },
    });
  });

  it("returns request_failed when fetch rejects or response is not ok", async () => {
    await expect(
      callOpenRouterJson({
        apiKey: "test-key",
        model: "test/model",
        messages: [{ role: "user", content: "coffee" }],
        jsonSchema,
        schema: suggestionSchema,
        fetchFn: vi.fn().mockRejectedValue(new Error("network down")),
      })
    ).resolves.toEqual({ ok: false, reason: "request_failed" });

    await expect(
      callOpenRouterJson({
        apiKey: "test-key",
        model: "test/model",
        messages: [{ role: "user", content: "coffee" }],
        jsonSchema,
        schema: suggestionSchema,
        fetchFn: vi.fn().mockResolvedValue(createResponse("{}", false)),
      })
    ).resolves.toEqual({ ok: false, reason: "request_failed" });
  });

  it("returns invalid_response for empty, non-string, or invalid JSON content", async () => {
    for (const content of ["", { status: "success" }, "not json"]) {
      await expect(
        callOpenRouterJson({
          apiKey: "test-key",
          model: "test/model",
          messages: [{ role: "user", content: "coffee" }],
          jsonSchema,
          schema: suggestionSchema,
          fetchFn: vi.fn().mockResolvedValue(createResponse(content)),
        })
      ).resolves.toEqual({ ok: false, reason: "invalid_response" });
    }
  });

  it("returns schema_mismatch when parsed JSON does not match the schema", async () => {
    await expect(
      callOpenRouterJson({
        apiKey: "test-key",
        model: "test/model",
        messages: [{ role: "user", content: "coffee" }],
        jsonSchema,
        schema: suggestionSchema,
        fetchFn: vi.fn().mockResolvedValue(createResponse(JSON.stringify({ status: "success" }))),
      })
    ).resolves.toEqual({ ok: false, reason: "schema_mismatch" });
  });
});
```

- [ ] **Step 2: Run the failing OpenRouter core tests**

Run:

```bash
rtk bun run test src/lib/ai/core/openrouter.test.ts
```

Expected: fail because `src/lib/ai/core/openrouter.ts` does not exist.

- [ ] **Step 3: Implement the OpenRouter core helper**

Create `src/lib/ai/core/openrouter.ts`:

```ts
import type { z } from "zod";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export type OpenRouterMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type OpenRouterJsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OpenRouterJsonFailureReason =
  | "request_failed"
  | "invalid_response"
  | "schema_mismatch";

export type OpenRouterJsonResult<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      reason: OpenRouterJsonFailureReason;
    };

type CallOpenRouterJsonArgs<TSchema extends z.ZodType> = {
  apiKey: string;
  model: string;
  messages: OpenRouterMessage[];
  jsonSchema: OpenRouterJsonSchema;
  schema: TSchema;
  fetchFn?: typeof fetch;
};

const readContent = (content: unknown) => {
  if (typeof content !== "string") {
    return null;
  }

  const trimmed = content.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const callOpenRouterJson = async <TSchema extends z.ZodType>({
  apiKey,
  model,
  messages,
  jsonSchema,
  schema,
  fetchFn = fetch,
}: CallOpenRouterJsonArgs<TSchema>): Promise<
  OpenRouterJsonResult<z.infer<TSchema>>
> => {
  let response: Response;

  try {
    response = await fetchFn(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        response_format: {
          type: "json_schema",
          json_schema: jsonSchema,
        },
      }),
    });
  } catch {
    return { ok: false, reason: "request_failed" };
  }

  if (!response.ok) {
    return { ok: false, reason: "request_failed" };
  }

  let payload: {
    choices?: Array<{ message?: { content?: unknown } }>;
  };

  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    return { ok: false, reason: "invalid_response" };
  }

  const content = readContent(payload.choices?.[0]?.message?.content);
  if (!content) {
    return { ok: false, reason: "invalid_response" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { ok: false, reason: "invalid_response" };
  }

  const validated = schema.safeParse(parsed);
  if (!validated.success) {
    return { ok: false, reason: "schema_mismatch" };
  }

  return { ok: true, value: validated.data };
};
```

- [ ] **Step 4: Run the OpenRouter core tests**

Run:

```bash
rtk bun run test src/lib/ai/core/openrouter.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit Task 1**

Run:

```bash
rtk git add src/lib/ai/core/openrouter.ts src/lib/ai/core/openrouter.test.ts
rtk git commit -m "feat: add openrouter structured output helper"
```

## Task 2: Budget Suggestion Task

**Files:**

- Create: `src/lib/ai/suggest-budget-contract.ts`
- Create: `src/lib/ai/suggest-budget.test.ts`
- Create: `src/lib/ai/suggest-budget.ts`

- [ ] **Step 1: Write the contract file**

Create `src/lib/ai/suggest-budget-contract.ts`:

```ts
import { z } from "zod";

export const suggestBudgetCandidateSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1),
  amount: z.number().finite(),
  spent: z.number().finite(),
  remaining: z.number().finite(),
  period: z.enum(["week", "month", "custom"]),
  periodStartDate: z.string().optional(),
  periodEndDate: z.string().nullable().optional(),
});

export const suggestBudgetRequestSchema = z.object({
  note: z.string().trim().min(1),
  budgets: z.array(suggestBudgetCandidateSchema),
});

export const suggestBudgetModelResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("success"),
    budgetId: z.number().int().positive(),
    confidence: z.enum(["high", "medium", "low"]),
    reason: z.string().trim().min(1).max(180),
  }),
  z.object({
    status: z.literal("no_match"),
    reason: z.string().trim().min(1).max(180),
  }),
]);

export const suggestBudgetResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("success"),
    budgetId: z.number().int().positive(),
    confidence: z.enum(["high", "medium", "low"]),
    reason: z.string().trim().min(1).max(180),
  }),
  z.object({
    status: z.literal("no_match"),
    reason: z.string().trim().min(1).max(180),
  }),
  z.object({
    status: z.literal("fallback"),
    reason: z.enum(["request_failed", "invalid_response", "schema_mismatch"]),
  }),
]);

export type SuggestBudgetCandidate = z.infer<
  typeof suggestBudgetCandidateSchema
>;
export type SuggestBudgetRequest = z.infer<typeof suggestBudgetRequestSchema>;
export type SuggestBudgetModelResponse = z.infer<
  typeof suggestBudgetModelResponseSchema
>;
export type SuggestBudgetResponse = z.infer<typeof suggestBudgetResponseSchema>;
```

- [ ] **Step 2: Write the failing suggestion task tests**

Create `src/lib/ai/suggest-budget.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

import { suggestBudget } from "./suggest-budget";
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
```

- [ ] **Step 3: Run the failing suggestion task tests**

Run:

```bash
rtk bun run test src/lib/ai/suggest-budget.test.ts
```

Expected: fail because `src/lib/ai/suggest-budget.ts` does not exist.

- [ ] **Step 4: Implement the suggestion task**

Create `src/lib/ai/suggest-budget.ts`:

```ts
import { callOpenRouterJson } from "./core/openrouter";
import type { OpenRouterJsonSchema } from "./core/openrouter";
import {
  suggestBudgetModelResponseSchema,
  type SuggestBudgetCandidate,
  type SuggestBudgetResponse,
} from "./suggest-budget-contract";

const MODEL = "openai/gpt-oss-20b:free";

const MODEL_JSON_SCHEMA: OpenRouterJsonSchema = {
  name: "suggest_budget",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["status"],
    properties: {
      status: { type: "string", enum: ["success", "no_match"] },
      budgetId: { type: "integer" },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
      reason: { type: "string" },
    },
  },
};

const SYSTEM_PROMPT = `
You choose the best budget for one expense note.

Rules:
- Choose only from the provided budget ids.
- Return no_match when the note is ambiguous.
- Prefer semantic fit over remaining amount.
- Use budget name as the primary signal.
- Use period and remaining amount only as supporting context.
- Keep reason short.
- Return only JSON matching the schema.
`.trim();

type SuggestBudgetArgs = {
  note: string;
  budgets: SuggestBudgetCandidate[];
  apiKey: string;
  fetchFn?: typeof fetch;
};

const normalizeText = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, " ");

const findDeterministicMatch = (
  note: string,
  budgets: SuggestBudgetCandidate[]
): SuggestBudgetResponse | null => {
  const normalizedNote = normalizeText(note);
  const matches = budgets.filter((budget) => {
    const normalizedName = normalizeText(budget.name);
    return normalizedName.length > 1 && normalizedNote.includes(normalizedName);
  });

  if (matches.length !== 1) {
    return null;
  }

  const [match] = matches;
  return {
    status: "success",
    budgetId: match.id,
    confidence: "high",
    reason: `The note contains the budget name ${match.name}.`,
  };
};

const buildUserPrompt = (
  note: string,
  budgets: SuggestBudgetCandidate[]
) =>
  JSON.stringify({
    note,
    budgets: budgets.map((budget) => ({
      id: budget.id,
      name: budget.name,
      amount: budget.amount,
      spent: budget.spent,
      remaining: budget.remaining,
      period: budget.period,
      periodStartDate: budget.periodStartDate,
      periodEndDate: budget.periodEndDate,
    })),
  });

const validateCandidateResult = (
  result: SuggestBudgetResponse,
  budgets: SuggestBudgetCandidate[]
): SuggestBudgetResponse => {
  if (result.status !== "success") {
    return result;
  }

  if (!budgets.some((budget) => budget.id === result.budgetId)) {
    return { status: "fallback", reason: "schema_mismatch" };
  }

  return result;
};

export const suggestBudget = async ({
  note,
  budgets,
  apiKey,
  fetchFn,
}: SuggestBudgetArgs): Promise<SuggestBudgetResponse> => {
  const trimmedNote = note.trim();

  if (trimmedNote.length === 0) {
    return {
      status: "no_match",
      reason: "Enter a note to suggest a budget.",
    };
  }

  if (budgets.length === 0) {
    return {
      status: "no_match",
      reason: "No budgets are available for this expense.",
    };
  }

  const deterministic = findDeterministicMatch(trimmedNote, budgets);
  if (deterministic) {
    return deterministic;
  }

  const providerResult = await callOpenRouterJson({
    apiKey,
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(trimmedNote, budgets) },
    ],
    jsonSchema: MODEL_JSON_SCHEMA,
    schema: suggestBudgetModelResponseSchema,
    fetchFn,
  });

  if (!providerResult.ok) {
    return {
      status: "fallback",
      reason: providerResult.reason,
    };
  }

  return validateCandidateResult(providerResult.value, budgets);
};
```

- [ ] **Step 5: Run the suggestion task tests**

Run:

```bash
rtk bun run test src/lib/ai/suggest-budget.test.ts
```

Expected: pass.

- [ ] **Step 6: Commit Task 2**

Run:

```bash
rtk git add src/lib/ai/suggest-budget-contract.ts src/lib/ai/suggest-budget.ts src/lib/ai/suggest-budget.test.ts
rtk git commit -m "feat: add ai budget suggestion task"
```

## Task 3: Suggest Budget API Route

**Files:**

- Create: `src/app/api/ai/suggest-budget/route.test.ts`
- Create: `src/app/api/ai/suggest-budget/route.ts`

- [ ] **Step 1: Write the failing route tests**

Create `src/app/api/ai/suggest-budget/route.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const { suggestBudget } = vi.hoisted(() => ({
  suggestBudget: vi.fn(),
}));

vi.mock("@/lib/ai/suggest-budget", () => ({
  suggestBudget,
}));

const budgets = [
  {
    id: 1,
    name: "Groceries",
    amount: 3000000,
    spent: 1000000,
    remaining: 2000000,
    period: "month",
  },
];

describe("POST /api/ai/suggest-budget", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    suggestBudget.mockReset();
    delete process.env.OPENROUTER_API_KEY;
  });

  it("returns 400 for invalid payloads", async () => {
    const response = await POST(
      new Request("http://localhost/api/ai/suggest-budget", {
        method: "POST",
        body: JSON.stringify({ note: "", budgets }),
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
      new Request("http://localhost/api/ai/suggest-budget", {
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

  it("wraps a successful suggestion in the API envelope", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    const suggestion = {
      status: "success",
      budgetId: 1,
      confidence: "high",
      reason: "The note matches Groceries.",
    };
    suggestBudget.mockResolvedValue(suggestion);

    const response = await POST(
      new Request("http://localhost/api/ai/suggest-budget", {
        method: "POST",
        body: JSON.stringify({ note: "buy groceries", budgets }),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: suggestion,
    });
    expect(suggestBudget).toHaveBeenCalledWith({
      note: "buy groceries",
      budgets,
      apiKey: "test-key",
    });
  });

  it("wraps no_match and fallback as success envelope data", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    suggestBudget.mockResolvedValueOnce({
      status: "no_match",
      reason: "No provided budget clearly fits this note.",
    });

    const noMatchResponse = await POST(
      new Request("http://localhost/api/ai/suggest-budget", {
        method: "POST",
        body: JSON.stringify({ note: "misc", budgets }),
      })
    );

    expect(noMatchResponse.status).toBe(200);
    await expect(noMatchResponse.json()).resolves.toEqual({
      success: true,
      data: {
        status: "no_match",
        reason: "No provided budget clearly fits this note.",
      },
    });

    suggestBudget.mockResolvedValueOnce({
      status: "fallback",
      reason: "request_failed",
    });

    const fallbackResponse = await POST(
      new Request("http://localhost/api/ai/suggest-budget", {
        method: "POST",
        body: JSON.stringify({ note: "misc", budgets }),
      })
    );

    expect(fallbackResponse.status).toBe(200);
    await expect(fallbackResponse.json()).resolves.toEqual({
      success: true,
      data: {
        status: "fallback",
        reason: "request_failed",
      },
    });
  });

  it("returns 500 when OPENROUTER_API_KEY is missing", async () => {
    const response = await POST(
      new Request("http://localhost/api/ai/suggest-budget", {
        method: "POST",
        body: JSON.stringify({ note: "buy groceries", budgets }),
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: "SUGGEST_BUDGET_FAILED",
        message: "Missing OPENROUTER_API_KEY",
      },
    });
  });

  it("returns 500 for unexpected task failures", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    suggestBudget.mockRejectedValue(new Error("boom"));

    const response = await POST(
      new Request("http://localhost/api/ai/suggest-budget", {
        method: "POST",
        body: JSON.stringify({ note: "buy groceries", budgets }),
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: "SUGGEST_BUDGET_FAILED",
        message: "Failed to suggest budget",
      },
    });
  });
});
```

- [ ] **Step 2: Run the failing route tests**

Run:

```bash
rtk bun run test src/app/api/ai/suggest-budget/route.test.ts
```

Expected: fail because `src/app/api/ai/suggest-budget/route.ts` does not exist.

- [ ] **Step 3: Implement the route**

Create `src/app/api/ai/suggest-budget/route.ts`:

```ts
import { suggestBudget } from "@/lib/ai/suggest-budget";
import { suggestBudgetRequestSchema } from "@/lib/ai/suggest-budget-contract";
import { apiError, apiSuccess } from "@/lib/api/route-response";

const invalidPayloadResponse = () =>
  apiError("INVALID_PAYLOAD", "Invalid payload", 400);

export const POST = async (request: Request) => {
  try {
    let payload: unknown;

    try {
      payload = await request.json();
    } catch {
      return invalidPayloadResponse();
    }

    const parsed = suggestBudgetRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return invalidPayloadResponse();
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return apiError(
        "SUGGEST_BUDGET_FAILED",
        "Missing OPENROUTER_API_KEY",
        500
      );
    }

    const result = await suggestBudget({
      note: parsed.data.note,
      budgets: parsed.data.budgets,
      apiKey,
    });

    return apiSuccess(result);
  } catch (error) {
    console.error("Failed to suggest budget with OpenRouter:", error);
    return apiError(
      "SUGGEST_BUDGET_FAILED",
      "Failed to suggest budget",
      500
    );
  }
};
```

- [ ] **Step 4: Run the route tests**

Run:

```bash
rtk bun run test src/app/api/ai/suggest-budget/route.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit Task 3**

Run:

```bash
rtk git add src/app/api/ai/suggest-budget/route.ts src/app/api/ai/suggest-budget/route.test.ts
rtk git commit -m "feat: add suggest budget api route"
```

## Task 4: Client Mutation Hook

**Files:**

- Modify: `src/lib/mutations/index.test.tsx`
- Modify: `src/lib/mutations/index.ts`

- [ ] **Step 1: Add failing mutation tests**

In `src/lib/mutations/index.test.tsx`, add these imports if they are not already present:

```ts
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
```

Add this test block near the other mutation hook tests:

```ts
describe("useSuggestBudgetMutation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    return ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  it("posts to the suggest budget route and unwraps the API envelope", async () => {
    const responsePayload = {
      status: "success",
      budgetId: 1,
      confidence: "high",
      reason: "The note matches Groceries.",
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: responsePayload,
        }),
        { status: 200 }
      )
    );

    const { result } = renderHook(() => useSuggestBudgetMutation(), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.mutateAsync({
        note: "buy groceries",
        budgets: [
          {
            id: 1,
            name: "Groceries",
            amount: 3000000,
            spent: 1000000,
            remaining: 2000000,
            period: "month",
          },
        ],
      })
    ).resolves.toEqual(responsePayload);

    expect(fetch).toHaveBeenCalledWith("/api/ai/suggest-budget", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        note: "buy groceries",
        budgets: [
          {
            id: 1,
            name: "Groceries",
            amount: 3000000,
            spent: 1000000,
            remaining: 2000000,
            period: "month",
          },
        ],
      }),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("throws the API error message for route failures", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "SUGGEST_BUDGET_FAILED",
            message: "Failed to suggest budget",
          },
        }),
        { status: 500 }
      )
    );

    const { result } = renderHook(() => useSuggestBudgetMutation(), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.mutateAsync({
        note: "buy groceries",
        budgets: [],
      })
    ).rejects.toThrow("Failed to suggest budget");
  });
});
```

- [ ] **Step 2: Run the failing mutation tests**

Run:

```bash
rtk bun run test src/lib/mutations/index.test.tsx
```

Expected: fail because `useSuggestBudgetMutation` is not exported.

- [ ] **Step 3: Implement the mutation hook**

In `src/lib/mutations/index.ts`, add this type import:

```ts
import type {
  SuggestBudgetRequest,
  SuggestBudgetResponse,
} from "@/lib/ai/suggest-budget-contract";
```

Add this exported hook near the other server-backed mutation hooks:

```ts
export const useSuggestBudgetMutation = () =>
  useMutation({
    mutationFn: (input: SuggestBudgetRequest) =>
      fetchJsonMutation<SuggestBudgetResponse, SuggestBudgetRequest>(
        "/api/ai/suggest-budget",
        {
          method: "POST",
          body: input,
          fallbackError: "Failed to suggest budget",
        }
      ),
  });
```

- [ ] **Step 4: Run the mutation tests**

Run:

```bash
rtk bun run test src/lib/mutations/index.test.tsx
```

Expected: pass.

- [ ] **Step 5: Commit Task 4**

Run:

```bash
rtk git add src/lib/mutations/index.ts src/lib/mutations/index.test.tsx
rtk git commit -m "feat: add suggest budget mutation hook"
```

## Task 5: Manual Expense Form Blur Suggestion

**Files:**

- Modify: `src/components/ManualExpenseForm.quick-mode.test.tsx`
- Modify: `src/components/ManualExpenseForm.tsx`

- [ ] **Step 1: Add failing ManualExpenseForm tests**

In `src/components/ManualExpenseForm.quick-mode.test.tsx`, add this hoisted mutation mock after the `restoreReactGlobal` helper:

```ts
const mutationMocks = vi.hoisted(() => ({
  suggestBudgetMutateAsync: vi.fn(),
}));

vi.mock("@/lib/mutations", async () => {
  const actual = await vi.importActual<typeof import("@/lib/mutations")>(
    "@/lib/mutations"
  );
  return {
    ...actual,
    useSuggestBudgetMutation: () => ({
      mutateAsync: mutationMocks.suggestBudgetMutateAsync,
      isPending: false,
    }),
  };
});
```

Update the existing `afterEach`:

```ts
afterEach(() => {
  restoreReactGlobal();
  vi.restoreAllMocks();
  mutationMocks.suggestBudgetMutateAsync.mockReset();
});
```

Add this fixture near `createFetchResponse`:

```ts
const budgetSuggestionPayload = {
  budgets: [
    {
      id: 7,
      name: "Coffee",
      icon: "☕",
      color: "amber",
      amount: 500000,
      spent: 120000,
      remaining: 380000,
      period: "month",
      periodStartDate: "2026-05-01",
      periodEndDate: "2026-05-31",
    },
    {
      id: 8,
      name: "Transport",
      icon: "🚌",
      color: "blue",
      amount: 1000000,
      spent: 400000,
      remaining: 600000,
      period: "month",
      periodStartDate: "2026-05-01",
      periodEndDate: "2026-05-31",
    },
  ],
};
```

Add these tests:

```ts
it("suggests a budget when the note input blurs", async () => {
  const user = userEvent.setup();
  mutationMocks.suggestBudgetMutateAsync.mockResolvedValue({
    status: "success",
    budgetId: 7,
    confidence: "high",
    reason: "The note matches Coffee.",
  });

  await renderManualExpenseForm({
    showBudgetSelect: true,
    isSheetOpen: true,
    budgetPayload: budgetSuggestionPayload,
  });

  const noteInput = screen.getByPlaceholderText(
    "Optional note about this expense"
  );

  await userEvent.type(noteInput, "coffee with team");
  fireEvent.blur(noteInput);

  await waitFor(() =>
    expect(mutationMocks.suggestBudgetMutateAsync).toHaveBeenCalledWith({
      note: "coffee with team",
      budgets: expect.arrayContaining([
        expect.objectContaining({ id: 7, name: "Coffee" }),
      ]),
    })
  );
  await waitFor(() => expect(screen.getByText("Coffee")).toBeInTheDocument());
});

it("does not overwrite a manually selected budget on note blur", async () => {
  const user = userEvent.setup();
  mutationMocks.suggestBudgetMutateAsync.mockResolvedValue({
    status: "success",
    budgetId: 8,
    confidence: "high",
    reason: "The note matches Transport.",
  });

  await renderManualExpenseForm({
    showBudgetSelect: true,
    isSheetOpen: true,
    budgetPayload: budgetSuggestionPayload,
  });

  await userEvent.click(screen.getByRole("button", { name: /budget/i }));
  await user.click(await screen.findByText("Coffee"));

  const noteInput = screen.getByPlaceholderText(
    "Optional note about this expense"
  );

  await user.type(noteInput, "bus ride");
  fireEvent.blur(noteInput);

  await waitFor(() =>
    expect(mutationMocks.suggestBudgetMutateAsync).toHaveBeenCalled()
  );
  expect(screen.getByText("Coffee")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the failing ManualExpenseForm tests**

Run:

```bash
rtk bun run test src/components/ManualExpenseForm.quick-mode.test.tsx
```

Expected: fail because blur does not call `useSuggestBudgetMutation`.

- [ ] **Step 3: Implement ManualExpenseForm blur suggestion**

In `src/components/ManualExpenseForm.tsx`, import the hook:

```ts
import {
  useCreateExpenseMutation,
  useSuggestBudgetMutation,
} from "@/lib/mutations";
```

Add selection source state near the budget state:

```ts
const [budgetSelectionSource, setBudgetSelectionSource] = useState<
  "none" | "manual" | "ai"
>(initialExpense?.budgetId ? "manual" : "none");
const lastSuggestedNoteRef = useRef<string | null>(null);
const suggestionRequestRef = useRef(0);
const suggestBudgetMutation = useSuggestBudgetMutation();
```

When `initialExpense` resets budget fields, reset the source:

```ts
setBudgetSelectionSource(initialExpense?.budgetId ? "manual" : "none");
lastSuggestedNoteRef.current = null;
```

Update `handleBudgetChange`:

```ts
const handleBudgetChange = useCallback(
  (value: number | null) => {
    const selected = budgetOptions.find((budget) => budget.id === value);
    setBudgetId(value);
    setBudgetName(value === null ? null : (selected?.name ?? null));
    setBudgetIcon(value === null ? null : (selected?.icon ?? null));
    setBudgetColor(value === null ? null : (selected?.color ?? null));
    setBudgetSelectionSource(value === null ? "none" : "manual");
  },
  [budgetOptions]
);
```

Add helper functions before `return`:

```ts
const applySuggestedBudget = useCallback(
  (suggestedBudgetId: number) => {
    const selected = budgetOptions.find(
      (budget) => budget.id === suggestedBudgetId
    );
    if (!selected) {
      return;
    }

    setBudgetId(selected.id);
    setBudgetName(selected.name ?? null);
    setBudgetIcon(selected.icon ?? null);
    setBudgetColor(selected.color ?? null);
    setBudgetSelectionSource("ai");
  },
  [budgetOptions]
);

const handleNoteBlur = useCallback(() => {
  if (!showBudgetSelect || !budgetLoaded) {
    return;
  }
  if (budgetSelectionSource === "manual") {
    return;
  }

  const note = expense.note.trim();
  if (note.length < 3 || budgetOptions.length === 0) {
    return;
  }
  if (lastSuggestedNoteRef.current === note) {
    return;
  }

  lastSuggestedNoteRef.current = note;
  const requestId = suggestionRequestRef.current + 1;
  suggestionRequestRef.current = requestId;

  void suggestBudgetMutation
    .mutateAsync({
      note,
      budgets: budgetOptions.map((budget) => ({
        id: budget.id,
        name: budget.name,
        amount: budget.amount,
        spent: budget.spent,
        remaining: budget.remaining,
        period: budget.period,
        periodStartDate: budget.periodStartDate,
        periodEndDate: budget.periodEndDate,
      })),
    })
    .then((result) => {
      if (suggestionRequestRef.current !== requestId) {
        return;
      }
      if (result.status !== "success") {
        return;
      }
      if (result.confidence === "low") {
        return;
      }
      applySuggestedBudget(result.budgetId);
    })
    .catch((error) => {
      console.error("Failed to suggest budget:", error);
    });
}, [
  applySuggestedBudget,
  budgetLoaded,
  budgetOptions,
  budgetSelectionSource,
  expense.note,
  showBudgetSelect,
  suggestBudgetMutation,
]);
```

Attach the blur handler to the note `Textarea`:

```tsx
<Textarea
  ref={noteRef}
  value={expense.note}
  onChange={(e) => handleExpenseChange("note", e.target.value)}
  onBlur={handleNoteBlur}
  placeholder="Optional note about this expense"
  className="min-h-[80px] resize-none rounded-xl"
  onKeyDown={handleOnNoteKeyDown}
  tabIndex={0}
/>
```

- [ ] **Step 4: Run the ManualExpenseForm tests**

Run:

```bash
rtk bun run test src/components/ManualExpenseForm.quick-mode.test.tsx
```

Expected: pass.

- [ ] **Step 5: Commit Task 5**

Run:

```bash
rtk git add src/components/ManualExpenseForm.tsx src/components/ManualExpenseForm.quick-mode.test.tsx
rtk git commit -m "feat: suggest budget from manual expense note"
```

## Task 6: Quick Expense Sheet Blur Suggestion

**Files:**

- Modify: `src/components/QuickExpenseSheet.test.tsx`
- Modify: `src/components/QuickExpenseSheet.tsx`

- [ ] **Step 1: Add failing QuickExpenseSheet tests**

In `src/components/QuickExpenseSheet.test.tsx`, extend the existing `mutationMocks` object:

```ts
const mutationMocks = vi.hoisted(() => ({
  createMutateAsync: vi.fn(),
  updateMutateAsync: vi.fn(),
  suggestBudgetMutateAsync: vi.fn(),
}));
```

Update the existing `vi.mock("@/lib/mutations", ...)` block:

```ts
vi.mock("@/lib/mutations", () => ({
  useCreateExpenseMutation: () => ({
    mutateAsync: mutationMocks.createMutateAsync,
  }),
  useUpdateExpenseMutation: () => ({
    mutateAsync: mutationMocks.updateMutateAsync,
  }),
  useSuggestBudgetMutation: () => ({
    mutateAsync: mutationMocks.suggestBudgetMutateAsync,
    isPending: false,
  }),
}));
```

Update `beforeEach`:

```ts
beforeEach(() => {
  vi.clearAllMocks();
  toastMock.loading.mockReturnValue("loading-toast");
  mutationMocks.createMutateAsync.mockResolvedValue({
    clientId: "expense-client-1",
  });
  mutationMocks.updateMutateAsync.mockResolvedValue({
    clientId: "expense-client-1",
  });
  mutationMocks.suggestBudgetMutateAsync.mockResolvedValue({
    status: "no_match",
    reason: "No provided budget clearly fits this note.",
  });
  weeklyBudgetOptionsMock.mockResolvedValue([]);
});
```

Add these tests:

```ts
it("suggests a budget when the quick note input blurs", async () => {
  weeklyBudgetOptionsMock.mockResolvedValue([
    budgetOption({
      id: 7,
      name: "Coffee",
      icon: "☕",
      color: "amber",
      period: "month",
      periodStartDate: "2026-05-01",
      periodEndDate: "2026-05-31",
      amount: 500000,
      spent: 120000,
      remaining: 380000,
    }),
    budgetOption({
      id: 8,
      name: "Transport",
      icon: "🚌",
      color: "blue",
      period: "month",
      periodStartDate: "2026-05-01",
      periodEndDate: "2026-05-31",
      amount: 1000000,
      spent: 400000,
      remaining: 600000,
    }),
  ]);
  mutationMocks.suggestBudgetMutateAsync.mockResolvedValue({
    status: "success",
    budgetId: 7,
    confidence: "high",
    reason: "The note matches Coffee.",
  });

  render(<QuickExpenseSheet open onOpenChange={vi.fn()} />);

  const noteInput = screen.getByPlaceholderText("What did you spend on?");
  await userEvent.type(noteInput, "coffee with team");
  fireEvent.blur(noteInput);

  await waitFor(() =>
    expect(mutationMocks.suggestBudgetMutateAsync).toHaveBeenCalledWith({
      note: "coffee with team",
      budgets: expect.arrayContaining([
        expect.objectContaining({ id: 7, name: "Coffee" }),
      ]),
    })
  );
  await waitFor(() => expect(screen.getByText("Coffee")).toBeInTheDocument());
});

it("does not overwrite a manually selected quick budget on note blur", async () => {
  const user = userEvent.setup();
  weeklyBudgetOptionsMock.mockResolvedValue([
    budgetOption({
      id: 7,
      name: "Coffee",
      icon: "☕",
      color: "amber",
      period: "month",
      periodStartDate: "2026-05-01",
      periodEndDate: "2026-05-31",
      amount: 500000,
      spent: 120000,
      remaining: 380000,
    }),
    budgetOption({
      id: 8,
      name: "Transport",
      icon: "🚌",
      color: "blue",
      period: "month",
      periodStartDate: "2026-05-01",
      periodEndDate: "2026-05-31",
      amount: 1000000,
      spent: 400000,
      remaining: 600000,
    }),
  ]);
  mutationMocks.suggestBudgetMutateAsync.mockResolvedValue({
    status: "success",
    budgetId: 8,
    confidence: "high",
    reason: "The note matches Transport.",
  });

  render(<QuickExpenseSheet open onOpenChange={vi.fn()} />);

  await user.click(await screen.findByRole("button", { name: "No budget" }));
  await user.click(await screen.findByRole("button", { name: "Coffee" }));

  const noteInput = screen.getByPlaceholderText("What did you spend on?");
  await user.type(noteInput, "bus ride");
  fireEvent.blur(noteInput);

  await waitFor(() =>
    expect(mutationMocks.suggestBudgetMutateAsync).toHaveBeenCalled()
  );
  expect(screen.getByText("Coffee")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the failing QuickExpenseSheet tests**

Run:

```bash
rtk bun run test src/components/QuickExpenseSheet.test.tsx
```

Expected: fail because quick note blur does not call `useSuggestBudgetMutation`.

- [ ] **Step 3: Implement QuickExpenseSheet blur suggestion**

In `src/components/QuickExpenseSheet.tsx`, import the hook:

```ts
import {
  useCreateExpenseMutation,
  useSuggestBudgetMutation,
  useUpdateExpenseMutation,
} from "@/lib/mutations";
```

Add selection source state near `draft`:

```ts
const [budgetSelectionSource, setBudgetSelectionSource] = useState<
  "none" | "manual" | "ai"
>(() => (draft.budgetId ? "manual" : "none"));
const lastSuggestedNoteRef = useRef<string | null>(null);
const suggestionRequestRef = useRef(0);
const suggestBudgetMutation = useSuggestBudgetMutation();
```

When the sheet opens or resets a draft, reset the source:

```ts
setBudgetSelectionSource(nextDraft.budgetId ? "manual" : "none");
lastSuggestedNoteRef.current = null;
```

Use `nextDraft` in `handleOpenChange` so the state reset is explicit:

```ts
const nextDraft = buildDraftForOpen();
setDraft(nextDraft);
setBudgetSelectionSource(nextDraft.budgetId ? "manual" : "none");
lastSuggestedNoteRef.current = null;
```

Add helpers before `return`:

```ts
const applySuggestedBudget = (suggestedBudgetId: number) => {
  const selected = budgetOptionsQuery.data?.find(
    (budget) => budget.id === suggestedBudgetId
  );
  if (!selected) {
    return;
  }

  setDraft((prev) => ({
    ...prev,
    budgetId: selected.id,
    budgetName: selected.name,
    budgetIcon: selected.icon,
    budgetColor: selected.color,
  }));
  setBudgetSelectionSource("ai");
};

const handleNoteBlur = () => {
  if (!budgetOptionsQuery.isSuccess) {
    return;
  }
  if (budgetSelectionSource === "manual") {
    return;
  }

  const note = draft.note.trim();
  const budgetOptions = budgetOptionsQuery.data;
  if (note.length < 3 || budgetOptions.length === 0) {
    return;
  }
  if (lastSuggestedNoteRef.current === note) {
    return;
  }

  lastSuggestedNoteRef.current = note;
  const requestId = suggestionRequestRef.current + 1;
  suggestionRequestRef.current = requestId;

  void suggestBudgetMutation
    .mutateAsync({
      note,
      budgets: budgetOptions.map((budget) => ({
        id: budget.id,
        name: budget.name,
        amount: budget.amount,
        spent: budget.spent,
        remaining: budget.remaining,
        period: budget.period,
        periodStartDate: budget.periodStartDate,
        periodEndDate: budget.periodEndDate,
      })),
    })
    .then((result) => {
      if (suggestionRequestRef.current !== requestId) {
        return;
      }
      if (result.status !== "success") {
        return;
      }
      if (result.confidence === "low") {
        return;
      }
      applySuggestedBudget(result.budgetId);
    })
    .catch((error) => {
      console.error("Failed to suggest budget:", error);
    });
};
```

Update manual budget changes in `BudgetChipRow`:

```tsx
onChange={(id) => {
  const selected = budgetOptionsQuery.data?.find(
    (budget) => budget.id === id
  );
  setDraft((prev) => ({
    ...prev,
    budgetId: id,
    budgetName: id === null ? null : (selected?.name ?? null),
    budgetIcon: id === null ? null : (selected?.icon ?? null),
    budgetColor: id === null ? null : (selected?.color ?? null),
  }));
  setBudgetSelectionSource(id === null ? "none" : "manual");
}}
```

Attach the blur handler to the note input:

```tsx
<input
  ref={noteRef}
  value={draft.note}
  onChange={(e) => setField("note", e.target.value)}
  onBlur={handleNoteBlur}
  onKeyDown={(e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      amountRef.current?.focus({
        preventScroll: true,
      });
    }
  }}
  placeholder="What did you spend on?"
  className="placeholder:text-muted-foreground w-full overflow-hidden border-0 bg-transparent px-0 py-2 text-2xl whitespace-nowrap focus-visible:ring-0 focus-visible:outline-none"
/>
```

- [ ] **Step 4: Run the QuickExpenseSheet tests**

Run:

```bash
rtk bun run test src/components/QuickExpenseSheet.test.tsx
```

Expected: pass.

- [ ] **Step 5: Commit Task 6**

Run:

```bash
rtk git add src/components/QuickExpenseSheet.tsx src/components/QuickExpenseSheet.test.tsx
rtk git commit -m "feat: suggest budget from quick expense note"
```

## Task 7: Final Formatting, Linting, and Targeted Tests

**Files:**

- Check all files modified in Tasks 1-6.

- [ ] **Step 1: Run Prettier write for modified TS and TSX files**

Run:

```bash
rtk bunx prettier --write src/lib/ai/core/openrouter.ts src/lib/ai/core/openrouter.test.ts src/lib/ai/suggest-budget-contract.ts src/lib/ai/suggest-budget.ts src/lib/ai/suggest-budget.test.ts src/app/api/ai/suggest-budget/route.ts src/app/api/ai/suggest-budget/route.test.ts src/lib/mutations/index.ts src/lib/mutations/index.test.tsx src/components/ManualExpenseForm.tsx src/components/ManualExpenseForm.quick-mode.test.tsx src/components/QuickExpenseSheet.tsx src/components/QuickExpenseSheet.test.tsx
```

Expected: Prettier formats the listed files.

- [ ] **Step 2: Run Prettier check for modified TS and TSX files**

Run:

```bash
rtk bunx prettier --check src/lib/ai/core/openrouter.ts src/lib/ai/core/openrouter.test.ts src/lib/ai/suggest-budget-contract.ts src/lib/ai/suggest-budget.ts src/lib/ai/suggest-budget.test.ts src/app/api/ai/suggest-budget/route.ts src/app/api/ai/suggest-budget/route.test.ts src/lib/mutations/index.ts src/lib/mutations/index.test.tsx src/components/ManualExpenseForm.tsx src/components/ManualExpenseForm.quick-mode.test.tsx src/components/QuickExpenseSheet.tsx src/components/QuickExpenseSheet.test.tsx
```

Expected: pass.

- [ ] **Step 3: Run ESLint for modified TS and TSX files**

Run:

```bash
rtk bunx eslint src/lib/ai/core/openrouter.ts src/lib/ai/core/openrouter.test.ts src/lib/ai/suggest-budget-contract.ts src/lib/ai/suggest-budget.ts src/lib/ai/suggest-budget.test.ts src/app/api/ai/suggest-budget/route.ts src/app/api/ai/suggest-budget/route.test.ts src/lib/mutations/index.ts src/lib/mutations/index.test.tsx src/components/ManualExpenseForm.tsx src/components/ManualExpenseForm.quick-mode.test.tsx src/components/QuickExpenseSheet.tsx src/components/QuickExpenseSheet.test.tsx
```

Expected: pass.

- [ ] **Step 4: Run all targeted tests**

Run:

```bash
rtk bun run test src/lib/ai/core/openrouter.test.ts src/lib/ai/suggest-budget.test.ts src/app/api/ai/suggest-budget/route.test.ts src/lib/mutations/index.test.tsx src/components/ManualExpenseForm.quick-mode.test.tsx src/components/QuickExpenseSheet.test.tsx
```

Expected: pass.

- [ ] **Step 5: Inspect final diff**

Run:

```bash
rtk git diff --stat
rtk git diff -- src/lib/ai/core/openrouter.ts src/lib/ai/suggest-budget.ts src/app/api/ai/suggest-budget/route.ts src/lib/mutations/index.ts src/components/ManualExpenseForm.tsx src/components/QuickExpenseSheet.tsx
```

Expected: diff is limited to the planned files and contains no unrelated edits.

- [ ] **Step 6: Commit final verification fixes if any were needed**

If formatting or linting changed files after Task 6, run:

```bash
rtk git add src/lib/ai/core/openrouter.ts src/lib/ai/core/openrouter.test.ts src/lib/ai/suggest-budget-contract.ts src/lib/ai/suggest-budget.ts src/lib/ai/suggest-budget.test.ts src/app/api/ai/suggest-budget/route.ts src/app/api/ai/suggest-budget/route.test.ts src/lib/mutations/index.ts src/lib/mutations/index.test.tsx src/components/ManualExpenseForm.tsx src/components/ManualExpenseForm.quick-mode.test.tsx src/components/QuickExpenseSheet.tsx src/components/QuickExpenseSheet.test.tsx
rtk git commit -m "chore: verify ai budget suggestion"
```

Expected: a commit is created only if Step 1 changed files after the previous task commits.

## Self-Review Notes

Spec coverage:

- Reusable AI core is covered by Task 1.
- Budget-specific classifier and validation are covered by Task 2.
- API envelope route is covered by Task 3.
- Client mutation helper is covered by Task 4.
- Manual form blur behavior is covered by Task 5.
- Quick sheet blur behavior is covered by Task 6.
- Required formatting, linting, and targeted tests are covered by Task 7.

Placeholder scan:

- No task contains open implementation placeholders.
- Tests name exact files and expected behavior.
- Commands use `rtk` as required by project instructions.

Type consistency:

- `SuggestBudgetRequest`, `SuggestBudgetResponse`, `SuggestBudgetCandidate`, and `useSuggestBudgetMutation` are introduced before later tasks consume them.
- Domain response statuses match the approved design: `success`, `no_match`, and `fallback`.
- HTTP responses use the existing `ApiResponse<T>` envelope through `apiSuccess` and `apiError`.
