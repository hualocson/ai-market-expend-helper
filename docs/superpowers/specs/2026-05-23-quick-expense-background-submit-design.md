# Quick Expense Background Submit Design

## Context

The transaction list now performs visible-list-only optimistic updates in the TanStack Query mutation hooks. `QuickExpenseSheet` still waits for add/edit mutations to finish before closing, which makes the sheet feel blocked even though the visible list can update optimistically.

The desired UX is:

- Submit add/edit from `QuickExpenseSheet`.
- Close the sheet immediately after the mutation request is dispatched.
- Show a loading toast while the mutation is pending.
- Let the existing mutation hooks handle optimistic cache updates and invalidation in the background.
- If the mutation fails, show an error toast with an action that reopens the sheet using the user's submitted draft.

## Scope

In scope:

- `QuickExpenseSheet` create mode.
- `QuickExpenseSheet` edit mode.
- Loading, success, and error toast behavior for those add/edit mutations.
- Restoring the submitted draft when the user chooses the error-toast action.
- Focused component tests for immediate close, pending toast, success, error, and draft restoration.

Out of scope:

- Delete confirmation flow.
- `ManualExpenseForm`.
- Budget transfer or budget CRUD flows.
- New routes, new Server Actions, or direct component fetch calls.
- Optimistic updates for dashboard, report, budget, or other derived caches.

## Considered Approaches

### Recommended: component-level submission callbacks, cache logic stays in mutations

Use the existing mutation hooks with `mutate(variables, { onSuccess, onError })`. The sheet closes immediately after dispatch, displays a loading toast, and uses the callbacks only for user-facing toast and draft restoration behavior. Optimistic cache work remains entirely inside `src/lib/mutations`.

This matches the current TanStack Query architecture: components own UI state and user feedback, mutation hooks own REST writes, optimistic list patches, rollback, and invalidation.

### Alternative: move toast lifecycle into mutation hooks

The hooks could show loading/success/error toasts internally. That would centralize side effects, but it would make hooks less reusable and would couple generic mutation behavior to one sheet-specific "Reopen" action.

### Alternative: keep awaiting `mutateAsync`, but close first

The sheet could call `handleOpenChange(false)` and then `await mutateAsync(...)`. This would reduce the blocking feel, but the component would still need local loading cleanup and would be easier to accidentally sequence incorrectly. It also makes the error-toast action harder to reason about because the submitted draft must be preserved across an async `try/catch`.

## Design

`QuickExpenseSheet` should build a submitted draft snapshot before dispatching the mutation. The snapshot is the exact values sent by the user, not whatever the form state becomes after closing or resetting.

On submit:

1. Validate `canSubmit`.
2. Build `payload` from the current draft.
3. Build `submittedDraft` as a new object copied from the current draft.
4. Create a loading toast and retain its toast id.
5. Dispatch the relevant mutation with `mutate`.
6. Close the sheet immediately after dispatch.

For create mode, closing the sheet may reset the live form draft to defaults. That is acceptable because the submitted draft snapshot is used if the request later fails.

For edit mode, closing the controlled sheet should behave the same as today from the parent view's perspective. The mutation success callback still invokes `onSuccess?.()` so parent edit state can close or refresh its local UI.

## Draft Snapshot Mechanics

The submitted draft must be captured synchronously in `handleSubmit`, before any mutation dispatch, toast action registration, or sheet close can reset state.

The implementation should use a small helper or inline copy with the same shape as `TExpenseDraft`:

```ts
const submittedDraft: TExpenseDraft = {
  date: draft.date,
  amount: draft.amount,
  note: draft.note,
  category: draft.category,
  budgetId: draft.budgetId,
  paidBy: draft.paidBy,
};
```

Then build the mutation `payload` from `submittedDraft`, not from the live `draft` object:

```ts
const payload = {
  date: submittedDraft.date,
  amount: submittedDraft.amount,
  note: submittedDraft.note,
  category: submittedDraft.category,
  paidBy: submittedDraft.paidBy,
  budgetId: submittedDraft.budgetId,
};
```

This ordering matters because `handleOpenChange(false)` resets the create-mode draft to defaults. The mutation callbacks and the error-toast action must close over `submittedDraft`, or store that same copied value in a ref dedicated to retry recovery. They must not read the current `draft` state after dispatch.

The error-toast `Reopen` action should restore in this order:

1. Set the sheet draft to `submittedDraft`.
2. Clear local pending state if still pending.
3. Open the sheet with `handleOpenChange(true)` or the equivalent controlled callback.

Restoring the draft before opening avoids a visible flash of the default create draft or stale edit props. If React batching makes the order visually equivalent in tests, the implementation should still keep this logical order for clarity.

