# API Response Envelope Design

## Context

The app currently uses REST route handlers for app-owned reads and writes. Most non-internal API routes return raw domain payloads on success and `{ error: string }` on failure. Browser fetchers and mutation helpers each parse those shapes directly.

This creates inconsistent response handling across query fetchers, mutation hooks, sync calls, and route tests. The new API contract should make success and error responses explicit while preserving the existing service-layer types.

## Goals

- Add one shared API response envelope for non-internal app API routes.
- Keep route success and error shapes consistent.
- Keep service and database functions domain-focused; envelope wrapping belongs at the API boundary.
- Keep `/api/expenses/sync` batch semantics: a processed batch is a successful HTTP/API response even when individual operations fail.
- Exclude `/api/internal/*` routes from this migration.

## Non-Goals

- Do not change service-layer return types.
- Do not migrate `/api/internal/*`.
- Do not redesign sync outbox processing.
- Do not add Server Actions for app-owned data.
- Do not support a temporary dual old/new response contract.

## Shared Types

Add a shared module at `src/lib/api/api-response.ts` with these exported types:

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
```

Add helpers in the same module so route handlers do not hand-roll response objects:

- `apiSuccess(data, init?, meta?)`
- `apiError(code, message, status, details?)`

The helpers should return `NextResponse.json(...)` with the envelope shape.

## Scope

Migrate all non-internal app routes under `src/app/api`, including:

- `/api/expenses`
- `/api/expenses/[id]`
- `/api/expenses/sync`
- `/api/budgets`
- `/api/budgets/*`
- `/api/budget-weekly`
- `/api/weekly-budgets`
- `/api/weekly-budgets/[id]`
- `/api/transaction-budget`
- `/api/reports/*`
- `/api/dashboard/*`
- `/api/ai/*`

Exclude:

- `/api/internal/*`

## Response Semantics

Successful request processing returns:

```ts
{
  success: true,
  data
}
```

Failures return:

```ts
{
  success: false,
  error: {
    code,
    message,
    details
  }
}
```

HTTP status codes remain meaningful:

- `2xx` for successful request processing.
- `400` for validation errors and malformed request payloads.
- `404` for missing resources.
- `500` for unexpected server failures when appropriate.

## Sync Endpoint Semantics

`POST /api/expenses/sync` is a batch endpoint. If the request payload is valid and the server processes the batch, the API response should be:

```ts
{
  success: true,
  data: {
    results: [
      { operationId: "...", ok: false, error: "Invalid date format" }
    ]
  }
}
```

The HTTP status should remain `200` in this case because the batch request itself was processed. Individual operation failures stay inside `data.results` so the client can mark the exact outbox operations as failed.

Request-level failures still use `success: false`, for example invalid JSON, invalid cursor, or invalid sync payload shape.

## Client Fetching

Update shared browser fetch helpers to unwrap the envelope:

- On `success: true`, return `data`.
- On `success: false`, throw an `Error` using `error.message`.
- Preserve access to `error.code` and `error.details` where a caller needs structured handling.

Update all non-internal query fetchers and mutation helpers that consume migrated routes. This includes the sync coordinator's JSON fetch helper.

Because this is a breaking migration, app callers should expect only the new envelope shape after the change. Do not keep legacy `{ error: string }` parsing except where an excluded internal route still needs it.

## Error Codes

Use stable uppercase string codes. Initial route-level codes can be simple and route-specific:

- `INVALID_PAYLOAD`
- `INVALID_CURSOR`
- `INVALID_PARAMS`
- `NOT_FOUND`
- `CREATE_EXPENSE_FAILED`
- `UPDATE_EXPENSE_FAILED`
- `DELETE_EXPENSE_FAILED`
- `FETCH_EXPENSES_FAILED`
- `SYNC_EXPENSES_FAILED`
- `FETCH_BUDGETS_FAILED`
- `BUDGET_TRANSFER_FAILED`
- `FETCH_REPORT_FAILED`
- `PARSE_EXPENSE_FAILED`

Tests should assert codes for representative validation, not-found, and server-failure paths.

## Testing

Add or update tests for:

- API response helper output for success and error.
- Representative route success responses returning `{ success: true, data }`.
- Representative validation failures returning `{ success: false, error: { code, message } }`.
- Query fetchers unwrapping `data`.
- Mutation helpers throwing from `error.message`.
- Sync POST preserving `200` and `success: true` for per-operation failures.
- Sync request-level failures returning `success: false`.

## Rollout

Implement as one breaking migration over non-internal routes and their in-repo callers. Update tests in the same change so there is no temporary mixed contract for browser-facing API routes.
