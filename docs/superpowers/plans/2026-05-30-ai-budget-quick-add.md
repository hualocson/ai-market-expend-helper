# AI Budget Quick Add Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the `/ai` quick-add flow so a single `parse-expense` call receives the user's budgets `{id, name, category}`, returns a `budgetId`, and the chat either auto-adds high-confidence expenses or opens `QuickExpenseDrawer` for review — deriving the expense category from the chosen budget.

**Architecture:** One merged AI call (`POST /api/ai/parse-expense`) takes `{ input, budgets }` and returns `{ amount, date, note, budgetId, confidence, reason }` (no category). `AIExpenseChat` loads today's active budgets, calls the API, and on a high-confidence + resolved + in-period result writes the expense via the existing `useCreateExpenseMutation`; otherwise it dispatches an extended prefill event that opens a trigger-less `QuickExpenseDrawer` mounted in the chat. The drawer derives category from the budget once options load. `suggest-budget` and `ManualExpenseForm` are left untouched; `AIInput.tsx` is deleted.

**Tech Stack:** Next.js 15 App Router, React 19, TanStack Query, Zod, Zustand, dayjs (`@/configs/date`), Vitest.

**Spec:** `docs/superpowers/specs/2026-05-29-ai-budget-quick-add-design.md`

---

## Pre-flight

- [ ] **Create the work branch** (branches must start with `dev-`, per `CLAUDE.md`):

```bash
git checkout main && git pull
git checkout -b dev-ai-budget-quick-add
```

After every `.ts`/`.tsx` edit, run the file-scoped format + lint (per `CLAUDE.md`):

```bash
rtk bunx prettier --write <files> && rtk bunx prettier --check <files> && rtk bunx eslint <files>
```

Targeted tests run with: `bunx vitest run <path>`. Do **not** run `npm run build` per change; run it once at the end.

---

## File Structure

**Modify:**
- `src/lib/ai/parse-expense-contract.ts` — new request/response types + Zod request schema (budgets with `category`, drop response `category`, add `budgetId`/`confidence`/`reason`).
- `src/lib/ai/parse-expense.ts` — prompt + budget-aware parsing, `budgetId` validation, VND≥1000, Vietnamese note, drop category.
- `src/app/api/ai/parse-expense/route.ts` — Zod request validation, pass `budgets` to the parser.
- `src/lib/expense-prefill.ts` — extend `ExpensePrefillPayload` (add `date`/budget fields, drop `category`).
- `src/lib/budget-options.ts` — add `isDateWithinBudgetPeriod` helper.
- `src/components/QuickExpenseDrawer.tsx` — prefill handler applies date+budget fields and sets source; budget-sync effect derives category for AI selections.
- `src/components/AIExpenseChat.tsx` — full rewrite: load budgets, call API, auto-add or prefill, mount review drawer; stop using `ManualExpenseForm`.

**Tests (modify/create):**
- `src/lib/ai/parse-expense-contract.test.ts` (create)
- `src/lib/ai/parse-expense.test.ts` (rewrite)
- `src/app/api/ai/parse-expense/route.test.ts` (modify)
- `src/lib/budget-options.test.ts` (create or extend)
- `src/components/QuickExpenseDrawer.test.tsx` (add prefill cases)
- `src/components/AIExpenseChat.test.tsx` (rewrite)

**Delete:**
- `src/components/AIInput.tsx`, `src/components/AIInput.test.tsx`, and `src/components/AIExpensePreviewCard.tsx` if orphaned.

---

## Task 1: Parse-expense contract (types + Zod request schema)

**Files:**
- Modify: `src/lib/ai/parse-expense-contract.ts`
- Test: `src/lib/ai/parse-expense-contract.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/lib/ai/parse-expense-contract.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { Category } from "@/enums";

import {
  PARSE_EXPENSE_MAX_BUDGETS,
  PARSE_EXPENSE_MIN_AMOUNT,
  parseExpenseRequestSchema,
} from "./parse-expense-contract";

describe("parseExpenseRequestSchema", () => {
  it("accepts input with budgets carrying a mapped category", () => {
    const result = parseExpenseRequestSchema.safeParse({
      input: "cf sua da 35k",
      budgets: [{ id: 2, name: "Cà phê", category: Category.FOOD }],
    });

    expect(result.success).toBe(true);
  });

  it("defaults budgets to an empty array when omitted", () => {
    const result = parseExpenseRequestSchema.safeParse({ input: "lunch 50k" });

    expect(result.success).toBe(true);
    expect(result.success && result.data.budgets).toEqual([]);
  });

  it("rejects empty input", () => {
    expect(
      parseExpenseRequestSchema.safeParse({ input: "   ", budgets: [] }).success
    ).toBe(false);
  });

  it("rejects a budget category outside the Category enum", () => {
    expect(
      parseExpenseRequestSchema.safeParse({
        input: "lunch 50k",
        budgets: [{ id: 1, name: "Food", category: "Travel" }],
      }).success
    ).toBe(false);
  });

  it("rejects oversized budget lists", () => {
    const budgets = Array.from(
      { length: PARSE_EXPENSE_MAX_BUDGETS + 1 },
      (_unused, index) => ({
        id: index + 1,
        name: `Budget ${index + 1}`,
        category: Category.OTHER,
      })
    );

    expect(
      parseExpenseRequestSchema.safeParse({ input: "lunch 50k", budgets })
        .success
    ).toBe(false);
  });

  it("exposes a 1000 VND minimum constant", () => {
    expect(PARSE_EXPENSE_MIN_AMOUNT).toBe(1000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/lib/ai/parse-expense-contract.test.ts`
Expected: FAIL — `parseExpenseRequestSchema` / constants not exported.

- [ ] **Step 3: Replace the contract file**

Replace the entire contents of `src/lib/ai/parse-expense-contract.ts`:

```ts
import { Category } from "@/enums";
import { z } from "zod";

export const PARSE_EXPENSE_INPUT_MAX_LENGTH = 500;
export const PARSE_EXPENSE_MAX_BUDGETS = 100;
export const PARSE_EXPENSE_BUDGET_NAME_MAX_LENGTH = 120;
export const PARSE_EXPENSE_MIN_AMOUNT = 1000;

export const parseExpenseBudgetSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1).max(PARSE_EXPENSE_BUDGET_NAME_MAX_LENGTH),
  category: z.nativeEnum(Category),
});

export const parseExpenseRequestSchema = z.object({
  input: z.string().trim().min(1).max(PARSE_EXPENSE_INPUT_MAX_LENGTH),
  budgets: z
    .array(parseExpenseBudgetSchema)
    .max(PARSE_EXPENSE_MAX_BUDGETS)
    .default([]),
});

export type ParseExpenseBudget = z.infer<typeof parseExpenseBudgetSchema>;
export type ParseExpenseRequest = z.infer<typeof parseExpenseRequestSchema>;

export type ParseExpenseConfidence = "high" | "medium" | "low";

export type ParseExpenseSuccessResponse = {
  status: "success";
  originalInput: string;
  expense: {
    date: string;
    amount: number;
    note: string;
    budgetId: number | null;
    confidence: ParseExpenseConfidence;
    reason: string;
  };
};

export type ParseExpenseFallbackResponse = {
  status: "fallback";
  originalInput: string;
  prefill: {
    note?: string;
    amount?: number;
    date?: string;
    budgetId?: number | null;
  };
  reason:
    | "invalid_json"
    | "schema_mismatch"
    | "empty_response"
    | "request_failed"
    | "no_budget_match";
};

export type ParseExpenseResponse =
  | ParseExpenseSuccessResponse
  | ParseExpenseFallbackResponse;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/lib/ai/parse-expense-contract.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Format, lint, commit**

```bash
rtk bunx prettier --write src/lib/ai/parse-expense-contract.ts src/lib/ai/parse-expense-contract.test.ts
rtk bunx eslint src/lib/ai/parse-expense-contract.ts src/lib/ai/parse-expense-contract.test.ts
git add src/lib/ai/parse-expense-contract.ts src/lib/ai/parse-expense-contract.test.ts
git commit -m "feat(ai): add budget-aware parse-expense contract"
```

---

## Task 2: Parser — budget matching, VND≥1000, Vietnamese note

**Files:**
- Modify: `src/lib/ai/parse-expense.ts`
- Test: `src/lib/ai/parse-expense.test.ts` (rewrite)

- [ ] **Step 1: Rewrite the failing test**

Replace the entire contents of `src/lib/ai/parse-expense.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

import { Category } from "@/enums";

import { parseExpenseWithOpenRouter } from "./parse-expense";

const createOpenRouterResponse = (content: unknown, ok = true) =>
  ({
    ok,
    json: vi.fn().mockResolvedValue({
      choices: [{ message: { content } }],
    }),
  }) as unknown as Response;

const budgets = [
  { id: 1, name: "Ăn uống", category: Category.FOOD },
  { id: 2, name: "Cà phê", category: Category.FOOD },
  { id: 3, name: "Xăng xe", category: Category.TRANSPORT },
];

describe("parseExpenseWithOpenRouter", () => {
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
        apiKey: "test-key",
        fetchFn,
      })
    ).resolves.toMatchObject({ status: "fallback", reason: "empty_response" });
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
      apiKey: "test-key",
      fetchFn,
    });

    const body = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    const userMessage = body.messages[1].content as string;
    expect(userMessage).toContain("Cà phê");
    expect(userMessage).toContain(Category.FOOD);
    expect(userMessage).toContain("id 2");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/lib/ai/parse-expense.test.ts`
Expected: FAIL — parser still returns `category` and ignores `budgets`.

- [ ] **Step 3: Rewrite the parser**

Replace the entire contents of `src/lib/ai/parse-expense.ts`:

```ts
import type {
  ParseExpenseBudget,
  ParseExpenseFallbackResponse,
  ParseExpenseResponse,
} from "./parse-expense-contract";
import { PARSE_EXPENSE_MIN_AMOUNT } from "./parse-expense-contract";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "openai/gpt-oss-20b:free";
const DATE_PATTERN = /^\d{2}\/\d{2}\/\d{4}$/;

type FallbackReason = ParseExpenseFallbackResponse["reason"];

const SYSTEM_PROMPT = `
You extract a single expense draft from short natural-language text and pick the best-matching budget.

Rules:
- Return only one JSON object.
- Output fields: date, amount, note, budgetId, confidence, reason.
- date must be DD/MM/YYYY.
- amount is Vietnamese dong (VND): a whole number, minimum 1000. Expand shorthand: "35k" = 35000, "1.2tr" = 1200000.
- note must be a short, natural Vietnamese phrase. Normalize shorthand, e.g. "cf sua da" -> "Cà phê sữa đá".
- budgetId must be exactly one of the provided budget ids, or null when none plausibly matches. Never invent an id.
- Match using the budget name first and its category as secondary context. Match Vietnamese with or without diacritics, and common shorthand (cf = coffee, xang = fuel, grab = transport or food).
- confidence is "high" only when amount, date, note, and a non-null budgetId are all confidently determined; otherwise "medium" or "low".
- reason is a short explanation of the budget match.
`.trim();

const buildUserContent = (input: string, budgets: ParseExpenseBudget[]) => {
  const budgetLines = budgets.length
    ? budgets
        .map(
          (budget) =>
            `- id ${budget.id}: ${budget.name} (category: ${budget.category})`
        )
        .join("\n")
    : "(no budgets available)";

  return `Text: ${input}\n\nBudgets:\n${budgetLines}`;
};

const extractJsonObject = (value: string) => {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    return null;
  }
  return value.slice(start, end + 1);
};

const readContent = (content: unknown) =>
  typeof content === "string" ? content.trim() : null;

const shapeFallbackNote = (originalInput: string) => {
  const note = originalInput.trim();
  return note.length > 0 ? note : undefined;
};

const extractAmountFromInput = (input: string) => {
  const match = input.match(/(\d+(?:\.\d+)?)(k|tr)?/i);
  if (!match) {
    return undefined;
  }
  const numeric = Number(match[1]);
  if (!Number.isFinite(numeric)) {
    return undefined;
  }
  const suffix = match[2]?.toLowerCase();
  if (suffix === "k") {
    return numeric * 1000;
  }
  if (suffix === "tr") {
    return numeric * 1000000;
  }
  return numeric;
};

const buildFallback = (
  originalInput: string,
  reason: FallbackReason
): ParseExpenseResponse => ({
  status: "fallback",
  originalInput,
  reason,
  prefill: {
    note: shapeFallbackNote(originalInput),
    amount: extractAmountFromInput(originalInput),
  },
});

type ParseExpenseArgs = {
  input: string;
  budgets: ParseExpenseBudget[];
  apiKey: string;
  fetchFn?: typeof fetch;
};

const isConfidence = (value: unknown): value is "high" | "medium" | "low" =>
  value === "high" || value === "medium" || value === "low";

