# Budget Picker — Show Remaining Amount

**Date:** 2026-05-01
**Status:** Approved (design)

## Summary

When creating or editing a transaction, the budget picker drawer (in `ManualExpenseForm.tsx`) currently shows each candidate budget as `name` + period range only. It does not show how much of the budget is left. Add the remaining amount to each row, matching the visual treatment used on the budgets list page.

## Motivation

When picking a budget for a new expense, users need to know which budget still has room. Today they have to leave the form, check the budgets list page, then come back. The remaining amount is already available from the API — the client query just discards it.

## Non-Goals

- No progress bar or "% used" indicator in the picker (kept compact; the budgets list page is the place for that).
- No change to the AI chat flow (`AIExpenseChat.tsx` does not render a budget picker list).
- No change to `BudgetTransferDrawer` (separate flow).
- No new endpoints or DB queries.

## Architecture

Two files change. No data layer or schema change.

```
/api/budget-weekly  ──(already returns amount/spent/remaining)──┐
                                                                 ▼
src/lib/queries/budget-weekly.ts                       (pass fields through)
   • BudgetWeeklyOptionsResponse: add amount/spent/remaining
   • BudgetWeeklyOption: add amount/spent/remaining
   • fetchWeeklyBudgetOptions(): map them out of the response
                                                                 │
                                                                 ▼
src/components/ManualExpenseForm.tsx                   (render remaining)
   • Each picker row: name + remaining on top line, range below
   • Color: text-destructive if remaining < 0, else text-success
```

## Detailed Design

### 1. Query layer — `src/lib/queries/budget-weekly.ts`

Extend the response and option types with three new numeric fields, then pass them through in the parser. Defensive: coerce with `Number(... ?? 0)` so a malformed response still produces a valid number.

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

In `fetchWeeklyBudgetOptions`, after the existing date-range filter, include the three fields in the mapped result:

```ts
amount: Number(budget.amount ?? 0),
spent: Number(budget.spent ?? 0),
remaining: Number(budget.remaining ?? 0),
```

### 2. UI — `src/components/ManualExpenseForm.tsx`

- Import `formatVndSigned` from `@/lib/utils` alongside the existing `formatVnd` import.
- In the budget picker drawer, inside `budgetGroups[groupKey].map((budget) => ...)` (the `<button>` rendered around `ManualExpenseForm.tsx:715–755`), add a right-aligned remaining figure on the top row.

Row layout (Option C from the brainstorm):

```
[status dot]  [Budget name]                 [+12,345 ₫]   [✓ if active]
              Week of Apr 28 → May 4
```

Concretely:

- Keep the existing left side (status dot + stacked `name` + `formatBudgetRange(budget)`).
- Add a new right-aligned `<span>` between the left side and the active-state check icon, containing `formatVndSigned(budget.remaining)`.
- Color: `cn("text-xs font-semibold", budget.remaining < 0 ? "text-destructive" : "text-success")`.
- The active check icon stays in its current trailing slot.

The "No budget" entry is unchanged (no remaining applies).

### 3. Edge cases

| Case | Behavior |
|------|----------|
| `amount === 0`, no spend | `remaining = 0`, rendered in success color. Acceptable. |
| Over-budget (negative remaining) | Destructive color, same rule as the budgets list page. |
| Budget loading | Existing spinner; remaining only renders once data is loaded. |
| API response missing the field | `Number(undefined ?? 0) === 0` — row still renders, no crash. |

### 4. Tests

Update `src/components/ManualExpenseForm.quick-mode.test.tsx`:

- Where `fetchWeeklyBudgetOptions` is mocked, add `amount`, `spent`, `remaining` to the returned shape so the new types compile.
- Add one assertion: open the picker drawer and verify the formatted remaining text appears for at least one budget row.

No new test files.

### 5. Validation

Per project rules (`.agents/rules/nextjs-code.md` §12 and `CLAUDE.md`), do **not** run `npm run build`. Targeted checks only:

- `tsc --noEmit` (or scoped: just the touched files via the IDE).
- `vitest run ManualExpenseForm` to exercise the picker path.
- Optionally open `bun run dev` and inspect the picker visually.

## Risks

- **Stale `remaining` after a mutation.** The picker uses TanStack Query keyed by `weekStart`. Existing mutation flows in this app already invalidate `budgetWeeklyOptionsRootQueryKey`; nothing new required, but verify by grepping for `invalidateBudgetWeeklyOptionsCache` after the change to confirm coverage hasn't regressed.
- **Type ripple.** `BudgetWeeklyOption` is exported and consumed elsewhere. A grep before edits confirms whether other call sites need updates; the new fields are additive (not removed/renamed), so the risk is low.

## Out of Scope / Follow-ups

- Adding a progress bar or "% used" affordance to picker rows.
- Showing remaining amounts in the AI chat budget-confirmation flow (currently no list).
- A "low budget" warning indicator in the trigger button label itself.