Only one submitted draft needs to be retained per `QuickExpenseSheet` instance. While local pending is true, further submits are disabled, so there should not be multiple in-flight draft snapshots from the same sheet instance. If a parent unmounts the sheet before an error action is clicked, the action should no-op safely rather than trying to recover state in an unmounted component.

## Toast Behavior

Pending:

- Show a loading toast when the request is dispatched.
- Suggested copy:
  - Create: `Adding expense...`
  - Edit: `Updating expense...`

Success:

- Replace or dismiss the loading toast via the same toast id.
- Suggested copy:
  - Create: `Expense added`
  - Edit: `Expense updated`

Error:

- Replace or dismiss the loading toast via the same toast id.
- Show the error message from the thrown `Error` when available.
- Fall back to:
  - Create: `Failed to add expense`
  - Edit: `Failed to update expense`
- Include an action labeled `Reopen`.
- When clicked, the action restores the submitted draft snapshot and opens the sheet.

If the component unmounts while the mutation is pending, the toast callbacks should not assume mounted state. The implementation should avoid throwing, and the toast can still report success or failure.

## Data Flow

Create:

1. User submits.
2. `useCreateExpenseMutation().mutate(payload, callbacks)` starts.
3. Mutation hook performs existing optimistic visible-list update in `onMutate`.
4. Sheet closes immediately.
5. Success callback shows success toast.
6. Error callback shows error toast with `Reopen`, and the action restores the submitted draft.
7. Mutation hook invalidation remains the final source of server truth.

Edit:

1. User submits.
2. If `transactionId` is missing, show the existing failure toast and keep the sheet open.
3. `useUpdateExpenseMutation().mutate({ id: transactionId, input: payload }, callbacks)` starts.
4. Mutation hook performs existing optimistic visible-list update in `onMutate`.
5. Sheet closes immediately.
6. Success callback shows success toast and calls `onSuccess?.()`.
7. Error callback shows error toast with `Reopen`, and the action restores the submitted draft.
8. Mutation hook rollback/invalidation handles the list cache.

## State Boundaries

Keep optimistic cache logic out of `QuickExpenseSheet`.

`QuickExpenseSheet` may own:

- Whether the sheet is open when uncontrolled.
- Current draft fields.
- UI-only pending state for disabling duplicate submits while a request is pending.
- Toast lifecycle callbacks.
- Submitted draft restoration for the error-toast action.

Mutation hooks continue to own:

- REST route calls.
- Query cancellation.
- Visible-list optimistic updates.
- Rollback.
- Derived cache invalidation.

## Duplicate Submit Handling

Keep a local pending flag so the submit button cannot dispatch duplicate requests while a create/edit mutation from this sheet is still pending. Since the sheet closes immediately, the main practical protection is against rapid double activation before the close transition completes.

The pending flag should reset in both success and error callbacks.

## Error Handling

Rollback remains snapshot-based inside the mutation hooks. The sheet should not attempt to manually undo list changes.

The error-toast action should restore the draft exactly as submitted:

- date
- amount
- note
- category
- budget id
- paid by

For edit mode, reopening should preserve edit mode and the same transaction id. If the parent has already removed the edit sheet from the tree, the action should fail gracefully rather than throwing.

## Tests

Update `src/components/QuickExpenseSheet.test.tsx` with focused behavior tests:

- Create submit calls `mutate` with callbacks, closes immediately, and shows a loading toast.
- Create success callback shows success toast and does not require the sheet to still be open.
- Create error callback shows an error toast with a `Reopen` action.
- Create `Reopen` action restores the submitted draft.
- Edit submit calls `mutate` with callbacks, closes immediately, and shows a loading toast.
- Edit success callback shows success toast and calls `onSuccess`.
- Edit error callback shows an error toast with a `Reopen` action.
- Edit `Reopen` action restores the submitted draft.
- Missing edit `transactionId` still shows a failure toast and does not dispatch a mutation.

Targeted verification:

```bash
rtk npm run test -- src/components/QuickExpenseSheet.test.tsx
rtk npm run test -- src/lib/mutations/expense-optimistic.test.ts src/lib/mutations/index.test.tsx src/components/ExpenseList.test.tsx src/components/QuickExpenseSheet.test.tsx
rtk npx tsc --noEmit
```

Do not run `npm run build`.

## Acceptance Criteria

- Add/edit sheet closes immediately after dispatching a valid mutation request.
- A loading toast is visible while the mutation is pending.
- Success toast appears when the request succeeds.
- Failure toast includes a `Reopen` action.
- `Reopen` restores the user's submitted draft instead of resetting to defaults or initial edit props.
- Optimistic updates remain in mutation/cache helpers, not components.
- Existing invalidation continues to correct derived dashboard/report/budget caches.
