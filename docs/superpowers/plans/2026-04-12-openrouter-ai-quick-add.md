# OpenRouter AI Quick Add Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current Gemini-backed AI expense parser with a direct OpenRouter API route using `openai/gpt-oss-20b:free`, add a confirmation preview, and fall back cleanly into the existing manual form.

**Architecture:** Keep the feature narrow. The client continues to start from `AIInput`, but now calls a new `POST /api/ai/parse-expense` route. The route delegates model-specific parsing and normalization to a focused server module in `src/lib/ai/`, returns a stable success-or-fallback contract, and the client either shows a preview card or opens `ManualExpenseForm` directly with safe prefill values.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest, Testing Library, existing `Category` enum, direct `fetch` to OpenRouter HTTP API

---

## File Structure

**Create**
- `src/lib/ai/parse-expense-contract.ts`
- `src/lib/ai/parse-expense.ts`
- `src/lib/ai/parse-expense.test.ts`
- `src/app/api/ai/parse-expense/route.ts`
- `src/app/api/ai/parse-expense/route.test.ts`
- `src/components/AIExpensePreviewCard.tsx`
- `src/components/AIInput.test.tsx`

**Modify**
- `src/components/AIInput.tsx`
- `src/components/ManualExpenseForm.tsx`
- `src/components/ManualExpenseForm.quick-mode.test.tsx`
- `package.json`

**Delete**
- `src/app/actions/ai-actionts.ts`
- `src/configs/gemini.ts`

**Responsibilities**
- `src/lib/ai/parse-expense-contract.ts`: shared request/response types used by server and client
- `src/lib/ai/parse-expense.ts`: OpenRouter request, JSON extraction, validation, enum normalization, fallback shaping
- `src/app/api/ai/parse-expense/route.ts`: payload validation, env handling, HTTP response shaping
- `src/components/AIExpensePreviewCard.tsx`: isolated preview UI so `AIInput` does not become a large stateful rendering file
- `src/components/AIInput.tsx`: fetch orchestration, loading state, success preview, fallback manual form
- `src/components/ManualExpenseForm.tsx`: accept partial fallback prefill without fabricating category

### Task 1: Define the shared AI contract and lock parser behavior with tests

**Files:**
- Create: `src/lib/ai/parse-expense-contract.ts`
- Create: `src/lib/ai/parse-expense.test.ts`

- [ ] **Step 1: Create the shared request/response contract**

```ts
// src/lib/ai/parse-expense-contract.ts
import { Category } from "@/enums";

export type ParseExpenseRequest = {
  input: string;
};

export type ParseExpenseSuccessResponse = {
  status: "success";
  originalInput: string;
  expense: {
    date: string;
    amount: number;
    note: string;
    category: Category;
  };
};

export type ParseExpenseFallbackResponse = {
  status: "fallback";
  originalInput: string;
  prefill: {
    note?: string;
    amount?: number;
  };
  reason:
    | "invalid_json"
    | "schema_mismatch"
    | "empty_response"
    | "request_failed";
};

export type ParseExpenseResponse =
  | ParseExpenseSuccessResponse
  | ParseExpenseFallbackResponse;
```

- [ ] **Step 2: Write the failing parser tests**

```ts
// src/lib/ai/parse-expense.test.ts
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
    const fetchFn = vi
      .fn()
      .mockResolvedValue(createOpenRouterResponse(""));

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
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm run test -- src/lib/ai/parse-expense.test.ts`

Expected: FAIL with `Cannot find module './parse-expense'` or missing export errors.

- [ ] **Step 4: Commit the contract and failing tests**

```bash
git add src/lib/ai/parse-expense-contract.ts src/lib/ai/parse-expense.test.ts
git commit -m "test: define AI expense parsing contract"
```

### Task 2: Implement the OpenRouter parser module

**Files:**
- Create: `src/lib/ai/parse-expense.ts`
- Test: `src/lib/ai/parse-expense.test.ts`

- [ ] **Step 1: Write the parser implementation**

```ts
// src/lib/ai/parse-expense.ts
import { Category } from "@/enums";

import type { ParseExpenseResponse } from "./parse-expense-contract";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "openai/gpt-oss-20b:free";
const CATEGORY_VALUES = Object.values(Category);
const DATE_PATTERN = /^\d{2}\/\d{2}\/\d{4}$/;
type FallbackReason =
  | "invalid_json"
  | "schema_mismatch"
  | "empty_response"
  | "request_failed";

const SYSTEM_PROMPT = `
You extract a single expense draft from short natural-language text.

