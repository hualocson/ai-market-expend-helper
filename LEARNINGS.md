# Learnings

## Optimistic Mutations With Persistent UI Recovery

Use this pattern when a UI should close immediately after submit while the server mutation continues in the background.

### Boundaries

- Components collect form state, clone the submitted draft, enqueue a recovery operation, and close.
- A stable coordinator component owns mutation execution, pending/success/error toasts, and failed-entry marking.
- TanStack Query mutation hooks own REST calls, optimistic cache updates, rollback, and invalidation.
- Zustand recovery stores own UI recovery metadata only. They must not call REST routes or patch query caches.
- Stable recovery hosts reopen failed drafts independently from the original sheet/list item that submitted them.

### Draft Capture

- Clone submitted form state synchronously before closing or resetting UI state.
- Build mutation payloads from the cloned draft, not from live component state after close.
- Store both the cloned draft and the payload in the recovery entry so error recovery restores exactly what the user submitted.

### Persistence Rules

- Persist only durable recovery metadata: draft, payload, mode, transaction id, status, and creation time.
- Do not persist presentation handles such as toast ids.
- Use a short TTL and invoke pruning from production-mounted code, not only from tests.
- Treat `running` as a current-runtime status. If persisted or hydrated, normalize it to a failed recovery draft rather than queued, so reload cannot replay a mutation and create duplicates.
- The coordinator should process only `queued` entries and defensively skip expired entries.

### Toast and Recovery Flow

- Use a durable operation id for recovery identity.
- Loading toast ids are optional runtime handles; missing ids must not block success cleanup or error recovery.
- On success, replace or show the success toast and clear the recovery entry.
- On error, mark the entry failed and show a toast action that selects the operation id for the stable recovery host.

### Testing Checklist

- Store tests: enqueue, running, failed, clear, active recovery, TTL prune, persisted partialization, hydrated normalization.
- Sheet tests: valid create/edit submits enqueue cloned draft and payload, close immediately, and do not call mutation hooks.
- Coordinator tests: create/update execution, toast id handling, success cleanup, error recovery, duplicate in-flight guard, expired-entry pruning, invalid edit guard.
- Host tests: failed create/edit entries reopen with the submitted draft and clear active recovery on close.
- Regression tests: optimistic mutation hooks still own visible-list updates, rollback, and invalidation.

