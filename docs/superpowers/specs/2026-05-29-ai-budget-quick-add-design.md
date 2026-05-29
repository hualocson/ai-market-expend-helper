# AI Budget Quick Add Design

Date: 2026-05-29
Status: Draft for review

## Goal

Revise the AI quick-add expense flow so AI chooses from the user's available budgets instead of choosing a legacy category.

The feature should support two outcomes:

- High-confidence AI drafts are added directly as expenses.
- Lower-confidence, incomplete, or no-match drafts open `QuickExpenseDrawer` with prefilled fields for review.

`ManualExpenseForm` is stale and must not be used for this flow.

## Current Context

The current AI parser contract accepts only free-text input and returns an expense draft with `date`, `amount`, `note`, and `category`.

The app already has a separate budget suggestion flow that chooses a `budgetId` from provided budget candidates, and the modern quick-add UI already saves expenses through `QuickExpenseDrawer`.

The revised design should combine these concepts around the current quick-add surface:

- `QuickExpenseDrawer` is the only manual review/edit surface.
- The AI parse request receives a budget list shaped as `{ id, name }[]`.
- Budgets replace categories in the AI decision contract.
- Category remains only as a legacy required expense field during save.

## Recommended Approach

Use a single AI parse flow that receives the user's text plus current budget candidates.

Flow:

1. User enters a natural-language expense.
2. Client provides available budgets to `POST /api/ai/parse-expense`.
3. Server extracts amount, date, and note, then selects a `budgetId` only from the provided budgets.
4. Client handles the result:
   - `confidence: "high"`: create the expense directly.
   - `confidence: "medium"` or `confidence: "low"`: open `QuickExpenseDrawer` with the draft.
   - no budget match, invalid result, or fallback: open `QuickExpenseDrawer` with safe prefill.

This keeps the user out of the drawer for obvious expenses while preserving review for uncertain ones.

## Request Contract

```ts
type ParseExpenseRequest = {
  input: string;
  budgets: Array<{
    id: number;
    name: string;
  }>;
};
```

Rules:

- `input` must be non-empty after trimming.
- `budgets` is the only allowed budget universe.
- The server must reject invalid budget ids, empty budget names, or oversized lists.
- The AI must never invent a budget id or budget name.

## Response Contract

```ts
type ParseExpenseSuccessResponse = {
  status: "success";
  originalInput: string;
  expense: {
    date: string;
    amount: number;
    note: string;
    budgetId: number | null;
    budgetName?: string | null;
    confidence: "high" | "medium" | "low";
    reason: string;
  };
};

type ParseExpenseFallbackResponse = {
  status: "fallback";
  originalInput: string;
  prefill: {
    note?: string;
    amount?: number;
    date?: string;
    budgetId?: number | null;
    budgetName?: string | null;
  };
  reason:
    | "invalid_json"
    | "schema_mismatch"
    | "empty_response"
    | "request_failed"
    | "no_budget_match";
};

type ParseExpenseResponse =
  | ParseExpenseSuccessResponse
  | ParseExpenseFallbackResponse;
```

Response rules:

- `date` is returned as `DD/MM/YYYY` for `QuickExpenseDrawer`.
- `amount` must be a positive finite number.
- `note` must be short and non-empty for success.
- `budgetId` must be either `null` or one of the provided budget ids.
- `confidence: "high"` is allowed only when amount, date, note, and budget choice are all valid.

## AI Budget Matching

The AI should treat budget names as the replacement for the old category list.

Prompt rules:

- Choose only from the provided budget ids.
- Use budget name as the primary matching signal.
- Match Vietnamese with or without diacritics.
- Treat common shorthand naturally, such as `cf` for coffee, `xang` for fuel, and `grab` for transport or food depending on budget names.
- If no provided budget plausibly matches, return `budgetId: null` with non-high confidence or a no-match fallback.
- Return a short `reason` explaining the match.

Example request:

```json
{
  "input": "cf sua da 35k sang nay",
  "budgets": [
    { "id": 1, "name": "Ăn uống" },
    { "id": 2, "name": "Cà phê" },
    { "id": 3, "name": "Xăng xe" }
  ]
}
```

Example success:

```json
{
  "status": "success",
  "originalInput": "cf sua da 35k sang nay",
  "expense": {
    "date": "29/05/2026",
    "amount": 35000,
    "note": "cf sua da",
    "budgetId": 2,
    "budgetName": "Cà phê",
    "confidence": "high",
    "reason": "Matched coffee wording to Cà phê."
  }
}
```

## High-Confidence Auto Add

When the response is `status: "success"` and `confidence: "high"`, the client should create the expense immediately without opening `QuickExpenseDrawer`.

