# AI Budget Suggestion Design

Date: 2026-05-27
Status: Approved for planning

## Goal

Suggest the best matching budget for an expense note when the user leaves the note input.

The feature stays narrow:

- accept the current note and a caller-provided candidate budget list
- return one matching budget from that list, or an explicit no-match result
- preselect the suggested budget in the form when confidence is strong enough
- keep the user in control before saving

This design does not include:

- creating budgets
- changing budget amounts
- saving expenses automatically
- direct AI writes to the database
- a broad AI chat experience

## Current Context

The app already has one AI flow for parsing expenses. The provider call is currently isolated in `src/lib/ai/parse-expense.ts`, while `POST /api/ai/parse-expense` wraps the result with the shared API envelope.

Budget data already has the information needed for classification. `BudgetListItem` includes budget id, name, amount, spent, remaining, period, and dates. The budget picker and expense forms already fetch candidate budgets for the active expense date.

The project rule for app-owned browser reads and writes is REST route handlers plus TanStack Query query factories or mutation hooks. This feature should not add Server Actions.

## Recommended Approach

Use a dedicated budget-suggestion route backed by a reusable AI structured-output helper.

Flow:

1. User edits the expense note.
2. User blurs the note input.
3. Client checks whether the note and candidate budgets are usable.
4. Client calls `POST /api/ai/suggest-budget`.
5. Server asks the AI provider to choose one `budgetId` from the provided list.
6. Server validates that the returned `budgetId` exists in the provided candidates.
7. Client preselects the budget only when confidence is `high` or `medium`.
8. User can change the budget before saving.

Manual selection wins. If the user has already selected a budget manually, note blur must not replace it.

## Alternatives Considered

### AI-Only Ranking

Send the note and candidates to the model and ask for the best `budgetId`.

This is simple and flexible, but it spends provider calls on obvious cases and relies entirely on model behavior.

### Heuristic First, AI Second

Try a local matcher first, then call AI when there is no confident deterministic match.

This is the recommended approach. It keeps common cases fast and cheap while still supporting fuzzy notes.

### Ranked Candidate List

Return the top candidates instead of one budget.

This may be useful later, but it adds UI work that is not needed for the blur preselect behavior. The v1 contract should return one suggestion or no match.

## Architecture

### AI Core

Add a reusable server-side AI helper under `src/lib/ai/core/`.

Responsibilities:

- build OpenRouter chat completion requests
- support structured JSON output
- keep provider URL, model, and API key handling outside task modules
- parse provider responses
- return normalized task-level errors
- accept `fetchFn` injection for unit tests

OpenRouter remains the initial provider because the app already uses `OPENROUTER_API_KEY`.

### Suggest Budget Task

Add:

- `src/lib/ai/suggest-budget.ts`
- `src/lib/ai/suggest-budget-contract.ts`

Responsibilities:

- define request and response schemas
- normalize the note and candidate budget list
- run the deterministic matcher
- call the AI core only when deterministic matching is inconclusive
- validate model output against the provided candidate ids
- return a stable domain response

The task module should not read from the database. The caller provides the candidate list so the same module can be used from quick expense and manual expense flows.

### API Route

Add:

- `src/app/api/ai/suggest-budget/route.ts`

Responsibilities:

- parse JSON request body
- validate request shape
- require `OPENROUTER_API_KEY` when AI fallback is needed
- call the suggestion task
- return `apiSuccess(result)` for domain-level success, no-match, or fallback
- return `apiError(...)` only for invalid payloads, missing required server configuration, or unexpected route failures

### Client Integration

Wire the feature into note inputs used by expense forms.

Behavior:

- run on note input blur
- skip empty or very short notes
- skip when there are no candidate budgets
- skip when the user manually selected a budget
- avoid duplicate calls for the same note and candidate set
- ignore stale responses if the note changed while a request was in flight
- preselect only `success` responses with `high` or `medium` confidence
- do not show blocking errors

The caller should track whether the current budget value was selected manually or filled by AI. AI may replace its own previous suggestion after a later note blur, but it must not replace manual user choice.

