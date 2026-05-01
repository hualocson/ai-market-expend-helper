# Budget Picker Remaining-Amount Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show each budget's remaining amount in the budget picker drawer of the create/edit transaction form, matching the visual treatment used on the budgets list page.

**Architecture:** Pass three already-available fields (`amount`, `spent`, `remaining`) through the existing client query (`fetchWeeklyBudgetOptions`) without adding endpoints or DB calls, then render the remaining figure on each row of the picker in `ManualExpenseForm.tsx` using the shared `formatVndSigned` helper and the project's success/destructive tokens.

**Tech Stack:** Next.js 15 (App Router), React 19, TanStack Query, Tailwind v4, shadcn/ui, Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-05-01-budget-picker-remaining-design.md`

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `src/lib/queries/budget-weekly.ts` | Client query + types for the budget picker | Modify — extend types, pass new fields through `fetchWeeklyBudgetOptions` |
| `src/lib/queries/budget-weekly.test.ts` | Unit tests for the client query | Modify — update fixtures + assertions for the three new fields |
| `src/components/ManualExpenseForm.tsx` | Manual expense form, contains the budget picker drawer | Modify — import `formatVndSigned`, render remaining in each picker row |
| `src/components/ManualExpenseForm.quick-mode.test.tsx` | Tests for the budget drawer behavior | Modify — extend the grouping fixture with amounts and assert the formatted remaining is rendered with correct color |

No new files. No DB / route handler changes.

---

### Task 1: Extend the client query types and parser

**Files:**
- Modify: `src/lib/queries/budget-weekly.ts:5-21,82-95`
- Test: `src/lib/queries/budget-weekly.test.ts`

- [ ] **Step 1: Update both existing tests' expected shapes to include the new fields**

The current tests assert with `toEqual([...])` on the full object, so the test file must be updated alongside the type. We start here so the failing tests drive the implementation. Open `src/lib/queries/budget-weekly.test.ts` and:

(a) In the test "filters budget options to the selected date within the fetched week" (around line 38–86), add `amount`, `spent`, `remaining` to each fixture budget and to each expected option:

```ts
// fixtures inside json: budgets array
{
  id: 1,
  name: "Monthly March",
  period: "month",
  periodStartDate: "2026-03-01",
  periodEndDate: "2026-03-31",
  amount: 1000,
  spent: 200,
  remaining: 800,
},
{
  id: 2,
  name: "Monthly April",
  period: "month",
  periodStartDate: "2026-04-01",
  periodEndDate: "2026-04-30",
  amount: 1500,
  spent: 1700,
  remaining: -200,
},
{
  id: 3,
  name: "Week 30/03-05/04",
  period: "week",
  periodStartDate: "2026-03-30",
  periodEndDate: "2026-04-05",
  amount: 500,
  spent: 0,
  remaining: 500,
},
```

```ts
// expected
expect(options).toEqual([
  {
    id: 2,
    name: "Monthly April",
    period: "month",
    periodStartDate: "2026-04-01",
    periodEndDate: "2026-04-30",
    amount: 1500,
    spent: 1700,
    remaining: -200,
  },
  {
    id: 3,
    name: "Week 30/03-05/04",
    period: "week",
    periodStartDate: "2026-03-30",
    periodEndDate: "2026-04-05",
    amount: 500,
    spent: 0,
    remaining: 500,
  },
]);
```

(b) In the test "returns all fetched budget options when no target date is provided" (around line 88–129), add a fixture that omits the new fields entirely so we cover the defensive `?? 0` path. Update the expected output to include `amount: 0, spent: 0, remaining: 0` for that omitted-fields fixture, and explicit values for the other:

```ts
// fixtures
{
  id: 1,
  name: "Monthly March",
  period: "month",
  periodStartDate: "2026-03-01",
  periodEndDate: "2026-03-31",
  amount: 800,
  spent: 100,
  remaining: 700,
},
{
  id: 2,
  name: "Monthly April",
  period: "month",
  periodStartDate: "2026-04-01",
  periodEndDate: "2026-04-30",
  // amount/spent/remaining intentionally omitted
},
```

```ts
// expected
expect(options).toEqual([
  {
    id: 1,
    name: "Monthly March",
    period: "month",
    periodStartDate: "2026-03-01",
    periodEndDate: "2026-03-31",
    amount: 800,
    spent: 100,
    remaining: 700,
  },
  {
    id: 2,
    name: "Monthly April",
    period: "month",
    periodStartDate: "2026-04-01",
    periodEndDate: "2026-04-30",
    amount: 0,
    spent: 0,
    remaining: 0,
  },
]);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test src/lib/queries/budget-weekly.test.ts`

Expected: both updated tests FAIL because `fetchWeeklyBudgetOptions` does not yet return `amount/spent/remaining`. The "invalidates all weekly budget option caches" test should still PASS.

- [ ] **Step 3: Extend the types and parser in `src/lib/queries/budget-weekly.ts`**

Replace the current `BudgetWeeklyOptionsResponse` type (around line 5–13) with:

```ts
type BudgetWeeklyOptionsResponse = {
  budgets?: Array<{
    id: number;
    name: string;
    period?: BudgetPeriod;
    periodStartDate?: string;
    periodEndDate?: string | null;
    amount?: number;
    spent?: number;
    remaining?: number;
  }>;
};
```

Replace the current `BudgetWeeklyOption` type (around line 15–21) with:

```ts
export type BudgetWeeklyOption = {
  id: number;
  name: string;
  period: BudgetPeriod;
  periodStartDate: string | null;
  periodEndDate: string | null;
  amount: number;
  spent: number;
  remaining: number;
};
```

In `fetchWeeklyBudgetOptions` (the `.map(...)` block around line 82–95), append the three numeric fields to the returned object — each defensively coerced:

```ts
.map((budget) => ({
  id: Number(budget.id),
  name: String(budget.name),
  period:
    budget.period === "week" ||
    budget.period === "month" ||
    budget.period === "custom"
      ? budget.period
      : "custom",
  periodStartDate: budget.periodStartDate
    ? String(budget.periodStartDate)
    : null,
  periodEndDate: budget.periodEndDate ? String(budget.periodEndDate) : null,
  amount: Number(budget.amount ?? 0),
  spent: Number(budget.spent ?? 0),
  remaining: Number(budget.remaining ?? 0),
}));
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun run test src/lib/queries/budget-weekly.test.ts`

Expected: all three tests PASS.

- [ ] **Step 5: Run a targeted typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`

