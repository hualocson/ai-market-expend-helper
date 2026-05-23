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

### Recommended: component-level fire-and-follow submission, recovery state stays outside the sheet

Use the existing mutation hooks with a non-blocking `mutateAsync` call: start the promise, attach `then`/`catch` handlers, and close the sheet without awaiting it. The submitted draft and loading toast id are saved to a small recovery store before dispatch. The promise handlers use the recovery entry for user-facing toast and draft restoration behavior. Optimistic cache work remains entirely inside `src/lib/mutations`.

This matches the current TanStack Query architecture: components own UI state and user feedback, a client store owns cross-unmount recovery state, and mutation hooks own REST writes, optimistic list patches, rollback, and invalidation. It also avoids relying on live sheet state after the sheet closes.

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
4. Create a recovery operation id.
5. Save the submitted draft in the recovery store.
6. Create a loading toast and save its toast id in the same recovery entry.
7. Dispatch the relevant mutation with `mutateAsync`, attach completion handlers, and do not await it.
8. Close the sheet immediately after dispatch.

For create mode, closing the sheet may reset the live form draft to defaults. That is acceptable because the submitted draft snapshot is used if the request later fails.

For edit mode, closing the controlled sheet should behave the same as today from the parent view's perspective. The mutation success handler still invokes `onSuccess?.()` so parent edit state can close or refresh its local UI.

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

This ordering matters because `handleOpenChange(false)` resets the create-mode draft to defaults. The mutation completion handlers and the error-toast action must read the copied draft from the recovery store or close over the same copied value. They must not read the current `draft` state after dispatch.

The error-toast `Reopen` action should restore in this order:

1. Read the failed recovery entry by `operationId`.
2. Set the sheet draft to the stored recovery draft.
3. Clear local pending state if still pending.
4. Open the sheet with `handleOpenChange(true)` or the equivalent controlled callback.

Restoring the draft before opening avoids a visible flash of the default create draft or stale edit props. If React batching makes the order visually equivalent in tests, the implementation should still keep this logical order for clarity.

Only one submitted draft needs to be retained per submit operation. While local pending is true, further submits from the same sheet instance are disabled, so there should not be multiple in-flight draft snapshots from the same sheet instance. If a parent unmounts the sheet before an error action is clicked, the submitted draft remains available in the recovery store.

## Recovery Store

Add a dedicated quick-expense recovery store outside `QuickExpenseSheet`, for example `src/stores/quick-expense-recovery-store.ts`. This store is UI recovery state, not server state and not optimistic cache state.

Recommended entry shape:

```ts
type QuickExpenseRecoveryEntry = {
  operationId: string;
  mode: "create" | "edit";
  transactionId?: number;
  draft: TExpenseDraft;
  toastId?: string | number;
  status: "pending" | "failed";
  createdAt: number;
};
```

Recommended actions:

- `savePending(entry)` saves the submitted draft before dispatch.
- `attachToastId(operationId, toastId)` stores the loading toast id returned by `toast.loading`.
- `markFailed(operationId)` keeps the draft available for `Reopen`.
- `clear(operationId)` removes the entry after success or after the user successfully reopens and resubmits.
- `pruneExpired(now)` removes entries older than the TTL.

Use Zustand to match the app's existing client-state pattern. Persist only the recoverable draft metadata to `sessionStorage` with a short TTL, for example 10-30 minutes. Do not persist the toast id across page reloads because a Sonner toast id is only valid for the current browser runtime. The store can keep `toastId` in memory during the current runtime so success/error handling can update the correct loading toast even if the sheet component is closed.

The recovery store should not call REST routes, patch TanStack Query cache, or own mutation invalidation. Its only job is to preserve enough UI state to recover a failed add/edit submit.

## Toast Id Handling

Each submit operation should have an `operationId` and one associated loading toast id.

Suggested sequence:

1. Generate `operationId`.
2. Save the recovery entry with `status: "pending"` and no toast id.
3. Call `toast.loading(...)`.
4. Save the returned toast id with `attachToastId(operationId, toastId)`.
5. Start the mutation promise.
6. In success/error handlers, read the current recovery entry by `operationId`.
7. Use the stored toast id when replacing the loading toast with success or error.

