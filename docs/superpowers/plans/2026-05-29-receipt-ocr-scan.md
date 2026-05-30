# Receipt OCR Scan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user photograph a receipt and turn it into a single prefilled expense draft in the existing `QuickExpenseDrawer`.

**Architecture:** A new `ReceiptScanDrawer` captures/compresses an image, POSTs it to a new `/api/ai/scan-receipt` route that calls a free OpenRouter vision model, and on a result dispatches the existing `EXPENSE_PREFILL_EVENT`. The `QuickExpenseDrawer` already mounted in `BottomNav` catches that event and opens itself prefilled — it owns all review/edit/save behavior. The OCR service mirrors the resilient `parse-expense.ts` pattern (raw fetch, manual JSON extraction, structured fallback); core `openrouter.ts` is untouched.

**Tech Stack:** Next.js 15 App Router route handlers, TypeScript, Vitest + Testing Library, OpenRouter (`nvidia/nemotron-nano-12b-v2-vl:free`), dayjs, sonner, lucide-react.

**Spec:** `docs/superpowers/specs/2026-05-29-receipt-ocr-scan-design.md`

---

## File Structure

- **Create** `src/lib/ai/scan-receipt-contract.ts` — request/response types.
- **Create** `src/lib/ai/scan-receipt.ts` — OCR service (multimodal request + fallback).
- **Create** `src/lib/ai/scan-receipt.test.ts` — service unit tests.
- **Create** `src/app/api/ai/scan-receipt/route.ts` — route handler.
- **Create** `src/app/api/ai/scan-receipt/route.test.ts` — route tests.
- **Create** `src/lib/image/compress-image.ts` — canvas image-compression util (isolated for testability/mocking).
- **Create** `src/components/ReceiptScanDrawer.tsx` — capture + progress + error UI; dispatches prefill.
- **Create** `src/components/ReceiptScanDrawer.test.tsx` — component tests.
- **Modify** `src/lib/expense-prefill.ts` — add optional `date?: string` to `ExpensePrefillPayload`.
- **Modify** `src/lib/quick-add-mode.ts` — add `"receipt_scan"` to `QuickAddSource`.
- **Modify** `src/components/QuickExpenseDrawer.tsx` — apply `detail.date` in the prefill handler.
- **Modify** `src/components/BottomNav.tsx` — add scan button before the FAB; mount `ReceiptScanDrawer`.

---

## Task 1: OCR contract types

**Files:**
- Create: `src/lib/ai/scan-receipt-contract.ts`

- [ ] **Step 1: Write the contract file**

```ts
import { Category } from "@/enums";

export type ScanReceiptRequest = {
  imageBase64: string;
};

export type ScanReceiptSuccessResponse = {
  status: "success";
  receipt: {
    merchant?: string;
    date: string;
    total: number;
    category: Category;
  };
};

export type ScanReceiptFallbackResponse = {
  status: "fallback";
  prefill: {
    amount?: number;
    note?: string;
  };
  reason: "request_failed" | "invalid_json" | "schema_mismatch" | "empty_response";
};

export type ScanReceiptResponse =
  | ScanReceiptSuccessResponse
  | ScanReceiptFallbackResponse;
```

- [ ] **Step 2: Type-check the file**

Run: `rtk bunx tsc --noEmit -p tsconfig.json`
Expected: PASS (no errors referencing scan-receipt-contract.ts)

- [ ] **Step 3: Format + lint**

