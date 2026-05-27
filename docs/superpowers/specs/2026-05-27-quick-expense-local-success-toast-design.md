# Quick Expense Local Success Toast Design

## Context

`QuickExpenseSheet` handles quick add and edit flows through local-first expense mutations. The sheet closes immediately after dispatching the local write, and later server sync failures are surfaced by the existing recovery flow. Today the quick sheet shows error toasts for failed local writes but does not show a success toast when the local write succeeds.

The desired behavior is a toast after the local write succeeds, not after server sync succeeds.

## Goals

- Show a success toast for quick expense create after the local write resolves.
- Show a success toast for quick expense edit after the local write resolves.
- Preserve immediate sheet close behavior after submit.
- Keep server sync failure handling in the existing recovery/toast flow.
- Avoid moving UI feedback into shared mutation hooks.

## Non-Goals

- Do not wait for server sync before showing success.
- Do not add success toasts in TanStack Query mutation hooks.
- Do not change recovery persistence or outbox ownership.
- Do not change delete toast behavior.

## Recommended Approach

Add the success toast in `QuickExpenseSheet`, inside the existing background `localWrite` promise chain. The sheet already owns the user intent and knows whether the submit is create or edit. This keeps the shared mutation hooks focused on local writes, invalidation, and sync scheduling.

The sheet should continue to close immediately after dispatching the mutation. Once the local write promise resolves, it should show:

- Create: `Expense added.`
- Edit: `Expense updated.`

The existing catch branch should continue to show:

- Create: `Failed to add expense`
- Edit: `Failed to update expense`

Recovery resubmits should follow the same behavior because they are successful local writes for the recovered draft.

## Data Flow

1. User submits a valid quick add or edit form.
2. `QuickExpenseSheet` clones the draft and builds the payload.
3. The sheet dispatches `createExpense(payload)` or `updateExpense({ id, input: payload })`.
4. The sheet closes immediately.
5. If the local write resolves, `QuickExpenseSheet` shows the success toast.
6. If the local write rejects, `QuickExpenseSheet` shows the existing error toast.
7. Server sync continues independently. Existing recovery toasts handle later sync failures.

## Testing

Update `QuickExpenseSheet` tests to verify:

- Create success toast appears after the create mutation resolves.
- Edit success toast appears after the update mutation resolves.
- Success toast is not emitted merely by clicking submit before the local write resolves.
- Existing failure toast behavior remains covered.

No mutation hook tests are required for the toast because mutation hooks should not own UI feedback.

## Open Decisions

None. Success means local write success, not server sync success.
