# Transaction Optimistic Visible List Design

## Context

Transaction create, edit, and delete flows already use TanStack Query mutation hooks in `src/lib/mutations/index.ts`. Those hooks call REST route handlers and then invalidate affected query families:

- `queries.expenses._def`
- `queries.dashboard._def`
- `queries.reports._def`
- `queries.budgets.overview.queryKey`
- `queries.budgetWeekly.options._def`

The current behavior waits for the mutation and refetch before the visible transaction list reflects the change. The goal is to make add, edit, and delete feel immediate in visible expense lists without duplicating dashboard, report, or budget total calculations on the client.

TanStack Query's recommended cache-level optimistic flow is to cancel active queries, snapshot previous cache data, update cached data in `onMutate`, roll back from the snapshot in `onError`, and invalidate/refetch after the mutation settles.

## Scope

Implement optimistic updates only for cached expense list results produced by `queries.expenses.list(...)`.

In scope:

- Create transaction: insert a temporary row into matching cached expense list results.
- Edit transaction: update, move, or remove the row across cached expense list results depending on local filter membership.
- Delete transaction: remove the row from all cached expense list results.
- Regroup affected `ExpenseListResult` data by date and recompute per-day totals.
- Preserve existing server-backed invalidation for all derived surfaces after mutation completion.
- Add focused tests for optimistic cache behavior and rollback.

Out of scope:

- Optimistic dashboard totals.
- Optimistic monthly/daily reports.
- Optimistic budget overview, remaining budget, or weekly budget options.
- Persistent offline mutation queues.
- Cross-session temporary transaction identity.

## Architecture

Add a small helper module for expense-list optimistic cache updates at `src/lib/mutations/expense-optimistic.ts`.

Responsibilities:

- Inspect cached queries under `queries.expenses.list._def`.
- Snapshot previous cached `ExpenseListResult` values before patching.
- Apply one of three operations: create, update, delete.
- Rebuild `rows` and `groupedRows` consistently after each patch.
- Restore snapshots on mutation error.

The mutation hooks remain the public API used by components:

- `useCreateExpenseMutation`
- `useUpdateExpenseMutation`
- `useDeleteExpenseMutation`

Components should not contain cache patching logic. They continue to call `mutateAsync`, show toasts, and close sheets/dialogs.

## Data Flow

### Create

1. `onMutate(input)` cancels active expense list queries.
2. It snapshots every cached `queries.expenses.list(...)` result.
3. It creates a temporary list row from the mutation input:
   - temporary negative id
   - normalized ISO date for list rendering
   - amount, note, category, paidBy, and budgetId from input
   - best-effort budget name from cached weekly budget options when available, otherwise `null`
4. It inserts the temporary row into each cached expense list where the row locally matches:
   - month range
   - recent range
   - search query text
5. It sorts rows by date descending, then id descending, and regenerates groups.
6. On error, the previous snapshots are restored.
7. On settle, existing invalidation refetches server truth.

### Edit

1. `onMutate({ id, input })` cancels active expense list queries.
2. It snapshots every cached expense list.
3. For each cached list:
   - if the row exists and the edited row still matches the list filters, replace it in place using the input values
   - if the row exists but no longer matches, remove it
   - if the row does not exist but the edited row matches, add it only when the pre-mutation snapshots contain the same id in another cached expense list
4. It sorts and regroups patched lists.
5. On error, snapshots are restored.
6. On settle, existing invalidation refetches server truth.

### Delete

1. `onMutate(id)` cancels active expense list queries.
2. It snapshots every cached expense list.
3. It removes the matching id from all cached expense list results.
4. It regroups affected lists.
5. On error, snapshots are restored.
6. On settle, existing invalidation refetches server truth.

## Local Matching Rules

The local matcher should be conservative.

Month:

- Compare the transaction ISO date month (`YYYY-MM`) with the cached query's normalized `month` param.
- If no month param is set, use the cached result's `activeMonth`.
- Read cached list params from the `queries.expenses.list(...)` query key object; do not duplicate ad hoc keys.

Recent mode:

- Use cached `isRecent`, `activeMonth`, and `effectiveRecentDays`.
- Include rows dated inside the current recent window for that cached result.
- If the math is ambiguous, skip insertion and rely on refetch.

Search:

- Trim and lowercase the cached query `q`.
- Match against note and category using a simple substring check.
- This is intentionally less powerful than the server's full-text search. If local matching is uncertain, avoid inserting. Server refetch will correct the list.

Budget name:

- For create and edit, set `budgetName` to `null` unless a cached budget option can be found for the selected budget id.
- The list already handles a missing budget name by showing a generic assigned label.

## Error Handling

Rollback must restore exact snapshots rather than attempting an inverse operation. This prevents partial rollback bugs when multiple cached lists were patched.

If a mutation succeeds but returns a shape that differs from the optimistic row, the normal invalidation/refetch path corrects the cache.

If concurrent mutations touch the same visible list, each mutation keeps its own snapshot. The implementation should avoid broad custom reconciliation beyond the standard TanStack Query pattern; server refetch remains the final source of truth.

## Rules

- Do not optimistic-update derived totals outside `queries.expenses.list(...)`.
- Do not put optimistic update logic in components.
- Do not create ad hoc query keys.
- Cancel expense list queries before patching them.
- Snapshot before every optimistic patch.
- Restore snapshots on error.
- Keep existing invalidation after mutation completion.
- Prefer skipping an uncertain optimistic insertion over showing a row in the wrong filtered list.

## Tests

Add focused mutation/helper tests:

- Create inserts a temporary row into a matching cached expense list.
- Create does not insert into a non-matching month/search list.
- Update changes a visible row and recomputes the group total.
- Update removes a row when it no longer matches the cached list filter.
- Delete removes a row and recomputes the group total.
- Failed create/update/delete restores the previous cached data.
- Mutation hooks still call the existing REST routes and derived invalidation keys.

Verification should use targeted tests, for example:

```bash
rtk npm run test -- src/lib/mutations/index.test.tsx
```

Do not run `npm run build` for this individual change.

## References

- TanStack Query React optimistic updates guide: https://tanstack.com/query/v5/docs/framework/react/guides/optimistic-updates
