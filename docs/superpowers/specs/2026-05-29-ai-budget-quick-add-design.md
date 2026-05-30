# AI Budget Quick Add Design

Date: 2026-05-29
Last revised: 2026-05-30
Status: Implemented

## Goal

Revise the AI quick-add expense flow on the `/ai` page so the AI chooses from the
user's available budgets instead of classifying a legacy category. The user's
expense category is then **derived from the chosen budget**, matching the rest of
the app.

The feature supports two outcomes:

- High-confidence drafts with a resolved budget are added directly as expenses.
- Lower-confidence, incomplete, or no-match drafts open `QuickExpenseDrawer` with
  prefilled fields for review.

`ManualExpenseForm` is stale and must not be used by this flow.

## Current Context (verified against the codebase)

This section records the as-built state the redesign starts from. Paths and types
were confirmed on 2026-05-30.

### Two AI flows exist today

- **Parse** — `src/lib/ai/parse-expense.ts` + `src/app/api/ai/parse-expense/route.ts`.
  Request is `{ input }` only. Success returns `{ date, amount, note, category }`
  where `category` is a legacy `Category` enum value. **No budgets are sent.**
  Contract in `src/lib/ai/parse-expense-contract.ts`.
- **Suggest budget** — `src/lib/ai/suggest-budget-contract.ts`. Request is
  `{ note, budgets }` where each candidate is
  `{ id, name, amount, spent, remaining, period, periodStartDate?, periodEndDate? }`
  — note that the budget's `category` is **not** sent. It returns
  `{ status, budgetId?, confidence?, reason? }`. This flow is already wired into
  `QuickExpenseDrawer.handleNoteBlur` (`src/components/QuickExpenseDrawer.tsx:684`)
  and runs on note blur once the drawer is open.

### Budgets already carry a mapped category

`src/db/schema.ts` defines `budgets.category` (`Category` enum, default
`Category.OTHER`). The weekly budget options query already exposes it:

```ts
// src/lib/queries/budget-weekly.ts
export type BudgetWeeklyOption = {
  id: number;
  name: string;
  icon: string;
  color: BudgetColorId;
  period: BudgetPeriod;          // "week" | "month" | "custom"
  periodStartDate: string | null;
  periodEndDate: string | null;
  amount: number;
  spent: number;
  remaining: number;
  category: Category;            // <- mapped category
};
```

`queries.budgetWeekly.options(weekStart, targetDate)` returns every budget whose
period range covers `targetDate`, so a single call yields the **week and month**
budgets active on that date (plus any custom-period budgets that cover it).

### The drawer already auto-applies a budget's category

When a budget is selected (manually, via `applySuggestedBudget`, or via the budget
chip row), the drawer copies the budget's `category` into the draft **unless the
user has manually edited the category**:

```ts
// src/components/QuickExpenseDrawer.tsx
const shouldApplyBudgetCategory = () =>
  !isEditMode && !categoryUserEditedRef.current;
```

It also tracks a budget-selection source ref valued `"manual" | "ai" | "none"`, and
clears a stale `budgetId` (resetting name/icon/color) when the budget is not present
in the reloaded options for the current draft date
(`QuickExpenseDrawer.tsx:647`).

### The `/ai` page uses `ManualExpenseForm`

`src/app/ai/page.tsx` renders `AIExpenseChat`, which on both the success and
fallback paths renders `ManualExpenseForm`. `src/components/AIInput.tsx` is an
older variant that is **not mounted anywhere** and also uses `ManualExpenseForm`.

### Category enum (current values)

```ts
// src/enums
enum Category {
  FOOD = "Food",
  SHOPPING = "Shopping",
  HOUSING = "Housing",
  TRANSPORT = "Transport",
  BADMINTON = "Badminton",
  ENTERTAINMENT = "Entertainment",
  GIVING = "Giving",
  OTHER = "Other",
}
```

### Prefill event (current shape — must be extended)

```ts
// src/lib/expense-prefill.ts
export type ExpensePrefillPayload = {
  amount: number;
  note: string;
  category: string;
  source?: QuickAddSource;
};
```

The drawer's prefill handler (`QuickExpenseDrawer.tsx:617`) currently applies only
`amount`, `note`, and `category`, then resets the budget-selection source to
`"none"`.

### Save path

`useCreateExpenseMutation` (`src/lib/mutations/index.ts:302`) takes
`CreateExpenseInput`:

```ts
// src/db/type.d.ts
type CreateExpenseInput = Pick<TExpense, "date" | "amount" | "category"> & {
  clientId?: string | null;
  note?: string;
  paidBy: PaidBy;
  budgetId?: number | null;
  budgetName?: string | null;
  budgetIcon?: string | null;
  budgetColor?: BudgetColorId | null;
};
```

Default `paidBy` comes from `useSettingsStore((s) => s.paidBy)`, normalized the same
way the drawer does via `normalizePaidBy`.

## Resolved Decisions

These were settled during design review. They override the original draft wherever
they conflict.

1. **Single merged call.** `parse-expense` is extended to receive budgets and to
   return a `budgetId`. The separate `suggest-budget` flow is left untouched and is
   **not** given category context (deliberate scope boundary). The drawer keeps
   using `suggest-budget` only for its own note-blur path.
2. **Surface: `/ai` chat only.** `AIExpenseChat` is rewired to auto-add or to open
   `QuickExpenseDrawer` via an extended prefill event. It stops rendering
   `ManualExpenseForm`. `AIInput.tsx` is deleted (see Cleanup).
3. **Category is derived from the chosen budget.** A resolved budget contributes its
   mapped `category`; `Category.OTHER` is used only when `budgetId` is `null`.
4. **AI does not emit a category.** The response carries `budgetId` only; there is no
   AI `category` field and no per-no-match category fallback.
5. **Budgets sent = today's active set.** The client sends the budgets returned by
   `queries.budgetWeekly.options(currentWeekStart, today)` — i.e. the week + month
   (+ covering custom) budgets active today.
6. **Auto-add gate.** Auto-add only when: `confidence === "high"` AND amount, date,
   and note are valid AND `budgetId` resolves to a sent budget AND the parsed date
   falls within that budget's `periodStartDate..periodEndDate`. Otherwise open the
   drawer.
7. **Re-suggest suppression.** When the drawer opens via prefill with a non-null
   `budgetId`, mark the budget-selection source `"ai"` so the drawer's note-blur
   suggestion does not override it. When the prefilled `budgetId` is `null`, leave
   the source `"none"` so the drawer may still suggest. A manual budget change sets
   the source `"manual"` and locks it.

   Implementation note: this suppression is realized with a dedicated
   budget-selection source value `"ai-prefill"` in `QuickExpenseDrawer` (locked
   against note-blur re-suggestion like `"manual"`), while the drawer's own
   in-drawer suggestion keeps using `"ai"` and stays re-suggestable.

## Flow

1. User enters natural-language text in `AIExpenseChat`.
2. Client loads today's active budgets via
   `queries.budgetWeekly.options(currentWeekStart, today)` and sends
   `{ input, budgets: [{ id, name, category }] }` to `POST /api/ai/parse-expense`.
3. Server extracts amount, date, and note, then selects a `budgetId` only from the
   provided budgets (or `null`).
4. Client handles the result:
   - **Auto-add** when the gate in Decision 6 is satisfied.
   - Otherwise dispatch the extended prefill event to open `QuickExpenseDrawer`
     (Decision 7).

## Request Contract

```ts
type ParseExpenseRequest = {
  input: string;
  budgets: Array<{
    id: number;
    name: string;
    category: Category; // the budget's mapped category, for matching context
  }>;
};
```

Rules:

- `input` must be non-empty after trimming.
- `budgets` is the only allowed budget universe; an empty array is valid (user has no
  budgets) and forces `budgetId: null`.
- The server must reject invalid budget ids, empty budget names, category values
  outside the `Category` enum, and oversized lists.
- The AI must never invent a budget id.
- `category` is sent **as matching context only**. The AI still returns a `budgetId`,
  never a category.

## Response Contract

