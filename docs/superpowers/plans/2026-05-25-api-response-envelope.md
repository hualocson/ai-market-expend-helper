# API Response Envelope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate every non-internal app API route to a consistent `{ success, data | error, meta }` response envelope while preserving `/api/expenses/sync` batch semantics.

**Architecture:** Add shared domain-neutral API response types and browser-safe unwrapping helpers under `src/lib/api/*`, plus server-only `NextResponse` helpers for route handlers. Migrate non-internal route handlers at the API boundary, then update fetchers, mutation helpers, sync coordinator parsing, and tests to consume only the new envelope. Leave `/api/internal/*` untouched.

**Tech Stack:** Next.js App Router route handlers, TypeScript, Zod, TanStack Query fetchers, Vitest, React Testing Library where existing tests require it.

---

## File Structure

- Create `src/lib/api/api-response.ts`: browser-safe response types, body builders, type guards, `ApiResponseError`, and envelope unwrapping.
- Create `src/lib/api/api-response.test.ts`: unit tests for response body builders, type guards, and unwrapping behavior.
- Create `src/lib/api/route-response.ts`: server-only `NextResponse` helpers importing `next/server`.
- Create `src/lib/api/route-response.test.ts`: unit tests for the `NextResponse` helpers.
- Modify `src/lib/queries/http.ts`: unwrap `ApiResponse<T>` instead of returning raw JSON.
- Modify `src/lib/queries/budgets.ts`: replace custom raw response parsing with envelope-aware `fetchJson`.
- Modify `src/lib/queries/budget-weekly.ts`: unwrap the envelope before reading `budgets`.
- Modify `src/lib/mutations/index.ts`: unwrap mutation success payloads and parse structured error payloads.
- Modify `src/lib/sync/expenses/coordinator.ts`: unwrap sync API envelopes while preserving per-operation failure results.
- Modify non-internal route files under `src/app/api/**/route.ts`; do not modify `src/app/api/internal/**/route.ts`.
- Modify `src/app/api/read-routes.test.ts`, `src/app/api/mutation-routes.test.ts`, and `src/app/api/ai/parse-expense/route.test.ts`.
- Modify fetcher and client tests under `src/lib/queries/*.test.ts`, `src/lib/mutations/index.test.tsx`, `src/components/AIInput.test.tsx`, and `src/components/AIExpenseChat.test.tsx`.

Before every commit, run `rtk git status --short` and stage only files touched by that task. This branch may contain unrelated user or prior-agent changes.

---

### Task 1: Shared API Envelope Primitives

**Files:**
- Create: `src/lib/api/api-response.ts`
- Create: `src/lib/api/api-response.test.ts`
- Create: `src/lib/api/route-response.ts`
- Create: `src/lib/api/route-response.test.ts`

- [ ] **Step 1: Write failing tests for shared response helpers**

Create `src/lib/api/api-response.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  ApiResponseError,
  apiErrorBody,
  apiSuccessBody,
  isApiResponse,
  unwrapApiResponse,
} from "./api-response";

describe("api response envelope", () => {
  it("builds success bodies with optional meta", () => {
    expect(apiSuccessBody({ id: 1 }, { page: 1, hasNextPage: false })).toEqual({
      success: true,
      data: { id: 1 },
      meta: { page: 1, hasNextPage: false },
    });
  });

  it("builds error bodies with optional details", () => {
    expect(apiErrorBody("INVALID_PAYLOAD", "Invalid payload", { path: "date" }))
      .toEqual({
        success: false,
        error: {
          code: "INVALID_PAYLOAD",
          message: "Invalid payload",
          details: { path: "date" },
        },
      });
  });

  it("recognizes success and error envelope payloads", () => {
    expect(isApiResponse({ success: true, data: [] })).toBe(true);
    expect(
      isApiResponse({
        success: false,
        error: { code: "INVALID_PAYLOAD", message: "Invalid payload" },
      })
    ).toBe(true);
    expect(isApiResponse({ error: "Invalid payload" })).toBe(false);
  });

  it("unwraps success data", () => {
    expect(unwrapApiResponse({ success: true, data: { id: 1 } }, 200)).toEqual({
      id: 1,
    });
  });

  it("throws ApiResponseError for structured error envelopes", () => {
    expect(() =>
      unwrapApiResponse(
        {
          success: false,
          error: {
            code: "INVALID_PAYLOAD",
            message: "Invalid payload",
            details: { field: "amount" },
          },
        },
        400
      )
    ).toThrow(ApiResponseError);

    try {
      unwrapApiResponse(
        {
          success: false,
          error: {
            code: "INVALID_PAYLOAD",
            message: "Invalid payload",
            details: { field: "amount" },
          },
        },
        400
      );
    } catch (error) {
      expect(error).toBeInstanceOf(ApiResponseError);
      expect(error).toMatchObject({
        code: "INVALID_PAYLOAD",
        message: "Invalid payload",
        details: { field: "amount" },
        status: 400,
      });
    }
  });

  it("throws a request error for non-envelope payloads", () => {
    expect(() => unwrapApiResponse({ error: "legacy" }, 500)).toThrow(
      "Invalid API response"
    );
  });
});
```

Create `src/lib/api/route-response.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { apiError, apiSuccess } from "./route-response";

describe("route response helpers", () => {
  it("returns a NextResponse success envelope", async () => {
    const response = apiSuccess({ id: 1 }, { status: 201 }, { total: 1 });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { id: 1 },
      meta: { total: 1 },
    });
  });

  it("returns a NextResponse error envelope", async () => {
    const response = apiError(
      "INVALID_PAYLOAD",
      "Invalid payload",
      400,
      { field: "date" }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: "INVALID_PAYLOAD",
        message: "Invalid payload",
        details: { field: "date" },
      },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
rtk bunx vitest run src/lib/api/api-response.test.ts src/lib/api/route-response.test.ts
```

