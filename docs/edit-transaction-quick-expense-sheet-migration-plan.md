# Edit Transaction Migration Plan: QuickExpenseSheet

## Goal

Migrate persisted transaction editing from the legacy `ManualExpenseForm` sheet to the newer `QuickExpenseSheet` interaction model in `src/components/QuickExpenseSheet.tsx`.

The target result is one reusable expense sheet that supports both:

- Creating a new expense from the bottom nav / quick-add entry points.
- Editing an existing persisted transaction from `ExpenseListItem`.

## Current State

- `QuickExpenseSheet` is create-only.
- `QuickExpenseSheet` owns its own `open` state and renders its own trigger button.
- `QuickExpenseSheet` submits through `createExpenseEntry` only.
- `ExpenseListItem` owns the persisted edit flow today.
- `ExpenseListItem` renders a separate `Sheet` with `ManualExpenseForm`, calls `updateExpenseEntry`, closes the sheet, and calls `router.refresh()`.
- `AIExpenseChat` also shows an "Edit expense" sheet, but that flow edits an unsaved AI draft before create. It should not be included in the first persisted transaction migration unless we intentionally extend the scope.

## Migration Strategy

Make `QuickExpenseSheet` support controlled edit mode while preserving its current uncontrolled create mode. Then replace only the persisted transaction edit sheet in `ExpenseListItem`.

This keeps the migration small and avoids rewriting unrelated quick-add or AI draft behavior.

## Proposed Component Contract

Extend `TQuickExpenseSheetProps` in `src/components/QuickExpenseSheet.tsx`:

```ts
export type QuickExpenseSheetInitialExpense = {
  id?: number;
  date: string;
  amount: number;
  note?: string | null;
  category: Category | string;
  budgetId?: number | null;
  paidBy?: PaidBy | string;
};

export type TQuickExpenseSheetProps = {
  compact?: boolean;
  mode?: "create" | "edit";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialExpense?: QuickExpenseSheetInitialExpense | null;
  transactionId?: number;
  onSuccess?: () => void;
  showTrigger?: boolean;
};
```

Behavior:

- Default remains current create mode: `mode="create"`, internal open state, rendered trigger, `createExpenseEntry`, reset on close.
- Edit mode uses the passed `open` / `onOpenChange`, hides the add trigger by default, initializes the draft from `initialExpense`, and submits through `updateExpenseEntry(transactionId, payload)`.
- The sheet title, description, primary button, loading text, and toast text switch by mode.
- `onSuccess` runs after a successful create or update so callers can close and refresh.

## Implementation Steps

1. Normalize draft construction in `QuickExpenseSheet`.

- Keep `buildDefaultDraft(paidBy)` for create mode.
- Add `buildDraftFromExpense(initialExpense, fallbackPaidBy)` for edit mode.
- Convert persisted ISO dates like `YYYY-MM-DD` to the existing UI date format `DD/MM/YYYY`.
- Normalize `category` against `Category`; fall back to `Category.FOOD` when invalid.
- Normalize `paidBy` against `PaidBy`; fall back to settings paid-by, then `PaidBy.OTHER`.
- Normalize nullable `note` to `""` and missing `budgetId` to `null`.

2. Make sheet open state controllable.

- Introduce `isControlledOpen = typeof open === "boolean"`.
- Use `sheetOpen = open ?? internalOpen`.
- Update `handleOpenChange(next)` to call `onOpenChange?.(next)` and only set internal state when uncontrolled.
- Keep the current reset-on-close behavior for create mode.
- In edit mode, reset from `initialExpense` when the sheet opens or when `initialExpense` changes while open.

3. Make the trigger optional.

- Render `SheetTrigger` only when `showTrigger !== false`.
- Default `showTrigger` to `mode === "create"`.
- Preserve the compact bottom-nav button behavior exactly for existing callers.

4. Switch submit behavior by mode.

- Import `updateExpenseEntry` beside `createExpenseEntry`.
- Build one payload from `draft` with `{ date, amount, note, category, paidBy, budgetId }`.
- In create mode, call `createExpenseEntry(payload)`.
- In edit mode, require `transactionId`; if missing, show a failure toast and do not submit.
- In edit mode, call `updateExpenseEntry(transactionId, payload)`.
- Success copy: create = `Expense added`; edit = `Expense updated`.
- Error copy: create = `Failed to add expense`; edit = `Failed to update expense`.

5. Update labels and accessibility copy.

- `SheetTitle`: create = `Add expense`; edit = `Edit expense`.
- `SheetDescription`: create = `Enter expense details and save.`; edit = `Update expense details and save.`.
- Submit button: create = `Save expense`; edit = `Update expense`.
- Loading button: create = `Saving...`; edit = `Updating...`.
- Note placeholder can stay `What did you spend on?` for both modes.

6. Migrate `ExpenseListItem` persisted edit flow.

