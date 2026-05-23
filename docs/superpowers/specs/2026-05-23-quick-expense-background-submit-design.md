# Quick Expense Background Submit Design

## Context

The transaction list now performs visible-list-only optimistic updates in the TanStack Query mutation hooks. `QuickExpenseSheet` still waits for add/edit mutations to finish before closing, which makes the sheet feel blocked even though the visible list can update optimistically.

The desired UX is:

- Submit add/edit from `QuickExpenseSheet`.
- Close the sheet immediately after the submit operation is queued.
- Show a loading toast while the mutation is pending.
- Let the existing mutation hooks handle optimistic cache updates and invalidation in the background.
- If the mutation fails, show an error toast with an action that reopens the sheet using the user's submitted draft.

## Scope

In scope:

- `QuickExpenseSheet` create mode.
- `QuickExpenseSheet` edit mode.
- A stable mutation coordinator for those add/edit mutations.
- Loading, success, and error toast behavior for those add/edit mutation operations.
- Restoring the submitted draft when the user chooses the error-toast action.
- A stable recovery sheet host that can reopen a failed create/edit draft even if the original sheet unmounted.
- Focused component tests for immediate close, pending toast, success, error, and draft restoration.

Out of scope:

- Delete confirmation flow.
- `ManualExpenseForm`.
- Budget transfer or budget CRUD flows.
- New routes, new Server Actions, or direct component fetch calls.
- Optimistic updates for dashboard, report, budget, or other derived caches.

## Considered Approaches

### Recommended: sheet queues the operation, stable coordinator owns mutation lifecycle

`QuickExpenseSheet` should not start the mutation promise itself. Instead, it saves a queued submit operation to a recovery store and closes immediately. A stable client component mounted above route/list churn, for example `QuickExpenseMutationCoordinator`, observes queued operations, owns the existing mutation hooks, creates the loading toast, stores the toast id, starts `mutateAsync`, and handles success/error.

This makes the mutation lifecycle independent from the sheet instance. If the sheet closes, unmounts, or its list item disappears, the coordinator is still mounted and can finish the toast/recovery flow. Optimistic cache work remains entirely inside `src/lib/mutations`.

### Alternative: sheet starts a non-blocking `mutateAsync` promise

The sheet could call `mutateAsync`, attach `then`/`catch`, and close without awaiting. The request usually continues after unmount, but the completion handlers still belong to the sheet render that started them. That is more fragile for edit sheets mounted inside list items, and reopen behavior can fail if the original component no longer exists.

### Alternative: move toast lifecycle into mutation hooks

The hooks could show loading/success/error toasts internally. That would centralize side effects, but it would make hooks less reusable and would couple generic mutation behavior to one sheet-specific "Reopen" action.

## Design

`QuickExpenseSheet` should build a submitted draft snapshot before queueing the operation. The snapshot is the exact values sent by the user, not whatever the form state becomes after closing or resetting.

On submit:

1. Validate `canSubmit`.
2. Build `payload` from the current draft.
3. Build `submittedDraft` as a new object copied from the current draft.
4. Create a recovery operation id.
5. Save the submitted draft and mutation variables in the recovery store with `status: "queued"`.
6. Close the sheet immediately after queueing.
7. Let `QuickExpenseMutationCoordinator` pick up the queued operation, create the loading toast, attach the toast id, mark the operation `running`, and call the relevant `mutateAsync`.

For create mode, closing the sheet may reset the live form draft to defaults. That is acceptable because the submitted draft snapshot is used if the request later fails.

For edit mode, closing the controlled sheet should behave the same as today from the parent view's perspective. The queued operation must include `transactionId`, so the coordinator does not need the original edit sheet to remain mounted.

## Draft Snapshot Mechanics

The submitted draft must be captured synchronously in `handleSubmit`, before queueing, coordinator processing, or sheet close can reset state.

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

This ordering matters because `handleOpenChange(false)` resets the create-mode draft to defaults. The coordinator and the error-toast action must read the copied draft from the recovery store. They must not read the current `draft` state after queueing.

The error-toast `Reopen` action should restore in this order:

1. Read the failed recovery entry by `operationId`.
2. Set the active recovery operation id in the recovery store.
3. The stable recovery sheet host reads the stored draft for that operation.
4. The host sets its sheet draft from the stored recovery draft before opening.
5. The host opens the sheet.

Restoring the draft before opening avoids a visible flash of the default create draft or stale edit props. If React batching makes the order visually equivalent in tests, the implementation should still keep this logical order for clarity.

Only one submitted draft needs to be retained per submit operation. While local pending is true, further submits from the same sheet instance are disabled, so there should not be multiple in-flight draft snapshots from the same sheet instance. If a parent unmounts the original sheet before an error action is clicked, the submitted draft remains available in the recovery store and can be opened by the stable recovery sheet host.