export const parseExpenseWithOpenRouter = async ({
  input,
  budgets,
  apiKey,
  fetchFn = fetch,
}: ParseExpenseArgs): Promise<ParseExpenseResponse> => {
  let response: Response;

  try {
    response = await fetchFn(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserContent(input, budgets) },
        ],
      }),
    });
  } catch {
    return buildFallback(input, "request_failed");
  }

  if (!response.ok) {
    return buildFallback(input, "request_failed");
  }

  let payload: { choices?: Array<{ message?: { content?: unknown } }> };
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    return buildFallback(input, "request_failed");
  }

  const content = readContent(payload.choices?.[0]?.message?.content);
  if (!content) {
    return buildFallback(input, "empty_response");
  }

  const jsonBlock = extractJsonObject(content);
  if (!jsonBlock) {
    return buildFallback(input, "invalid_json");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonBlock);
  } catch {
    return buildFallback(input, "invalid_json");
  }

  const expense = parsed as {
    date?: unknown;
    amount?: unknown;
    note?: unknown;
    budgetId?: unknown;
    confidence?: unknown;
    reason?: unknown;
  };

  const amount = Number(expense.amount);
  const note = String(expense.note ?? "").trim();
  const date = String(expense.date ?? "").trim();
  const reason = String(expense.reason ?? "").trim();
  const confidence = expense.confidence;

  const allowedIds = new Set(budgets.map((budget) => budget.id));
  let budgetId: number | null;
  const rawBudgetId = expense.budgetId;
  if (rawBudgetId === null || rawBudgetId === undefined) {
    budgetId = null;
  } else {
    const numericId = Number(rawBudgetId);
    if (!Number.isInteger(numericId) || !allowedIds.has(numericId)) {
      return buildFallback(input, "schema_mismatch");
    }
    budgetId = numericId;
  }

  if (
    !DATE_PATTERN.test(date) ||
    !Number.isFinite(amount) ||
    !Number.isInteger(amount) ||
    amount < PARSE_EXPENSE_MIN_AMOUNT ||
    note.length === 0 ||
    !isConfidence(confidence)
  ) {
    return buildFallback(input, "schema_mismatch");
  }

  return {
    status: "success",
    originalInput: input,
    expense: {
      date,
      amount,
      note,
      budgetId,
      confidence,
      reason: reason.length > 0 ? reason : "Matched from input.",
    },
  };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/lib/ai/parse-expense.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Format, lint, commit**

```bash
rtk bunx prettier --write src/lib/ai/parse-expense.ts src/lib/ai/parse-expense.test.ts
rtk bunx eslint src/lib/ai/parse-expense.ts src/lib/ai/parse-expense.test.ts
git add src/lib/ai/parse-expense.ts src/lib/ai/parse-expense.test.ts
git commit -m "feat(ai): pick budget id in parse-expense with VND and Vietnamese rules"
```

---

## Task 3: API route — Zod request validation, pass budgets

**Files:**
- Modify: `src/app/api/ai/parse-expense/route.ts`
- Test: `src/app/api/ai/parse-expense/route.test.ts`

- [ ] **Step 1: Update the failing tests**

In `src/app/api/ai/parse-expense/route.test.ts`, replace the "returns parser success payload for valid input" test body and add a budgets-validation test. Replace the success test's expected `expense` and the `toHaveBeenCalledWith` assertion:

```ts
  it("returns parser success payload and forwards budgets", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    const expectedParseResult = {
      status: "success",
      originalInput: "cf 35k",
      expense: {
        date: "29/05/2026",
        amount: 35000,
        note: "Cà phê",
        budgetId: 2,
        confidence: "high",
        reason: "Matched coffee.",
      },
    };
    parseExpenseWithOpenRouter.mockResolvedValue(expectedParseResult);

    const response = await POST(
      new Request("http://localhost/api/ai/parse-expense", {
        method: "POST",
        body: JSON.stringify({
          input: "cf 35k",
          budgets: [{ id: 2, name: "Cà phê", category: "Food" }],
        }),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: expectedParseResult,
    });
    expect(parseExpenseWithOpenRouter).toHaveBeenCalledWith({
      input: "cf 35k",
      budgets: [{ id: 2, name: "Cà phê", category: "Food" }],
      apiKey: "test-key",
    });
  });

  it("returns 400 when a budget category is invalid", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";

    const response = await POST(
      new Request("http://localhost/api/ai/parse-expense", {
        method: "POST",
        body: JSON.stringify({
          input: "cf 35k",
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
```

> Note: the existing `{ input: "Lunch 120k today" }` success-free tests for missing/invalid input and missing API key still pass because `budgets` defaults to `[]`.

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/app/api/ai/parse-expense/route.test.ts`
Expected: FAIL — route doesn't forward `budgets` and doesn't validate categories.

- [ ] **Step 3: Update the route**

Replace the entire contents of `src/app/api/ai/parse-expense/route.ts`:

```ts
import { parseExpenseWithOpenRouter } from "@/lib/ai/parse-expense";
import { parseExpenseRequestSchema } from "@/lib/ai/parse-expense-contract";
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

    const parsedRequest = parseExpenseRequestSchema.safeParse(payload);
    if (!parsedRequest.success) {
      return invalidPayloadResponse();
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return apiError("PARSE_EXPENSE_FAILED", "Missing OPENROUTER_API_KEY", 500);
    }

    const result = await parseExpenseWithOpenRouter({
      input: parsedRequest.data.input,
      budgets: parsedRequest.data.budgets,
      apiKey,
    });

    return apiSuccess(result);
  } catch (error) {
    console.error("Failed to parse expense with OpenRouter:", error);
    return apiError("PARSE_EXPENSE_FAILED", "Failed to parse expense", 500);
  }
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/app/api/ai/parse-expense/route.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Format, lint, commit**

```bash
rtk bunx prettier --write src/app/api/ai/parse-expense/route.ts src/app/api/ai/parse-expense/route.test.ts
rtk bunx eslint src/app/api/ai/parse-expense/route.ts src/app/api/ai/parse-expense/route.test.ts
git add src/app/api/ai/parse-expense/route.ts src/app/api/ai/parse-expense/route.test.ts
git commit -m "feat(ai): validate parse-expense request with budgets via zod"
```

---

## Task 4: Date-in-period helper

**Files:**
- Modify: `src/lib/budget-options.ts`
- Test: `src/lib/budget-options.test.ts` (create if absent; otherwise append the `describe` block)

- [ ] **Step 1: Write the failing test**

