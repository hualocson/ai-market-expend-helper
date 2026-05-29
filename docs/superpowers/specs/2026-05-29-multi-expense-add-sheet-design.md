# Create Multiple Expenses In One Open Session — Design

Date: 2026-05-29
Branch: `dev-multi-expense-add-sheet`

## Problem

The add-expense sheet (`QuickExpenseDrawer`) closes on every save. Logging several
expenses from one shopping trip means reopening the sheet for each item. We want an
opt-in "keep open" mode so a user can save one expense and immediately enter the next
without the sheet closing.

## Scope

The behavior change applies **only to the pure-create flow**:

```
mode === "create" && !recoveryOperationId && !recoveryDraft
```

Edit mode and recovery resubmits keep their current "close on submit" behavior,
untouched. The toggle control is rendered only in the pure-create flow.

Creating an expense is already a local-first optimistic write (`createLocalExpense`)
that syncs in the background, so rapid sequential saves need no new mutation work.

## Decisions

- **Interaction model:** Save & keep open. Each save commits one expense; the drawer
  stays open and resets for the next entry.
- **Field reset on next entry:** carry over `date` and `paidBy`; reset `amount → 0`,
  `note → ""`, `category → default (FOOD)`, and clear the budget. Refocus the note input.
- **Control:** a Switch placed next to the close button, opt-in.
- **Persistence:** the toggle is persisted in the settings store, default **OFF**
  (Save closes — current behavior — until the user opts in).
- **Switch implementation:** add `@radix-ui/react-switch` and the standard shadcn
  `Switch` primitive.

## Changes

### 1. Settings store — `src/stores/settings-store.ts`

- Add state field `keepDrawerOpen: boolean` (default `false`).
- Add action `setKeepDrawerOpen: (value: boolean) => void`.
- Add to `defaultInitState`.
- Bump persist `version` to `2`. The field is additive and zustand merges persisted
  state with initial state, so no custom migration is required; the bump documents the
  shape change.
- Consumed through the existing `useSettingsStore` selector hook
  (`src/components/providers/StoreProvider`).

### 2. Switch primitive — `src/components/ui/switch.tsx`

- Install `@radix-ui/react-switch`.
- Add the standard shadcn `Switch` component, styled with existing dark-mode design
  tokens. Do not modify other generated primitives.

### 3. Toggle control — `src/components/QuickExpenseDrawer.tsx`

- Read `keepDrawerOpen` and `setKeepDrawerOpen` from `useSettingsStore`.
- Render the toggle **only** when `!isEditMode && !recoveryOperationId && !recoveryDraft`.
- Place it in the top bar next to the existing `DrawerClose`. Wrap both in a container
  positioned `absolute top-4 right-4 z-60 flex items-center gap-2`, ordered
  `[Switch + small "Keep open" label] [X close]`. The existing close button keeps its
  styling; its absolute positioning moves to the wrapper.
- Per `.agents/rules/ios-input-focus.md`, add `onPointerDown={(e) => e.preventDefault()}`
  to the switch so toggling mid-entry does not blur the focused note/amount input and
  dismiss the iOS keyboard. The toggle command stays in `onCheckedChange`.

### 4. Save behavior — `handleSubmit` in `QuickExpenseDrawer.tsx`

- Compute:

  ```ts
  const keepOpen =
    !isEditMode && !recoveryOperationId && !recoveryDraft && keepDrawerOpen;
  ```

- When the local write is fired:
  - **keepOpen === true:** do not call `handleOpenChange(false)`. Instead reset the
    draft in place via a new helper `buildNextEntryDraft(submittedDraft)`, reset
    suggestion tracking (`resetSuggestionTracking(nextDraft, "none")`), and refocus the
    note input (`noteRef.current?.focus({ preventScroll: true })`). Because the amount
    field held focus, refocusing note keeps the software keyboard up for the next entry.
  - **keepOpen === false:** existing behavior (`handleOpenChange(false)`).
- The per-save success toast stays. With the drawer able to remain open, the toast is
  the primary signal that each expense committed. Sonner stacks/auto-dismisses rapid
  toasts.

### 5. New helper

```ts
const buildNextEntryDraft = (previous: TExpenseDraft): TExpenseDraft => ({
  ...buildDefaultDraft(normalizePaidBy(previous.paidBy)),
  date: previous.date,
});
```

Keeps the carry-over reset logic in one named place.

## Testing

`src/components/QuickExpenseDrawer.test.tsx`:

- Create mode, `keepDrawerOpen` on → after save the drawer stays mounted; note and
  amount are cleared; date and paidBy are preserved; note input is refocused.
- Create mode, `keepDrawerOpen` off → after save the drawer closes (current behavior).
- Edit mode → closes on update regardless of `keepDrawerOpen`.
- Recovery mode (`recoveryOperationId` set) → closes and clears recovery on save
  regardless of `keepDrawerOpen`.
- The toggle control is absent in edit and recovery modes.

`src/stores/settings-store.test.ts` (add if a settings-store test does not exist):

- Default `keepDrawerOpen === false`.
- `setKeepDrawerOpen(true)` updates state.

## Out of Scope

- Batch list builder / multi-row submit UI.
- A separate "Save & add another" button (the persisted toggle replaces the need).
- Changes to edit, recovery, or background-sync behavior.