Expected: no errors. (If the type ripple touches another file, fix it in this task — additive fields default to `0`, so most consumers will be unaffected.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/queries/budget-weekly.ts src/lib/queries/budget-weekly.test.ts
git commit -m "feat(budgets): expose amount/spent/remaining on BudgetWeeklyOption"
```

---

### Task 2: Render remaining amount in the picker drawer

**Files:**
- Modify: `src/components/ManualExpenseForm.tsx:24` (import) and `:715–755` (row markup)
- Test: `src/components/ManualExpenseForm.quick-mode.test.tsx:312–373`

- [ ] **Step 1: Update the picker grouping test to include amounts and assert the formatted remaining renders**

In `src/components/ManualExpenseForm.quick-mode.test.tsx`, locate the test "groups budget options by weekly and monthly periods" (starts around line 313). Update the budget fixtures to include `amount/spent/remaining` and add assertions that the remaining figure is rendered for each row, with the correct color class for negative vs. non-negative.

Replace the `budgetPayload.budgets` array (around line 330–353) with:

```ts
budgets: [
  {
    id: 11,
    name: "Week groceries",
    period: "week",
    periodStartDate: weekStart,
    periodEndDate: weekEnd,
    amount: 500000,
    spent: 120000,
    remaining: 380000,
  },
  {
    id: 12,
    name: "Week transport",
    period: "week",
    periodStartDate: weekStart,
    periodEndDate: weekEnd,
    amount: 200000,
    spent: 250000,
    remaining: -50000,
  },
  {
    id: 21,
    name: "Monthly essentials",
    period: "month",
    periodStartDate: monthStart,
    periodEndDate: monthEnd,
    amount: 1000000,
    spent: 0,
    remaining: 1000000,
  },
],
```

After the existing assertions at the end of the test (after line 372), add:

```ts
const positiveRow = screen.getByRole("button", { name: /week groceries/i });
const negativeRow = screen.getByRole("button", { name: /week transport/i });
const zeroSpentRow = screen.getByRole("button", { name: /monthly essentials/i });

const positiveRemaining = within(positiveRow).getByText("380.000");
const negativeRemaining = within(negativeRow).getByText("-50.000");
const fullRemaining = within(zeroSpentRow).getByText("1.000.000");

expect(positiveRemaining).toHaveClass("text-success");
expect(negativeRemaining).toHaveClass("text-destructive");
expect(fullRemaining).toHaveClass("text-success");
```

If `within` is not yet imported in this file, add it to the existing `@testing-library/react` import line (alongside `screen`).

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test src/components/ManualExpenseForm.quick-mode.test.tsx -t "groups budget options"`

Expected: FAIL — the remaining amounts are not rendered yet, so `getByText("380.000")` will throw.

- [ ] **Step 3: Add the `formatVndSigned` import in `ManualExpenseForm.tsx`**

In `src/components/ManualExpenseForm.tsx` line 24, change:

```ts
import { cn, formatVnd, parseVndInput } from "@/lib/utils";
```

to:

```ts
import { cn, formatVnd, formatVndSigned, parseVndInput } from "@/lib/utils";
```

- [ ] **Step 4: Render the remaining amount inside each picker row**

In `src/components/ManualExpenseForm.tsx`, locate the picker row button rendered inside `groupItems.map((budget) => { ... })` (around line 715–755). The current row has this structure:

```tsx
<button ...>
  <span className="flex min-w-0 items-center gap-2">
    <span className={cn("size-2 shrink-0 rounded-full", ...)} />
    <span className="flex min-w-0 flex-col">
      <span className="truncate text-sm font-medium">{budget.name}</span>
      <span className="text-muted-foreground text-xs">
        {formatBudgetRange(budget)}
      </span>
    </span>
  </span>
  {isActive ? (
    <CheckIcon className="text-success h-4 w-4 shrink-0" />
  ) : null}
</button>
```

Insert a new right-aligned remaining `<span>` between the left content `<span>` and the active-state check, so the final row reads:

```tsx
<button ...>
  <span className="flex min-w-0 items-center gap-2">
    <span className={cn("size-2 shrink-0 rounded-full", ...)} />
    <span className="flex min-w-0 flex-col">
      <span className="truncate text-sm font-medium">{budget.name}</span>
      <span className="text-muted-foreground text-xs">
        {formatBudgetRange(budget)}
      </span>
    </span>
  </span>
  <span
    className={cn(
      "ml-2 shrink-0 text-xs font-semibold tabular-nums",
      budget.remaining < 0 ? "text-destructive" : "text-success"
    )}
  >
    {formatVndSigned(budget.remaining)}
  </span>
  {isActive ? (
    <CheckIcon className="text-success ml-2 h-4 w-4 shrink-0" />
  ) : null}
</button>
```

Notes:
- `tabular-nums` keeps amounts visually aligned across rows.
- The `ml-2` on the check icon is an additive change so the spacing stays sensible when both the remaining figure and the check are present.
- Do NOT touch the "No budget" button above this map; the remaining amount is only shown for actual budget rows.

- [ ] **Step 5: Run the picker test to verify it passes**

Run: `bun run test src/components/ManualExpenseForm.quick-mode.test.tsx -t "groups budget options"`

Expected: PASS.

- [ ] **Step 6: Run the full picker test file to confirm no regressions**

Run: `bun run test src/components/ManualExpenseForm.quick-mode.test.tsx`

Expected: all tests PASS.

- [ ] **Step 7: Run a scoped lint and typecheck**

Run: `npx eslint src/components/ManualExpenseForm.tsx src/lib/queries/budget-weekly.ts src/lib/queries/budget-weekly.test.ts src/components/ManualExpenseForm.quick-mode.test.tsx`

Run: `npx tsc --noEmit -p tsconfig.json`

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/ManualExpenseForm.tsx src/components/ManualExpenseForm.quick-mode.test.tsx
git commit -m "feat(budgets): show remaining amount in transaction budget picker"
```

---

### Task 3: Manual smoke + invalidation sanity check

**Files:** none (verification only)

- [ ] **Step 1: Confirm the existing mutation flows still invalidate the picker cache**

Run: `grep -rn "invalidateBudgetWeeklyOptionsCache" src` (or use the project's preferred search) and confirm it is called from at least one mutation site (e.g., expense create/update or budget create/update). The new fields share the same query key, so existing invalidations cover the new data — but verify nothing was inadvertently removed.

Expected: at least one call site found in `src/`. If you are running this through an agentic flow, paste the matched lines into the task transcript.

- [ ] **Step 2: Visual check in the dev server**

Run: `bun run dev`

In a browser, open the create-transaction flow that mounts `ManualExpenseForm` with `showBudgetSelect`, open the budget picker drawer, and verify:

(a) Each row shows a name (left), period range (left, second line), and a remaining figure (right).
(b) A budget with positive remaining renders the figure in success color.
(c) A budget with negative remaining renders it in destructive color.
(d) The active-state check still appears on the selected row, to the right of the remaining figure, without overlap.
(e) The "No budget" entry is unchanged (no remaining figure).

Stop the dev server (`Ctrl+C`) when done.

- [ ] **Step 3: No commit**

This task is verification only — there should be no code changes. If the visual check uncovers an issue, fix it inside Task 2 (re-run the relevant test) and re-commit there, not here.

---

## Self-Review Notes

- **Spec coverage:** Section 1 of the spec (query layer) → Task 1. Section 2 (UI) → Task 2. Edge cases (negative remaining, missing fields, "No budget" untouched) → covered in Task 1 Step 1(b) and Task 2 Step 1 fixtures + Step 4 markup. Tests section → covered by Task 1 + Task 2 test updates. Validation section → Task 1 Step 5 (typecheck), Task 2 Step 7 (lint + typecheck), Task 3 Step 2 (visual smoke).
- **No `npm run build`** per `CLAUDE.md` and `.agents/rules/nextjs-code.md` §12.
- **TanStack Query invalidation** is unchanged — same query key, additive payload — so no new invalidation work is required, but Task 3 Step 1 verifies an existing invalidator is wired up.
- **Server vs Client:** all changes are within the existing client component (`ManualExpenseForm.tsx` already starts with `"use client"`) and a client-side query helper. No server boundary crossed.