Create/extend `src/lib/budget-options.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { Category } from "@/enums";

import { isDateWithinBudgetPeriod, type TBudgetOption } from "./budget-options";

const baseBudget: TBudgetOption = {
  id: 1,
  name: "Cà phê",
  icon: "☕",
  color: "blue",
  period: "week",
  periodStartDate: "2026-05-25",
  periodEndDate: "2026-05-31",
  amount: 100000,
  spent: 0,
  remaining: 100000,
  category: Category.FOOD,
};

describe("isDateWithinBudgetPeriod", () => {
  it("returns true when the date is inside the period", () => {
    expect(isDateWithinBudgetPeriod(baseBudget, "2026-05-29")).toBe(true);
  });

  it("returns false when the date is before the period", () => {
    expect(isDateWithinBudgetPeriod(baseBudget, "2026-05-20")).toBe(false);
  });

  it("returns false when the date is after the period", () => {
    expect(isDateWithinBudgetPeriod(baseBudget, "2026-06-02")).toBe(false);
  });

  it("returns false for an unparseable date", () => {
    expect(isDateWithinBudgetPeriod(baseBudget, "not-a-date")).toBe(false);
  });

  it("treats a missing start date as always covering", () => {
    expect(
      isDateWithinBudgetPeriod(
        { ...baseBudget, periodStartDate: null, periodEndDate: null },
        "2026-01-01"
      )
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/lib/budget-options.test.ts`
Expected: FAIL — `isDateWithinBudgetPeriod` is not exported.

- [ ] **Step 3: Add the helper**

Append to `src/lib/budget-options.ts` (it already imports `dayjs` and exports `parseBudgetDate`):

```ts
export const isDateWithinBudgetPeriod = (
  budget: TBudgetOption,
  isoDate: string
): boolean => {
  const target = dayjs(isoDate, "YYYY-MM-DD", true);
  if (!target.isValid()) {
    return false;
  }
  const start = parseBudgetDate(budget.periodStartDate);
  if (!start) {
    return true;
  }
  const end = parseBudgetDate(budget.periodEndDate) ?? start;
  return !target.isBefore(start, "day") && !target.isAfter(end, "day");
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/lib/budget-options.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Format, lint, commit**

```bash
rtk bunx prettier --write src/lib/budget-options.ts src/lib/budget-options.test.ts
rtk bunx eslint src/lib/budget-options.ts src/lib/budget-options.test.ts
git add src/lib/budget-options.ts src/lib/budget-options.test.ts
git commit -m "feat(budgets): add isDateWithinBudgetPeriod helper"
```

---

## Task 5: Extend the prefill payload

**Files:**
- Modify: `src/lib/expense-prefill.ts`

This is a type + dispatcher change consumed by Tasks 6 and 7; no standalone test (covered by the drawer and chat tests).

- [ ] **Step 1: Replace the payload type**

Replace the entire contents of `src/lib/expense-prefill.ts`:

```ts
import type { BudgetColorId } from "@/lib/budget-appearance";
import type { QuickAddSource } from "@/lib/quick-add-mode";

export const EXPENSE_PREFILL_EVENT = "expense-prefill";

export type ExpensePrefillPayload = {
  amount: number;
  note: string;
  date?: string;
  budgetId?: number | null;
  budgetName?: string | null;
  budgetIcon?: string | null;
  budgetColor?: BudgetColorId | null;
  source?: QuickAddSource;
};

export const dispatchExpensePrefill = (payload: ExpensePrefillPayload) => {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<ExpensePrefillPayload>(EXPENSE_PREFILL_EVENT, {
      detail: payload,
    })
  );
};
```

- [ ] **Step 2: Find other consumers of the removed `category` field**

Run: `rg -n "dispatchExpensePrefill|ExpensePrefillPayload|\.category" src/components/QuickExpenseDrawer.tsx`
Also: `rg -ln "dispatchExpensePrefill" src -g '!*.test.*'`
Expected: only `QuickExpenseDrawer.tsx` reads the payload; dispatchers are updated in Task 7. Note any other dispatcher for follow-up (there should be none after `AIInput.tsx` is removed).

- [ ] **Step 3: Type-check the touched scope**

Run: `bunx tsc --noEmit -p tsconfig.json 2>&1 | rg "expense-prefill|QuickExpenseDrawer|AIExpenseChat|AIInput" || echo "no related type errors yet"`
Expected: errors in `QuickExpenseDrawer.tsx` (uses `detail.category`) and `AIInput.tsx`/`AIExpenseChat.tsx` — these are fixed in Tasks 6, 7, and 9.

- [ ] **Step 4: Format, lint, commit**

```bash
rtk bunx prettier --write src/lib/expense-prefill.ts
rtk bunx eslint src/lib/expense-prefill.ts
git add src/lib/expense-prefill.ts
git commit -m "feat(expenses): extend prefill payload with date and budget fields"
```

---

## Task 6: QuickExpenseDrawer — apply budget prefill, derive category

**Files:**
- Modify: `src/components/QuickExpenseDrawer.tsx`
- Test: `src/components/QuickExpenseDrawer.test.tsx` (add prefill cases)

- [ ] **Step 1: Add the failing tests**

Append a `describe` block to `src/components/QuickExpenseDrawer.test.tsx`. Match the existing harness in that file (it already renders the drawer with a `QueryClientProvider`); reuse its render helper. The two behaviors:

```ts
import { EXPENSE_PREFILL_EVENT } from "@/lib/expense-prefill";

// Inside the existing describe for QuickExpenseDrawer, using the file's render helper:

it("applies an AI budget prefill and shows the budget without re-suggesting", async () => {
  // Arrange: seed budget options so id 2 resolves (use the file's queryClient seed helper).
  // seedBudgetOptions(queryClient, weekStart, today, [
  //   { id: 2, name: "Cà phê", icon: "☕", color: "blue", category: Category.FOOD, period: "week",
  //     periodStartDate: <weekStart>, periodEndDate: <weekEnd>, amount: 100000, spent: 0, remaining: 100000 },
  // ]);
  renderDrawer(); // file's helper that mounts an uncontrolled <QuickExpenseDrawer />

  await act(async () => {
    window.dispatchEvent(
      new CustomEvent(EXPENSE_PREFILL_EVENT, {
        detail: {
          amount: 35000,
          note: "Cà phê sữa đá",
          date: <todayDDMMYYYY>,
          budgetId: 2,
          budgetName: "Cà phê",
          budgetIcon: "☕",
          budgetColor: "blue",
          source: "ai",
        },
      })
    );
  });

  expect(await screen.findByDisplayValue("35.000")).toBeInTheDocument();
  expect(screen.getByText("Cà phê sữa đá")).toBeInTheDocument();
  // suggest-budget mutation must NOT have been triggered on note blur for a prefilled budget.
  expect(suggestBudgetMutateAsync).not.toHaveBeenCalled();
});