Expected: FAIL because `src/lib/api/api-response.ts` and `src/lib/api/route-response.ts` do not exist.

- [ ] **Step 3: Implement shared response helpers**

Create `src/lib/api/api-response.ts`:

```ts
export type ApiResponse<T> = ApiSuccess<T> | ApiErrorResponse;

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: ApiMeta;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
  hasNextPage?: boolean;
}

export class ApiResponseError extends Error {
  readonly code: string;
  readonly details?: unknown;
  readonly status?: number;

  constructor(
    message: string,
    {
      code,
      details,
      status,
    }: {
      code: string;
      details?: unknown;
      status?: number;
    }
  ) {
    super(message);
    this.name = "ApiResponseError";
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

export const apiSuccessBody = <T>(
  data: T,
  meta?: ApiMeta
): ApiSuccess<T> => ({
  success: true,
  data,
  ...(meta ? { meta } : {}),
});

export const apiErrorBody = (
  code: string,
  message: string,
  details?: unknown
): ApiErrorResponse => ({
  success: false,
  error: {
    code,
    message,
    ...(typeof details === "undefined" ? {} : { details }),
  },
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isApiResponse = <T = unknown>(
  value: unknown
): value is ApiResponse<T> => {
  if (!isRecord(value) || typeof value.success !== "boolean") {
    return false;
  }

  if (value.success === true) {
    return "data" in value;
  }

  if (!isRecord(value.error)) {
    return false;
  }

  return (
    typeof value.error.code === "string" &&
    typeof value.error.message === "string"
  );
};

export const unwrapApiResponse = <T>(
  payload: unknown,
  status?: number
): T => {
  if (!isApiResponse<T>(payload)) {
    throw new ApiResponseError("Invalid API response", {
      code: "INVALID_API_RESPONSE",
      status,
      details: payload,
    });
  }

  if (payload.success) {
    return payload.data;
  }

  throw new ApiResponseError(payload.error.message, {
    code: payload.error.code,
    details: payload.error.details,
    status,
  });
};
```

Create `src/lib/api/route-response.ts`:

```ts
import { NextResponse } from "next/server";

import {
  type ApiMeta,
  type ApiResponse,
  apiErrorBody,
  apiSuccessBody,
} from "./api-response";

export const apiSuccess = <T>(
  data: T,
  init?: ResponseInit,
  meta?: ApiMeta
) => NextResponse.json<ApiResponse<T>>(apiSuccessBody(data, meta), init);

export const apiError = (
  code: string,
  message: string,
  status: number,
  details?: unknown
) =>
  NextResponse.json<ApiResponse<never>>(apiErrorBody(code, message, details), {
    status,
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
rtk bunx vitest run src/lib/api/api-response.test.ts src/lib/api/route-response.test.ts
```

Expected: PASS.

- [ ] **Step 5: Format and lint modified TypeScript files**

Run:

```bash
rtk bunx prettier --write src/lib/api/api-response.ts src/lib/api/api-response.test.ts src/lib/api/route-response.ts src/lib/api/route-response.test.ts
rtk bunx prettier --check src/lib/api/api-response.ts src/lib/api/api-response.test.ts src/lib/api/route-response.ts src/lib/api/route-response.test.ts
rtk bunx eslint src/lib/api/api-response.ts src/lib/api/api-response.test.ts src/lib/api/route-response.ts src/lib/api/route-response.test.ts
```

Expected: Prettier check passes and ESLint exits 0.

- [ ] **Step 6: Commit**

Run:

```bash
rtk git status --short
rtk git add src/lib/api/api-response.ts src/lib/api/api-response.test.ts src/lib/api/route-response.ts src/lib/api/route-response.test.ts
rtk git commit -m "feat: add api response envelope helpers"
```

Expected: commit succeeds and stages only Task 1 files.

---

### Task 2: Envelope-Aware Browser Fetch Helpers

**Files:**
- Modify: `src/lib/queries/http.ts`
- Modify: `src/lib/queries/budgets.ts`
- Modify: `src/lib/queries/budget-weekly.ts`
- Modify: `src/lib/mutations/index.ts`
- Modify: `src/lib/sync/expenses/coordinator.ts`
- Test: `src/lib/queries/read-fetchers.test.ts`
- Test: `src/lib/mutations/index.test.tsx`
- Test: `src/lib/sync/expenses/coordinator.test.ts`

- [ ] **Step 1: Update fetcher tests to expect envelope unwrapping**

In `src/lib/queries/read-fetchers.test.ts`, change server mock responses for network-backed query fetchers from raw payloads to success envelopes. For the first network fallback test, update this line:

```ts
.mockResolvedValue(mockJsonResponse(serverPage));
```

to:

```ts
.mockResolvedValue(mockJsonResponse({ success: true, data: serverPage }));
```

Add a new failure test near the other fetcher error tests:

```ts
it("throws the structured API error message from read fetchers", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    mockJsonResponse(
      {
        success: false,
        error: {
          code: "FETCH_BUDGETS_FAILED",
          message: "Failed to fetch budgets",
        },
      },
      { status: 400 }
    )
  );

  await expect(fetchBudgetOverview()).rejects.toThrow(
    "Failed to fetch budgets"
  );
});
```

In `src/lib/mutations/index.test.tsx`, update mocked mutation success responses from raw bodies to success envelopes. For example:

```ts
mockJsonResponse({ id: 8 }, { status: 201 })
```

becomes:

```ts
mockJsonResponse({ success: true, data: { id: 8 } }, { status: 201 })
```

Update error responses from:

```ts
mockJsonResponse({ error: "Insufficient source budget amount" }, { status: 400 })
```

to:

```ts
mockJsonResponse(
  {
    success: false,
    error: {
      code: "BUDGET_TRANSFER_FAILED",
      message: "Insufficient source budget amount",
    },
  },
  { status: 400 }
)
```

In `src/lib/sync/expenses/coordinator.test.ts`, update fetch mocks for `/api/expenses/sync` from raw sync payloads to:

