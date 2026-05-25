# Quick Expense Drawer Refocus Design

## Problem

On iPhone/iOS Safari, opening a secondary drawer from `QuickExpenseSheet` while the note or amount input is focused can blur the active input and dismiss the keyboard. The requested behavior is:

- If the note input was focused before opening Date, Budget, or Paid By, focus note again after that drawer closes.
- If the amount input was focused before opening Date, Budget, or Paid By, focus amount again after that drawer closes.
- If neither input was focused, do not force focus when a drawer closes.

This applies to the Date, Budget, and Paid By drawer buttons in `src/components/QuickExpenseSheet.tsx`.

## Existing Context

`QuickExpenseSheet` already owns:

- `noteRef` and `amountRef`.
- Drawer open state: `dateOpen`, `budgetOpen`, `paidByOpen`.
- The button handlers that open those drawers.
- The child picker `onOpenChange` callbacks.

The project also has `.agents/rules/ios-input-focus.md`, which says iOS input focus handling should be applied narrowly to controls in the active input workflow.

## Recommended Approach

Add a small focus-memory helper inside `QuickExpenseSheet`.

Track the focused input before opening a picker drawer:

```ts
type RestorableInputFocus = "note" | "amount" | null;
const pendingDrawerFocusRestoreRef = useRef<RestorableInputFocus>(null);
```

When the user opens Date, Budget, or Paid By:

1. Read `document.activeElement`.
2. Store `"note"` if it is `noteRef.current`.
3. Store `"amount"` if it is `amountRef.current`.
4. Store `null` otherwise.
5. Open the requested drawer.

When a drawer `onOpenChange(false)` fires:

1. Close that drawer.
2. If the parent quick expense sheet is still open, restore the remembered input focus.
3. Use `focus({ preventScroll: true })`.
4. For the amount input, call `select()` after focusing, matching existing amount-focus behavior.
5. Clear the remembered focus after attempting restoration.

The restoration should be deferred with `requestAnimationFrame` or a zero-delay timer so Radix/Vaul focus cleanup from the closing drawer finishes first.

## Alternatives Considered

### Add `onPointerDown.preventDefault()` to the Date/Budget/Paid By buttons

This could preserve focus during the tap itself, but these buttons intentionally open modal/drawer UI. Preventing pointer defaults on modal triggers can interfere with normal focus handoff and accessibility semantics. It also does not address focus after the child drawer closes.

### Put focus restoration inside each picker component

This spreads one QuickExpenseSheet-specific behavior across `DatePickerSheet`, `BudgetPickerSheet`, and `PaidByPickerSheet`. Those components do not own the note/amount refs, so they would need new props or implicit coupling.

### Restore focus on every picker close unconditionally

This would be simpler but too aggressive. If the user opened a picker without editing note/amount first, forcing keyboard focus afterward would be surprising.

## Detailed Behavior

- Opening Date while note is focused records `note`; closing Date focuses note.
- Opening Budget while amount is focused records `amount`; closing Budget focuses amount and selects the amount text.
- Opening Paid By while no note/amount input is focused records `null`; closing Paid By does not focus note or amount.
- If the parent quick expense sheet closes while a child drawer is open, no focus restore should run.
- If the recorded input no longer exists, no error should be thrown.
- Existing category chip behavior remains unchanged.
- Existing amount suggestion chips remain unchanged; they intentionally blur amount after applying a suggestion.

## Implementation Scope

Modify only:

- `src/components/QuickExpenseSheet.tsx`
- `src/components/QuickExpenseSheet.test.tsx`

No API, query, mutation, or persisted recovery state changes are required.

## Test Plan

Use test-first changes in `src/components/QuickExpenseSheet.test.tsx`.

Add focused behavior tests:

- Focus note, open Date, close Date, expect note to regain focus.
- Focus amount, open Budget, close Budget, expect amount to regain focus.
- Open Paid By without note/amount focus, close Paid By, expect note and amount not to be focused.

Keep existing tests green, especially:

- Sheet opens and focuses note in create mode.
- Edit mode does not autofocus note.
- Amount suggestions still blur after applying a suggestion.

## Validation

After implementation, run targeted checks:

```bash
rtk bun run test src/components/QuickExpenseSheet.test.tsx
rtk bunx prettier --write src/components/QuickExpenseSheet.tsx src/components/QuickExpenseSheet.test.tsx
rtk bunx prettier --check src/components/QuickExpenseSheet.tsx src/components/QuickExpenseSheet.test.tsx
rtk bunx eslint src/components/QuickExpenseSheet.tsx src/components/QuickExpenseSheet.test.tsx
```

Do not run `npm run build` for this scoped change.