it("opens for review and allows the drawer to suggest when budgetId is null", async () => {
  renderDrawer();

  await act(async () => {
    window.dispatchEvent(
      new CustomEvent(EXPENSE_PREFILL_EVENT, {
        detail: { amount: 50000, note: "Mua sách", budgetId: null, source: "ai" },
      })
    );
  });

  expect(await screen.findByDisplayValue("50.000")).toBeInTheDocument();
  // budget selection source is "none" -> note blur is allowed to call suggest-budget
});
```

> Implementation detail: mirror the existing test file's mocking of `useSuggestBudgetMutation` (it is already mocked there as `suggestBudgetMutateAsync`). Use the file's existing `seed`/`render` helpers rather than inventing new ones; the pseudo-helpers above name the behavior to assert.

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/components/QuickExpenseDrawer.test.tsx`
Expected: FAIL — the prefill handler ignores `date`/budget fields and still references `detail.category`.

- [ ] **Step 3: Update the prefill handler**

In `src/components/QuickExpenseDrawer.tsx`, replace the prefill `useEffect` (currently around lines 617–645) with:

```tsx
  useEffect(() => {
    if (isEditMode) {
      return;
    }
    const handle = (event: Event) => {
      const detail = (event as CustomEvent<ExpensePrefillPayload>).detail;
      if (!detail) {
        return;
      }
      const hasBudget =
        detail.budgetId !== null && detail.budgetId !== undefined;
      setDraft((prev) => {
        const nextDraft: TExpenseDraft = {
          ...prev,
          amount: detail.amount,
          note: detail.note,
          date: detail.date ? formatDraftDate(detail.date) : prev.date,
          budgetId: hasBudget ? (detail.budgetId ?? null) : null,
          budgetName: hasBudget ? (detail.budgetName ?? null) : null,
          budgetIcon: hasBudget ? (detail.budgetIcon ?? null) : null,
          budgetColor: hasBudget ? (detail.budgetColor ?? null) : null,
        };
        resetSuggestionTracking(nextDraft, hasBudget ? "ai" : "none");
        return nextDraft;
      });
      if (typeof open !== "boolean") {
        setInternalOpen(true);
      }
      onOpenChange?.(true);
    };
    window.addEventListener(EXPENSE_PREFILL_EVENT, handle);
    return () => window.removeEventListener(EXPENSE_PREFILL_EVENT, handle);
  }, [isEditMode, onOpenChange, open]);
```

- [ ] **Step 4: Derive category + refresh display once options load**

Replace the stale-budget-clearing `useEffect` (currently around lines 647–663) with a version that also reconciles an AI-prefilled budget against loaded options:

```tsx
  useEffect(() => {
    if (draft.budgetId === null || !budgetOptionsQuery.isSuccess) {
      return;
    }
    const option = budgetOptions.find((budget) => budget.id === draft.budgetId);
    if (!option) {
      setDraft((prev) => ({
        ...prev,
        budgetId: null,
        budgetName: null,
        budgetIcon: null,
        budgetColor: null,
      }));
      if (budgetSelectionSourceRef.current === "ai") {
        budgetSelectionSourceRef.current = "none";
      }
      return;
    }
    if (budgetSelectionSourceRef.current === "ai") {
      setDraft((prev) => ({
        ...prev,
        budgetName: option.name,
        budgetIcon: option.icon,
        budgetColor: option.color,
        category: shouldApplyBudgetCategory() ? option.category : prev.category,
      }));
    }
  }, [draft.budgetId, budgetOptions, budgetOptionsQuery.isSuccess]);
```

> `formatDraftDate`, `resetSuggestionTracking`, `shouldApplyBudgetCategory`, `budgetSelectionSourceRef`, and `TExpenseDraft` already exist in this file (lines 170, 334, 346, 318, 101). `normalizeCategory` is no longer referenced by the handler but remains used by `buildDraftFromExpense` — keep its import/definition.

- [ ] **Step 5: Run tests to verify they pass**

Run: `bunx vitest run src/components/QuickExpenseDrawer.test.tsx`
Expected: PASS (existing + 2 new).

- [ ] **Step 6: Format, lint, commit**

```bash
rtk bunx prettier --write src/components/QuickExpenseDrawer.tsx src/components/QuickExpenseDrawer.test.tsx
rtk bunx eslint src/components/QuickExpenseDrawer.tsx src/components/QuickExpenseDrawer.test.tsx
git add src/components/QuickExpenseDrawer.tsx src/components/QuickExpenseDrawer.test.tsx
git commit -m "feat(expenses): apply budget+date prefill and derive category in drawer"
```

---

## Task 7: Rewrite AIExpenseChat (load budgets, auto-add, prefill, mount drawer)

**Files:**
- Modify: `src/components/AIExpenseChat.tsx`
- Test: `src/components/AIExpenseChat.test.tsx` (rewrite)

- [ ] **Step 1: Rewrite the failing test**