```ts
jsonResponse({ success: true, data: syncPayload })
```

and update sync error response mocks from:

```ts
jsonResponse({ error: "Failed to sync expenses" }, { status: 400 })
```

to:

```ts
jsonResponse(
  {
    success: false,
    error: {
      code: "SYNC_EXPENSES_FAILED",
      message: "Failed to sync expenses",
    },
  },
  { status: 400 }
)
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
rtk bunx vitest run src/lib/queries/read-fetchers.test.ts src/lib/mutations/index.test.tsx src/lib/sync/expenses/coordinator.test.ts
```

Expected: FAIL because fetch helpers still return raw JSON and mutation/sync helpers still parse legacy `{ error }` shapes.

- [ ] **Step 3: Update `fetchJson` to unwrap the new envelope**

Replace `src/lib/queries/http.ts` with:

```ts
import { unwrapApiResponse } from "@/lib/api/api-response";

export const fetchJson = async <T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> => {
  const response = await fetch(input, init);
  const payload = await response.json().catch(() => null);

  return unwrapApiResponse<T>(payload, response.status);
};
```

- [ ] **Step 4: Update custom read fetchers to use envelope-aware `fetchJson`**

In `src/lib/queries/budgets.ts`, replace `fetchBudgetOverview` with:

```ts
export const fetchBudgetOverview = async (): Promise<BudgetOverviewReport> =>
  fetchJson<BudgetOverviewReport>("/api/budgets", {
    method: "GET",
    cache: "no-store",
  });
```

Replace `fetchBudgetTransactions` response handling with:

```ts
return fetchJson<BudgetTransactionsResponse>(
  `/api/budgets/${budgetId}/transactions?${query}`,
  {
    method: "GET",
    cache: "no-store",
  }
);
```

In `src/lib/queries/budget-weekly.ts`, import `fetchJson`:

```ts
import { fetchJson } from "./http";
```

Replace the raw fetch block with:

```ts
const data = await fetchJson<BudgetWeeklyOptionsResponse>(
  `/api/budget-weekly?weekStart=${weekStart}`,
  {
    method: "GET",
    cache: "no-store",
  }
);
```

- [ ] **Step 5: Update mutation helper parsing**

In `src/lib/mutations/index.ts`, import:

```ts
import {
  ApiResponseError,
  unwrapApiResponse,
} from "@/lib/api/api-response";
```

Replace `readJsonError` with:

```ts
const readJsonError = async (response: Response, fallback: string) => {
  const payload = await response.json().catch(() => null);

  try {
    unwrapApiResponse<never>(payload, response.status);
  } catch (error) {
    if (error instanceof ApiResponseError) {
      return error.message;
    }
  }

  return fallback;
};
```

Replace the success return in `fetchJsonMutation`:

```ts
return (await response.json()) as TResponse;
```

with:

```ts
return unwrapApiResponse<TResponse>(await response.json(), response.status);
```

Replace the success return in `postBudgetTransfer`:

```ts
return (await response.json()) as TransferBudgetResult;
```

with:

```ts
return unwrapApiResponse<TransferBudgetResult>(
  await response.json(),
  response.status
);
```

- [ ] **Step 6: Update sync coordinator JSON parsing**

In `src/lib/sync/expenses/coordinator.ts`, import:

```ts
import {
  ApiResponseError,
  unwrapApiResponse,
} from "@/lib/api/api-response";
```

Replace `fetchSyncJson` with:

```ts
const fetchSyncJson = async <T>(
  input: string,
  init: RequestInit
): Promise<T> => {
  const response = await fetch(input, {
    ...init,
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);

  try {
    return unwrapApiResponse<T>(payload, response.status);
  } catch (error) {
    if (error instanceof ApiResponseError) {
      throw new Error(error.message);
    }
    throw error;
  }
};
```

- [ ] **Step 7: Run tests to verify they pass**

Run:

```bash
rtk bunx vitest run src/lib/queries/read-fetchers.test.ts src/lib/mutations/index.test.tsx src/lib/sync/expenses/coordinator.test.ts
```

Expected: PASS.

- [ ] **Step 8: Format and lint modified TypeScript files**

Run:

```bash
rtk bunx prettier --write src/lib/queries/http.ts src/lib/queries/budgets.ts src/lib/queries/budget-weekly.ts src/lib/mutations/index.ts src/lib/sync/expenses/coordinator.ts src/lib/queries/read-fetchers.test.ts src/lib/mutations/index.test.tsx src/lib/sync/expenses/coordinator.test.ts
rtk bunx prettier --check src/lib/queries/http.ts src/lib/queries/budgets.ts src/lib/queries/budget-weekly.ts src/lib/mutations/index.ts src/lib/sync/expenses/coordinator.ts src/lib/queries/read-fetchers.test.ts src/lib/mutations/index.test.tsx src/lib/sync/expenses/coordinator.test.ts
rtk bunx eslint src/lib/queries/http.ts src/lib/queries/budgets.ts src/lib/queries/budget-weekly.ts src/lib/mutations/index.ts src/lib/sync/expenses/coordinator.ts src/lib/queries/read-fetchers.test.ts src/lib/mutations/index.test.tsx src/lib/sync/expenses/coordinator.test.ts
```

Expected: Prettier check passes and ESLint exits 0.

- [ ] **Step 9: Commit**

Run:

```bash
rtk git status --short
rtk git add src/lib/queries/http.ts src/lib/queries/budgets.ts src/lib/queries/budget-weekly.ts src/lib/mutations/index.ts src/lib/sync/expenses/coordinator.ts src/lib/queries/read-fetchers.test.ts src/lib/mutations/index.test.tsx src/lib/sync/expenses/coordinator.test.ts
rtk git commit -m "refactor: unwrap api response envelopes in clients"
```

Expected: commit succeeds and stages only Task 2 files.

---

### Task 3: Read Route Envelope Migration