Rules:
- Return only one JSON object.
- Output fields: date, amount, note, category.
- date must be DD/MM/YYYY.
- amount must be a positive number.
- note must be short.
- category must be exactly one of: ${CATEGORY_VALUES.join(", ")}.
`.trim();

const extractJsonObject = (value: string) => {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");

  if (start === -1 || end === -1 || end < start) {
    return null;
  }

  return value.slice(start, end + 1);
};

const normalizeCategory = (value: unknown) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return (
    CATEGORY_VALUES.find(
      (category) => category.toLowerCase() === normalized
    ) ?? null
  );
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
    note: originalInput.trim() || undefined,
    amount: extractAmountFromInput(originalInput),
  },
});

type ParseExpenseArgs = {
  input: string;
  apiKey: string;
  fetchFn?: typeof fetch;
};

export const parseExpenseWithOpenRouter = async ({
  input,
  apiKey,
  fetchFn = fetch,
}: ParseExpenseArgs): Promise<ParseExpenseResponse> => {
  const response = await fetchFn(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: input },
      ],
    }),
  });

  if (!response.ok) {
    return buildFallback(input, "request_failed");
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = payload.choices?.[0]?.message?.content?.trim();
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
    category?: unknown;
  };

  const category = normalizeCategory(expense.category);
  const amount = Number(expense.amount);
  const note = String(expense.note ?? "").trim();
  const date = String(expense.date ?? "").trim();

  if (
    !category ||
    !DATE_PATTERN.test(date) ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    note.length === 0
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
      category,
    },
  };
};
```

- [ ] **Step 2: Run the parser tests**

Run: `npm run test -- src/lib/ai/parse-expense.test.ts`

Expected: PASS with 5 tests green.

- [ ] **Step 3: Commit the parser**

```bash
git add src/lib/ai/parse-expense.ts src/lib/ai/parse-expense.test.ts
git commit -m "feat: add OpenRouter expense parser"
```

### Task 3: Add the API route with focused route tests

**Files:**
- Create: `src/app/api/ai/parse-expense/route.ts`
- Create: `src/app/api/ai/parse-expense/route.test.ts`
- Test: `src/lib/ai/parse-expense-contract.ts`

- [ ] **Step 1: Write the failing route tests**

```ts
// src/app/api/ai/parse-expense/route.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";

const parseExpenseWithOpenRouter = vi.fn();

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
```

- [ ] **Step 2: Run the route tests to verify they fail**

Run: `npm run test -- src/app/api/ai/parse-expense/route.test.ts`

Expected: FAIL because `src/app/api/ai/parse-expense/route.ts` does not exist yet.

- [ ] **Step 3: Implement the route**

```ts
// src/app/api/ai/parse-expense/route.ts
import { NextResponse } from "next/server";

import type { ParseExpenseRequest } from "@/lib/ai/parse-expense-contract";
import { parseExpenseWithOpenRouter } from "@/lib/ai/parse-expense";

export const POST = async (request: Request) => {
  try {
    const payload = (await request.json()) as Partial<ParseExpenseRequest>;
    const input = payload.input?.trim();

    if (!input) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing OPENROUTER_API_KEY" },
        { status: 500 }
      );
    }

    const result = await parseExpenseWithOpenRouter({
      input,
      apiKey,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to parse expense with OpenRouter:", error);
    return NextResponse.json(
      { error: "Failed to parse expense" },
      { status: 500 }
    );
  }
};
```

- [ ] **Step 4: Run the route tests**

Run: `npm run test -- src/app/api/ai/parse-expense/route.test.ts`

Expected: PASS with 4 tests green.

- [ ] **Step 5: Commit the route**

```bash
git add src/app/api/ai/parse-expense/route.ts src/app/api/ai/parse-expense/route.test.ts
git commit -m "feat: add AI parse expense API route"
```

### Task 4: Let the manual form accept partial fallback prefill without inventing category

**Files:**
- Modify: `src/components/ManualExpenseForm.tsx`
- Modify: `src/components/ManualExpenseForm.quick-mode.test.tsx`

- [ ] **Step 1: Add the failing fallback-prefill test**