Replace the entire contents of `src/components/AIExpenseChat.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Category } from "@/enums";
import { queries } from "@/lib/queries";

const createExpenseMock = vi.fn();
const dispatchExpensePrefillMock = vi.fn();

vi.mock("@/lib/mutations", () => ({
  useCreateExpenseMutation: () => ({ mutateAsync: createExpenseMock }),
}));

vi.mock("@/lib/expense-prefill", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/expense-prefill")>();
  return { ...actual, dispatchExpensePrefill: dispatchExpensePrefillMock };
});

// Mount-only stub for the review drawer so the chat test stays focused.
vi.mock("@/components/QuickExpenseDrawer", () => ({
  __esModule: true,
  default: () => <div data-testid="quick-expense-drawer" />,
}));

import AIExpenseChat from "./AIExpenseChat";

const TODAY = "2026-05-30";
const WEEK_START = "2026-05-24"; // getWeekRange(Sunday-start) for 2026-05-30

const budgetOption = {
  id: 2,
  name: "Cà phê",
  icon: "☕",
  color: "blue" as const,
  period: "week" as const,
  periodStartDate: "2026-05-24",
  periodEndDate: "2026-05-30",
  amount: 100000,
  spent: 0,
  remaining: 100000,
  category: Category.FOOD,
};

const renderChat = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData(
    queries.budgetWeekly.options(WEEK_START, TODAY).queryKey,
    [budgetOption]
  );
  return render(
    <QueryClientProvider client={queryClient}>
      <AIExpenseChat />
    </QueryClientProvider>
  );
};

const mockParseResponse = (data: unknown, status = 200) => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      status,
      json: vi.fn().mockResolvedValue({ success: true, data }),
    })
  );
};

beforeEach(() => {
  vi.useFakeTimers({ now: new Date(`${TODAY}T08:00:00.000Z`) });
  createExpenseMock.mockReset().mockResolvedValue(undefined);
  dispatchExpensePrefillMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const submit = async (text: string) => {
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: text } });
  fireEvent.submit(input.closest("form")!);
};

describe("AIExpenseChat", () => {
  it("auto-adds a high-confidence draft with a resolved in-period budget", async () => {
    mockParseResponse({
      status: "success",
      originalInput: "cf 35k",
      expense: {
        date: "30/05/2026",
        amount: 35000,
        note: "Cà phê sữa đá",
        budgetId: 2,
        confidence: "high",
        reason: "Matched coffee.",
      },
    });
    renderChat();

    await submit("cf 35k");

    await waitFor(() =>
      expect(createExpenseMock).toHaveBeenCalledWith(
        expect.objectContaining({
          date: "2026-05-30",
          amount: 35000,
          note: "Cà phê sữa đá",
          category: Category.FOOD,
          budgetId: 2,
          budgetName: "Cà phê",
          budgetIcon: "☕",
          budgetColor: "blue",
        })
      )
    );
    expect(dispatchExpensePrefillMock).not.toHaveBeenCalled();
  });

  it("opens the drawer for a medium-confidence draft", async () => {
    mockParseResponse({
      status: "success",
      originalInput: "cf 35k",
      expense: {
        date: "30/05/2026",
        amount: 35000,
        note: "Cà phê",
        budgetId: 2,
        confidence: "medium",
        reason: "Unsure.",
      },
    });
    renderChat();

    await submit("cf 35k");

    await waitFor(() => expect(dispatchExpensePrefillMock).toHaveBeenCalled());
    expect(createExpenseMock).not.toHaveBeenCalled();
    expect(dispatchExpensePrefillMock).toHaveBeenCalledWith(
      expect.objectContaining({ budgetId: 2, budgetName: "Cà phê", date: "30/05/2026" })
    );
  });

  it("opens the drawer when a high-confidence budget falls outside its period", async () => {
    mockParseResponse({
      status: "success",
      originalInput: "cf 35k last week",
      expense: {
        date: "15/05/2026", // before the budget's 2026-05-24 start
        amount: 35000,
        note: "Cà phê",
        budgetId: 2,
        confidence: "high",
        reason: "Matched coffee.",
      },
    });
    renderChat();

    await submit("cf 35k last week");

    await waitFor(() => expect(dispatchExpensePrefillMock).toHaveBeenCalled());
    expect(createExpenseMock).not.toHaveBeenCalled();
  });

  it("opens the drawer with safe prefill on a fallback", async () => {
    mockParseResponse({
      status: "fallback",
      originalInput: "??? 35",
      prefill: { note: "??? 35", amount: undefined },
      reason: "schema_mismatch",
    });
    renderChat();

    await submit("??? 35");

    await waitFor(() => expect(dispatchExpensePrefillMock).toHaveBeenCalled());
    expect(createExpenseMock).not.toHaveBeenCalled();
  });
});
```

> If the file's testing setup does not use fake timers elsewhere, the `now` injection guarantees `dayjs()` resolves to `TODAY` so the seeded query key matches. Adjust `WEEK_START` only if the project sets a non-default `weekStartDay`.

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/components/AIExpenseChat.test.tsx`
Expected: FAIL — current chat sends no budgets, never auto-adds, and renders `ManualExpenseForm`.

- [ ] **Step 3: Rewrite the component**

Replace the entire contents of `src/components/AIExpenseChat.tsx`:

```tsx
"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";

import dayjs from "@/configs/date";
import { Category, PaidBy } from "@/enums";
import { useAppHaptics } from "@/hooks/useAppHaptics";
import type { ParseExpenseResponse } from "@/lib/ai/parse-expense-contract";
import { unwrapApiResponse } from "@/lib/api/api-response";
import {
  isDateWithinBudgetPeriod,
  type TBudgetOption,
} from "@/lib/budget-options";
import { dispatchExpensePrefill } from "@/lib/expense-prefill";
import { useCreateExpenseMutation } from "@/lib/mutations";
import { queries } from "@/lib/queries";
import { formatVnd } from "@/lib/utils";
import { getWeekRange } from "@/lib/week";
import { useSettingsStore } from "@/stores/settings-store";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUp, Loader2 } from "lucide-react";
import { toast } from "sonner";

import QuickExpenseDrawer from "./QuickExpenseDrawer";
import VndSymbol from "./VndSymbol";
import { Button } from "./ui/button";
import PixelLoader from "./ui/pixel-loader/PixelLoader";
import { Textarea } from "./ui/textarea";

const examplePrompts = [
  "Cà phê sữa đá 35k sáng nay",
  "Ăn trưa 90k hôm nay",
  "Đổ xăng 60k chiều qua",
];

const ALLOWED_PAID_BY = [PaidBy.CUBI, PaidBy.EMBE, PaidBy.OTHER];

const resolvePaidBy = (value: string | undefined): PaidBy =>
  ALLOWED_PAID_BY.find((option) => option === value) ?? PaidBy.OTHER;

const toIsoDate = (ddmmyyyy: string): string | null => {
  const parsed = dayjs(ddmmyyyy, "DD/MM/YYYY", true);
  return parsed.isValid() ? parsed.format("YYYY-MM-DD") : null;
};