Run: `rtk bunx prettier --write src/lib/ai/scan-receipt-contract.ts && rtk bunx eslint src/lib/ai/scan-receipt-contract.ts`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/scan-receipt-contract.ts
git commit -m "feat(ai): add receipt scan contract types"
```

---

## Task 2: OCR service with fallback (TDD)

**Files:**
- Create: `src/lib/ai/scan-receipt.test.ts`
- Create: `src/lib/ai/scan-receipt.ts`

The service mirrors `src/lib/ai/parse-expense.ts`: a raw `fetch` to OpenRouter with a **multimodal** user message (text + `image_url`), then manual JSON extraction and validation, returning success or a structured fallback. It must NOT use `callOpenRouterJson` / `response_format`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it, vi } from "vitest";

import { Category } from "@/enums";

import { scanReceiptWithOpenRouter } from "./scan-receipt";

const createOpenRouterResponse = (content: unknown, ok = true) =>
  ({
    ok,
    json: vi.fn().mockResolvedValue({
      choices: [{ message: { content } }],
    }),
  }) as unknown as Response;

const IMAGE = "data:image/jpeg;base64,AAAA";

describe("scanReceiptWithOpenRouter", () => {
  it("returns success for valid receipt JSON", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      createOpenRouterResponse(
        JSON.stringify({
          merchant: "Circle K",
          date: "12/04/2026",
          total: 85000,
          category: "Food",
        })
      )
    );

    await expect(
      scanReceiptWithOpenRouter({ imageBase64: IMAGE, apiKey: "k", fetchFn })
    ).resolves.toEqual({
      status: "success",
      receipt: {
        merchant: "Circle K",
        date: "12/04/2026",
        total: 85000,
        category: Category.FOOD,
      },
    });
  });

  it("sends a multimodal message containing the image url", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      createOpenRouterResponse(
        JSON.stringify({ date: "12/04/2026", total: 1000, category: "Food" })
      )
    );

    await scanReceiptWithOpenRouter({ imageBase64: IMAGE, apiKey: "k", fetchFn });

    const body = JSON.parse((fetchFn.mock.calls[0][1] as RequestInit).body as string);
    const userMessage = body.messages.find(
      (m: { role: string }) => m.role === "user"
    );
    expect(Array.isArray(userMessage.content)).toBe(true);
    expect(userMessage.content).toContainEqual({
      type: "image_url",
      image_url: { url: IMAGE },
    });
  });

  it("defaults an unreadable date to today (DD/MM/YYYY)", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      createOpenRouterResponse(
        JSON.stringify({ date: "garbage", total: 1000, category: "Food" })
      )
    );

    const result = await scanReceiptWithOpenRouter({
      imageBase64: IMAGE,
      apiKey: "k",
      fetchFn,
    });

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.receipt.date).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    }
  });

  it("returns schema_mismatch fallback when total is missing or <= 0", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      createOpenRouterResponse(
        JSON.stringify({ date: "12/04/2026", total: 0, category: "Food" })
      )
    );

    await expect(
      scanReceiptWithOpenRouter({ imageBase64: IMAGE, apiKey: "k", fetchFn })
    ).resolves.toEqual({
      status: "fallback",
      reason: "schema_mismatch",
      prefill: {},
    });
  });

  it("returns invalid_json fallback when content is not JSON", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(createOpenRouterResponse("no json here"));

    const result = await scanReceiptWithOpenRouter({
      imageBase64: IMAGE,
      apiKey: "k",
      fetchFn,
    });
    expect(result).toEqual({ status: "fallback", reason: "invalid_json", prefill: {} });
  });

  it("returns empty_response fallback when content is empty", async () => {
    const fetchFn = vi.fn().mockResolvedValue(createOpenRouterResponse(""));

    const result = await scanReceiptWithOpenRouter({
      imageBase64: IMAGE,
      apiKey: "k",
      fetchFn,
    });
    expect(result).toEqual({ status: "fallback", reason: "empty_response", prefill: {} });
  });

  it("returns request_failed fallback when fetch rejects", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("network"));

    const result = await scanReceiptWithOpenRouter({
      imageBase64: IMAGE,
      apiKey: "k",
      fetchFn,
    });
    expect(result).toEqual({ status: "fallback", reason: "request_failed", prefill: {} });
  });

  it("returns request_failed fallback when response not ok", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(createOpenRouterResponse("{}", false));

    const result = await scanReceiptWithOpenRouter({
      imageBase64: IMAGE,
      apiKey: "k",
      fetchFn,
    });
    expect(result).toEqual({ status: "fallback", reason: "request_failed", prefill: {} });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `rtk bunx vitest run src/lib/ai/scan-receipt.test.ts`
Expected: FAIL — `scanReceiptWithOpenRouter` is not defined / module not found.

- [ ] **Step 3: Write the service implementation**

```ts
import dayjs from "@/configs/date";
import { Category } from "@/enums";

import type {
  ScanReceiptFallbackResponse,
  ScanReceiptResponse,
} from "./scan-receipt-contract";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "nvidia/nemotron-nano-12b-v2-vl:free";
const CATEGORY_VALUES = Object.values(Category);
const DATE_PATTERN = /^\d{2}\/\d{2}\/\d{4}$/;

type FallbackReason = ScanReceiptFallbackResponse["reason"];

const SYSTEM_PROMPT = `
You read a single store receipt from an image and extract one expense summary.

Rules:
- Return only one JSON object, no prose.
- Output fields: merchant, date, total, category.
- merchant is the store name as a short string (may be empty if unknown).
- date must be DD/MM/YYYY (the receipt's purchase date).
- total must be the receipt grand total as a positive number, no currency symbols or separators.
- category must be exactly one of: ${CATEGORY_VALUES.join(", ")}.
`.trim();

const USER_PROMPT = "Extract the expense summary from this receipt image.";

const readContent = (content: unknown) =>
  typeof content === "string" ? content.trim() : null;

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
    CATEGORY_VALUES.find((category) => category.toLowerCase() === normalized) ??
    null
  );
};

const normalizeDate = (value: unknown) => {
  const raw = String(value ?? "").trim();
  if (DATE_PATTERN.test(raw) && dayjs(raw, "DD/MM/YYYY", true).isValid()) {
    return raw;
  }
  return dayjs().format("DD/MM/YYYY");
};

const fallback = (reason: FallbackReason): ScanReceiptResponse => ({
  status: "fallback",
  reason,
  prefill: {},
});

type ScanReceiptArgs = {
  imageBase64: string;
  apiKey: string;
  fetchFn?: typeof fetch;
};

