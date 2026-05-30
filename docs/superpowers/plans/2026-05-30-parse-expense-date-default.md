# Parse-Expense Date Defaulting & Hallucination Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AI-parsed expenses default a missing date to today (so no-date inputs can auto-add), let the model resolve relative dates by giving it today's date, and reset wildly-off dates (> 1 calendar month from today) to today while forcing the confirm drawer.

**Architecture:** The AI boundary stays the only place that uses `DD/MM/YYYY`. The server parser (`parse-expense.ts`) becomes purely mechanical: it receives `today` from the client, injects it into the prompt, and fills `today` whenever the model returns a null/empty date. The client (`AIExpenseChat.tsx`) sends its local `today` and owns the trust decision — a pure `isExpenseDateSuspicious` helper resets bogus dates to today and routes them to the drawer instead of auto-adding.

**Tech Stack:** Next.js 15 route handler, Zod, OpenRouter chat completions, dayjs (`@/configs/date`), Vitest.

**Spec:** `docs/superpowers/specs/2026-05-30-parse-expense-date-default-design.md`

**Conventions for every commit step below:**
- Already on branch `dev-ai-budget-quick-add` (correct `dev-` prefix). No new branch needed.
- After editing any `.ts`/`.tsx` file, run before committing:
  - `rtk bunx prettier --write <files>`
  - `rtk bunx eslint <files>`
- End every commit message with the line:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Use `bun run test` to run Vitest (script is `vitest run`).

---

## File Structure

- `src/lib/ai/parse-expense-contract.ts` — add a shared `DD/MM/YYYY` regex const and the required `today` request field.
- `src/lib/ai/parse-expense-contract.test.ts` — **new** — schema tests for `today`.
- `src/lib/ai/parse-expense.ts` — thread `today` through args + prompt; fill `today` for null/empty model dates; reuse the shared regex.
- `src/lib/ai/parse-expense.test.ts` — update existing calls to pass `today`; add null-date and prompt-content tests.
- `src/app/api/ai/parse-expense/route.ts` — forward `today` to the parser.
- `src/app/api/ai/parse-expense/route.test.ts` — add `today` to request bodies and the expected call args.
- `src/lib/budget-options.ts` — add pure `isExpenseDateSuspicious(isoDate, todayIso)` helper.
- `src/lib/budget-options.test.ts` — unit tests for the helper.
- `src/components/AIExpenseChat.tsx` — send `today`; apply the suspicious-date guard in `handleResult`.

---

## Task 1: Add shared date pattern + required `today` to the request contract

**Files:**
- Modify: `src/lib/ai/parse-expense-contract.ts`
- Test: `src/lib/ai/parse-expense-contract.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/lib/ai/parse-expense-contract.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  PARSE_EXPENSE_DATE_PATTERN,
  parseExpenseRequestSchema,
} from "./parse-expense-contract";

describe("parseExpenseRequestSchema today field", () => {
  it("accepts a DD/MM/YYYY today", () => {
    const result = parseExpenseRequestSchema.safeParse({
      input: "cf 35k",
      today: "30/05/2026",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing today", () => {
    const result = parseExpenseRequestSchema.safeParse({ input: "cf 35k" });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed today", () => {
    const result = parseExpenseRequestSchema.safeParse({
      input: "cf 35k",
      today: "2026-05-30",
    });
    expect(result.success).toBe(false);
  });
});

describe("PARSE_EXPENSE_DATE_PATTERN", () => {
  it("matches DD/MM/YYYY and rejects ISO", () => {
    expect(PARSE_EXPENSE_DATE_PATTERN.test("30/05/2026")).toBe(true);
    expect(PARSE_EXPENSE_DATE_PATTERN.test("2026-05-30")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/lib/ai/parse-expense-contract.test.ts`
Expected: FAIL — `PARSE_EXPENSE_DATE_PATTERN` is not exported and schema has no `today`.

- [ ] **Step 3: Implement the contract change**

In `src/lib/ai/parse-expense-contract.ts`, add the pattern const after the existing numeric consts (after line 7):

```ts
export const PARSE_EXPENSE_DATE_PATTERN = /^\d{2}\/\d{2}\/\d{4}$/;
```

Then add `today` to `parseExpenseRequestSchema` (inside the existing `z.object({ ... })`):

