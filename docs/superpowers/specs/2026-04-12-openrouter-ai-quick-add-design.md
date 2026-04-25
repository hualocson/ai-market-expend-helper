# OpenRouter AI Quick Add Design

Date: 2026-04-12
Status: Approved for planning

## Goal

Replace the current Gemini-backed expense parsing flow with an OpenRouter-backed v1 flow using `openai/gpt-oss-20b:free`.

The feature stays intentionally narrow:
- accept a short natural-language expense input
- return a structured expense draft
- show a confirmation preview before the existing manual form
- fall back to the manual form when parsing is invalid or incomplete

This design does not include:
- background jobs
- polling
- Zustand or localStorage job state
- general-purpose AI chat
- direct AI writes to the database

## Current Context

The current app already has an AI entry point in [`src/components/AIInput.tsx`](/home/locson/workspaces/personal/expend-tracker/src/components/AIInput.tsx) and a Gemini-based server action in [`src/app/actions/ai-actionts.ts`](/home/locson/workspaces/personal/expend-tracker/src/app/actions/ai-actionts.ts). That path returns either a parsed expense or `null`, and the parsed result is passed to the existing manual form.

The existing manual form in [`src/components/ManualExpenseForm.tsx`](/home/locson/workspaces/personal/expend-tracker/src/components/ManualExpenseForm.tsx) is already the final user-controlled save surface. That boundary remains unchanged.

The project also has a canonical `Category` enum in [`src/enums/index.ts`](/home/locson/workspaces/personal/expend-tracker/src/enums/index.ts). The AI parser must normalize into those exact enum values instead of defining a separate category source of truth.

## Recommended Approach

Use a plain API route for v1.

Flow:
1. Client submits expense text to `POST /api/ai/parse-expense`
2. API route calls OpenRouter with `openai/gpt-oss-20b:free`
3. Server validates and normalizes the response into the project expense draft shape
4. Client either shows a confirmation preview or opens the manual form in fallback mode

This approach is preferred because it keeps the change surface small, avoids premature async orchestration, and cleanly replaces Gemini without redesigning the rest of the app.

## Architecture

### Client

`AIInput` remains the entry point for the feature.

Responsibilities:
- collect the user input
- submit a `fetch` request to the new API route
- manage local loading state
- branch between success preview and fallback manual entry

No TanStack Query is required in v1 because the request is a single direct mutation-style call with no polling.

### Server

The new API route lives at:

- `src/app/api/ai/parse-expense/route.ts`

Responsibilities:
- validate request body shape
- call OpenRouter
- parse and validate model output
- normalize the result into app-safe values
- return a stable response contract for the client

### Parser Module

Model-specific logic should be isolated in a small module under `src/lib/ai/`.

Responsibilities:
- request construction for OpenRouter
- prompt and schema definition
- response parsing
- normalization into the app’s expected expense draft shape

This keeps provider-specific behavior out of the route and UI, while still avoiding a broader provider abstraction that is not needed for this change.

## Data Contract

### Request

```json
{ "input": "Lunch 120k today" }
```

### Response

```ts
type ParseExpenseResponse =
  | {
      status: "success";
      expense: {
        date: string;
        amount: number;
        note: string;
        category: Category;
      };
      originalInput: string;
    }
  | {
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
```

Notes:
- `Category` refers to the existing enum from `src/enums/index.ts`
- the parser normalizes output into those exact enum values
- this spec does not require tightening the global `TExpense` definition in `src/types/index.d.ts`; that can remain unchanged unless implementation work makes the cleanup local and low-risk

## Model Behavior

Model:
- `openai/gpt-oss-20b:free`

Prompt contract:
- accept short expense-like natural language
- return only structured JSON
- normalize date into `DD/MM/YYYY`
- normalize amounts such as `45k` into integer currency values
- keep note short
- map category output only to the exact values in the existing `Category` enum

For v1, the parser should only emit values that exactly match the current `Category` enum. If the model produces an unsupported, misspelled, or ambiguous category, the server should return `fallback` rather than guessing.

## UX Flow

### Success Path

1. User enters text in `AIInput`
2. Client sends request to `/api/ai/parse-expense`
3. Client shows loading state
4. API returns `status: "success"`
5. UI shows a compact confirmation preview card with the parsed values
6. User accepts the suggestion
7. Existing `ManualExpenseForm` opens with `initialExpense`
8. User reviews and saves

### Fallback Path

1. User enters text in `AIInput`
2. Client sends request to `/api/ai/parse-expense`
3. API returns `status: "fallback"`
4. UI skips the confirmation preview
5. Existing `ManualExpenseForm` opens directly
6. Form uses any safe `prefill` values and preserves the original user text as context where useful
7. User completes the remaining fields manually

The fallback path exists to keep the flow moving forward even when AI extraction is weak. It must not invent missing values just to avoid manual input.

## Error Handling

Recoverable parser failures return `status: "fallback"`:
- invalid JSON from the model
- empty model output
- schema mismatch
- unsupported or ambiguous category output
- model response that cannot be normalized safely

Non-recoverable server failures return HTTP `500`:
- missing OpenRouter API key
- route-level exceptions that prevent shaping a normal response

Client behavior:
- `fallback` opens the manual form directly
- `500` keeps the user in the AI input surface and shows a concise retryable error state

## Normalization Rules

Server-side normalization rules:
- date format must be `DD/MM/YYYY`
- amount must be numeric and positive
- note must be a short string
- category must normalize to the existing `Category` enum

Safe fallback extraction:
- `note` may be derived from the original input text
- `amount` may be included only if it can be derived confidently
- date and category should not be fabricated in fallback mode

## Components Affected

Primary files likely affected during implementation:
- `src/components/AIInput.tsx`
- `src/app/api/ai/parse-expense/route.ts`
- `src/lib/ai/*`

Optional small UI addition:
- a compact parsed preview component, or equivalent inline preview block inside `AIInput`

No other broad refactor is part of this design.

## Testing Strategy

Use targeted checks only.

### Parser Unit Tests

Cover:
- valid model JSON maps to the expected expense draft shape
- invalid JSON becomes `fallback`
- schema mismatch becomes `fallback`
- unsupported category becomes `fallback`
- category normalization uses the exact `Category` enum values

### API Route Tests

Cover:
- valid request returns `status: "success"`
- malformed or unsafe model response returns `status: "fallback"`
- missing API key returns HTTP `500`

### Component Tests

Cover:
- loading state during request
- success response shows confirmation preview
- fallback response opens the manual form directly

## Constraints

- Do not keep Gemini and OpenRouter running in parallel for this flow
- Do not add background parsing or polling in v1
- Do not let AI write directly to persistence
- Do not expand this into a general “Ask AI” assistant in the same change

## Open Questions Resolved

- Replace current Gemini path: yes
- General AI chat in v1: no
- Success UX: confirmation preview before manual form
- Failure UX: open fallback manual path
- Transport model: plain API route, no polling

## Implementation Boundary

This design is intentionally scoped to one feature path:
- user enters expense text
- app requests AI parsing
- app previews or falls back
- user confirms through the existing form

That is small enough for a single implementation plan and does not require decomposition into multiple independent projects.