**Files:**
- Modify: `src/app/api/expenses/route.ts`
- Modify: `src/app/api/expenses/sync/route.ts`
- Modify: `src/app/api/budgets/route.ts`
- Modify: `src/app/api/budgets/[id]/transactions/route.ts`
- Modify: `src/app/api/budgets/transfer-candidates/route.ts`
- Modify: `src/app/api/budget-weekly/route.ts`
- Modify: `src/app/api/dashboard/monthly-summary/route.ts`
- Modify: `src/app/api/reports/daily/route.ts`
- Modify: `src/app/api/reports/monthly/route.ts`
- Test: `src/app/api/read-routes.test.ts`

- [ ] **Step 1: Update read route tests for envelopes**

In `src/app/api/read-routes.test.ts`, update successful JSON assertions from:

```ts
await expect(response.json()).resolves.toEqual(payload);
```

to:

```ts
await expect(response.json()).resolves.toEqual({
  success: true,
  data: payload,
});
```

Update invalid parameter assertions. For invalid expense mode, replace:

```ts
await expect(response.json()).resolves.toEqual({ error: "Invalid mode" });
```

with:

```ts
await expect(response.json()).resolves.toEqual({
  success: false,
  error: {
    code: "INVALID_PARAMS",
    message: "Invalid mode",
  },
});
```

For invalid transfer destination, invalid dashboard month, invalid report month, invalid report date, invalid recent days, and invalid pagination, use the same `INVALID_PARAMS` code and the existing message string.

Add one request-level sync failure assertion:

```ts
it("returns an error envelope for invalid expense sync cursors", async () => {
  const response = await getExpenseSync(
    new Request("http://localhost/api/expenses/sync?cursor=not-a-date")
  );

  expect(response.status).toBe(400);
  await expect(response.json()).resolves.toEqual({
    success: false,
    error: {
      code: "INVALID_CURSOR",
      message: "Invalid cursor",
    },
  });
  expect(mocks.getExpenseChangesSince).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run read route tests to verify they fail**

Run:

```bash
rtk bunx vitest run src/app/api/read-routes.test.ts
```

Expected: FAIL because routes still return raw payloads and legacy error bodies.

- [ ] **Step 3: Migrate read routes to route helpers**

In each route, import:

```ts
import { apiError, apiSuccess } from "@/lib/api/route-response";
```

Replace read success returns:

```ts
return NextResponse.json(result);
```

with:

```ts
return apiSuccess(result);
```

Replace validation failures:

```ts
return NextResponse.json({ error: parsedParams.error }, { status: 400 });
```

with:

```ts
return apiError("INVALID_PARAMS", parsedParams.error, 400);
```

In `src/app/api/expenses/sync/route.ts`, use:

```ts
return apiError("INVALID_CURSOR", "Invalid cursor", 400);
```

for invalid cursor and:

```ts
return apiSuccess(await getExpenseChangesSince(parsedCursor.data));
```

for successful pulls.

For caught read failures, use route-specific codes and existing messages:

```ts
return apiError("FETCH_EXPENSES_FAILED", "Failed to fetch expenses", 400);
return apiError("SYNC_EXPENSES_FAILED", "Failed to sync expenses", 400);
return apiError("FETCH_BUDGETS_FAILED", "Failed to fetch budgets", 400);
return apiError("FETCH_REPORT_FAILED", "Failed to fetch monthly report", 400);
return apiError("FETCH_REPORT_FAILED", "Failed to fetch daily report", 400);
```

Remove unused `NextResponse` imports from migrated routes.

- [ ] **Step 4: Run read route tests to verify they pass**

Run:

```bash
rtk bunx vitest run src/app/api/read-routes.test.ts
```

Expected: PASS.

- [ ] **Step 5: Format and lint modified TypeScript files**

Run:

```bash
rtk bunx prettier --write src/app/api/expenses/route.ts src/app/api/expenses/sync/route.ts src/app/api/budgets/route.ts src/app/api/budgets/[id]/transactions/route.ts src/app/api/budgets/transfer-candidates/route.ts src/app/api/budget-weekly/route.ts src/app/api/dashboard/monthly-summary/route.ts src/app/api/reports/daily/route.ts src/app/api/reports/monthly/route.ts src/app/api/read-routes.test.ts
rtk bunx prettier --check src/app/api/expenses/route.ts src/app/api/expenses/sync/route.ts src/app/api/budgets/route.ts src/app/api/budgets/[id]/transactions/route.ts src/app/api/budgets/transfer-candidates/route.ts src/app/api/budget-weekly/route.ts src/app/api/dashboard/monthly-summary/route.ts src/app/api/reports/daily/route.ts src/app/api/reports/monthly/route.ts src/app/api/read-routes.test.ts
rtk bunx eslint src/app/api/expenses/route.ts src/app/api/expenses/sync/route.ts src/app/api/budgets/route.ts src/app/api/budgets/[id]/transactions/route.ts src/app/api/budgets/transfer-candidates/route.ts src/app/api/budget-weekly/route.ts src/app/api/dashboard/monthly-summary/route.ts src/app/api/reports/daily/route.ts src/app/api/reports/monthly/route.ts src/app/api/read-routes.test.ts
```

Expected: Prettier check passes and ESLint exits 0.

- [ ] **Step 6: Commit**

Run:

```bash
rtk git status --short
rtk git add src/app/api/expenses/route.ts src/app/api/expenses/sync/route.ts src/app/api/budgets/route.ts src/app/api/budgets/[id]/transactions/route.ts src/app/api/budgets/transfer-candidates/route.ts src/app/api/budget-weekly/route.ts src/app/api/dashboard/monthly-summary/route.ts src/app/api/reports/daily/route.ts src/app/api/reports/monthly/route.ts src/app/api/read-routes.test.ts
rtk git commit -m "refactor: wrap read api responses"
```

Expected: commit succeeds and stages only Task 3 files.

---

### Task 4: Mutation and Sync Route Envelope Migration

**Files:**
- Modify: `src/app/api/expenses/route.ts`
- Modify: `src/app/api/expenses/[id]/route.ts`
- Modify: `src/app/api/expenses/sync/route.ts`
- Modify: `src/app/api/transaction-budget/route.ts`
- Modify: `src/app/api/budgets/transfer/route.ts`
- Modify: `src/app/api/weekly-budgets/route.ts`
- Modify: `src/app/api/weekly-budgets/[id]/route.ts`
- Test: `src/app/api/mutation-routes.test.ts`

- [ ] **Step 1: Update mutation route tests for envelopes**

In `src/app/api/mutation-routes.test.ts`, update success assertions from:

```ts
await expect(response.json()).resolves.toEqual(created);
```

to:

```ts
await expect(response.json()).resolves.toEqual({
  success: true,
  data: created,
});
```

For `POST /api/expenses/sync`, update the per-operation failure test to expect:

```ts
await expect(response.json()).resolves.toEqual({
  success: true,
  data: payload,
});
```

while keeping:

```ts
expect(response.status).toBe(200);
```

For invalid payload assertions, replace legacy bodies with:

```ts
await expect(response.json()).resolves.toEqual({
  success: false,
  error: {
    code: "INVALID_PAYLOAD",
    message: "Invalid payload",
  },
});
```

For missing resources, use:

```ts
await expect(response.json()).resolves.toEqual({
  success: false,
  error: {
    code: "NOT_FOUND",
    message: "Expense not found",
  },
});
```

Use `BUDGET_TRANSFER_FAILED` for budget transfer domain failures and keep the existing message strings.

- [ ] **Step 2: Run mutation route tests to verify they fail**

Run:

```bash
rtk bunx vitest run src/app/api/mutation-routes.test.ts
```

Expected: FAIL because mutation routes still return raw payloads and legacy errors.

- [ ] **Step 3: Migrate mutation routes to route helpers**

In each route, import:

```ts
import { apiError, apiSuccess } from "@/lib/api/route-response";
```

Replace create success returns:

```ts
return NextResponse.json(created, { status: 201 });
```

with:

```ts
return apiSuccess(created, { status: 201 });
```

Replace update/delete success returns:

```ts
return NextResponse.json(updated);
return NextResponse.json(deleted);
```

with:

```ts
return apiSuccess(updated);
return apiSuccess(deleted);
```

In `src/app/api/expenses/sync/route.ts`, keep processed batch failures as successful API envelopes:

```ts
return apiSuccess(result);
```

Use request-level sync errors:

```ts
return apiError("INVALID_PAYLOAD", "Invalid payload", 400);
return apiError("SYNC_EXPENSES_FAILED", "Failed to sync expenses", 400);
```

Use route-specific caught failure codes:

```ts
return apiError("CREATE_EXPENSE_FAILED", "Failed to create expense", 400);
return apiError("UPDATE_EXPENSE_FAILED", "Failed to update expense", 400);
return apiError("DELETE_EXPENSE_FAILED", "Failed to delete expense", 400);
return apiError("BUDGET_TRANSFER_FAILED", "Failed to transfer budget amount", 400);
return apiError("NOT_FOUND", error.message, 404);
```

Remove unused `NextResponse` imports after each route is migrated.

- [ ] **Step 4: Run mutation route tests to verify they pass**

Run:

```bash
rtk bunx vitest run src/app/api/mutation-routes.test.ts
```

Expected: PASS.

- [ ] **Step 5: Format and lint modified TypeScript files**

Run:

```bash
rtk bunx prettier --write src/app/api/expenses/route.ts src/app/api/expenses/[id]/route.ts src/app/api/expenses/sync/route.ts src/app/api/transaction-budget/route.ts src/app/api/budgets/transfer/route.ts src/app/api/weekly-budgets/route.ts src/app/api/weekly-budgets/[id]/route.ts src/app/api/mutation-routes.test.ts
rtk bunx prettier --check src/app/api/expenses/route.ts src/app/api/expenses/[id]/route.ts src/app/api/expenses/sync/route.ts src/app/api/transaction-budget/route.ts src/app/api/budgets/transfer/route.ts src/app/api/weekly-budgets/route.ts src/app/api/weekly-budgets/[id]/route.ts src/app/api/mutation-routes.test.ts
rtk bunx eslint src/app/api/expenses/route.ts src/app/api/expenses/[id]/route.ts src/app/api/expenses/sync/route.ts src/app/api/transaction-budget/route.ts src/app/api/budgets/transfer/route.ts src/app/api/weekly-budgets/route.ts src/app/api/weekly-budgets/[id]/route.ts src/app/api/mutation-routes.test.ts
```

Expected: Prettier check passes and ESLint exits 0.

- [ ] **Step 6: Commit**

Run:

```bash
rtk git status --short
rtk git add src/app/api/expenses/route.ts src/app/api/expenses/[id]/route.ts src/app/api/expenses/sync/route.ts src/app/api/transaction-budget/route.ts src/app/api/budgets/transfer/route.ts src/app/api/weekly-budgets/route.ts src/app/api/weekly-budgets/[id]/route.ts src/app/api/mutation-routes.test.ts
rtk git commit -m "refactor: wrap mutation api responses"
```

Expected: commit succeeds and stages only Task 4 files.

---

### Task 5: AI Parse Endpoint and UI Consumers

**Files:**
- Modify: `src/app/api/ai/parse-expense/route.ts`
- Modify: `src/app/api/ai/parse-expense/route.test.ts`
- Modify: `src/components/AIInput.tsx`
- Modify: `src/components/AIInput.test.tsx`
- Modify: `src/components/AIExpenseChat.tsx`
- Modify: `src/components/AIExpenseChat.test.tsx`

- [ ] **Step 1: Update AI route and component tests for envelopes**

In `src/app/api/ai/parse-expense/route.test.ts`, update success assertions to:

```ts
await expect(response.json()).resolves.toEqual({
  success: true,
  data: expectedParseResult,
});
```

Update invalid payload assertions to:

```ts
await expect(response.json()).resolves.toEqual({
  success: false,
  error: {
    code: "INVALID_PAYLOAD",
    message: "Invalid payload",
  },
});
```

Update missing API key and unexpected parse failures to use:

```ts
{
  success: false,
  error: {
    code: "PARSE_EXPENSE_FAILED",
    message: "Missing OPENROUTER_API_KEY"
  }
}
```

or:

```ts
{
  success: false,
  error: {
    code: "PARSE_EXPENSE_FAILED",
    message: "Failed to parse expense"
  }
}
```

In `src/components/AIInput.test.tsx` and `src/components/AIExpenseChat.test.tsx`, update mocked `/api/ai/parse-expense` success responses from raw parse results to:

```ts
jsonResponse({
  success: true,
  data: {
    status: "success",
    expense: {
      amount: 45000,
      note: "Coffee",
      category: "Food",
    },
  },
})
```

Update error responses to:

```ts
jsonResponse(
  {
    success: false,
    error: {
      code: "PARSE_EXPENSE_FAILED",
      message: "Failed to parse expense",
    },
  },
  { status: 500 }
)
```

- [ ] **Step 2: Run AI tests to verify they fail**

Run:

```bash
rtk bunx vitest run src/app/api/ai/parse-expense/route.test.ts src/components/AIInput.test.tsx src/components/AIExpenseChat.test.tsx
```

Expected: FAIL because the route and components still use raw parse response bodies.

- [ ] **Step 3: Migrate the AI parse route**

In `src/app/api/ai/parse-expense/route.ts`, replace `NextResponse` with:

```ts
import { apiError, apiSuccess } from "@/lib/api/route-response";
```

Replace `invalidPayloadResponse` with:

```ts
const invalidPayloadResponse = () =>
  apiError("INVALID_PAYLOAD", "Invalid payload", 400);
