# Create Transaction UI Redesign

**Date:** 2026-05-22
**Branch:** `feat/create-transaction-ui`
**Status:** Approved (brainstorming → implementation planning)

## Problem

The current "Add expense" flow (`ExpenseEntryDrawer` + `ManualExpenseForm`) is dense: title, description, mascot companion, quick/advanced mode toggle, and many labeled rows. It works but the chrome competes with the two things the user actually fills in — **note** and **amount**.

We want a minimal, focused, mobile-first sheet that prioritizes note and amount, while keeping date, budget, paid-by, and category accessible.

## Goals

- Full-screen `Sheet` with **no title, no description, no mascot**.
- Layout, top to bottom:
  1. **Row of three small buttons:** date · budget · paid-by.
  2. **Note input** — full width, borderless, single-line, auto-shrink font (no wrap).
  3. **Amount input** — full width, borderless, right-aligned, large.
  4. **Amount suggestion chips** (×10 / ×100 / ×1000) when amount > 0.
  5. **Category chip row** (horizontal scroll).
  6. **Footer:** primary submit button.
- Note autofocuses on open.
- Truly borderless on all viewports (no focus ring on inputs).
- Existing AI prefill flow (`EXPENSE_PREFILL_EVENT`) still opens and populates the sheet.

## Non-Goals

- Touching `ManualExpenseForm` beyond extracting the budget-picker sub-sheet. The form stays in place for its other consumers (`AIExpenseChat`, `AIInput`, `ExpenseListItem` edit row).
- Changing the server action `createExpenseEntry` or the database schema.
- Redesigning the edit-expense flow inside `ExpenseListItem`.

## Approach

**Build a new `QuickExpenseSheet` component that owns its own state and submission, alongside the unchanged `ManualExpenseForm`.** Extract the budget-picker sub-sheet from `ManualExpenseForm` into a shared `BudgetPickerSheet` so both flows reuse it; build a new small `PaidByPickerSheet` for the new top-row paid-by button.

Rejected alternatives:

- **Rewrite `ManualExpenseForm` in place.** Forces a layout change on three other callers that should evolve independently. Too much blast radius for a UI change.
- **Extract a shared `useExpenseDraft` hook first.** Cleanest long-term, but a big up-front refactor across four consumers and not required to ship this UI.

## Architecture

### New files

```
src/components/QuickExpenseSheet.tsx       (~180 lines)
src/components/BudgetPickerSheet.tsx       (~140 lines, extracted)
src/components/PaidByPickerSheet.tsx       (~60 lines)
src/hooks/useAutoShrinkFont.ts             (~30 lines)
```

### Modified files

- `src/components/BottomNav.tsx` — swap `<ExpenseEntryDrawer compact />` for `<QuickExpenseSheet compact />`.
- `src/components/ManualExpenseForm.tsx` — replace the inline budget-picker sub-sheet (≈ lines 626–800) with `<BudgetPickerSheet />`. Behavior unchanged.

### Deleted files

- `src/components/ExpenseEntryDrawer.tsx`
- `src/components/ExpenseEntryDrawer.mascot.test.tsx` (mascot slot is gone)

### Untouched callers of `ManualExpenseForm`

- `src/components/AIExpenseChat.tsx`
- `src/components/AIInput.tsx`
- `src/components/ExpenseListItem.tsx` (edit row)

## Component Contracts

All new types use the project `T` prefix.

### `QuickExpenseSheet`

```ts
type TQuickExpenseSheetProps = {
  compact?: boolean;   // controls the trigger button size (matches ExpenseEntryDrawer)
};
```

Internally owns:

```ts
type TExpenseDraft = {
  date: string;                // "DD/MM/YYYY"
  amount: number;              // VND integer
  note: string;
  category: Category;
  budgetId: string | null;
  paidBy: PaidBy;
};
```

Responsibilities:

- Sheet open/close state.
- Draft state + per-field setters.
- Listener for `EXPENSE_PREFILL_EVENT` (hydrate amount/note/category, bump `prefillVersion`, force-open).
- TanStack Query for weekly budget options keyed on `getWeekRange(date)`.
- Budget auto-pick: while `userTouchedBudget === false`, set `budgetId = pickDefaultBudget(groups)` whenever options load/change.
- Submit: `createExpenseEntry` server action, loading state, toast, close + reset on success.

### `BudgetPickerSheet`

```ts
type TBudgetPickerSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string | null;           // budgetId
  onChange: (id: string | null) => void;
  weekStart: string;              // "YYYY-MM-DD", for query key
  isParentSheetOpen: boolean;     // gates fetch enabled
};
```

Renders the grouped picker (week / month / custom) currently inlined in `ManualExpenseForm`. No behavior change — pure extraction.

### `PaidByPickerSheet`