The client must resolve the selected budget from the current budget options before saving so the expense payload includes budget display metadata:

```ts
{
  date: "YYYY-MM-DD";
  amount: number;
  note: string;
  category: Category.OTHER;
  paidBy: defaultPaidBy;
  budgetId: number | null;
  budgetName: string | null;
  budgetIcon: string | null;
  budgetColor: BudgetColorId | null;
}
```

Rules:

- Convert the AI date from `DD/MM/YYYY` to the save payload date format.
- Use `Category.OTHER` as the legacy required category value.
- Use the user's default `paidBy`.
- If the returned `budgetId` cannot be found in current budget options, do not auto-add; open `QuickExpenseDrawer` instead.
- Use the existing expense mutation/sync path rather than creating a new AI-specific write path.
- On success, show a compact toast such as `Added 35,000₫ to Cà phê`.
- On failure, rely on the existing expense sync and recovery system.

## Review Path

Open `QuickExpenseDrawer` when any of these are true:

- AI confidence is `medium`.
- AI confidence is `low`.
- AI returns `budgetId: null`.
- The returned `budgetId` is not in current budget options.
- The parse result is fallback.
- The draft is missing a required save field.

The existing prefill event should be extended from amount/note/category only to include budget and date fields:

```ts
type ExpensePrefillPayload = {
  amount: number;
  note: string;
  category: Category;
  date?: string;
  budgetId?: number | null;
  budgetName?: string | null;
  budgetIcon?: string | null;
  budgetColor?: BudgetColorId | null;
  source?: QuickAddSource;
};
```

`QuickExpenseDrawer` should apply these fields into its draft when handling the prefill event.

Rules:

- The drawer opens only for review-needed cases.
- The drawer should preserve the user's ability to manually change the budget.
- Once the user manually changes the budget, AI should not override it.
- `ManualExpenseForm` remains out of scope.

## Component Boundaries

### AI Input or Chat Component

Responsibilities:

- Collect the natural-language input.
- Load current budget options for the target date.
- Send `{ input, budgets }` to `/api/ai/parse-expense`.
- Resolve the returned budget id against loaded budget options.
- Auto-create high-confidence drafts.
- Dispatch prefill to `QuickExpenseDrawer` for review-needed drafts.

### API Route

Responsibilities:

- Validate request shape.
- Call the parser with the budget candidates.
- Return a stable `ApiResponse<ParseExpenseResponse>`.
- Avoid database writes.

### Parser Module

Responsibilities:

- Build the model prompt from input and budgets.
- Parse and validate model output.
- Validate returned `budgetId` against provided budgets.
- Shape fallback responses with safe prefill values.

### QuickExpenseDrawer

Responsibilities:

- Accept extended prefill payloads.
- Open with AI draft fields applied.
- Save through the existing quick-expense mutation path.
- Preserve existing edit, recovery, budget picker, and sync behavior.

## Error Handling

Recoverable parse failures return `status: "fallback"` and should open `QuickExpenseDrawer`:

- invalid JSON
- empty model response
- schema mismatch
- request failed
- no plausible budget match

Hard API failures return an error envelope:

- missing OpenRouter API key
- unexpected route exception

Client behavior:

- Hard API failure should show a retryable error state.
- Fallback should keep the user moving by opening the drawer with safe prefill.
- High-confidence auto-add should not happen unless the draft is fully valid and the budget id resolves locally.

## Testing Strategy

Use targeted checks only.

Parser tests:

- Valid model JSON returns a high-confidence draft with a provided budget id.
- Returned budget id outside the provided list becomes fallback or schema mismatch.
- No budget match returns fallback/no-match behavior.
- Invalid JSON, empty content, and request failure return fallback.
- Amount shorthand such as `35k` and `1.2tr` is handled.

Route tests:

- Reject invalid payloads.
- Pass `input` and `budgets` into the parser.
- Return success/fallback through the API envelope.
- Return an error envelope for missing API key.

Client tests:

- High-confidence result calls the existing create expense path and does not open `QuickExpenseDrawer`.
- Medium/low confidence dispatches the prefill event and opens `QuickExpenseDrawer`.
- Unknown returned budget id opens the drawer instead of auto-adding.
- Fallback opens the drawer with safe prefill.
- `ManualExpenseForm` is not rendered by this flow.

QuickExpenseDrawer tests:

- Prefill event applies amount, note, date, budget id, budget name, budget icon, and budget color.
- User manual budget selection still wins after the drawer is open.
- Existing create/edit/recovery behavior remains intact.

## Out Of Scope

- Voice input.
- Receipt OCR.
- Multi-expense parsing.
- Background AI jobs.
- AI-created budgets.
- General-purpose finance chat.
- Any changes to `ManualExpenseForm`.