```ts
export const parseExpenseRequestSchema = z.object({
  input: z.string().trim().min(1).max(PARSE_EXPENSE_INPUT_MAX_LENGTH),
  today: z.string().regex(PARSE_EXPENSE_DATE_PATTERN),
  budgets: z
    .array(parseExpenseBudgetSchema)
    .max(PARSE_EXPENSE_MAX_BUDGETS)
    .default([]),
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/lib/ai/parse-expense-contract.test.ts`
Expected: PASS (all 4 cases).

- [ ] **Step 5: Format, lint, commit**

```bash
rtk bunx prettier --write src/lib/ai/parse-expense-contract.ts src/lib/ai/parse-expense-contract.test.ts
rtk bunx eslint src/lib/ai/parse-expense-contract.ts src/lib/ai/parse-expense-contract.test.ts
git add src/lib/ai/parse-expense-contract.ts src/lib/ai/parse-expense-contract.test.ts
git commit -m "feat(ai): require today and share date pattern in parse-expense contract

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Thread `today` through the server parser, prompt, and null-date fill

**Files:**
- Modify: `src/lib/ai/parse-expense.ts`
- Test: `src/lib/ai/parse-expense.test.ts`

- [ ] **Step 1: Update existing test calls and add new failing tests**

In `src/lib/ai/parse-expense.test.ts`, add `today: "29/05/2026",` to **every** existing `parseExpenseWithOpenRouter({ ... })` call (there are 10 of them — each currently passes `input`, `budgets`, `apiKey`, `fetchFn`). Example of the edited shape:

```ts
parseExpenseWithOpenRouter({
  input: "cf sua da 35k sang nay",
  budgets,
  today: "29/05/2026",
  apiKey: "test-key",
  fetchFn,
})
```

Then add two new tests inside the `describe("parseExpenseWithOpenRouter", ...)` block:

```ts
it("defaults a null date to today", async () => {
  const fetchFn = vi.fn().mockResolvedValue(
    createOpenRouterResponse(
      JSON.stringify({
        date: null,
        amount: 35000,
        note: "Cà phê sữa đá",
        budgetId: 2,
        confidence: "high",
        reason: "Matched coffee.",
      })
    )
  );

  await expect(
    parseExpenseWithOpenRouter({
      input: "cf sua da 35k",
      budgets,
      today: "30/05/2026",
      apiKey: "test-key",
      fetchFn,
    })
  ).resolves.toMatchObject({
    status: "success",
    expense: { date: "30/05/2026", confidence: "high" },
  });
});