```ts
type ParseExpenseSuccessResponse = {
  status: "success";
  originalInput: string;
  expense: {
    date: string;        // DD/MM/YYYY
    amount: number;      // VND, whole number, >= 1000
    note: string;        // short, non-empty, prefer Vietnamese
    budgetId: number | null;
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
    date?: string;       // DD/MM/YYYY when extractable
    budgetId?: number | null;
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

- No `category` field is returned (Decision 4).
- No `budgetName` / `budgetIcon` / `budgetColor` is returned; the client resolves all
  budget display metadata locally from `budgetOptions` by `budgetId`.
- `budgetId` must be either `null` or one of the provided budget ids. A `budgetId`
  outside the provided list is treated as a schema mismatch (fallback).
- `amount` is VND: a whole number with a **minimum of 1000**. Sub-1000 or fractional
  amounts are invalid → not high confidence (route to the drawer / fallback).
- `note` should be written in **Vietnamese** (a short, natural Vietnamese phrase),
  even when the input mixes English or shorthand.
- `confidence: "high"` is allowed only when amount, date, note, and a non-null
  `budgetId` are all valid.

## AI Budget Matching

The AI treats budget **name plus mapped category** as the matching signal, replacing
the old fixed category list.

Prompt rules:

- Choose only from the provided budget ids; never invent one.
- Use the budget `name` as the primary signal and the budget `category` as secondary
  disambiguation (e.g. two "Grab" budgets, one mapped to `Transport` and one to
  `Food`).
- Match Vietnamese with or without diacritics.
- Treat common shorthand naturally: `cf` → coffee, `xang` → fuel, `grab` → transport
  or food depending on budget names/categories.
- Write the `note` in Vietnamese — a short, natural phrase — normalizing shorthand
  (e.g. `cf sua da` → `Cà phê sữa đá`), even when the input is English or mixed.
- Amounts are VND with a minimum of 1000; expand shorthand (`35k` → 35000,
  `1.2tr` → 1200000) and never emit a fractional or sub-1000 amount.
- If no provided budget plausibly matches, return `budgetId: null` with non-high
  confidence (success path) or a `no_budget_match` fallback.
- Return a short `reason` explaining the match.

Example request:

```json
{
  "input": "cf sua da 35k sang nay",
  "budgets": [
    { "id": 1, "name": "Ăn uống", "category": "Food" },
    { "id": 2, "name": "Cà phê", "category": "Food" },
    { "id": 3, "name": "Xăng xe", "category": "Transport" }
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
    "note": "Cà phê sữa đá",
    "budgetId": 2,
    "confidence": "high",
    "reason": "Matched coffee wording to the Cà phê budget."
  }
}
```

## High-Confidence Auto Add

When `status: "success"` and the **auto-add gate** (Decision 6) holds, the client
creates the expense immediately without opening `QuickExpenseDrawer`.

Auto-add gate (all must be true):

- `confidence === "high"`.
- `amount` is a whole VND number `>= 1000`, `note` is non-empty, and `date` parses.
- `budgetId` is non-null and resolves to a budget in the sent options.
- The parsed date falls within that budget's `periodStartDate..periodEndDate`. (A
  weekly budget picked for a different week fails here → open the drawer instead, so
  the drawer can reload the correct week and re-resolve.)

The client resolves the budget locally and builds the save payload:

```ts
{
  date: "YYYY-MM-DD";          // converted from DD/MM/YYYY
  amount: number;
  note: string;
  category: resolvedBudget.category;   // derived from the budget (Decision 3)
  paidBy: settingsPaidBy;              // useSettingsStore -> normalizePaidBy
  budgetId: number;
  budgetName: resolvedBudget.name;
  budgetIcon: resolvedBudget.icon;
  budgetColor: resolvedBudget.color;
}
```

Rules:

- Convert the AI date from `DD/MM/YYYY` to `YYYY-MM-DD` for the payload.
- `category` is always the resolved budget's `category` (never hard-coded
  `Category.OTHER`; `OTHER` only appears for the no-budget review path).
- Use the existing `useCreateExpenseMutation` write path — no AI-specific write path.
- On success show a compact toast such as `Added 35,000₫ to Cà phê` (reuse or mirror
  `QuickExpenseSuccessToast`).
- On failure, rely on the existing expense sync and recovery system.

## Review Path

Open `QuickExpenseDrawer` (via the prefill event) when any of these are true:

- Confidence is `medium` or `low`.
- `budgetId` is `null`.
- `budgetId` does not resolve in the sent options.
- The resolved budget does not cover the parsed date.
- The parse result is a fallback.
- A required save field is missing.

### Extend the prefill payload

```ts
type ExpensePrefillPayload = {
  amount: number;
  note: string;
  date?: string;                 // DD/MM/YYYY
  budgetId?: number | null;
  budgetName?: string | null;
  budgetIcon?: string | null;
  budgetColor?: BudgetColorId | null;
  source?: QuickAddSource;
};
```

Notes vs. the current shape:

- `category` is removed from the payload — the drawer derives it from the budget.
- `date`, `budgetId`, and budget display fields are added.
- The chat resolves budget display fields locally before dispatching; if `budgetId`
  is `null`, the budget fields are omitted/null.

### Drawer prefill handler changes

`QuickExpenseDrawer` must, on the prefill event:

- Apply `amount`, `note`, and `date` (so it reloads budgets for the correct week).
- Apply `budgetId` and the resolved budget display fields.
- Derive `category` from the applied budget (respecting `shouldApplyBudgetCategory`).
- Set the budget-selection source per Decision 7: `"ai"` when `budgetId` is non-null
  (suppresses note-blur re-suggestion), `"none"` when `null` (allows it).
- Preserve the existing "user manual budget change wins, then locks to `manual`"
  behavior and the stale-`budgetId`-clearing effect.

`ManualExpenseForm` remains out of scope.

## Component Boundaries

### `AIExpenseChat` (rewired)

- Collect the natural-language input.
- Load today's active budgets via
  `queries.budgetWeekly.options(currentWeekStart, today)`.
- Send `{ input, budgets: [{ id, name, category }] }` to `/api/ai/parse-expense`.
- Resolve the returned `budgetId` against the loaded options.
- Auto-create high-confidence drafts that pass the gate.
- Dispatch the extended prefill event for review-needed drafts.
- Stop rendering `ManualExpenseForm`.

### API Route (`/api/ai/parse-expense`)

- Validate request shape (input + budgets with category) with Zod.
- Call the parser with the budget candidates.
- Return a stable `ApiResponse<ParseExpenseResponse>`.
- No database writes.

### Parser module (`src/lib/ai/parse-expense.ts`)

- Build the model prompt from input + budgets (name + mapped category).
- Parse and validate model output.
- Validate the returned `budgetId` against the provided budgets (out-of-list → schema
  mismatch fallback).
- Shape fallback responses with safe prefill values.

### `QuickExpenseDrawer`

- Accept the extended prefill payload (date + budget fields).
- Derive category from the applied budget.
- Honor the budget-selection-source rule (Decision 7).
- Save through the existing quick-expense mutation path.
- Preserve existing edit, recovery, budget picker, and sync behavior.

## Cleanup

- Delete `src/components/AIInput.tsx` (unmounted, uses `ManualExpenseForm`).
- If `AIExpensePreviewCard` (or other AIInput-only helpers) become orphaned after the
  rewire, remove them too.
- Leave `suggest-budget` and `ManualExpenseForm` themselves untouched (still used
  elsewhere).

## Error Handling

Recoverable parse failures return `status: "fallback"` and open `QuickExpenseDrawer`:

- invalid JSON, empty model response, schema mismatch, request failed, no plausible
  budget match.

Hard API failures return an error envelope (missing OpenRouter API key, unexpected
route exception).

Client behavior:

- Hard API failure shows a retryable error state (the chat already has a "Try again"
  affordance).
- Fallback opens the drawer with safe prefill.
- Auto-add never happens unless the full gate passes.

## Testing Strategy

Targeted checks only.

Parser tests:

- Valid model JSON with a provided `budgetId` returns a high-confidence draft.
- A returned `budgetId` outside the provided list becomes fallback / schema mismatch.
- No budget match returns `budgetId: null` (non-high) or `no_budget_match` fallback.
- Invalid JSON, empty content, and request failure return fallback.
- Amount shorthand such as `35k` and `1.2tr` is handled.
- Amounts below 1000 or fractional are rejected as invalid (not high confidence).
- The returned `note` is Vietnamese (shorthand normalized, e.g. `cf` → `Cà phê`).
- The prompt includes budget name **and** category; the response never includes a
  category field.

Route tests:

- Reject invalid payloads (missing input, malformed budgets, bad category values).
- Pass `input` and `budgets` into the parser.
- Return success/fallback through the API envelope.
- Return an error envelope for a missing API key.

Client (`AIExpenseChat`) tests:

- High-confidence + resolved-and-covering budget calls the create-expense path and
  does NOT open the drawer.
- The save payload's `category` equals the resolved budget's category.
- Medium/low confidence dispatches the prefill event and opens the drawer.
- Unknown / null `budgetId` opens the drawer instead of auto-adding.
- A high-confidence weekly budget whose period does not cover the parsed date opens
  the drawer.
- Fallback opens the drawer with safe prefill.
- `ManualExpenseForm` is not rendered by this flow.

`QuickExpenseDrawer` tests:

- Prefill event applies amount, note, date, budgetId, and resolved budget
  name/icon/color, and derives category from the budget.
- A non-null prefilled budget suppresses note-blur re-suggestion; a null one does not.
- User manual budget selection still wins and locks after the drawer is open.
- Existing create/edit/recovery behavior remains intact.

## Out Of Scope

- Voice input, receipt OCR, multi-expense parsing, background AI jobs.
- AI-created budgets, general-purpose finance chat.
- Any changes to `ManualExpenseForm`.
- Adding category context to the separate `suggest-budget` flow.
- Bottom-nav quick-add behavior (unchanged; it already loads budgets per draft date).