type ChatMessage = {
  id: string;
} & (
  | { role: "user"; text: string }
  | { role: "assistant"; variant: "pending" }
  | { role: "assistant"; variant: "added"; summary: string }
  | { role: "assistant"; variant: "review" }
  | { role: "assistant"; variant: "error"; retryInput: string }
);

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const AIExpenseChat = () => {
  const composerId = useId();
  const queryClient = useQueryClient();
  const settingsPaidBy = useSettingsStore((state) => state.paidBy);
  const { mutateAsync: createExpense } = useCreateExpenseMutation();
  const haptics = useAppHaptics();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [composer, setComposer] = useState("");
  const [loading, setLoading] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (!el || typeof el.scrollTo !== "function") {
      return;
    }
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) {
      return;
    }
    const max = 128;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
    el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
  }, [composer]);

  const replaceMessage = (id: string, next: ChatMessage) => {
    setMessages((current) =>
      current.map((message) => (message.id === id ? next : message))
    );
  };

  const loadTodayBudgets = async (): Promise<TBudgetOption[]> => {
    const today = dayjs().format("YYYY-MM-DD");
    const weekStart = getWeekRange(dayjs())
      .weekStartDate.format("YYYY-MM-DD");
    return queryClient.ensureQueryData(
      queries.budgetWeekly.options(weekStart, today)
    );
  };

  const openForReview = (
    prefill: {
      amount: number;
      note: string;
      date?: string;
    },
    budget: TBudgetOption | null
  ) => {
    dispatchExpensePrefill({
      amount: prefill.amount,
      note: prefill.note,
      date: prefill.date,
      budgetId: budget?.id ?? null,
      budgetName: budget?.name ?? null,
      budgetIcon: budget?.icon ?? null,
      budgetColor: budget?.color ?? null,
      source: "ai",
    });
  };

  const handleResult = async (
    result: ParseExpenseResponse,
    assistantId: string,
    budgetOptions: TBudgetOption[]
  ) => {
    if (result.status === "fallback") {
      openForReview(
        { amount: result.prefill.amount ?? 0, note: result.prefill.note ?? "" },
        null
      );
      replaceMessage(assistantId, {
        id: assistantId,
        role: "assistant",
        variant: "review",
      });
      haptics.warning();
      return;
    }

    const { expense } = result;
    const isoDate = toIsoDate(expense.date);
    const budget =
      expense.budgetId !== null
        ? (budgetOptions.find((option) => option.id === expense.budgetId) ??
          null)
        : null;

    const canAutoAdd =
      expense.confidence === "high" &&
      isoDate !== null &&
      expense.note.trim().length > 0 &&
      budget !== null &&
      isDateWithinBudgetPeriod(budget, isoDate);

    if (canAutoAdd && budget && isoDate) {
      await createExpense({
        date: isoDate,
        amount: expense.amount,
        note: expense.note,
        category: budget.category,
        paidBy: resolvePaidBy(settingsPaidBy),
        budgetId: budget.id,
        budgetName: budget.name,
        budgetIcon: budget.icon,
        budgetColor: budget.color,
      });
      const summary = `Added ${formatVnd(expense.amount)}₫ to ${budget.name}`;
      replaceMessage(assistantId, {
        id: assistantId,
        role: "assistant",
        variant: "added",
        summary,
      });
      toast.success(summary);
      haptics.success();
      return;
    }

    openForReview(
      { amount: expense.amount, note: expense.note, date: expense.date },
      budget
    );
    replaceMessage(assistantId, {
      id: assistantId,
      role: "assistant",
      variant: "review",
    });
    haptics.warning();
  };

  const sendInput = async ({
    input,
    assistantId,
    appendUserMessage,
  }: {
    input: string;
    assistantId: string;
    appendUserMessage: boolean;
  }) => {
    if (!input || loading) {
      return;
    }

    setLoading(true);
    setComposer("");
    setMessages((current) => {
      const pendingMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        variant: "pending",
      };
      if (!appendUserMessage) {
        return current.map((message) =>
          message.id === assistantId ? pendingMessage : message
        );
      }
      return [
        ...current,
        { id: createId(), role: "user", text: input },
        pendingMessage,
      ];
    });

    try {
      const budgetOptions = await loadTodayBudgets();
      const response = await fetch("/api/ai/parse-expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input,
          budgets: budgetOptions.map((option) => ({
            id: option.id,
            name: option.name,
            category: option.category,
          })),
        }),
      });
      const payload = unwrapApiResponse<ParseExpenseResponse>(
        await response.json(),
        response.status
      );
      await handleResult(payload, assistantId, budgetOptions);
    } catch (requestError) {
      console.error(requestError);
      replaceMessage(assistantId, {
        id: assistantId,
        role: "assistant",
        variant: "error",
        retryInput: input,
      });
      haptics.error();
    } finally {
      setLoading(false);
    }
  };

  const submitMessage = async () => {
    await sendInput({
      input: composer.trim(),
      assistantId: createId(),
      appendUserMessage: true,
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitMessage();
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitMessage();
    }
  };

  const trimmedComposer = composer.trim();
  const showExamples = messages.length === 0;

  const renderAssistantContent = (
    message: Extract<ChatMessage, { role: "assistant" }>
  ) => {
    switch (message.variant) {
      case "pending":
        return (
          <span className="text-muted-foreground inline-flex items-center gap-2.5 text-sm">
            <PixelLoader size="sm" pattern="wave" label="Reading the expense" />
            Reading the expense...
          </span>
        );
      case "added":
        return (
          <p className="text-foreground text-[15px] font-medium tracking-tight">
            {message.summary}
            <VndSymbol className="ml-0.5" />
          </p>
        );
      case "review":
        return (
          <p className="text-muted-foreground text-sm leading-6">
            I opened a draft for you to review and save.
          </p>
        );
      case "error":
        return (
          <div className="space-y-2">
            <p className="text-foreground text-[15px] font-medium tracking-tight">
              I could not parse that expense.
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={loading}
              className="gap-1.5 rounded-full"
              onClick={() =>
                void sendInput({
                  input: message.retryInput,
                  assistantId: message.id,
                  appendUserMessage: false,
                })
              }
            >
              Try again
            </Button>
          </div>
        );
    }
  };

  return (
    <section
      aria-label="AI expense conversation"
      className="flex min-h-0 flex-1 flex-col"
    >
      <div
        ref={logRef}
        role="log"
        aria-label="AI expense conversation"
        aria-live="polite"
        aria-relevant="additions text"
        className="no-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-4"
      >
        {messages.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-muted-foreground text-center text-sm leading-6">
              Tell me what you spent.
            </p>
          </div>
        ) : null}

        {messages.map((message) =>
          message.role === "user" ? (
            <article key={message.id} className="flex justify-end">
              <div className="bg-primary text-primary-foreground max-w-[82%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-6 font-medium">
                {message.text}
              </div>
            </article>
          ) : (
            <article
              key={message.id}
              className="text-foreground max-w-full text-sm leading-6"
            >
              {renderAssistantContent(message)}
            </article>
          )
        )}
      </div>

      <div className="sticky bottom-0 z-50 shrink-0 space-y-2.5 pt-3">
        {showExamples ? (
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-0.5">
            {examplePrompts.map((prompt) => (
              <Button
                key={prompt}
                type="button"
                variant="secondary"
                size="sm"
                className="border-border/70 bg-surface-2/80 text-muted-foreground hover:border-primary/40 hover:text-foreground h-8 shrink-0 rounded-full border px-3 text-xs"
                onClick={() => {
                  setComposer(prompt);
                  textareaRef.current?.focus();
                }}
              >
                {prompt}
              </Button>
            ))}
          </div>
        ) : null}

        <form
          onSubmit={handleSubmit}
          className="ds-glass border-border/80 relative flex items-end gap-2 rounded-[28px] border p-1.5 pl-4"
        >
          <label htmlFor={composerId} className="sr-only">
            Message Spendly AI
          </label>
          <Textarea
            id={composerId}
            ref={textareaRef}
            value={composer}
            onChange={(event) => setComposer(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            placeholder="Cà phê 35k sáng nay"
            rows={1}
            className="text-foreground placeholder:text-muted-foreground/70 max-h-32 min-h-9 resize-none border-0 !bg-transparent p-0 py-2 text-base leading-6 shadow-none focus-visible:border-0 focus-visible:ring-0 md:text-[15px] dark:!bg-transparent"
          />
          <Button
            type="submit"
            aria-label="Send message"
            disabled={loading || !trimmedComposer}
            className="size-10 shrink-0 rounded-full p-0"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowUp className="size-4" />
            )}
            <span className="sr-only">Send message</span>
          </Button>
        </form>
      </div>

      <QuickExpenseDrawer showTrigger={false} />
    </section>
  );
};