## Data Contract

### Request

```ts
type SuggestBudgetRequest = {
  note: string;
  budgets: Array<{
    id: number;
    name: string;
    amount: number;
    spent: number;
    remaining: number;
    period: "week" | "month" | "custom";
    periodStartDate?: string;
    periodEndDate?: string | null;
  }>;
};
```

The API route should accept only the fields needed for classification. Appearance fields such as icon and color do not need to be sent to the model.

### Domain Response

```ts
type SuggestBudgetResponse =
  | {
      status: "success";
      budgetId: number;
      confidence: "high" | "medium" | "low";
      reason: string;
    }
  | {
      status: "no_match";
      reason: string;
    }
  | {
      status: "fallback";
      reason: "request_failed" | "invalid_response" | "schema_mismatch";
    };
```

### HTTP Response

The route must use the current API envelope:

```ts
type SuggestBudgetApiResponse = ApiResponse<SuggestBudgetResponse>;
```

Example success:

```json
{
  "success": true,
  "data": {
    "status": "success",
    "budgetId": 12,
    "confidence": "high",
    "reason": "The note mentions groceries, matching the Groceries budget."
  }
}
```

Example no-match:

```json
{
  "success": true,
  "data": {
    "status": "no_match",
    "reason": "No provided budget clearly fits this note."
  }
}
```

Example route error:

```json
{
  "success": false,
  "error": {
    "code": "SUGGEST_BUDGET_FAILED",
    "message": "Failed to suggest budget"
  }
}
```

## Model Behavior

Prompt rules:

- choose only from the provided budget ids
- return `no_match` when the note is ambiguous
- prefer semantic fit over remaining amount
- use budget name as the primary signal
- use period and remaining amount only as supporting context
- keep reason short and user-readable
- never invent a budget id or budget name

Server validation rules:

- returned `budgetId` must exist in the provided candidate list
- confidence must be one of `high`, `medium`, or `low`
- reason must be a non-empty short string
- malformed, invented, or incomplete model output becomes `fallback`

## Error Handling

Domain-level uncertainty returns `success: true` with a domain response:

- `no_match` for ambiguous notes
- `fallback` for provider failure or invalid model response

Route-level failures return `success: false`:

- invalid JSON payload
- invalid request shape
- missing API key when the flow needs an AI call
- unexpected route exception

Client behavior:

- `success` with high or medium confidence preselects the budget
- `success` with low confidence leaves the current budget unchanged
- `no_match` leaves the current budget unchanged
- `fallback` leaves the current budget unchanged
- route errors do not block saving

## Testing Strategy

Use targeted checks only.

### AI Core Tests

Cover:

- structured-output request shape
- provider response parsing
- non-OK response handling
- malformed provider payload handling

### Suggestion Task Tests

Cover:

- deterministic name match returns success without provider call
- ambiguous note calls provider
- provider-selected budget id is validated against candidates
- invented budget id becomes fallback
- invalid schema becomes fallback
- no candidates returns no match

### API Route Tests

Cover:

- invalid payload returns API envelope error
- valid request returns `success: true`
- no-match response is wrapped in `data`
- fallback response is wrapped in `data`
- missing API key behavior is stable when AI is required
- unexpected task failure returns `SUGGEST_BUDGET_FAILED`

### Client Tests

Cover:

- blur triggers suggestion for a meaningful note
- empty note does not trigger suggestion
- manual budget selection is not overwritten
- stale response is ignored after note changes
- high or medium confidence preselects a budget
- low confidence, no-match, fallback, and route errors leave budget unchanged

## Validation Commands

After TS or TSX edits, run the required file-scoped checks:

```bash
rtk bunx prettier --write <modified-files>
rtk bunx prettier --check <modified-files>
rtk bunx eslint <modified-files>
```

Use targeted tests for the modified scope:

```bash
rtk bun run test src/lib/ai/suggest-budget.test.ts
rtk bun run test src/app/api/ai/suggest-budget/route.test.ts
rtk bun run test <affected-component-tests>
```