```ts
type TPaidByPickerSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: PaidBy;
  onChange: (next: PaidBy) => void;
};
```

Small bottom sheet listing `CUBI / EMBE / OTHER` as tappable rows with a check on the active one.

### `useAutoShrinkFont`

```ts
function useAutoShrinkFont(
  ref: RefObject<HTMLInputElement | null>,
  options?: { max?: number; min?: number; step?: number }   // px, default { max: 16, min: 11, step: 1 }
): void;
```

Measures `scrollWidth > clientWidth` on every input and steps `fontSize` down until it fits or hits `min`; restores to `max` when value shortens. Input must be `white-space: nowrap; overflow: hidden`.

## Layout & Styling

Sheet:

```tsx
<SheetContent side="bottom" className="h-full w-full gap-0 rounded-none p-0">
  {/* bare close handled by Sheet primitive */}
  <div className="flex h-full flex-col">
    <div className="flex items-center gap-2 px-4 pt-4">
      <DateButton />        {/* size sm, variant outline, rounded-full, icon-left */}
      <BudgetButton />
      <PaidByButton />
    </div>

    <div className="flex flex-1 flex-col gap-3 px-4 pt-6">
      <input
        ref={noteRef}
        autoFocus
        value={draft.note}
        onChange={(e) => setField("note", e.target.value)}
        placeholder="What did you spend on?"
        className="w-full whitespace-nowrap overflow-hidden border-0 bg-transparent px-0 py-2
                   text-base placeholder:text-muted-foreground
                   focus-visible:outline-none focus-visible:ring-0"
      />

      <div className="relative">
        <input
          ref={amountRef}
          inputMode="numeric"
          value={formatVnd(draft.amount)}
          onChange={(e) => setField("amount", parseVndInput(e.target.value))}
          className="w-full border-0 bg-transparent px-0
                     text-right text-4xl font-semibold tracking-tight
                     focus-visible:outline-none focus-visible:ring-0"
          placeholder="0"
        />
        <span className="text-muted-foreground absolute bottom-2 right-0 text-sm">VND</span>
      </div>

      {suggestions.length > 0 && <SuggestionChips ... />}
      <CategoryChipRow value={draft.category} onChange={...} />
    </div>

    <SheetFooter className="standalone:pb-safe border-t px-4">
      <Button onClick={submit} disabled={!canSubmit}>
        {loading ? <><Loader2 className="animate-spin" /> Saving…</> : "Save expense"}
      </Button>
    </SheetFooter>
  </div>
</SheetContent>
```

Tokens: all spacing/colors via existing Tailwind v4 tokens and `cn()`. No new color or spacing constants introduced.

## Data Flow

1. User taps the floating `+` (in `BottomNav`) → `QuickExpenseSheet` opens, note autofocuses.
2. Top-row buttons open small bottom sheets (`DatePicker`, `BudgetPickerSheet`, `PaidByPickerSheet`); selection collapses the picker and updates draft.
3. Date change → re-query budget options for the new week → auto-pick default until user manually picks.
4. Note + amount typed inline.
5. Footer **Save expense** → `createExpenseEntry({ ...draft, budgetId })` → on success: toast → close → reset.
6. AI prefill event → hydrate draft → open sheet → user reviews → submit.

## Error Handling

- Server action failure → `toast.error(error.message)`, sheet stays open with values intact.
- Budget query failure → silently fall back to "No budget" selectable in the picker; never blocks submission.
- Empty/invalid amount (`<= 0`) → submit button disabled.
- Prefill event with `amount = 0` → sheet opens, submit disabled until user edits amount.

## Testing

Vitest, behavior-focused, no snapshots:

- **`QuickExpenseSheet.test.tsx`**
  - Trigger opens sheet; note input is focused.
  - Submit disabled when amount = 0; enabled when amount > 0.
  - Submit calls `createExpenseEntry` with the full draft, then closes the sheet.
  - Dispatching `EXPENSE_PREFILL_EVENT` opens the sheet and populates amount/note/category.
  - On success toast fires; on failure toast fires and sheet stays open.

- **`BudgetPickerSheet.test.tsx`**
  - Renders three groups when all populated; hides custom when empty.
  - Selecting a budget calls `onChange(id)` and closes; selecting "No budget" calls `onChange(null)`.

- **`useAutoShrinkFont.test.ts`**
  - Shrinks font when `scrollWidth > clientWidth`.
  - Restores to max after content shortens.
  - Floors at `min`.

Tests for `BottomNav` and `ManualExpenseForm` only need updating where the budget-picker extraction changes the rendered tree.

## Migration / Rollout

Single PR, no flag. The two flows are independent — replacing `ExpenseEntryDrawer` with `QuickExpenseSheet` in `BottomNav` is the cutover.

## Open Questions

None — all clarifications resolved during brainstorming.
