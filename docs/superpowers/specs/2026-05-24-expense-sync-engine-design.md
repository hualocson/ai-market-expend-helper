# Expense Sync Engine V1 Spec: Zustand + IndexedDB

## Summary

Build a Linear-inspired local-first sync engine for this project, adapted from the article's "The sync engine" model: IndexedDB is the durable browser database, Zustand is the in-memory reactive object pool, and the server becomes the sync target rather than the UI's first read path.

Reference: [How is Linear so fast? A technical breakdown](https://performance.dev/how-is-linear-so-fast-a-technical-breakdown)

V1 ships only the Expense adapter, but the internal engine must be reusable for future entities. The shared core owns identity, durable records, outbox operations, metadata, retry, and reconciliation primitives. The Expense adapter owns expense-specific list filtering, query bridging, API mapping, and recovery UI.

## Design Decision

Use **Reusable sync core + Expense adapter + Zustand + IndexedDB + TanStack Query compatibility bridge**.

Alternatives considered:

- **MobX + IndexedDB**: closest to Linear, but adds a new state model and conflicts with the repo's existing Zustand usage.
- **TanStack Query persistence only**: easier, but it is cache persistence, not a durable mutation log or local database.
- **Zustand + IndexedDB**: best fit for this repo. Zustand replaces MobX's object pool; IndexedDB replaces transient query cache; TanStack Query remains as migration glue.
- **Generic multi-entity sync in V1**: too broad for this phase. V1 should make the core reusable but only register the `expenses` entity.

## Architecture

- `IndexedDB` stores generic sync records, outbox operations, and sync metadata. V1 records use `entity: "expenses"`.
- `Zustand` owns hydrated in-memory entity state through a reusable store factory. V1 instantiates only the Expense store.
- `TanStack Query` remains the public read path for current screens during V1 migration.
- `/api/expenses/sync` becomes the sync endpoint for pull and push.
- Existing REST mutation routes can remain during migration, but new local-first Expense writes should go through the sync engine.
- Shared sync core code must not import Expense modules. Expense modules may import the shared core.

Data flow:

```txt
App boot
-> hydrate IndexedDB records where entity = "expenses" into Expense Zustand store
-> seed/bridge TanStack Query expense list
-> render immediately
-> background pull from server
-> merge deltas into IndexedDB + Zustand + Query cache
```

Mutation flow:

```txt
User creates/edits/deletes expense
-> write local change to Zustand
-> persist generic sync record + generic outbox operation to IndexedDB
-> update visible Query cache
-> background flush to server
-> reconcile canonical server row or mark failed
```

## Interfaces

Add shared sync core types:

```ts
type SyncEntityName = "expenses";

type SyncStatus = "synced" | "pending" | "failed" | "deleted";

type SyncRecordBase = {
  entity: SyncEntityName;
  clientId: string;
  serverId: number | null;
  syncStatus: SyncStatus;
  lastError: string | null;
  updatedAt: string;
  serverUpdatedAt: string | null;
};

type SyncOperation<TPayload> = {
  operationId: string;
  entity: SyncEntityName;
  type: "create" | "update" | "delete";
  clientId: string;
  serverId: number | null;
  payload: TPayload | null;
  createdAt: string;
  attemptCount: number;
  lastAttemptAt: string | null;
  lastError: string | null;
};
```

Add Expense adapter row type:

```ts
type LocalExpense = SyncRecordBase & {
  entity: "expenses";
  date: string;
  amount: number;
  note: string;
  category: string;
  paidBy: string;
  budgetId: number | null;
  budgetName: string | null;
};
```

Add outbox operation type:

```ts
type ExpenseOutboxOperation = SyncOperation<LocalExpense>;
```

Add Zustand hook surface:

```ts
useExpenseSyncBootstrap()
useExpenseRows(params)
useExpenseByClientId(clientId)
useExpenseSyncStatus()
useCreateLocalExpense()
useUpdateLocalExpense()
useDeleteLocalExpense()
```

Add server sync contract:

```txt
GET /api/expenses/sync?cursor=<lastExpenseCursor>
POST /api/expenses/sync
```

The server must support idempotent create through `clientId`, so replay after reload cannot duplicate expenses.

## Key Implementation Requirements

- Add `clientId` to the `expenses` table with a unique index for non-null values.
- Include soft-deleted rows in sync pull responses so clients can remove local rows.
- Store cursors in shared IndexedDB metadata by entity key, with `expenses` using `lastCursor`.
- Use shared IndexedDB store names `syncRecords`, `syncOutbox`, and `syncMetadata`, not Expense-only durable store names.
- Treat IndexedDB as the durable source for Expense UI startup.
- Keep core sync modules generic: they may depend on `entity`, `clientId`, `serverId`, status, metadata, and operation shape, but not on fields like `amount`, `budgetId`, or `category`.
- Keep the Expense adapter responsible for converting between local rows, `ExpenseListResult`, existing route payloads, and recovery drafts.
- Use Zustand selectors narrowly to avoid full-list re-renders:
  - lists select ordered ids
  - row components select one row by id
  - badges/toasts select sync status only
- Keep existing quick expense failed-draft recovery behavior, but back it with failed outbox operations instead of session-only recovery for create/edit.
- Invalidate dashboard, reports, budgets, and budget weekly queries after successful expense sync because those domains remain server-owned in V1.

## Failure Behavior

- Offline writes stay visible as `pending`.
- Failed server validation marks the outbox operation and row as `failed`.
- Failed create/edit can reopen the existing recovery sheet with the exact submitted draft.
- Reload never replays a create without `clientId`.
- Interrupted `running` sync work becomes retryable on next app boot.

## Test Scenarios

- IndexedDB sync core repository:
  - persists records for `entity: "expenses"`
  - persists generic outbox operations with `entity`
  - stores and updates entity-scoped sync cursor
  - never imports Expense-specific field logic
- Expense adapter:
  - hides deleted rows from normal list reads
  - converts local Expense records into `ExpenseListResult`
- Zustand store:
  - hydrates from IndexedDB
  - updates one expense without replacing unrelated rows
  - exposes pending and failed sync status
- Local mutations:
  - create appears immediately before network
  - edit updates visible rows immediately
  - delete removes/hides visible row immediately
  - failed mutation is recoverable
- Sync:
  - queued create flushes once after reload
  - server confirmation maps `clientId` to `serverId`
  - pull applies server edits and soft deletes
  - rejected operations remain in failed state
- Compatibility:
  - existing `ExpenseList` still renders through TanStack Query during V1
  - dashboard/report/budget queries invalidate after successful sync

## Assumptions

- V1 does not add WebSockets.
- V1 does not sync Budget, Report, Dashboard, or AI data into IndexedDB.
- V1 defines only `SyncEntityName = "expenses"`, but the type and storage layout must be ready to extend to a union such as `"expenses" | "budgets"`.
- Native IndexedDB is acceptable; no new dependency is required unless implementation proves too verbose.
- Server remains the conflict authority.
- Last-write-wins is acceptable for V1 when server accepts an update.