Success should clear the recovery entry after replacing the loading toast. Error should keep the draft entry, mark it failed, and replace the loading toast with an error toast that has the `Reopen` action.

If the toast id is missing, the handler should still show a normal success/error toast. Missing toast id should not block cleanup or draft recovery.

The toast id should be treated as a presentation handle, not as the durable identity. `operationId` is the durable key used by the recovery store and tests.

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

If the component unmounts while the mutation is pending, completion handlers should not assume mounted sheet state. The implementation should avoid throwing, and the toast can still report success or failure.

## Data Flow

Create:

1. User submits.
2. The sheet saves `{ operationId, mode: "create", draft, status: "pending" }` in the recovery store.
3. The sheet creates a loading toast and stores its toast id on that recovery entry.
4. `useCreateExpenseMutation().mutateAsync(payload)` starts without being awaited by the submit handler.
5. Mutation hook performs existing optimistic visible-list update in `onMutate`.
6. Sheet closes immediately.
7. Success handler replaces the loading toast, clears the recovery entry, and does not require the sheet to still be open.
8. Error handler replaces the loading toast with `Reopen`, marks the recovery entry failed, and the action restores the draft from the recovery store.
9. Mutation hook invalidation remains the final source of server truth.

Edit:

1. User submits.
2. If `transactionId` is missing, show the existing failure toast and keep the sheet open.
3. The sheet saves `{ operationId, mode: "edit", transactionId, draft, status: "pending" }` in the recovery store.
4. The sheet creates a loading toast and stores its toast id on that recovery entry.
5. `useUpdateExpenseMutation().mutateAsync({ id: transactionId, input: payload })` starts without being awaited by the submit handler.
6. Mutation hook performs existing optimistic visible-list update in `onMutate`.
7. Sheet closes immediately.
8. Success handler replaces the loading toast, clears the recovery entry, and calls `onSuccess?.()`.
9. Error handler replaces the loading toast with `Reopen`, marks the recovery entry failed, and the action restores the draft from the recovery store.
10. Mutation hook rollback/invalidation handles the list cache.

## State Boundaries

Keep optimistic cache logic out of `QuickExpenseSheet`.

`QuickExpenseSheet` may own:

- Whether the sheet is open when uncontrolled.
- Current draft fields.
- UI-only pending state for disabling duplicate submits while a request is pending.
- Starting the toast lifecycle for a submitted operation.
- Reading a failed recovery entry when the user clicks `Reopen`.

The recovery store owns:

- Submitted draft snapshots that must survive sheet close or unmount.
- Operation ids.
- Current-runtime toast ids for pending operations.
- Short-lived failed-submit recovery entries.

Mutation hooks continue to own:

- REST route calls.
- Query cancellation.
- Visible-list optimistic updates.
- Rollback.
- Derived cache invalidation.

## Duplicate Submit Handling

Keep a local pending flag so the submit button cannot dispatch duplicate requests while a create/edit mutation from this sheet is still pending. Since the sheet closes immediately, the main practical protection is against rapid double activation before the close transition completes.

The pending flag should reset in both success and error handlers when the sheet instance is still mounted. Recovery cleanup should not depend on this local flag.

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

- Create submit starts `mutateAsync` without awaiting it, closes immediately, and shows a loading toast.
- Create submit saves the recovery draft and toast id before closing.
- Create success handler uses the stored toast id, shows success toast, and clears the recovery entry.
- Create error handler uses the stored toast id, shows an error toast with a `Reopen` action, and keeps the recovery draft.
- Create `Reopen` action restores the submitted draft.
- Edit submit starts `mutateAsync` without awaiting it, closes immediately, and shows a loading toast.
- Edit submit saves the recovery draft and toast id before closing.
- Edit success handler uses the stored toast id, shows success toast, clears the recovery entry, and calls `onSuccess`.
- Edit error handler uses the stored toast id, shows an error toast with a `Reopen` action, and keeps the recovery draft.
- Edit `Reopen` action restores the submitted draft.
- Missing edit `transactionId` still shows a failure toast and does not dispatch a mutation.
- Recovery store pruning removes expired failed-submit drafts.
- The persisted recovery state excludes the toast id.

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
