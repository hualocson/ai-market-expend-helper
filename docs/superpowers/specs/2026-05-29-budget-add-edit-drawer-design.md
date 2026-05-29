# Budget Add/Edit Drawer — Extraction Design

**Date:** 2026-05-29
**Status:** Approved (design)
**Scope:** Extract the create/edit budget drawer out of `BudgetWeeklyBudgetsClient.tsx` into a self-contained, well-tested component.

## Problem

The add/edit budget drawer lives entirely inline inside `src/components/BudgetWeeklyBudgetsClient.tsx`, a **1,505-line** client component. The drawer contributes:

- ~200 lines of JSX (`1263`–`1464`).
- 9 `useState` fields: `name`, `amount`, `period`, `periodStartDate`, `periodEndDate`, `icon`, `color`, `isSaving`, plus `activeBudget` (edit target). Two more — `startDateOpen`, `endDateOpen` — exist only to drive the form's date pickers.
- 7 handlers: `openCreate`, `openEdit`, `handleOpenChange`, `handlePeriodChange`, `handleStartDateChange`, `handleEndDateChange`, `handleSubmit`.
- Inline validation (`hasValidPeriod`, `isValid`, `canSubmit`) and the `periodRangeLabel` memo.
- Direct calls to `useCreateBudgetMutation` / `useUpdateBudgetMutation`.

Reset/prefill logic is duplicated across `openCreate`, `openEdit`, and `handleOpenChange`. The file is hard to read and hard to test in isolation.

A clean reference already exists: `BudgetTransferDrawer.tsx` is an extracted drawer with props `{ open, onOpenChange, destination }` that owns its own mutation hook and local state.

### Pre-existing test drift (to be fixed here)

`src/components/BudgetWeeklyBudgetsClient.mascot.test.tsx` currently fails **5 of 6** tests. The drawer header previously rendered a labeled `budget icon` input plus the `DialogCompanionSlot` + `IdleMascot` mascot. Commit `58e1964` ("Add budget emoji picker drawer") replaced those with `BudgetEmojiPickerSheet` (a `Plus`-button trigger + emoji sheet), but the test file was never updated. The tests assert on:

- `getByTestId("dialog-companion-slot")` and `getByTestId("idle-mascot")` — no longer rendered in this drawer (the mascot components still exist under `src/components/mascots/` but are unused here).
- `getByLabelText(/budget icon/i)` — the icon is now chosen via `BudgetEmojiPickerSheet`, not a labeled input.
- `getByLabelText(/budget name/i)` — the name `<input>` has only a `placeholder`, no label/`aria-label`.

## Goals

- Move the add/edit drawer into a self-contained component following the `BudgetTransferDrawer` pattern.
- Make the form's logic (state, validation, period/date interlocks, reset) unit-testable without rendering the drawer.
- Shrink `BudgetWeeklyBudgetsClient.tsx` and clarify its responsibilities.
- Land a green test suite (new tests + fix the drift).

## Non-Goals (YAGNI)

- No generic/config-driven form framework. The budgets page is the only consumer for now.
- No extraction of the detail drawer, delete-confirm dialog, or transfer wiring.
- No client-side Zod schema (route handlers keep their validation).
- No visual or behavioral change to the drawer as the user experiences it.
- The mascot is **not** reintroduced into this drawer; the `IdleMascot` / `DialogCompanionSlot` components are left untouched.

## Architecture

New folder groups the unit:

```
src/components/budget-form/
  BudgetFormDrawer.tsx     # "use client"; JSX only
  useBudgetForm.ts         # field state, interlocks, validation, reset, submit
  budget-form.types.ts     # shared prop/return types
```

`BudgetWeeklyBudgetsClient` owns *when* the drawer opens and *which* budget is being edited. `BudgetFormDrawer` owns *everything inside it*, including the two `DatePickerSheet`s and their open state.

### Component API (controlled)

```tsx
type BudgetFormDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget: BudgetListItem | null;     // null = create mode, otherwise edit
  weekStartDate: string;             // default period start in create mode
  onMoveFunds: (budget: BudgetListItem) => void; // "Move from another budget →"
};
```

