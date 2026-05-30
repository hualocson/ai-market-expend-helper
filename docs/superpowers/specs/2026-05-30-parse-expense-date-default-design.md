# Parse-Expense Date Defaulting & Hallucination Guard

Date: 2026-05-30
Status: Approved design (pending implementation)

## Problem

When a user's quick-add input contains no date (e.g. "cf sua da 35k"), the AI
parse-expense model emits an arbitrary date. The system prompt
(`src/lib/ai/parse-expense.ts`) instructs the model that `date must be
DD/MM/YYYY`, but it **never gives the model today's date**. With nothing to
anchor to, the model invents a date that usually falls outside the matched
budget's period.

Downstream, `handleResult` in `src/components/AIExpenseChat.tsx` requires
`isDateWithinBudgetPeriod(budget, isoDate)` to be true for `canAutoAdd`. A
bogus date fails that check, so a perfectly clear expense ("coffee 35k") never
auto-adds — it always falls to the confirm drawer, and the drawer is prefilled
with the garbage date.

## Goals

1. Input with **no date** resolves to **today**, deterministically, and stays
   eligible for auto-add.
2. The model can correctly resolve **relative dates** ("yesterday", "hôm qua",
   "thứ 3 tuần trước") because it now receives today's date.
3. A model-emitted date that is **wildly far from today (> 1 month)** is treated
   as a likely hallucination: the prefill date is reset to today and the confirm
   drawer is forced (no silent auto-add).

## Non-Goals

- No change to the auto-add confidence/budget/note checks beyond date handling.
- No new "do-not-trust" flag in the server response contract.
- No reformatting of the app's internal `YYYY-MM-DD` representation; the change
  is confined to the AI boundary (`DD/MM/YYYY`) and the existing client decision
  logic.

## Design Principles

The two-layer split is preserved:

- **Server (`parse-expense.ts`)** stays purely mechanical: normalize and
  validate. It owns the deterministic "no date = today" rule because that value
  must not be hallucinated.
- **Client (`handleResult`)** owns trust decisions, alongside the existing
  `canAutoAdd` checks. The "this date is too suspicious to auto-add" guard lives
  here so the server contract needs no new flag.

"Today" is computed **client-side** (`dayjs().format("DD/MM/YYYY")`) and passed
in the request. The route handler runs server-side (UTC on the host), so
server-local `new Date()` would be wrong for a UTC+7 user near midnight. Client
local date also matches `loadTodayBudgets` (`AIExpenseChat.tsx:100`), which
already derives the week range from client-local `dayjs()`.

## Changes

### 1. Contract — `src/lib/ai/parse-expense-contract.ts`

- Add `today` to `parseExpenseRequestSchema`, validated as `DD/MM/YYYY`:

  ```ts
  today: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/),
  ```

  (Define the pattern as a shared const, e.g. `PARSE_EXPENSE_DATE_PATTERN`, and
  reuse it in `parse-expense.ts` instead of the local `DATE_PATTERN`.)
- `ParseExpenseSuccessResponse.expense.date` remains a concrete `DD/MM/YYYY`
  string. The server guarantees it is always populated, so no consumer type
  changes are needed.

### 2. Prompt — `src/lib/ai/parse-expense.ts`

- `buildUserContent(input, budgets, today)` prepends a line:
  `Today is ${today}.`
- System prompt date rule becomes:
  > - date must be DD/MM/YYYY.
  > - If the text states or implies a date — including relative dates such as
  >   "yesterday", "hôm qua", "thứ 3 tuần trước" — resolve it to DD/MM/YYYY
  >   relative to today.
  > - If the text mentions **no date at all**, return `date: null`. Do not guess
  >   a date.
- Update the `confidence` rule so that a `null` date does not by itself force
  low confidence (the absent date is expected and resolved by the system, not a
  sign of uncertainty). Confidence still depends on amount, note, and a non-null
  budgetId.

### 3. Server normalization — `src/lib/ai/parse-expense.ts`

In `parseExpenseWithOpenRouter`:

- Accept `today: string` in `ParseExpenseArgs`.
- Date handling for the parsed model output:
  - `expense.date` is `null` / `undefined` / empty string → set `date = today`.
  - Non-empty and matches `PARSE_EXPENSE_DATE_PATTERN` → keep as-is.
  - Non-empty but malformed → `schema_mismatch` fallback (unchanged behavior).
- Result: a `success` response always carries a valid `DD/MM/YYYY` date.

### 4. Route — `src/app/api/ai/parse-expense/route.ts`

- Forward `parsedRequest.data.today` into `parseExpenseWithOpenRouter({ ..., today })`.

### 5. Client request — `src/components/AIExpenseChat.tsx`

- In `sendInput`, add to the POST body:
  ```ts
  today: dayjs().format("DD/MM/YYYY"),
  ```

### 6. Client hallucination guard — `src/components/AIExpenseChat.tsx`

In `handleResult`, after computing `isoDate` and before the `canAutoAdd` check,
add a gap guard for the success path:

- Compute `today = dayjs()` and `target = dayjs(isoDate)` (only when `isoDate`
  is non-null).
- **Suspicious** when the target is outside a ±1 calendar-month window:
  ```ts
  const isDateSuspicious =
    target.isBefore(today.subtract(1, "month"), "day") ||
    target.isAfter(today.add(1, "month"), "day");
  ```
- When suspicious:
  - Discard the model's date — open the drawer prefilled with **today**
    (`openForReview({ amount, note, date: today.format("DD/MM/YYYY") }, budget)`).
  - Do **not** auto-add (effectively `canAutoAdd = false` for this case).
- When not suspicious: existing `canAutoAdd` logic runs unchanged. No-date
  inputs now resolve to today server-side, so they pass
  `isDateWithinBudgetPeriod` for current-period budgets and auto-add when
  confidence is high.

The threshold is **calendar month, both directions** (symmetric): catches both
far-past and far-future hallucinations, calendar-aware via dayjs month
arithmetic.

## Flow After Change

```
"cf sua da 35k" (no date)
  client sends { input, budgets, today: "30/05/2026" }
  model: date=null, amount=35000, note="Cà phê sữa đá", budgetId=N, confidence=high
  server: date=null -> today "30/05/2026"  (success)
  client handleResult:
    gap(today, today) = 0  -> not suspicious
    canAutoAdd: high + valid iso + note + budget + date-in-period -> TRUE
  => AUTO-ADD ✅

"coffee hôm qua 35k"
  model: date=29/05/2026 (resolved relative to today)
  server: keeps date
  client: gap = 1 day -> not suspicious -> normal canAutoAdd path

model hallucinates "12/11/2027" despite null instruction
  server: keeps valid-format date
  client: gap > 1 month -> suspicious
  => reset prefill date to today, OPEN DRAWER (no auto-add) ✅

model returns malformed "2026-5-30"
  server: schema_mismatch fallback
  client: status=fallback -> OPEN DRAWER (existing behavior)
```

## Testing — `src/lib/ai/parse-expense.test.ts`

- Request schema rejects a malformed `today`; accepts `DD/MM/YYYY`.
- Model `date: null` → success with `date === today`.
- Relative-date input → resolved `DD/MM/YYYY`; assert `today` appears in the
  prompt sent to the mocked `fetchFn`.
- Explicit valid date is preserved.
- Malformed explicit date → `schema_mismatch` fallback (unchanged).

Client gap-guard tests (`AIExpenseChat` or an extracted helper):

- Prefer extracting the gap check into a small pure helper (e.g.
  `isExpenseDateSuspicious(isoDate, today)` or co-locate with
  `isDateWithinBudgetPeriod` in `src/lib/budget-options.ts`) so it is unit
  testable without rendering the chat: date within ±1 month → not suspicious;
  beyond → suspicious; both directions covered.

## Risks / Trade-offs

- A legitimate explicit date more than 1 month in the past (rare in quick-add)
  is reset to today and routed to the drawer. Mitigation: the drawer is the
  escape hatch — the date field is editable, so the user can restore it. The
  guard never silently persists a wrong date.
- Relative-date resolution accuracy still depends on the model, but it now has
  the anchor it lacked. The ±1-month guard bounds the blast radius of any
  remaining resolution error for auto-add.