export const scanReceiptWithOpenRouter = async ({
  imageBase64,
  apiKey,
  fetchFn = fetch,
}: ScanReceiptArgs): Promise<ScanReceiptResponse> => {
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
          {
            role: "user",
            content: [
              { type: "text", text: USER_PROMPT },
              { type: "image_url", image_url: { url: imageBase64 } },
            ],
          },
        ],
      }),
    });
  } catch {
    return fallback("request_failed");
  }

  if (!response.ok) {
    return fallback("request_failed");
  }

  let payload: { choices?: Array<{ message?: { content?: unknown } }> };
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    return fallback("request_failed");
  }

  const content = readContent(payload.choices?.[0]?.message?.content);
  if (!content) {
    return fallback("empty_response");
  }

  const jsonBlock = extractJsonObject(content);
  if (!jsonBlock) {
    return fallback("invalid_json");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonBlock);
  } catch {
    return fallback("invalid_json");
  }

  const receipt = parsed as {
    merchant?: unknown;
    date?: unknown;
    total?: unknown;
    category?: unknown;
  };

  const category = normalizeCategory(receipt.category);
  const total = Number(receipt.total);
  const merchant = String(receipt.merchant ?? "").trim();

  if (!category || !Number.isFinite(total) || total <= 0) {
    return fallback("schema_mismatch");
  }

  return {
    status: "success",
    receipt: {
      merchant: merchant.length > 0 ? merchant : undefined,
      date: normalizeDate(receipt.date),
      total,
      category,
    },
  };
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `rtk bunx vitest run src/lib/ai/scan-receipt.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Format + lint**

Run: `rtk bunx prettier --write src/lib/ai/scan-receipt.ts src/lib/ai/scan-receipt.test.ts && rtk bunx eslint src/lib/ai/scan-receipt.ts src/lib/ai/scan-receipt.test.ts`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/scan-receipt.ts src/lib/ai/scan-receipt.test.ts
git commit -m "feat(ai): add receipt OCR service with graceful fallback"
```

---

## Task 3: Route handler (TDD)

**Files:**
- Create: `src/app/api/ai/scan-receipt/route.test.ts`
- Create: `src/app/api/ai/scan-receipt/route.ts`

Mirrors `src/app/api/ai/parse-expense/route.ts`. Validation: invalid body → 400 `INVALID_PAYLOAD`; missing key → 500; otherwise return the service result via `apiSuccess` (status 200, including fallback bodies).

- [ ] **Step 1: Write the failing tests**

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const { scanReceiptWithOpenRouter } = vi.hoisted(() => ({
  scanReceiptWithOpenRouter: vi.fn(),
}));

vi.mock("@/lib/ai/scan-receipt", () => ({ scanReceiptWithOpenRouter }));

const request = (body: unknown) =>
  new Request("http://localhost/api/ai/scan-receipt", {
    method: "POST",
    body: JSON.stringify(body),
  });