it("injects today into the prompt for relative date resolution", async () => {
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
    input: "cf hom qua 35k",
    budgets,
    today: "30/05/2026",
    apiKey: "test-key",
    fetchFn,
  });

  const body = JSON.parse(fetchFn.mock.calls[0][1].body as string);
  const userMessage = body.messages[1].content as string;
  expect(userMessage).toContain("Today is 30/05/2026");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test src/lib/ai/parse-expense.test.ts`
Expected: FAIL — `today` is not a known arg (TS error) and the new assertions fail (no `Today is` line, null date currently rejected as `schema_mismatch`).

- [ ] **Step 3: Implement the parser changes**

In `src/lib/ai/parse-expense.ts`:

a) Update the contract import to include the shared pattern, and remove the local `DATE_PATTERN`:

```ts
import {
  PARSE_EXPENSE_DATE_PATTERN,
  PARSE_EXPENSE_MIN_AMOUNT,
} from "./parse-expense-contract";
```

Delete this line (currently line 14):

```ts
const DATE_PATTERN = /^\d{2}\/\d{2}\/\d{4}$/;
```

b) Replace the `date must be DD/MM/YYYY.` rule and the `confidence` rule in `SYSTEM_PROMPT`. The date block becomes:

```
- date must be DD/MM/YYYY.
- If the text states or implies a date — including relative dates such as "yesterday", "hôm qua", "thứ 3 tuần trước" — resolve it to DD/MM/YYYY relative to today.
- If the text mentions no date at all, return date as null. Do not guess a date.
```

The confidence line becomes:

```
- confidence is "high" only when amount, note, and a non-null budgetId are all confidently determined; a missing date does not lower confidence because today is used by default. Otherwise "medium" or "low".
```

c) Add `today` to `buildUserContent` and prepend it to the returned content:

```ts
const buildUserContent = (
  input: string,
  budgets: ParseExpenseBudget[],
  today: string
) => {
  const budgetLines = budgets.length
    ? budgets
        .map(
          (budget) =>
            `- id ${budget.id}: ${budget.name} (category: ${budget.category})`
        )
        .join("\n")
    : "(no budgets available)";

  return `Today is ${today}.\n\nText: ${input}\n\nBudgets:\n${budgetLines}`;
};
```

d) Add `today` to `ParseExpenseArgs`:

```ts
type ParseExpenseArgs = {
  input: string;
  budgets: ParseExpenseBudget[];
  today: string;
  apiKey: string;
  fetchFn?: typeof fetch;
};
```

e) Destructure `today` in `parseExpenseWithOpenRouter` and pass it to `buildUserContent`:

```ts
export const parseExpenseWithOpenRouter = async ({
  input,
  budgets,
  today,
  apiKey,
  fetchFn = fetch,
}: ParseExpenseArgs): Promise<ParseExpenseResponse> => {
```

```ts
        { role: "user", content: buildUserContent(input, budgets, today) },
```

f) Replace the date normalization. Find:

```ts
  const date = String(expense.date ?? "").trim();
```

Replace with:

```ts
  const rawDate = expense.date;
  const date =
    rawDate === null || rawDate === undefined || String(rawDate).trim() === ""
      ? today
      : String(rawDate).trim();
```

g) Replace `DATE_PATTERN.test(date)` in the validation block with `PARSE_EXPENSE_DATE_PATTERN.test(date)`:

```ts
  if (
    !PARSE_EXPENSE_DATE_PATTERN.test(date) ||
    !Number.isFinite(amount) ||
    !Number.isInteger(amount) ||
    amount < PARSE_EXPENSE_MIN_AMOUNT ||
    note.length === 0 ||
    !isConfidence(confidence)
  ) {
    return buildFallback(input, "schema_mismatch");
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test src/lib/ai/parse-expense.test.ts`
Expected: PASS — all existing tests plus the 2 new ones. (Today is a valid `DD/MM/YYYY`, so the null path fills a pattern-valid date; explicit valid dates are untouched; malformed explicit dates still fall back.)

- [ ] **Step 5: Format, lint, commit**

```bash
rtk bunx prettier --write src/lib/ai/parse-expense.ts src/lib/ai/parse-expense.test.ts
rtk bunx eslint src/lib/ai/parse-expense.ts src/lib/ai/parse-expense.test.ts
git add src/lib/ai/parse-expense.ts src/lib/ai/parse-expense.test.ts
git commit -m "feat(ai): default missing parse-expense date to today

Pass today into the prompt for relative-date resolution and fill it
when the model returns a null/empty date.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Forward `today` from the route handler

**Files:**
- Modify: `src/app/api/ai/parse-expense/route.ts:31-35`
- Test: `src/app/api/ai/parse-expense/route.test.ts`

- [ ] **Step 1: Update the route tests (will fail)**

In `src/app/api/ai/parse-expense/route.test.ts`, make these edits:

1. In `"returns parser success payload and forwards budgets"`, add `today` to the request body and the expected call args:

```ts
        body: JSON.stringify({
          input: "cf 35k",
          today: "30/05/2026",
          budgets: [{ id: 2, name: "Cà phê", category: "Food" }],
        }),
```

```ts
    expect(parseExpenseWithOpenRouter).toHaveBeenCalledWith({
      input: "cf 35k",
      budgets: [{ id: 2, name: "Cà phê", category: "Food" }],
      today: "30/05/2026",
      apiKey: "test-key",
    });
```

2. In `"returns parser fallback payload unchanged"`, add `today` to the body:

```ts
        body: JSON.stringify({ input: "Taxi 85k", today: "30/05/2026" }),
```

3. In `"returns 500 when OPENROUTER_API_KEY is missing"`, add `today` to the body:

```ts
        body: JSON.stringify({ input: "Lunch 120k today", today: "30/05/2026" }),
```

4. In `"returns 500 when parsing unexpectedly fails"`, add `today` to the body:

```ts
        body: JSON.stringify({ input: "Lunch 120k today", today: "30/05/2026" }),
```

Leave the three invalid-payload tests (`empty input`, `non-string input`, `malformed JSON`) and the `invalid category` test unchanged — they still return 400.

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test src/app/api/ai/parse-expense/route.test.ts`
Expected: FAIL — the success test's `toHaveBeenCalledWith` expects `today` but the route does not pass it yet.

(Note: before the route edit, the missing-key and unexpected-fail tests would actually pass again once bodies include `today`, since the schema now accepts them. The success test is the one that drives the implementation.)

- [ ] **Step 3: Implement the route change**

In `src/app/api/ai/parse-expense/route.ts`, update the parser call:

```ts
    const result = await parseExpenseWithOpenRouter({
      input: parsedRequest.data.input,
      budgets: parsedRequest.data.budgets,
      today: parsedRequest.data.today,
      apiKey,
    });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test src/app/api/ai/parse-expense/route.test.ts`
Expected: PASS (all 8 cases).

- [ ] **Step 5: Format, lint, commit**

```bash
rtk bunx prettier --write src/app/api/ai/parse-expense/route.ts src/app/api/ai/parse-expense/route.test.ts
rtk bunx eslint src/app/api/ai/parse-expense/route.ts src/app/api/ai/parse-expense/route.test.ts
git add src/app/api/ai/parse-expense/route.ts src/app/api/ai/parse-expense/route.test.ts
git commit -m "feat(ai): forward today from parse-expense route to parser

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Add the pure `isExpenseDateSuspicious` helper

**Files:**
- Modify: `src/lib/budget-options.ts`
- Test: `src/lib/budget-options.test.ts`

- [ ] **Step 1: Write the failing tests**

In `src/lib/budget-options.test.ts`, add `isExpenseDateSuspicious` to the existing named import from `./budget-options`:

```ts
import {
  type TBudgetOption,
  formatBudgetRange,
  groupBudgetOptions,
  isDateWithinBudgetPeriod,
  isExpenseDateSuspicious,
  pickDefaultBudget,
  sortBudgetOptions,
} from "./budget-options";
```

Add this describe block at the end of the file (after the final `});`):

```ts
describe("isExpenseDateSuspicious", () => {
  const today = "2026-05-30";

  it("is not suspicious for today", () => {
    expect(isExpenseDateSuspicious("2026-05-30", today)).toBe(false);
  });

  it("is not suspicious within one month either direction", () => {
    expect(isExpenseDateSuspicious("2026-05-01", today)).toBe(false);
    expect(isExpenseDateSuspicious("2026-06-29", today)).toBe(false);
  });

  it("is suspicious more than a month in the past", () => {
    expect(isExpenseDateSuspicious("2026-04-01", today)).toBe(true);
  });

  it("is suspicious more than a month in the future", () => {
    expect(isExpenseDateSuspicious("2027-11-12", today)).toBe(true);
  });

  it("is not suspicious when either date is unparseable", () => {
    expect(isExpenseDateSuspicious("not-a-date", today)).toBe(false);
    expect(isExpenseDateSuspicious("2026-05-30", "nope")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test src/lib/budget-options.test.ts`
Expected: FAIL — `isExpenseDateSuspicious` is not exported.

- [ ] **Step 3: Implement the helper**

In `src/lib/budget-options.ts`, add after `isDateWithinBudgetPeriod` (end of file):

```ts
export const isExpenseDateSuspicious = (
  isoDate: string,
  todayIso: string
): boolean => {
  const target = dayjs(isoDate, "YYYY-MM-DD", true);
  const today = dayjs(todayIso, "YYYY-MM-DD", true);
  if (!target.isValid() || !today.isValid()) {
    return false;
  }
  return (
    target.isBefore(today.subtract(1, "month"), "day") ||
    target.isAfter(today.add(1, "month"), "day")
  );
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test src/lib/budget-options.test.ts`
Expected: PASS (all 5 new cases + existing).

- [ ] **Step 5: Format, lint, commit**

```bash
rtk bunx prettier --write src/lib/budget-options.ts src/lib/budget-options.test.ts
rtk bunx eslint src/lib/budget-options.ts src/lib/budget-options.test.ts
git add src/lib/budget-options.ts src/lib/budget-options.test.ts
git commit -m "feat: add isExpenseDateSuspicious gap helper

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Wire the client — send `today` and apply the suspicious-date guard

**Files:**
- Modify: `src/components/AIExpenseChat.tsx`

This task has no unit test (the logic lives in the already-tested `isExpenseDateSuspicious` helper and the server parser). Verify with `tsc`, lint, and a manual dev-server check.

- [ ] **Step 1: Import the helper**

In `src/components/AIExpenseChat.tsx`, add `isExpenseDateSuspicious` to the existing import from `@/lib/budget-options`:

```ts
import {
  type TBudgetOption,
  isDateWithinBudgetPeriod,
  isExpenseDateSuspicious,
} from "@/lib/budget-options";
```

- [ ] **Step 2: Send `today` in the request body**

In `sendInput`, update the POST body (currently around line 232) to include `today`:

```ts
        body: JSON.stringify({
          input,
          today: dayjs().format("DD/MM/YYYY"),
          budgets: budgetOptions.map((option) => ({
            id: option.id,
            name: option.name,
            category: option.category,
          })),
        }),
```

- [ ] **Step 3: Add the suspicious-date guard in `handleResult`**

In `handleResult`, after the `budget` is resolved (after the block ending at line 149, before the `canAutoAdd` declaration at line 151), insert:

```ts
    const todayIso = dayjs().format("YYYY-MM-DD");
    if (isoDate !== null && isExpenseDateSuspicious(isoDate, todayIso)) {
      openForReview(
        {
          amount: expense.amount,
          note: expense.note,
          date: dayjs().format("DD/MM/YYYY"),
        },
        budget
      );
      replaceMessage(assistantId, {
        id: assistantId,
        role: "assistant",
        variant: "review",
      });
      haptics.warning();
      return;
    }
```

The existing `canAutoAdd` block stays exactly as-is below this guard.

- [ ] **Step 4: Typecheck and lint**

Run: `rtk bunx tsc --noEmit -p tsconfig.json`
Expected: no errors in `AIExpenseChat.tsx`.

Run: `rtk bunx prettier --write src/components/AIExpenseChat.tsx && rtk bunx eslint src/components/AIExpenseChat.tsx`
Expected: clean.

- [ ] **Step 5: Manual verification on the dev server**

Run: `bun run dev`
Then in the AI chat (iPhone 13/14 viewport):
1. Enter `cf sua da 35k` (no date) with a matching weekly budget present → expect **auto-add** with toast `Added 35.000₫ to <budget>`.
2. Enter `cf hom qua 35k` → expect the date resolved to yesterday; auto-add if yesterday is inside the budget period, otherwise the drawer prefilled with yesterday.
3. (Optional, to exercise the guard) Temporarily make the model return a far date, or trust that a > 1-month date opens the drawer prefilled with **today** rather than the bogus date.

- [ ] **Step 6: Commit**

```bash
git add src/components/AIExpenseChat.tsx
git commit -m "feat(ai): send today and guard suspicious AI dates in expense chat

No-date inputs now resolve to today and can auto-add; a parsed date more
than one month from today is reset to today and routed to the drawer.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Full suite + build gate before push

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `bun run test`
Expected: PASS, including `parse-expense-contract.test.ts`, `parse-expense.test.ts`, `route.test.ts`, `budget-options.test.ts`.

- [ ] **Step 2: Production build gate (required before pushing)**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 3: Stop and report**

Summarize: tests green, build green. Do not push unless the user asks.

---

## Self-Review Notes

- **Spec coverage:** Goal 1 (no date → today) → Task 2 (null fill) + Task 5 (auto-add path unchanged). Goal 2 (relative dates) → Task 2 (today in prompt). Goal 3 (>1-month guard) → Task 4 (helper) + Task 5 (handleResult guard). Contract/timezone decisions → Task 1 + Task 3 + Task 5 step 2. Testing section → Tasks 1–4.
- **Type consistency:** `today` is `string` (`DD/MM/YYYY`) across contract, args, and route; `isExpenseDateSuspicious(isoDate, todayIso)` takes two `YYYY-MM-DD` strings and is called with `dayjs().format("YYYY-MM-DD")` in the client. Shared regex named `PARSE_EXPENSE_DATE_PATTERN` everywhere (replaces the deleted local `DATE_PATTERN`).
- **Malformed explicit date:** intentionally left on the existing `schema_mismatch` → fallback drawer path (per spec); only `null`/empty fills today, and only an in-range-format-but-far date triggers the client guard.