export default AIExpenseChat;
```

> The trigger-less `<QuickExpenseDrawer showTrigger={false} />` at the end is what receives the prefill event on `/ai` (BottomNav — and therefore its drawer — is hidden on `/ai`). It is uncontrolled, so its prefill handler self-opens via `setInternalOpen(true)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bunx vitest run src/components/AIExpenseChat.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Format, lint, commit**

```bash
rtk bunx prettier --write src/components/AIExpenseChat.tsx src/components/AIExpenseChat.test.tsx
rtk bunx eslint src/components/AIExpenseChat.tsx src/components/AIExpenseChat.test.tsx
git add src/components/AIExpenseChat.tsx src/components/AIExpenseChat.test.tsx
git commit -m "feat(ai): auto-add or open review drawer from budget-aware chat"
```

---

## Task 8: Delete the dead AIInput component

**Files:**
- Delete: `src/components/AIInput.tsx`, `src/components/AIInput.test.tsx`
- Possibly delete: `src/components/AIExpensePreviewCard.tsx` (+ test) if orphaned

- [ ] **Step 1: Confirm AIInput is unreferenced**

Run: `rg -n "AIInput" src -g '!src/components/AIInput.tsx' -g '!src/components/AIInput.test.tsx'`
Expected: no matches.

- [ ] **Step 2: Check whether AIExpensePreviewCard is now orphaned**

Run: `rg -n "AIExpensePreviewCard" src -g '!src/components/AIExpensePreviewCard.tsx' -g '!src/components/AIExpensePreviewCard.test.tsx'`
Expected: matches only inside `AIInput.tsx` (being deleted). If no other consumer remains, delete it too.

- [ ] **Step 3: Delete the files**

```bash
git rm src/components/AIInput.tsx src/components/AIInput.test.tsx
# Only if Step 2 showed no surviving consumer:
git rm src/components/AIExpensePreviewCard.tsx 2>/dev/null || true
git rm src/components/AIExpensePreviewCard.test.tsx 2>/dev/null || true
```

- [ ] **Step 4: Verify nothing else broke**

Run: `rg -n "AIInput|AIExpensePreviewCard" src` (expect no matches) and `bunx tsc --noEmit` (expect no new errors).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(ai): remove unused AIInput surface"
```

---

## Task 9: Update the spec status + full verification

**Files:**
- Modify: `docs/superpowers/specs/2026-05-29-ai-budget-quick-add-design.md`

- [ ] **Step 1: Mark the spec implemented**

Change the header line `Status: Reviewed — ready for planning` to `Status: Implemented` and update `Last revised` to today.

- [ ] **Step 2: Run the full affected test surface**

```bash
bunx vitest run \
  src/lib/ai/parse-expense-contract.test.ts \
  src/lib/ai/parse-expense.test.ts \
  src/app/api/ai/parse-expense/route.test.ts \
  src/lib/budget-options.test.ts \
  src/components/QuickExpenseDrawer.test.tsx \
  src/components/AIExpenseChat.test.tsx \
  src/app/ai/page.test.tsx
```

Expected: all PASS. If `src/app/ai/page.test.tsx` asserts old chat copy, update its expectations to the new placeholder/examples.

- [ ] **Step 3: Type-check + build (build only once, here)**

```bash
bunx tsc --noEmit
npm run build
```

Expected: no type errors; build succeeds.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-05-29-ai-budget-quick-add-design.md
git commit -m "docs(ai): mark budget quick-add spec implemented"
```

- [ ] **Step 5: Push and open PR**

```bash
git push -u origin dev-ai-budget-quick-add
```

Then open a PR to `main` summarizing the merged contract, the auto-add gate, and the AIInput removal.

---

## Self-Review (completed during planning)

- **Spec coverage:** request contract (T1), response contract + VND/Vietnamese (T1/T2), AI matching prompt (T2), route validation (T3), auto-add gate incl. date-in-period (T4/T7), prefill extension (T5), drawer apply + category derivation + re-suggest suppression (T6), chat rewire + review drawer mount (T7), AIInput cleanup (T8), tests across all (each task), `suggest-budget` untouched (not modified anywhere). Covered.
- **Type consistency:** `ParseExpenseResponse`/`ParseExpenseBudget`/`PARSE_EXPENSE_MIN_AMOUNT` (T1) are consumed by T2/T3/T7; `ExpensePrefillPayload` (T5) consumed by T6/T7; `TBudgetOption`/`isDateWithinBudgetPeriod` (T4) consumed by T7; `BudgetWeeklyOption.category`, `icon`, `color` used consistently. `budgetSelectionSource` value `"ai"` matches the existing `BudgetSelectionSource` union.
- **Known follow-up flagged in spec:** `suggest-budget` deliberately lacks category context (in-drawer note-blur path); `reason` is returned but not surfaced.