```ts
// add to src/components/ManualExpenseForm.quick-mode.test.tsx
it("accepts fallback prefill without category", async () => {
  await renderManualExpenseForm({
    initialMode: "quick",
    prefillExpense: {
      amount: 85000,
      note: "Taxi home",
    },
  });

  expect(screen.getByDisplayValue("Taxi home")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the targeted form test and verify it fails at the type or runtime boundary**

Run: `npm run test -- src/components/ManualExpenseForm.quick-mode.test.tsx`

Expected: FAIL because `prefillExpense.category` is currently required by the prop type or because the test file cannot type-check the partial object.

- [ ] **Step 3: Relax the prefill type and keep category defaulting inside the form**

Update the prop type:

```ts
// src/components/ManualExpenseForm.tsx
type ManualExpenseFormProps = {
  // ...
  prefillExpense?: Partial<Pick<TExpense, "amount" | "note" | "category">> | null;
  // ...
};
```

Keep the prefill merge logic defensive:

```ts
const nextAmount = Number(prefillExpense.amount);
const nextCategory =
  typeof prefillExpense.category === "string" &&
  Object.values(Category).includes(prefillExpense.category as Category)
    ? (prefillExpense.category as Category)
    : defaultExpense.category;

setExpense((current) => ({
  ...current,
  amount: Number.isFinite(nextAmount) ? nextAmount : current.amount,
  note: prefillExpense.note ?? "",
  category: nextCategory,
}));
```

- [ ] **Step 4: Run the form test file again**

Run: `npm run test -- src/components/ManualExpenseForm.quick-mode.test.tsx`

Expected: PASS, including the new fallback-prefill coverage.

- [ ] **Step 5: Commit the form fallback support**

```bash
git add src/components/ManualExpenseForm.tsx src/components/ManualExpenseForm.quick-mode.test.tsx
git commit -m "refactor: allow partial AI fallback prefill"
```

### Task 5: Add client tests for loading, success preview, and fallback form opening

**Files:**
- Create: `src/components/AIInput.test.tsx`

- [ ] **Step 1: Write the failing AI input integration tests**

```ts
// src/components/AIInput.test.tsx
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Category } from "@/enums";

import AIInput from "./AIInput";

vi.mock("./ManualExpenseForm", () => ({
  default: (props: unknown) => (
    <pre data-testid="manual-expense-form">{JSON.stringify(props)}</pre>
  ),
}));