## Unmount Safety

Calling a TanStack Query mutation from a component does not normally abort the underlying network request when that component unmounts. The risky part is the owner of the completion flow:

- Per-call mutation callbacks can be skipped or become disconnected from UI when the mutation observer unmounts.
- Promise handlers attached in the sheet can still run, but they close over a component instance that may no longer be able to safely update state or reopen itself.
- Edit sheets rendered inside list items are especially fragile because the optimistic update or later invalidation can remove the list item that owns the sheet.

To avoid this, `QuickExpenseSheet` must only enqueue the operation. A stable coordinator, mounted near the app providers or another route-stable client shell, owns:

- `useCreateExpenseMutation`
- `useUpdateExpenseMutation`
- loading toast creation
- toast id storage
- mutation promise completion
- success cleanup
- failed-draft recovery marking

The coordinator should not render form UI. It should process queued operations from the recovery store and ignore operations that are already `running` to avoid duplicate requests.

Add a stable `QuickExpenseRecoverySheetHost` near the coordinator. It renders a recoverable `QuickExpenseSheet` when the user clicks the error-toast `Reopen` action. This host reads the failed operation from the recovery store and passes the stored draft into the sheet, so recovery does not depend on the original sheet or original list item still being mounted.

## Recovery Store

Add a dedicated quick-expense recovery store outside `QuickExpenseSheet`, for example `src/stores/quick-expense-recovery-store.ts`. This store is UI recovery state, not server state and not optimistic cache state.

Recommended entry shape:

```ts
type QuickExpenseRecoveryEntry = {
  operationId: string;
  mode: "create" | "edit";
  transactionId?: number;
  draft: TExpenseDraft;
  payload: {
    date: string;
    amount: number;
    note: string;
    category: Category;
    paidBy: PaidBy;
    budgetId: number | null;
  };
  toastId?: string | number;
  status: "queued" | "running" | "failed";
  createdAt: number;
};
```

Recommended actions:

- `enqueue(entry)` saves the submitted draft and mutation variables before the sheet closes.
- `attachToastId(operationId, toastId)` stores the loading toast id returned by `toast.loading`.
- `markRunning(operationId)` marks an operation after the coordinator starts the mutation.
- `markFailed(operationId)` keeps the draft available for `Reopen`.
- `clear(operationId)` removes the entry after success or after the user successfully reopens and resubmits.
- `pruneExpired(now)` removes entries older than the TTL.
- `setActiveRecovery(operationId | null)` selects which failed draft the recovery sheet host should render.

Use Zustand to match the app's existing client-state pattern. Persist only the recoverable draft metadata to `sessionStorage` with a short TTL, for example 10-30 minutes. Do not persist the toast id across page reloads because a Sonner toast id is only valid for the current browser runtime. The store can keep `toastId` in memory during the current runtime so success/error handling can update the correct loading toast even if the sheet component is closed.

The recovery store should not call REST routes, patch TanStack Query cache, or own mutation invalidation. Its only job is to preserve enough UI state to recover a failed add/edit submit.

## Toast Id Handling

Each submit operation should have an `operationId` and one associated loading toast id.

Suggested sequence:

1. Generate `operationId`.
2. Save the recovery entry with `status: "queued"` and no toast id.
3. Coordinator claims the queued operation and marks it `running`.
4. Coordinator calls `toast.loading(...)`.
5. Coordinator saves the returned toast id with `attachToastId(operationId, toastId)`.
6. Coordinator starts the mutation promise.
7. In success/error handlers, read the current recovery entry by `operationId`.
8. Use the stored toast id when replacing the loading toast with success or error.

Success should clear the recovery entry after replacing the loading toast. Error should keep the draft entry, mark it failed, and replace the loading toast with an error toast that has the `Reopen` action.

If the toast id is missing, the handler should still show a normal success/error toast. Missing toast id should not block cleanup or draft recovery.

The toast id should be treated as a presentation handle, not as the durable identity. `operationId` is the durable key used by the recovery store and tests.

## Toast Behavior

Pending:

- Show a loading toast when the coordinator starts the mutation.
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

If the original sheet unmounts while the mutation is pending, coordinator completion handlers should not assume mounted sheet state. The implementation should avoid throwing, and the toast can still report success or failure.

## Data Flow

Create:

1. User submits.
2. The sheet saves `{ operationId, mode: "create", draft, payload, status: "queued" }` in the recovery store.
3. Sheet closes immediately.
4. Coordinator observes the queued operation, marks it `running`, creates a loading toast, and stores the toast id.
5. Coordinator calls `useCreateExpenseMutation().mutateAsync(payload)`.
6. Mutation hook performs existing optimistic visible-list update in `onMutate`.
7. Success handler replaces the loading toast, clears the recovery entry, and does not require the sheet to still be open.
8. Error handler replaces the loading toast with `Reopen`, marks the recovery entry failed, and the action restores the draft from the recovery store.
9. Mutation hook invalidation remains the final source of server truth.

Edit:

1. User submits.
2. If `transactionId` is missing, show the existing failure toast and keep the sheet open.
3. The sheet saves `{ operationId, mode: "edit", transactionId, draft, payload, status: "queued" }` in the recovery store.
4. Sheet closes immediately.
5. Coordinator observes the queued operation, marks it `running`, creates a loading toast, and stores the toast id.
6. Coordinator calls `useUpdateExpenseMutation().mutateAsync({ id: transactionId, input: payload })`.
7. Mutation hook performs existing optimistic visible-list update in `onMutate`.
8. Success handler replaces the loading toast and clears the recovery entry.
9. Error handler replaces the loading toast with `Reopen`, marks the recovery entry failed, and the action restores the draft from the recovery store.
10. Mutation hook rollback/invalidation handles the list cache.

## State Boundaries

Keep optimistic cache logic out of `QuickExpenseSheet`.

`QuickExpenseSheet` may own:

- Whether the sheet is open when uncontrolled.
- Current draft fields.
- UI-only pending state for disabling duplicate submits while the operation is being queued.
- Enqueueing submitted operations into the recovery store.

The recovery store owns:

- Submitted draft snapshots that must survive sheet close or unmount.
- Mutation variables needed by the coordinator.
- Operation ids.
- Current-runtime toast ids for active operations.
- Short-lived failed-submit recovery entries.
- Active failed operation selected for recovery reopening.

The coordinator owns:

- Starting create/update mutations from queued recovery entries.
- Loading/success/error toast transitions.
- Success cleanup and failed-entry marking.

The recovery sheet host owns:

- Opening a failed create/edit draft from the recovery store.
- Rendering the recoverable sheet independently from the original list item or original sheet instance.

Mutation hooks continue to own:

- REST route calls.
- Query cancellation.
- Visible-list optimistic updates.
- Rollback.
- Derived cache invalidation.

## Duplicate Submit Handling

Keep a local pending flag so the submit button cannot enqueue duplicate operations while a create/edit submit from this sheet is being queued. Since the sheet closes immediately, the main practical protection is against rapid double activation before the close transition completes.

The coordinator should also ignore queued operations that have already been marked `running`. Recovery cleanup must not depend on a local sheet flag.

## Error Handling

Rollback remains snapshot-based inside the mutation hooks. The sheet should not attempt to manually undo list changes.

The error-toast action should restore the draft exactly as submitted:

- date
- amount
- note
- category
- budget id
- paid by

For edit mode, reopening should preserve edit mode and the same transaction id through the recovery sheet host. If the failed recovery entry has expired or no longer exists, the action should no-op safely rather than throwing.

## Tests

Update or add focused tests for `QuickExpenseSheet`, `QuickExpenseMutationCoordinator`, the recovery store, and the recovery sheet host:

- Create submit enqueues without calling `mutateAsync` from the sheet.
- Create submit enqueues the recovery draft and payload, then closes immediately.
- Coordinator starts the create mutation from the queued entry and stores the loading toast id.
- Create success handler uses the stored toast id, shows success toast, and clears the recovery entry.
- Create error handler uses the stored toast id, shows an error toast with a `Reopen` action, and keeps the recovery draft.
- Create `Reopen` action opens the stable recovery sheet host with the submitted draft.
- Edit submit enqueues the recovery draft, transaction id, and payload, then closes immediately.
- Coordinator starts the edit mutation from the queued entry and stores the loading toast id.
- Edit success handler uses the stored toast id, shows success toast, and clears the recovery entry.
- Edit error handler uses the stored toast id, shows an error toast with a `Reopen` action, and keeps the recovery draft.
- Edit `Reopen` action opens the stable recovery sheet host with the submitted draft and transaction id.
- Missing edit `transactionId` still shows a failure toast and does not enqueue an operation.
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

- Add/edit sheet closes immediately after queueing a valid submit operation.
- A loading toast is visible while the mutation is pending.
- Mutation execution and toast completion do not depend on the original sheet staying mounted.
- Success toast appears when the request succeeds.
- Failure toast includes a `Reopen` action.
- `Reopen` restores the user's submitted draft through a stable recovery sheet host instead of relying on the original sheet instance.
- Optimistic updates remain in mutation/cache helpers, not components.
- Existing invalidation continues to correct derived dashboard/report/budget caches.