- Create vs. edit is **derived from `budget`** — no separate `mode` prop.
- `onMoveFunds` is emitted when the user taps the "Move from another budget →" link (edit mode only). The parent closes the form and opens the transfer drawer.
- The drawer renders the `Drawer` (`repositionInputs={false}`, `hideIndicator` content, custom `DrawerClose`), the name input, `BudgetEmojiPickerSheet`, `BudgetBadge`, `BudgetColorList`, the amount input (`VndSymbol` + `parseVndInput`), the period buttons (`PERIOD_OPTIONS`), the start/end date buttons, both `DatePickerSheet`s, and the submit footer button.

### `useBudgetForm` hook

```ts
function useBudgetForm(args: {
  budget: BudgetListItem | null;
  weekStartDate: string;
  open: boolean;
}): {
  // field values
  name: string;
  amount: number;
  period: BudgetPeriod;
  periodStartDate: string;
  periodEndDate: string | null;
  icon: string;
  color: BudgetColorId;
  // setters / handlers
  setName: (v: string) => void;
  setAmount: (v: number) => void;
  setIcon: (v: string) => void;
  setColor: (v: BudgetColorId) => void;
  handlePeriodChange: (next: BudgetPeriod) => void;     // period↔date interlocks
  handleStartDateChange: (value: string) => void;       // keeps end ≥ start
  handleEndDateChange: (value: string) => void;
  // derived
  periodRangeLabel: string;
  trimmedName: string;
  hasValidPeriod: boolean;
  isValid: boolean;
  canSubmit: boolean;     // isValid && !isSaving
  isSaving: boolean;
  isEdit: boolean;        // budget !== null
  // actions
  submit: () => Promise<boolean>;   // returns true on success (parent closes)
};
```

Behavior preserved verbatim from the current implementation:

- **Reset / prefill:** a `useEffect` keyed on `open` (and `budget?.id`) prefills fields from `budget` in edit mode (`normalizeBudgetIcon` / `normalizeBudgetColor`) or resets to create-defaults (`DEFAULT_BUDGET_ICON`, `DEFAULT_BUDGET_COLOR`, `period = "week"`, `periodStartDate = weekStartDate`, `periodEndDate = null`, `amount = 0`, `name = ""`). This replaces the logic currently duplicated in `openCreate`, `openEdit`, and `handleOpenChange`.
- **Period/date interlocks:** identical to `handlePeriodChange` / `handleStartDateChange` today (custom period seeds an end date and keeps `end ≥ start`; non-custom clears the end date).
- **`periodRangeLabel`:** identical `useMemo` (week/month/custom branches).
- **Validation:** `trimmedName.length > 0 && amount > 0 && hasValidPeriod`.
- **Submit:** sets `isSaving`, calls the create or update mutation with the same payload (`periodEndDate` forced to `null` unless `period === "custom"`), fires the same `toast.success`/`toast.error`, and resolves `true` on success so the parent can close the drawer. Mutation hooks (`useCreateBudgetMutation`, `useUpdateBudgetMutation`) are instantiated inside the hook.

### Parent changes (`BudgetWeeklyBudgetsClient`)

- Remove the form's 9 + 2 `useState` fields, the 7 handlers, the validation derivations, the `periodRangeLabel` memo, the `amountRef`, and the ~200-line drawer JSX.
- Keep: `formOpen: boolean` and `editingBudget: BudgetListItem | null`.
  - `openCreate()` → `setEditingBudget(null); setFormOpen(true)`.
  - `openEdit(b)` → `setEditingBudget(b); setFormOpen(true)`.
- Render:
  ```tsx
  <BudgetFormDrawer
    open={formOpen}
    onOpenChange={setFormOpen}
    budget={editingBudget}
    weekStartDate={weekStartDate}
    onMoveFunds={(b) => { setFormOpen(false); openTransfer(b); }}
  />
  ```
- Handoffs preserved: detail-drawer "Edit" button still calls `openEdit(detailBudget)`; the form's "Move funds" link now flows through `onMoveFunds`.
- **Delete + confirm dialog stay in the parent unchanged.** Delete is only reachable from the detail drawer footer, which sets the delete target and opens the confirm dialog. The form no longer references `activeBudget`; the parent's delete path keeps using its own target state. (Optional clarity rename of `activeBudget` → `pendingDeleteBudget` may be applied where it only serves delete, but renaming is not required for correctness.)