describe("POST /api/ai/scan-receipt", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    scanReceiptWithOpenRouter.mockReset();
    delete process.env.OPENROUTER_API_KEY;
  });

  it("returns 400 when imageBase64 is missing", async () => {
    const response = await POST(request({}));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: { code: "INVALID_PAYLOAD", message: "Invalid payload" },
    });
  });

  it("returns 400 when imageBase64 is not a non-empty string", async () => {
    const response = await POST(request({ imageBase64: "" }));
    expect(response.status).toBe(400);
  });

  it("returns 500 when OPENROUTER_API_KEY is missing", async () => {
    const response = await POST(request({ imageBase64: "data:image/jpeg;base64,AAAA" }));
    expect(response.status).toBe(500);
  });

  it("returns 200 with the service result when valid", async () => {
    process.env.OPENROUTER_API_KEY = "k";
    scanReceiptWithOpenRouter.mockResolvedValue({
      status: "success",
      receipt: { merchant: "Shop", date: "12/04/2026", total: 1000, category: "Food" },
    });

    const response = await POST(request({ imageBase64: "data:image/jpeg;base64,AAAA" }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        status: "success",
        receipt: { merchant: "Shop", date: "12/04/2026", total: 1000, category: "Food" },
      },
    });
    expect(scanReceiptWithOpenRouter).toHaveBeenCalledWith({
      imageBase64: "data:image/jpeg;base64,AAAA",
      apiKey: "k",
    });
  });

  it("returns 200 with a fallback body unchanged", async () => {
    process.env.OPENROUTER_API_KEY = "k";
    scanReceiptWithOpenRouter.mockResolvedValue({
      status: "fallback",
      reason: "request_failed",
      prefill: {},
    });

    const response = await POST(request({ imageBase64: "data:image/jpeg;base64,AAAA" }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { status: "fallback", reason: "request_failed", prefill: {} },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `rtk bunx vitest run src/app/api/ai/scan-receipt/route.test.ts`
Expected: FAIL — module `./route` not found.

- [ ] **Step 3: Write the route handler**

```ts
import { scanReceiptWithOpenRouter } from "@/lib/ai/scan-receipt";
import type { ScanReceiptRequest } from "@/lib/ai/scan-receipt-contract";
import { apiError, apiSuccess } from "@/lib/api/route-response";

const invalidPayloadResponse = () =>
  apiError("INVALID_PAYLOAD", "Invalid payload", 400);

const readImage = (payload: unknown) => {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const image = (payload as Partial<ScanReceiptRequest>).imageBase64;
  if (typeof image !== "string") {
    return null;
  }
  const trimmed = image.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const POST = async (request: Request) => {
  try {
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return invalidPayloadResponse();
    }

    const imageBase64 = readImage(payload);
    if (!imageBase64) {
      return invalidPayloadResponse();
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return apiError("SCAN_RECEIPT_FAILED", "Missing OPENROUTER_API_KEY", 500);
    }

    const result = await scanReceiptWithOpenRouter({ imageBase64, apiKey });
    return apiSuccess(result);
  } catch (error) {
    console.error("Failed to scan receipt with OpenRouter:", error);
    return apiError("SCAN_RECEIPT_FAILED", "Failed to scan receipt", 500);
  }
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `rtk bunx vitest run src/app/api/ai/scan-receipt/route.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Format + lint**

Run: `rtk bunx prettier --write src/app/api/ai/scan-receipt/route.ts src/app/api/ai/scan-receipt/route.test.ts && rtk bunx eslint src/app/api/ai/scan-receipt/route.ts src/app/api/ai/scan-receipt/route.test.ts`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/app/api/ai/scan-receipt/route.ts src/app/api/ai/scan-receipt/route.test.ts
git commit -m "feat(ai): add scan-receipt route handler"
```

---

## Task 4: Extend prefill payload + quick-add source (TDD)

**Files:**
- Modify: `src/lib/expense-prefill.ts`
- Modify: `src/lib/quick-add-mode.ts`
- Create: `src/lib/expense-prefill.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from "vitest";

import {
  EXPENSE_PREFILL_EVENT,
  dispatchExpensePrefill,
  type ExpensePrefillPayload,
} from "./expense-prefill";

describe("dispatchExpensePrefill", () => {
  it("dispatches an event carrying the optional date and receipt_scan source", () => {
    const handler = vi.fn();
    window.addEventListener(EXPENSE_PREFILL_EVENT, handler);

    const payload: ExpensePrefillPayload = {
      amount: 85000,
      note: "Circle K",
      category: "Food",
      date: "12/04/2026",
      source: "receipt_scan",
    };
    dispatchExpensePrefill(payload);

    window.removeEventListener(EXPENSE_PREFILL_EVENT, handler);
    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0][0] as CustomEvent<ExpensePrefillPayload>;
    expect(event.detail).toEqual(payload);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk bunx vitest run src/lib/expense-prefill.test.ts`
Expected: FAIL — type error / `"receipt_scan"` not assignable to `QuickAddSource`, or `date` not on payload.

- [ ] **Step 3: Add `receipt_scan` to `QuickAddSource`**

In `src/lib/quick-add-mode.ts`, change the type and the constant:

```ts
export type QuickAddSource = "manual" | "repeat_entry" | "receipt_scan";

const QUICK_ADD_SOURCES: readonly QuickAddSource[] = [
  "manual",
  "repeat_entry",
  "receipt_scan",
];
```

- [ ] **Step 4: Add optional `date` to `ExpensePrefillPayload`**

In `src/lib/expense-prefill.ts`, update the type only (leave `dispatchExpensePrefill` as-is):

```ts
export type ExpensePrefillPayload = {
  amount: number;
  note: string;
  category: string;
  date?: string;
  source?: QuickAddSource;
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `rtk bunx vitest run src/lib/expense-prefill.test.ts`
Expected: PASS (1 test).

- [ ] **Step 6: Format + lint**

Run: `rtk bunx prettier --write src/lib/expense-prefill.ts src/lib/quick-add-mode.ts src/lib/expense-prefill.test.ts && rtk bunx eslint src/lib/expense-prefill.ts src/lib/quick-add-mode.ts src/lib/expense-prefill.test.ts`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/lib/expense-prefill.ts src/lib/quick-add-mode.ts src/lib/expense-prefill.test.ts
git commit -m "feat(expense): support date and receipt_scan source in prefill payload"
```

---

## Task 5: Apply prefilled date in QuickExpenseDrawer (TDD)

**Files:**
- Modify: `src/components/QuickExpenseDrawer.tsx:612-640` (the `EXPENSE_PREFILL_EVENT` handler)
- Modify: `src/components/QuickExpenseDrawer.test.tsx` (add one test)

The handler currently sets `amount`, `note`, `category`. Add: when `detail.date` is present, set `date` via the existing `formatDraftDate` normalization.

- [ ] **Step 1: Add a failing test**

Append this test inside the existing top-level `describe` in `src/components/QuickExpenseDrawer.test.tsx`. (Reuse the file's existing render helper/imports; this test dispatches the prefill event and asserts the date control reflects the receipt date. Match the existing tests' rendering approach in that file.)

```ts
it("applies a prefilled date from the expense-prefill event", async () => {
  // Render the create-mode drawer the same way other tests in this file do.
  renderQuickExpenseDrawer();

  act(() => {
    window.dispatchEvent(
      new CustomEvent("expense-prefill", {
        detail: {
          amount: 85000,
          note: "Circle K",
          category: "Food",
          date: "02/01/2026",
          source: "receipt_scan",
        },
      })
    );
  });

  // The date button label shows DD/MM for non-today dates (see formatDateLabel).
  expect(await screen.findByRole("button", { name: /Date: 02\/01/ })).toBeInTheDocument();
});
```

> Note: `renderQuickExpenseDrawer`, `act`, and `screen` should match the helpers/imports already used in `QuickExpenseDrawer.test.tsx`. If the file uses a different render helper name, use that one. Do not introduce a new rendering pattern.

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk bunx vitest run src/components/QuickExpenseDrawer.test.tsx -t "applies a prefilled date"`
Expected: FAIL — date label still shows "Today" because the handler ignores `detail.date`.

- [ ] **Step 3: Update the prefill handler**

In `src/components/QuickExpenseDrawer.tsx`, inside the `handle` callback registered for `EXPENSE_PREFILL_EVENT` (around line 616-637), extend the `setDraft` updater to apply the date when provided:

```ts
setDraft((prev) => {
  const nextDraft = {
    ...prev,
    amount: detail.amount,
    note: detail.note,
    category: detail.category
      ? normalizeCategory(detail.category)
      : prev.category,
    date: detail.date ? formatDraftDate(detail.date) : prev.date,
  };
  resetSuggestionTracking(nextDraft, "none");
  return nextDraft;
});
```

(`formatDraftDate` is already defined in this file and accepts `DD/MM/YYYY` or `YYYY-MM-DD`.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `rtk bunx vitest run src/components/QuickExpenseDrawer.test.tsx`
Expected: PASS (existing tests + the new one).

- [ ] **Step 5: Format + lint**

Run: `rtk bunx prettier --write src/components/QuickExpenseDrawer.tsx src/components/QuickExpenseDrawer.test.tsx && rtk bunx eslint src/components/QuickExpenseDrawer.tsx src/components/QuickExpenseDrawer.test.tsx`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/components/QuickExpenseDrawer.tsx src/components/QuickExpenseDrawer.test.tsx
git commit -m "feat(expense): apply prefilled date in QuickExpenseDrawer"
```

---

## Task 6: Image compression util (TDD)

**Files:**
- Create: `src/lib/image/compress-image.ts`
- Create: `src/lib/image/compress-image.test.ts`

Isolating compression in its own module keeps `ReceiptScanDrawer` testable (the component mocks this module). The util resizes the longest edge to ≤ `maxEdge` and exports JPEG. It depends on the DOM `Image`/`canvas`, so the test mocks those minimally and asserts the contract (returns a `data:image/jpeg` string, respects sizing call).

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

import { compressImage } from "./compress-image";

describe("compressImage", () => {
  afterEach(() => vi.restoreAllMocks());

  it("resizes the longest edge to <= maxEdge and returns a jpeg data url", async () => {
    const drawImage = vi.fn();
    const toDataURL = vi.fn().mockReturnValue("data:image/jpeg;base64,ZZZZ");
    const getContext = vi.fn().mockReturnValue({ drawImage });
    const canvas = { width: 0, height: 0, getContext, toDataURL } as unknown as HTMLCanvasElement;

    vi.spyOn(document, "createElement").mockImplementation(((tag: string) =>
      tag === "canvas" ? canvas : ({} as HTMLElement)) as typeof document.createElement);

    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    // Stub Image so onload fires immediately with a wide source (2000x1000).
    class FakeImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      width = 2000;
      height = 1000;
      set src(_v: string) {
        this.onload?.();
      }
    }
    vi.stubGlobal("Image", FakeImage as unknown as typeof Image);

    const file = new File(["x"], "r.jpg", { type: "image/jpeg" });
    const result = await compressImage(file, { maxEdge: 1280, quality: 0.7 });

    expect(result).toBe("data:image/jpeg;base64,ZZZZ");
    expect(canvas.width).toBe(1280);
    expect(canvas.height).toBe(640);
    expect(toDataURL).toHaveBeenCalledWith("image/jpeg", 0.7);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk bunx vitest run src/lib/image/compress-image.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the util**

```ts
export type CompressImageOptions = {
  maxEdge: number;
  quality: number;
};

export const compressImage = (
  file: File,
  { maxEdge, quality }: CompressImageOptions
): Promise<string> =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const longest = Math.max(image.width, image.height) || 1;
      const scale = longest > maxEdge ? maxEdge / longest : 1;
      const width = Math.round(image.width * scale);
      const height = Math.round(image.height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Canvas 2d context unavailable"));
        return;
      }

      context.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image"));
    };

    image.src = objectUrl;
  });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk bunx vitest run src/lib/image/compress-image.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Format + lint**

Run: `rtk bunx prettier --write src/lib/image/compress-image.ts src/lib/image/compress-image.test.ts && rtk bunx eslint src/lib/image/compress-image.ts src/lib/image/compress-image.test.ts`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/lib/image/compress-image.ts src/lib/image/compress-image.test.ts
git commit -m "feat(image): add canvas image-compression util"
```

---

## Task 7: ReceiptScanDrawer component (TDD)

**Files:**
- Create: `src/components/ReceiptScanDrawer.tsx`
- Create: `src/components/ReceiptScanDrawer.test.tsx`

Controlled drawer (`open` / `onOpenChange`). UI: a capture button that opens a hidden file input (`accept="image/*" capture="environment"`); on file selection it compresses, POSTs to `/api/ai/scan-receipt`, shows progress, and on a result dispatches `dispatchExpensePrefill` then closes. On error shows a retry. The component mocks `compressImage` and `fetch` in tests.

Mapping result → prefill:
- success → `{ amount: receipt.total, note: receipt.merchant ?? "", category: receipt.category, date: receipt.date, source: "receipt_scan" }`
- fallback → `{ amount: prefill.amount ?? 0, note: prefill.note ?? "", category: Category.OTHER, source: "receipt_scan" }` (drawer opens for manual completion; OTHER is a neutral default)

- [ ] **Step 1: Write the failing tests**

```tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { Category } from "@/enums";

import ReceiptScanDrawer from "./ReceiptScanDrawer";

vi.mock("@/lib/image/compress-image", () => ({
  compressImage: vi.fn().mockResolvedValue("data:image/jpeg;base64,ZZZZ"),
}));

const { dispatchExpensePrefill } = vi.hoisted(() => ({
  dispatchExpensePrefill: vi.fn(),
}));
vi.mock("@/lib/expense-prefill", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/expense-prefill")>();
  return { ...actual, dispatchExpensePrefill };
});

const selectFile = () => {
  fireEvent.click(screen.getByRole("button", { name: /take photo|choose|scan/i }));
  const input = screen.getByTestId("receipt-file-input") as HTMLInputElement;
  const file = new File(["x"], "receipt.jpg", { type: "image/jpeg" });
  fireEvent.change(input, { target: { files: [file] } });
};

const okJson = (data: unknown) =>
  ({ ok: true, status: 200, json: vi.fn().mockResolvedValue({ success: true, data }) }) as unknown as Response;

describe("ReceiptScanDrawer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    dispatchExpensePrefill.mockReset();
  });

  it("dispatches a mapped prefill on OCR success and closes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        okJson({
          status: "success",
          receipt: { merchant: "Circle K", date: "12/04/2026", total: 85000, category: "Food" },
        })
      )
    );
    const onOpenChange = vi.fn();

    render(<ReceiptScanDrawer open onOpenChange={onOpenChange} />);
    selectFile();

    await waitFor(() =>
      expect(dispatchExpensePrefill).toHaveBeenCalledWith({
        amount: 85000,
        note: "Circle K",
        category: Category.FOOD,
        date: "12/04/2026",
        source: "receipt_scan",
      })
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("dispatches a salvaged prefill on fallback and closes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        okJson({ status: "fallback", reason: "schema_mismatch", prefill: {} })
      )
    );
    const onOpenChange = vi.fn();

    render(<ReceiptScanDrawer open onOpenChange={onOpenChange} />);
    selectFile();

    await waitFor(() =>
      expect(dispatchExpensePrefill).toHaveBeenCalledWith({
        amount: 0,
        note: "",
        category: Category.OTHER,
        source: "receipt_scan",
      })
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows a retry affordance when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    render(<ReceiptScanDrawer open onOpenChange={vi.fn()} />);
    selectFile();

    expect(await screen.findByRole("button", { name: /try again|retry/i })).toBeInTheDocument();
    expect(dispatchExpensePrefill).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `rtk bunx vitest run src/components/ReceiptScanDrawer.test.tsx`
Expected: FAIL — module `./ReceiptScanDrawer` not found.

- [ ] **Step 3: Write the component**

```tsx
"use client";

import { useRef, useState } from "react";

import { Category } from "@/enums";
import { useAppHaptics } from "@/hooks/useAppHaptics";
import type { ScanReceiptResponse } from "@/lib/ai/scan-receipt-contract";
import { unwrapApiResponse } from "@/lib/api/api-response";
import { dispatchExpensePrefill } from "@/lib/expense-prefill";
import { compressImage } from "@/lib/image/compress-image";
import { Camera, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

import PixelLoader from "./ui/pixel-loader/PixelLoader";

type ScanStatus = "idle" | "scanning" | "error";

export type ReceiptScanDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const mapResultToPrefill = (result: ScanReceiptResponse) => {
  if (result.status === "success") {
    return {
      amount: result.receipt.total,
      note: result.receipt.merchant ?? "",
      category: result.receipt.category,
      date: result.receipt.date,
      source: "receipt_scan" as const,
    };
  }
  return {
    amount: result.prefill.amount ?? 0,
    note: result.prefill.note ?? "",
    category: Category.OTHER,
    source: "receipt_scan" as const,
  };
};

const ReceiptScanDrawer = ({ open, onOpenChange }: ReceiptScanDrawerProps) => {
  const [status, setStatus] = useState<ScanStatus>("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const haptics = useAppHaptics();

  const runScan = async (file: File) => {
    setStatus("scanning");
    try {
      const imageBase64 = await compressImage(file, { maxEdge: 1280, quality: 0.7 });
      const response = await fetch("/api/ai/scan-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64 }),
      });
      const result = unwrapApiResponse<ScanReceiptResponse>(
        await response.json(),
        response.status
      );

      if (result.status === "success") {
        haptics.success();
      } else {
        haptics.warning();
      }

      dispatchExpensePrefill(mapResultToPrefill(result));
      setStatus("idle");
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to scan receipt", error);
      haptics.error();
      setStatus("error");
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) {
      void runScan(file);
    }
  };

  const openPicker = () => fileInputRef.current?.click();

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" modal>
      <DrawerContent className="gap-0">
        <DrawerHeader className="text-left">
          <DrawerTitle>Scan a receipt</DrawerTitle>
          <DrawerDescription>
            Take a photo and we will draft an expense you can review.
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex flex-col items-center gap-4 px-4 pb-8">
          <input
            ref={fileInputRef}
            data-testid="receipt-file-input"
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />

          {status === "scanning" ? (
            <div className="text-muted-foreground inline-flex items-center gap-2.5 py-8 text-sm">
              <PixelLoader size="sm" pattern="wave" label="Reading the receipt" />
              Reading the receipt...
            </div>
          ) : status === "error" ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-foreground text-[15px] font-medium">
                I could not read that receipt.
              </p>
              <p className="text-muted-foreground text-sm">
                Try another photo or add it manually.
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-1.5 rounded-full"
                onClick={openPicker}
              >
                <RefreshCw className="size-3.5" />
                Try again
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              size="lg"
              className="gap-2 rounded-full"
              onClick={openPicker}
            >
              <Camera className="size-5" />
              Take photo
            </Button>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default ReceiptScanDrawer;
```

> If `unwrapApiResponse` throws on non-2xx bodies (it parses `{ error }`), the surrounding `try/catch` already routes that to the error state, which is the intended behavior.

- [ ] **Step 4: Run tests to verify they pass**

Run: `rtk bunx vitest run src/components/ReceiptScanDrawer.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Format + lint**

Run: `rtk bunx prettier --write src/components/ReceiptScanDrawer.tsx src/components/ReceiptScanDrawer.test.tsx && rtk bunx eslint src/components/ReceiptScanDrawer.tsx src/components/ReceiptScanDrawer.test.tsx`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/components/ReceiptScanDrawer.tsx src/components/ReceiptScanDrawer.test.tsx
git commit -m "feat(ai): add ReceiptScanDrawer capture + OCR flow"
```

---

## Task 8: Wire the scan button into BottomNav (TDD)

**Files:**
- Modify: `src/components/BottomNav.tsx`
- Modify: `src/components/BottomNav.test.tsx`

Add a scan button in the right-side cluster, immediately before the QuickExpense FAB, and mount `ReceiptScanDrawer` controlled by local `scanOpen` state. The scan button is hidden on the same `hiddenPaths` as the rest of the nav (the early `return null` already covers this since the whole nav unmounts).

- [ ] **Step 1: Add a failing test**

Append to `src/components/BottomNav.test.tsx`, matching the file's existing render setup (router mocks, providers):

```tsx
it("renders a scan-receipt button and opens the scan drawer", async () => {
  renderBottomNav("/"); // use the file's existing helper / path argument convention

  const scanButton = screen.getByRole("button", { name: /scan receipt/i });
  expect(scanButton).toBeInTheDocument();

  fireEvent.click(scanButton);

  expect(await screen.findByText(/scan a receipt/i)).toBeInTheDocument();
});
```

> Use the same render helper, imports (`fireEvent`, `screen`), and provider wrappers already present in `BottomNav.test.tsx`. Do not introduce a new rendering pattern.

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk bunx vitest run src/components/BottomNav.test.tsx -t "scan-receipt button"`
Expected: FAIL — no button named "scan receipt".

- [ ] **Step 3: Import and add state**

In `src/components/BottomNav.tsx`:

Add imports near the existing ones:

```tsx
import { BarChart3, ChevronsUpDown, Cog, Home, ScanLine, Wallet } from "lucide-react";

import ReceiptScanDrawer from "@/components/ReceiptScanDrawer";
```

Inside the component, add state next to the other `useState` hooks:

```tsx
const [scanOpen, setScanOpen] = useState(false);
```

- [ ] **Step 4: Render the scan button + drawer**

Replace the closing right-side FAB wrapper (the `<div className="grid size-14 ...">...</div>` block around lines 248-253) so the scan button sits just before it, and mount the drawer. Wrap both controls in a flex cluster:

```tsx
        <div className="flex items-end gap-3">
          <button
            type="button"
            aria-label="Scan receipt"
            onClick={() => {
              haptics.impact("light");
              setScanOpen(true);
            }}
            className="grid size-14 shrink-0 place-items-center rounded-full bg-[linear-gradient(180deg,color-mix(in_srgb,#ffffff_9%,transparent),color-mix(in_srgb,#ffffff_2%,transparent)),color-mix(in_srgb,var(--surface-3)_78%,transparent)] text-foreground shadow-[inset_0_1px_0_color-mix(in_srgb,#ffffff_20%,transparent),0_20px_46px_color-mix(in_srgb,#000000_58%,transparent)] backdrop-blur-2xl transition-transform active:scale-[0.96]"
          >
            <ScanLine className="size-6" />
          </button>

          <div className="grid size-14 shrink-0 place-items-center rounded-full bg-[linear-gradient(180deg,color-mix(in_srgb,#ffffff_9%,transparent),color-mix(in_srgb,#ffffff_2%,transparent)),color-mix(in_srgb,var(--surface-3)_78%,transparent)] p-1 shadow-[inset_0_1px_0_color-mix(in_srgb,#ffffff_20%,transparent),0_20px_46px_color-mix(in_srgb,#000000_58%,transparent)] backdrop-blur-2xl [&_[data-slot=button]]:size-14 [&_[data-slot=button]]:rounded-full [&_[data-slot=button]:active>span]:scale-[0.96] [&_[data-slot=button]>span]:transition-transform [&_[data-slot=button]>span]:duration-200 [&_[data-slot=button]>span]:ease-out">
            <QuickExpenseDrawer
              compact
              onTriggerClick={() => haptics.impact("medium")}
            />
          </div>
        </div>
```

Then, just before the closing `</div>` of the outer `max-w-[390px]` container (or as a sibling after `</nav>`-internal content — place it inside the `nav` root so it unmounts with the nav), mount the drawer:

```tsx
        <ReceiptScanDrawer open={scanOpen} onOpenChange={setScanOpen} />
```

> Placement detail: keep `<ReceiptScanDrawer />` inside the `<nav>` tree so the existing `hiddenPaths` early-return unmounts it on `/ai`. The scan button and FAB cluster replace the previous standalone FAB wrapper; the left nav pill block is unchanged.

- [ ] **Step 5: Run tests to verify they pass**

Run: `rtk bunx vitest run src/components/BottomNav.test.tsx`
Expected: PASS (existing tests + new one).

- [ ] **Step 6: Format + lint**

Run: `rtk bunx prettier --write src/components/BottomNav.tsx src/components/BottomNav.test.tsx && rtk bunx eslint src/components/BottomNav.tsx src/components/BottomNav.test.tsx`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/components/BottomNav.tsx src/components/BottomNav.test.tsx
git commit -m "feat(nav): add scan-receipt button before the quick-expense trigger"
```

---

## Task 9: Full verification + build

- [ ] **Step 1: Run the full affected test scope**

Run: `rtk bunx vitest run src/lib/ai src/app/api/ai/scan-receipt src/lib/image src/lib/expense-prefill.test.ts src/components/ReceiptScanDrawer.test.tsx src/components/QuickExpenseDrawer.test.tsx src/components/BottomNav.test.tsx`
Expected: all PASS.

- [ ] **Step 2: Lint the full changed scope**

Run: `rtk bunx eslint src/lib/ai/scan-receipt.ts src/lib/ai/scan-receipt-contract.ts src/app/api/ai/scan-receipt/route.ts src/lib/image/compress-image.ts src/lib/expense-prefill.ts src/lib/quick-add-mode.ts src/components/ReceiptScanDrawer.tsx src/components/QuickExpenseDrawer.tsx src/components/BottomNav.tsx`
Expected: no errors.

- [ ] **Step 3: Production build (required before pushing, per AGENTS.md)**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual smoke (dev server)**

Run: `bun run dev`, open the app on a mobile viewport, tap the scan button, choose a receipt photo, confirm the QuickExpenseDrawer opens prefilled with merchant/total/category/date, and save.

- [ ] **Step 5: Commit any fixups, then open a PR**

```bash
git push -u origin dev-receipt-ocr-scan
```

Open a PR from `dev-receipt-ocr-scan` into `main`.

---

## Notes for the implementer

- **Provider env:** the route reads `OPENROUTER_API_KEY` (already present in `.env.local`). No new env var.
- **Why no `callOpenRouterJson`:** free vision models can't be trusted to honor `response_format: json_schema`; the manual-extraction + fallback path is intentional and matches `parse-expense.ts`.
- **Why prefill instead of a confirm form:** `QuickExpenseDrawer` (mounted in `BottomNav`) already listens for `EXPENSE_PREFILL_EVENT` and owns review/edit/budget-suggestion/offline-sync. Receipt OCR is only a *producer* of that event.
- **`@/configs/date`** is the project's dayjs instance with the parsing plugins already configured — import dayjs from there, not from the `dayjs` package directly.
- **Test helpers:** Tasks 5 and 8 add tests to existing files — reuse those files' existing render helpers/imports rather than inventing new ones.