describe("AIInput", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a loading spinner while parsing is in flight", async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
    );

    const user = userEvent.setup();
    render(<AIInput />);

    await user.type(
      screen.getByLabelText(/expense input/i),
      "Lunch 120k today"
    );
    await user.click(screen.getByRole("button", { name: /parse expense/i }));

    expect(screen.getByTestId("ai-input-loading")).toBeInTheDocument();

    resolveFetch?.({
      ok: true,
      json: vi.fn().mockResolvedValue({
        status: "fallback",
        originalInput: "Lunch 120k today",
        prefill: { note: "Lunch 120k today" },
        reason: "request_failed",
      }),
    } as unknown as Response);

    await waitFor(() =>
      expect(
        screen.queryByTestId("ai-input-loading")
      ).not.toBeInTheDocument()
    );
  });

  it("shows the preview card before opening the manual form on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        status: "success",
        originalInput: "Lunch 120k today",
        expense: {
          date: "12/04/2026",
          amount: 120000,
          note: "Lunch",
          category: Category.FOOD,
        },
      }),
    } as unknown as Response);

    const user = userEvent.setup();
    render(<AIInput />);

    await user.type(
      screen.getByLabelText(/expense input/i),
      "Lunch 120k today"
    );
    await user.click(screen.getByRole("button", { name: /parse expense/i }));

    expect(await screen.findByText(/review ai suggestion/i)).toBeInTheDocument();
    expect(
      screen.queryByTestId("manual-expense-form")
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /continue to form/i }));

    expect(screen.getByTestId("manual-expense-form")).toHaveTextContent(
      '"category":"Food"'
    );
  });

  it("opens the manual form directly when the API returns fallback", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        status: "fallback",
        originalInput: "Taxi 85k",
        prefill: { note: "Taxi 85k", amount: 85000 },
        reason: "schema_mismatch",
      }),
    } as unknown as Response);

    const user = userEvent.setup();
    render(<AIInput />);

    await user.type(screen.getByLabelText(/expense input/i), "Taxi 85k");
    await user.click(screen.getByRole("button", { name: /parse expense/i }));

    expect(await screen.findByTestId("manual-expense-form")).toHaveTextContent(
      '"amount":85000'
    );
  });

  it("shows a retryable error message when the API returns 500", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      json: vi.fn(),
    } as unknown as Response);

    const user = userEvent.setup();
    render(<AIInput />);

    await user.type(screen.getByLabelText(/expense input/i), "Lunch 120k today");
    await user.click(screen.getByRole("button", { name: /parse expense/i }));

    expect(
      await screen.findByText(/could not parse expense right now/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("manual-expense-form")
    ).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the AI input tests to verify they fail**

Run: `npm run test -- src/components/AIInput.test.tsx`

Expected: FAIL because `AIInput` does not yet call the API route, expose accessible button labels, or render a preview state.

- [ ] **Step 3: Commit the failing client tests**

```bash
git add src/components/AIInput.test.tsx
git commit -m "test: cover AI input OpenRouter flow"
```

### Task 6: Implement the preview UI, fetch-based AI input flow, and Gemini cleanup

**Files:**
- Create: `src/components/AIExpensePreviewCard.tsx`
- Modify: `src/components/AIInput.tsx`
- Modify: `package.json`
- Delete: `src/app/actions/ai-actionts.ts`
- Delete: `src/configs/gemini.ts`
- Test: `src/components/AIInput.test.tsx`

- [ ] **Step 1: Create the preview component**

```tsx
// src/components/AIExpensePreviewCard.tsx
"use client";

import { formatVnd } from "@/lib/utils";

import { Button } from "./ui/button";

type AIExpensePreviewCardProps = {
  expense: TExpense;
  onAccept: () => void;
  onDismiss: () => void;
};

const AIExpensePreviewCard = ({
  expense,
  onAccept,
  onDismiss,
}: AIExpensePreviewCardProps) => {
  return (
    <div className="rounded-3xl border border-border/60 bg-card/80 p-4 shadow-xl shadow-black/5">
      <p className="text-sm font-medium">Review AI suggestion</p>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground">Amount</dt>
          <dd>{formatVnd(expense.amount)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Date</dt>
          <dd>{expense.date}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Category</dt>
          <dd>{expense.category}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-muted-foreground">Note</dt>
          <dd>{expense.note}</dd>
        </div>
      </dl>
      <div className="mt-4 flex gap-2">
        <Button type="button" onClick={onAccept}>
          Continue to form
        </Button>
        <Button type="button" variant="ghost" onClick={onDismiss}>
          Start over
        </Button>
      </div>
    </div>
  );
};

export default AIExpensePreviewCard;
```

- [ ] **Step 2: Replace the server action flow inside `AIInput`**

Use this state shape and render logic:

```tsx
// key parts for src/components/AIInput.tsx
import { Category } from "@/enums";
import type { ParseExpenseResponse } from "@/lib/ai/parse-expense-contract";

import AIExpensePreviewCard from "./AIExpensePreviewCard";

const [previewExpense, setPreviewExpense] = useState<TExpense | null>(null);
const [acceptedExpense, setAcceptedExpense] = useState<TExpense | null>(null);
const [fallbackPrefill, setFallbackPrefill] = useState<
  Partial<Pick<TExpense, "amount" | "note" | "category">> | null
>(null);
const [errorMessage, setErrorMessage] = useState("");

async function handleSubmit() {
  if (!input.trim()) {
    return;
  }

  setPreviewExpense(null);
  setAcceptedExpense(null);
  setFallbackPrefill(null);
  setErrorMessage("");
  setLoading(true);

  try {
    const response = await fetch("/api/ai/parse-expense", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input }),
    });

    if (!response.ok) {
      setErrorMessage("Could not parse expense right now. Please try again.");
      return;
    }

    const payload = (await response.json()) as ParseExpenseResponse;

    if (payload.status === "success") {
      setPreviewExpense(payload.expense);
      setInput("");
      return;
    }

    setFallbackPrefill({
      note: payload.prefill.note ?? payload.originalInput,
      amount: payload.prefill.amount,
    });
    setInput("");
  } catch (error) {
    console.error(error);
    setErrorMessage("Could not parse expense right now. Please try again.");
  } finally {
    setLoading(false);
  }
}

const handleAcceptPreview = () => {
  if (!previewExpense) {
    return;
  }

  setAcceptedExpense(previewExpense);
  setPreviewExpense(null);
};
```

- [ ] **Step 3: Make the action button testable and accessible**

Update the submit button and loading indicator in `src/components/AIInput.tsx`:

```tsx
{errorMessage ? (
  <p className="text-sm text-destructive">{errorMessage}</p>
) : null}

<Button
  type="submit"
  aria-label="Parse expense"
  onClick={handleSubmit}
  disabled={loading || input.trim() === ""}
  size="icon"
  className="bg-primary text-primary-foreground hover:bg-primary/90 size-11 rounded-full shadow-lg transition disabled:cursor-not-allowed disabled:opacity-50"
>
  {loading ? (
    <Loader2 data-testid="ai-input-loading" className="h-5 w-5 animate-spin" />
  ) : (
    <Send className="h-5 w-5" />
  )}
</Button>
```

- [ ] **Step 4: Render the preview and fallback/manual branches**

Append this rendering block under the input container:

```tsx
{previewExpense ? (
  <div className="animate-in slide-in-from-bottom-4 duration-300">
    <AIExpensePreviewCard
      expense={previewExpense}
      onAccept={handleAcceptPreview}
      onDismiss={() => setPreviewExpense(null)}
    />
  </div>
) : null}

{acceptedExpense ? (
  <div className="animate-in slide-in-from-bottom-4 duration-300">
    <ManualExpenseForm initialExpense={acceptedExpense} />
  </div>
) : null}

{fallbackPrefill ? (
  <div className="animate-in slide-in-from-bottom-4 duration-300">
    <ManualExpenseForm initialMode="quick" prefillExpense={fallbackPrefill} />
  </div>
) : null}
```

- [ ] **Step 5: Remove the Gemini-specific code and dependency entries**

Delete:

```text
src/app/actions/ai-actionts.ts
src/configs/gemini.ts
```

Remove these dependency lines from `package.json`:

```json
"@google/genai": "^1.16.0",
"@openrouter/sdk": "^0.3.14",
```

The v1 implementation uses direct server-side `fetch`, so both packages should be removed rather than left unused.

- [ ] **Step 6: Run the AI input tests**

Run: `npm run test -- src/components/AIInput.test.tsx`

Expected: PASS with loading, success preview, and fallback coverage green.

- [ ] **Step 7: Commit the client implementation and cleanup**

```bash
git add src/components/AIExpensePreviewCard.tsx src/components/AIInput.tsx src/components/AIInput.test.tsx package.json
git rm src/app/actions/ai-actionts.ts src/configs/gemini.ts
git commit -m "feat: switch AI quick add to OpenRouter"
```

### Task 7: Run focused verification across the whole feature slice

**Files:**
- Test: `src/lib/ai/parse-expense.test.ts`
- Test: `src/app/api/ai/parse-expense/route.test.ts`
- Test: `src/components/ManualExpenseForm.quick-mode.test.tsx`
- Test: `src/components/AIInput.test.tsx`

- [ ] **Step 1: Run the parser and route tests together**

Run:

```bash
npm run test -- src/lib/ai/parse-expense.test.ts src/app/api/ai/parse-expense/route.test.ts
```

Expected: PASS with all parser and route tests green.

- [ ] **Step 2: Run the UI tests together**

Run:

```bash
npm run test -- src/components/ManualExpenseForm.quick-mode.test.tsx src/components/AIInput.test.tsx
```

Expected: PASS with the new fallback-prefill and AI input flows green.

- [ ] **Step 3: Do a final diff review for scope control**

Run:

```bash
git diff --stat -- src/lib/ai src/app/api/ai/parse-expense src/components/AIInput.tsx src/components/AIExpensePreviewCard.tsx src/components/ManualExpenseForm.tsx package.json
git diff -- src/components/AIInput.tsx src/lib/ai/parse-expense.ts src/app/api/ai/parse-expense/route.ts
```

Expected:
- no background job or polling code
- no remaining Gemini imports
- no database write path added outside `ManualExpenseForm`

- [ ] **Step 4: Commit any final test-only adjustments if needed**

```bash
git add src/lib/ai/parse-expense.test.ts src/app/api/ai/parse-expense/route.test.ts src/components/ManualExpenseForm.quick-mode.test.tsx src/components/AIInput.test.tsx
git commit -m "test: finalize OpenRouter quick add coverage"
```

If no changes are needed after verification, skip this commit.