```

Replace missing API key response with:

```ts
return apiError("PARSE_EXPENSE_FAILED", "Missing OPENROUTER_API_KEY", 500);
```

Replace success:

```ts
return apiSuccess(result);
```

Replace catch response:

```ts
return apiError("PARSE_EXPENSE_FAILED", "Failed to parse expense", 500);
```

- [ ] **Step 4: Update AI UI consumers to unwrap envelopes**

In `src/components/AIInput.tsx`, import:

```ts
import { unwrapApiResponse } from "@/lib/api/api-response";
```

Replace:

```ts
const data = (await response.json()) as ParseExpenseResponse;
```

with:

```ts
const data = unwrapApiResponse<ParseExpenseResponse>(
  await response.json(),
  response.status
);
```

Make the same replacement in `src/components/AIExpenseChat.tsx`.

- [ ] **Step 5: Run AI tests to verify they pass**

Run:

```bash
rtk bunx vitest run src/app/api/ai/parse-expense/route.test.ts src/components/AIInput.test.tsx src/components/AIExpenseChat.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Format and lint modified TypeScript files**

Run:

```bash
rtk bunx prettier --write src/app/api/ai/parse-expense/route.ts src/app/api/ai/parse-expense/route.test.ts src/components/AIInput.tsx src/components/AIInput.test.tsx src/components/AIExpenseChat.tsx src/components/AIExpenseChat.test.tsx
rtk bunx prettier --check src/app/api/ai/parse-expense/route.ts src/app/api/ai/parse-expense/route.test.ts src/components/AIInput.tsx src/components/AIInput.test.tsx src/components/AIExpenseChat.tsx src/components/AIExpenseChat.test.tsx
rtk bunx eslint src/app/api/ai/parse-expense/route.ts src/app/api/ai/parse-expense/route.test.ts src/components/AIInput.tsx src/components/AIInput.test.tsx src/components/AIExpenseChat.tsx src/components/AIExpenseChat.test.tsx
```

Expected: Prettier check passes and ESLint exits 0.

- [ ] **Step 7: Commit**

Run:

```bash
rtk git status --short
rtk git add src/app/api/ai/parse-expense/route.ts src/app/api/ai/parse-expense/route.test.ts src/components/AIInput.tsx src/components/AIInput.test.tsx src/components/AIExpenseChat.tsx src/components/AIExpenseChat.test.tsx
rtk git commit -m "refactor: wrap ai parse api responses"
```

Expected: commit succeeds and stages only Task 5 files.

---

### Task 6: Remaining Non-Internal Route Sweep

**Files:**
- Modify any remaining non-internal `src/app/api/**/route.ts` files that still return raw JSON.
- Do not modify `src/app/api/internal/**/route.ts`.
- Test existing route tests that cover the changed files.

- [ ] **Step 1: Find any non-internal route still returning raw JSON or legacy errors**

Run:

```bash
rtk rg -n "NextResponse\\.json\\(|\\{ error:" src/app/api --glob '!internal/**'
```

Expected before implementation: remaining matches only in files not yet migrated by Tasks 3-5.

- [ ] **Step 2: Convert remaining route responses**

For every non-internal match, apply these exact replacements:

Success:

```ts
return NextResponse.json(value);
```

becomes:

```ts
return apiSuccess(value);
```

Created:

```ts
return NextResponse.json(value, { status: 201 });
```

becomes:

```ts
return apiSuccess(value, { status: 201 });
```

Validation:

```ts
return NextResponse.json({ error: payload.error }, { status: 400 });
```

becomes:

```ts
return apiError("INVALID_PAYLOAD", payload.error, 400);
```

Not found:

```ts
return NextResponse.json({ error: "Budget not found" }, { status: 404 });
```

becomes:

```ts
return apiError("NOT_FOUND", "Budget not found", 404);
```

Use existing message strings. Use the closest stable code from the spec:

```ts
"INVALID_PAYLOAD"
"INVALID_PARAMS"
"NOT_FOUND"
"FETCH_BUDGETS_FAILED"
"FETCH_EXPENSES_FAILED"
"FETCH_REPORT_FAILED"
"BUDGET_TRANSFER_FAILED"
"SYNC_EXPENSES_FAILED"
"PARSE_EXPENSE_FAILED"
```

- [ ] **Step 3: Verify no non-internal raw route responses remain**

Run:

```bash
rtk rg -n "NextResponse\\.json\\(|\\{ error:" src/app/api --glob '!internal/**'
```

Expected: no matches in non-internal migrated routes. Matches under `src/app/api/internal/**` are allowed only when the command is run without the `--glob '!internal/**'` exclusion.

- [ ] **Step 4: Run route test suites**

Run:

```bash
rtk bunx vitest run src/app/api/read-routes.test.ts src/app/api/mutation-routes.test.ts src/app/api/ai/parse-expense/route.test.ts
```

Expected: PASS.

- [ ] **Step 5: Format and lint remaining modified route files**

```bash
rtk bunx prettier --write src/app/api/expenses/route.ts src/app/api/expenses/[id]/route.ts src/app/api/expenses/sync/route.ts src/app/api/transaction-budget/route.ts src/app/api/budgets/route.ts src/app/api/budgets/[id]/transactions/route.ts src/app/api/budgets/transfer/route.ts src/app/api/budgets/transfer-candidates/route.ts src/app/api/budget-weekly/route.ts src/app/api/dashboard/monthly-summary/route.ts src/app/api/reports/daily/route.ts src/app/api/reports/monthly/route.ts src/app/api/weekly-budgets/route.ts src/app/api/weekly-budgets/[id]/route.ts src/app/api/ai/parse-expense/route.ts src/app/api/read-routes.test.ts src/app/api/mutation-routes.test.ts src/app/api/ai/parse-expense/route.test.ts
rtk bunx prettier --check src/app/api/expenses/route.ts src/app/api/expenses/[id]/route.ts src/app/api/expenses/sync/route.ts src/app/api/transaction-budget/route.ts src/app/api/budgets/route.ts src/app/api/budgets/[id]/transactions/route.ts src/app/api/budgets/transfer/route.ts src/app/api/budgets/transfer-candidates/route.ts src/app/api/budget-weekly/route.ts src/app/api/dashboard/monthly-summary/route.ts src/app/api/reports/daily/route.ts src/app/api/reports/monthly/route.ts src/app/api/weekly-budgets/route.ts src/app/api/weekly-budgets/[id]/route.ts src/app/api/ai/parse-expense/route.ts src/app/api/read-routes.test.ts src/app/api/mutation-routes.test.ts src/app/api/ai/parse-expense/route.test.ts
rtk bunx eslint src/app/api/expenses/route.ts src/app/api/expenses/[id]/route.ts src/app/api/expenses/sync/route.ts src/app/api/transaction-budget/route.ts src/app/api/budgets/route.ts src/app/api/budgets/[id]/transactions/route.ts src/app/api/budgets/transfer/route.ts src/app/api/budgets/transfer-candidates/route.ts src/app/api/budget-weekly/route.ts src/app/api/dashboard/monthly-summary/route.ts src/app/api/reports/daily/route.ts src/app/api/reports/monthly/route.ts src/app/api/weekly-budgets/route.ts src/app/api/weekly-budgets/[id]/route.ts src/app/api/ai/parse-expense/route.ts src/app/api/read-routes.test.ts src/app/api/mutation-routes.test.ts src/app/api/ai/parse-expense/route.test.ts
```

Expected: Prettier check passes and ESLint exits 0.

- [ ] **Step 6: Commit**

Run:

```bash
rtk git status --short
rtk git add src/app/api/expenses/route.ts src/app/api/expenses/[id]/route.ts src/app/api/expenses/sync/route.ts src/app/api/transaction-budget/route.ts src/app/api/budgets/route.ts src/app/api/budgets/[id]/transactions/route.ts src/app/api/budgets/transfer/route.ts src/app/api/budgets/transfer-candidates/route.ts src/app/api/budget-weekly/route.ts src/app/api/dashboard/monthly-summary/route.ts src/app/api/reports/daily/route.ts src/app/api/reports/monthly/route.ts src/app/api/weekly-budgets/route.ts src/app/api/weekly-budgets/[id]/route.ts src/app/api/ai/parse-expense/route.ts src/app/api/read-routes.test.ts src/app/api/mutation-routes.test.ts src/app/api/ai/parse-expense/route.test.ts
rtk git commit -m "refactor: complete api response envelope route migration"
```

Expected: commit succeeds and stages only Task 6 files.

---

### Task 7: Final Verification

**Files:**
- Verify all modified files from Tasks 1-6.
- No implementation files should be edited in this task unless a verification failure requires a focused fix.

- [ ] **Step 1: Check no browser-facing route still uses the legacy body shape**

Run:

```bash
rtk rg -n "NextResponse\\.json\\(|\\{ error:" src/app/api --glob '!internal/**'
```

Expected: no matches for non-internal routes.

- [ ] **Step 2: Check internal routes were not migrated**

Run:

```bash
rtk rg -n "NextResponse\\.json\\(|\\{ error:" src/app/api/internal
```

Expected: matches remain in `src/app/api/internal/**/route.ts`, confirming the excluded internal API was left alone.

- [ ] **Step 3: Run focused test suites**

Run:

```bash
rtk bunx vitest run src/lib/api/api-response.test.ts src/lib/api/route-response.test.ts src/app/api/read-routes.test.ts src/app/api/mutation-routes.test.ts src/app/api/ai/parse-expense/route.test.ts src/lib/queries/read-fetchers.test.ts src/lib/mutations/index.test.tsx src/lib/sync/expenses/coordinator.test.ts src/components/AIInput.test.tsx src/components/AIExpenseChat.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Run final formatting and lint checks on all modified TS/TSX files**

Run:

```bash
rtk bunx prettier --write src/lib/api/api-response.ts src/lib/api/api-response.test.ts src/lib/api/route-response.ts src/lib/api/route-response.test.ts src/lib/queries/http.ts src/lib/queries/budgets.ts src/lib/queries/budget-weekly.ts src/lib/mutations/index.ts src/lib/sync/expenses/coordinator.ts src/lib/queries/read-fetchers.test.ts src/lib/mutations/index.test.tsx src/lib/sync/expenses/coordinator.test.ts src/app/api/expenses/route.ts src/app/api/expenses/[id]/route.ts src/app/api/expenses/sync/route.ts src/app/api/transaction-budget/route.ts src/app/api/budgets/route.ts src/app/api/budgets/[id]/transactions/route.ts src/app/api/budgets/transfer/route.ts src/app/api/budgets/transfer-candidates/route.ts src/app/api/budget-weekly/route.ts src/app/api/dashboard/monthly-summary/route.ts src/app/api/reports/daily/route.ts src/app/api/reports/monthly/route.ts src/app/api/weekly-budgets/route.ts src/app/api/weekly-budgets/[id]/route.ts src/app/api/ai/parse-expense/route.ts src/app/api/read-routes.test.ts src/app/api/mutation-routes.test.ts src/app/api/ai/parse-expense/route.test.ts src/components/AIInput.tsx src/components/AIInput.test.tsx src/components/AIExpenseChat.tsx src/components/AIExpenseChat.test.tsx
rtk bunx prettier --check src/lib/api/api-response.ts src/lib/api/api-response.test.ts src/lib/api/route-response.ts src/lib/api/route-response.test.ts src/lib/queries/http.ts src/lib/queries/budgets.ts src/lib/queries/budget-weekly.ts src/lib/mutations/index.ts src/lib/sync/expenses/coordinator.ts src/lib/queries/read-fetchers.test.ts src/lib/mutations/index.test.tsx src/lib/sync/expenses/coordinator.test.ts src/app/api/expenses/route.ts src/app/api/expenses/[id]/route.ts src/app/api/expenses/sync/route.ts src/app/api/transaction-budget/route.ts src/app/api/budgets/route.ts src/app/api/budgets/[id]/transactions/route.ts src/app/api/budgets/transfer/route.ts src/app/api/budgets/transfer-candidates/route.ts src/app/api/budget-weekly/route.ts src/app/api/dashboard/monthly-summary/route.ts src/app/api/reports/daily/route.ts src/app/api/reports/monthly/route.ts src/app/api/weekly-budgets/route.ts src/app/api/weekly-budgets/[id]/route.ts src/app/api/ai/parse-expense/route.ts src/app/api/read-routes.test.ts src/app/api/mutation-routes.test.ts src/app/api/ai/parse-expense/route.test.ts src/components/AIInput.tsx src/components/AIInput.test.tsx src/components/AIExpenseChat.tsx src/components/AIExpenseChat.test.tsx
rtk bunx eslint src/lib/api/api-response.ts src/lib/api/api-response.test.ts src/lib/api/route-response.ts src/lib/api/route-response.test.ts src/lib/queries/http.ts src/lib/queries/budgets.ts src/lib/queries/budget-weekly.ts src/lib/mutations/index.ts src/lib/sync/expenses/coordinator.ts src/lib/queries/read-fetchers.test.ts src/lib/mutations/index.test.tsx src/lib/sync/expenses/coordinator.test.ts src/app/api/expenses/route.ts src/app/api/expenses/[id]/route.ts src/app/api/expenses/sync/route.ts src/app/api/transaction-budget/route.ts src/app/api/budgets/route.ts src/app/api/budgets/[id]/transactions/route.ts src/app/api/budgets/transfer/route.ts src/app/api/budgets/transfer-candidates/route.ts src/app/api/budget-weekly/route.ts src/app/api/dashboard/monthly-summary/route.ts src/app/api/reports/daily/route.ts src/app/api/reports/monthly/route.ts src/app/api/weekly-budgets/route.ts src/app/api/weekly-budgets/[id]/route.ts src/app/api/ai/parse-expense/route.ts src/app/api/read-routes.test.ts src/app/api/mutation-routes.test.ts src/app/api/ai/parse-expense/route.test.ts src/components/AIInput.tsx src/components/AIInput.test.tsx src/components/AIExpenseChat.tsx src/components/AIExpenseChat.test.tsx
```

Expected: Prettier check passes and ESLint exits 0.

- [ ] **Step 5: Smoke check the running dev server if port 3000 is available**

Run:

```bash
rtk curl -s -i http://localhost:3000/api/expenses?limit=1
```

Expected body shape:

```json
{
  "success": true,
  "data": {
    "rows": []
  }
}
```

The actual `data.rows` may contain records. The important part is `success: true` and `data`.

Run:

```bash
rtk curl -s -i "http://localhost:3000/api/expenses?mode=all"
```

Expected body shape:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_PARAMS",
    "message": "Invalid mode"
  }
}
```

Run:

```bash
rtk curl -s -i -X POST http://localhost:3000/api/expenses/sync -H 'Content-Type: application/json' --data '{"operations":[{"operationId":"plan-smoke-op","type":"create","clientId":"plan-smoke-client","serverId":null,"payload":{"clientId":"plan-smoke-client","date":"not-a-date","amount":1,"note":"PLAN-SMOKE","category":"Food","paidBy":"Cubi","budgetId":null}}]}'
```

Expected: HTTP `200` with:

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "operationId": "plan-smoke-op",
        "ok": false,
        "error": "Invalid date format"
      }
    ]
  }
}
```

- [ ] **Step 6: Report final status**

Run:

```bash
rtk git log --oneline -8
rtk git status --short
```

Expected: recent task commits are visible. Any remaining worktree changes are unrelated pre-existing changes or explicitly called out.