- Remove `ManualExpenseForm`, `ManualExpenseFormHandle`, edit form ref, edit form state, and the edit `Sheet` markup.
- Keep `editOpen` state.
- Render `QuickExpenseSheet` near the delete confirmation dialog with:

```tsx
<QuickExpenseSheet
  mode="edit"
  open={editOpen}
  onOpenChange={setEditOpen}
  showTrigger={false}
  transactionId={expense.id}
  initialExpense={initialExpense}
  onSuccess={() => {
    setEditOpen(false);
    router.refresh();
  }}
/>
```

- Keep the swipe action pencil button behavior: set `editOpen` true and close the swipe actions.
- Keep duplicate and delete flows unchanged.
- Remove the `DialogCompanionSlot` import unless the product requirement is to keep the mascot in the new quick sheet.

7. Decide whether to keep mascot behavior.

- Existing test coverage expects `DialogCompanionSlot` inside the old edit sheet.
- The new `QuickExpenseSheet` currently does not include mascot UI.
- Recommended: drop mascot from the persisted edit sheet as part of the migration unless the feature is explicitly required. Update the test to assert the new edit sheet renders and submits through `QuickExpenseSheet` instead.

8. Keep `AIExpenseChat` out of the first migration.

- That sheet edits an unsaved AI draft, not an existing transaction id.
- Migrating it safely would require create-mode controlled open plus draft initialization and possibly `autoSelectDefaultBudget` parity.
- Track it as a separate follow-up if a fully unified create/edit sheet is desired.

## Tests To Update

1. `src/components/QuickExpenseSheet.test.tsx`

- Mock `updateExpenseEntry` in addition to `createExpenseEntry`.
- Add edit-mode render helper with controlled `open={true}`, `showTrigger={false}`, `transactionId`, and `initialExpense`.
- Assert edit mode prepopulates note, amount, date label, category, paid-by, and selected budget when budget options contain the `budgetId`.
- Assert submit calls `updateExpenseEntry(id, payload)` and does not call `createExpenseEntry`.
- Assert successful edit calls `onSuccess`.
- Assert edit mode shows `Update expense` / `Updating...` copy.
- Assert missing `transactionId` does not call update and surfaces an error toast.

2. `src/components/ExpenseListItem.mascot.test.tsx`

- Rename or replace the test because the edit sheet will no longer render `ManualExpenseForm` or `DialogCompanionSlot`.
- Mock `QuickExpenseSheet` and assert clicking the pencil action opens it with `mode="edit"`, `transactionId`, and the normalized `initialExpense`.
- Keep a separate assertion that duplicate and delete buttons still render if needed.

3. Optional regression test

- Add a test that closes and reopens edit mode after changing props to confirm the draft resets from the latest `initialExpense` instead of keeping stale form state.

## Targeted Verification

Use targeted checks only; do not run a full build for this migration.

Recommended commands:

```bash
npm test -- src/components/QuickExpenseSheet.test.tsx src/components/ExpenseListItem.mascot.test.tsx
```

If type errors are suspected after the refactor:

```bash
npx tsc --noEmit
```

## Acceptance Criteria

- Existing quick-add create behavior from `BottomNav` still works.
- Duplicate action still opens quick-add prefilled through `EXPENSE_PREFILL_EVENT`.
- Persisted transaction edit from `ExpenseListItem` opens the `QuickExpenseSheet` UI.
- Edit sheet prepopulates amount, note, category, date, paid-by, and budget.
- Updating a transaction calls `updateExpenseEntry` with the same payload shape used by existing edit flow.
- After update, the sheet closes and the current route refreshes.
- Delete confirmation behavior is unchanged.
- `AIExpenseChat` behavior is unchanged in this migration.

## Risks

- `QuickExpenseSheet` currently resets draft on close; edit mode must avoid resetting to a blank create draft while controlled by `ExpenseListItem`.
- Existing `ExpenseListItem` tests are coupled to the old mascot edit sheet and need an intentional expectation change.
- `Category` and `PaidBy` values from persisted rows are typed as strings in `ExpenseListItem`; normalization must guard against invalid or legacy values.
- Budget option loading can temporarily hide the budget name. The selected `budgetId` should still be retained unless the loaded options prove it is invalid for the selected date.
- Revalidation in `expense-actions.ts` currently covers `/` and `/budgets`; `router.refresh()` in `ExpenseListItem` should remain to refresh `/transactions` immediately after edits.

## Follow-Ups

- Consider adding `revalidatePath("/transactions")` in `createExpenseEntry`, `updateExpenseEntry`, and `deleteExpenseEntry` if transaction pages become statically cached or stale after navigation.
- Consider migrating `AIExpenseChat` to `QuickExpenseSheet` only after edit mode is stable and create-mode controlled draft initialization is explicitly needed.
- Consider extracting shared draft normalization into a small local helper only if another component needs the same behavior.