### Accessibility improvement (folded in)

Add `aria-label="Budget name"` to the name `<input>` (currently placeholder-only). This fixes a real screen-reader gap and makes the field queryable by label in tests.

## Data Flow

```
BudgetWeeklyBudgetsClient (owns formOpen, editingBudget)
  └─ <BudgetFormDrawer open onOpenChange budget weekStartDate onMoveFunds>
        useBudgetForm({ budget, weekStartDate, open })
          ├─ field state + interlocks + validation + reset-on-open
          └─ submit() → useCreateBudgetMutation / useUpdateBudgetMutation
                          → /api/weekly-budgets[/:id]
                          → centralized invalidation (unchanged)
```

This conforms to `.agents/rules/tanstack-query.md`: mutations go through the existing hooks in `src/lib/mutations`; no new Server Actions or direct `fetch` calls; invalidation stays centralized.

## Error Handling

Unchanged from today: submit wraps the mutation in try/catch, logs the error, shows `toast.error("Failed to save budget.")`, and always clears `isSaving` in `finally`. On success the hook resolves `true` and the parent closes the drawer.

## Testing

Goal: green suite.

- **`src/components/budget-form/useBudgetForm.test.ts`** (new) — pure logic via `renderHook`:
  - validation truth table (empty name, zero amount, invalid/missing dates);
  - `handlePeriodChange` seeds/clears the end date correctly for custom vs. non-custom;
  - `handleStartDateChange` corrects `end < start`;
  - reset-on-open prefills create-defaults vs. edit values (including `normalizeBudgetIcon`/`normalizeBudgetColor`);
  - `periodRangeLabel` strings for week/month/custom.
- **`src/components/budget-form/BudgetFormDrawer.test.tsx`** (new) — render with a real `QueryClientProvider` and mocked mutation hooks:
  - create flow submits the expected payload;
  - edit mode prefills name/amount/icon/color;
  - submit disabled while invalid;
  - tapping "Move from another budget →" calls `onMoveFunds`.
- **Drift fix in `BudgetWeeklyBudgetsClient.mascot.test.tsx`:**
  - **Delete** the two tests asserting `dialog-companion-slot` / `idle-mascot` in the drawer header (removed behavior).
  - **Rewrite** the appearance tests to interact with the real `BudgetEmojiPickerSheet` (open via the `Choose budget emoji` trigger → pick/confirm) and to query the name field by its new `aria-label`. If driving the dynamic emoji picker proves brittle in jsdom, assert icon/color behavior at the `useBudgetForm` level instead and keep the component test focused on the picker trigger wiring.
  - Consider renaming the file to drop the now-inaccurate "mascot" name (e.g. `BudgetWeeklyBudgetsClient.appearance.test.tsx`) since the mascot is no longer part of this surface.
- Existing `BudgetWeeklyBudgetsClient.test.tsx` (currently passing) must stay green.

## Risks & Mitigations

- **Behavior regressions during extraction.** Mitigation: the hook preserves the exact logic; new hook + component tests assert the create/edit/validation/interlock behavior before and after.
- **vaul/Safari blur repaint perf** inside `DrawerContent`. The form has no large list, so the `memo` pattern used in `BudgetTransferDrawer` is not required; no change to current behavior.
- **Date picker nesting.** The two `DatePickerSheet`s currently render as siblings of `DrawerContent` inside the same `Drawer`; this structure is preserved inside `BudgetFormDrawer`.

## Acceptance Criteria

- Add/edit drawer renders and behaves identically to today (create, edit, period switching, custom date range, validation gating, save/update toasts, "Move funds" handoff).
- `BudgetWeeklyBudgetsClient.tsx` no longer contains the form state, handlers, or drawer JSX; it renders `<BudgetFormDrawer />`.
- `useBudgetForm` and `BudgetFormDrawer` have unit/component tests; the full budget test suite is green (no failing mascot tests).
- Name input has an accessible label.
- `rtk bunx prettier --check`, `rtk bunx eslint`, and `tsc --noEmit` pass for the changed scope; `npm run build` passes before push.
