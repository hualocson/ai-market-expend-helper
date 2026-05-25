# IDB Storage Redesign

## Goal

Replace the hand-written IndexedDB promise/transaction wrapper with `jakearchibald/idb`, and use the change to introduce a reusable typed IndexedDB foundation for future local storage features. The first consumer will be the existing sync repository, redesigned around the new typed storage layer.

The refactor does not need to preserve existing local IndexedDB data. Pending local records and outbox entries from the current `app-sync-v1` database can be discarded as part of this redesign.

## Context

The current sync storage code is split between:

- `src/lib/sync/core/idb.ts`, which manually opens `indexedDB`, creates stores, caches the connection, and handles version changes.
- `src/lib/sync/core/repository.ts`, which manually wraps `IDBRequest`, transaction completion, database deletion, records, outbox operations, and metadata.

This works, but it duplicates low-level IndexedDB mechanics that `idb` already provides. It also makes future local storage features likely to copy the same low-level patterns.

## Architecture

Add a generic IndexedDB helper layer under:

- `src/lib/storage/indexed-db/types.ts`
- `src/lib/storage/indexed-db/client.ts`

The generic layer should wrap `idb` primitives and stay domain-neutral. It should know how to open, cache, close, delete, and run typed transactions, but it should not know about sync records, expenses, outbox ordering, cursors, or mutation semantics.

The sync domain keeps its schema and repository under `src/lib/sync/core/*`:

- `src/lib/sync/core/idb.ts` defines a typed sync database schema using `DBSchema`.
- `src/lib/sync/core/repository.ts` exposes sync-specific record, outbox, metadata, and reset operations backed by the generic storage client.

Use a clean schema boundary with database name `app-sync-v2`, so stale `app-sync-v1` data is not read accidentally.

## Generic Storage API

The generic storage client should be small and typed. The intended shape is:

- `createIndexedDbClient({ name, version, upgrade })`
- `client.open()`
- `client.close()`
- `client.deleteDatabase()`
- `client.withTransaction(stores, mode, callback)`

The client should use `idb` APIs such as `openDB`, `deleteDB`, `IDBPDatabase`, and transaction `.done`. It should cache the open database connection and clear the cache when the connection closes for version changes.

`withTransaction` should provide typed access to the transaction and object stores, then await `tx.done` before resolving. Repository code must not perform network calls, React Query work, timers, or unrelated async work inside transaction callbacks.

## Sync Repository API

The sync repository can be redesigned, but it should remain a clear sync-domain API rather than exposing raw `idb` everywhere. The expected repository surface is grouped by responsibility:

- `records.list(entity)`
- `records.put(record)`
- `records.putMany(records)`
- `records.delete(entity, clientId)`
- `outbox.put(operation)`
- `outbox.list(entity)`
- `outbox.delete(operationId)`
- `outbox.markAttempted(operationId, attemptedAt)`
- `outbox.markFailed(operationId, error)`
- `metadata.getCursor(entity)`
- `metadata.setCursor(entity, cursor)`
- `testing.clearSyncDb()`

Atomic behavior should live inside repository operations. For example, assigning and incrementing the outbox sequence must remain one transaction over metadata and outbox stores. If future expense actions need record-and-outbox writes to be atomic together, add explicit repository functions for that rather than asking callers to coordinate multiple repository calls.

## Sync Schema

The sync database should retain the same logical stores, but model them with `DBSchema`:

- `syncRecords`
  - key: compound logical key string, `${entity}:${clientId}`
  - value: stored sync record with the computed key
  - index: `entity`
- `syncOutbox`
  - key: `operationId`
  - value: stored sync operation with `queuedAtSequence`
  - indexes: `entity`, `entityCreatedAtSequence`
- `syncMetadata`
  - key: `key`
  - value: metadata entry

Stored record and outbox types can stay internal to the sync storage layer. Public sync types should stay in `src/lib/sync/core/types.ts`.

## Error Handling

Open failures should reject with the underlying `idb` error where possible. Blocked opens should surface a clear error. Version-change handling should close the cached connection and clear the cached promise/database reference.

`deleteDatabase()` should close the cached connection before calling `deleteDB`.

Write operations should await both the relevant store operations and `tx.done`. Transaction aborts should propagate to callers and tests.

## Testing

Add tests for the generic storage client using `fake-indexeddb` and a small test schema:

- opens a typed database and runs the upgrade callback
- creates stores and indexes
- runs readonly and readwrite transactions
- resolves writes only after transaction completion
- closes and deletes the database
- propagates transaction failures

Update sync repository tests around the redesigned API:

- records are persisted and listed by entity
- records can be put in batches
- records can be deleted by entity and client id
- outbox operations list in FIFO order by `entity + createdAt + queuedAtSequence`
- updating an existing outbox operation preserves its sequence
- metadata cursors can be read and written
- outbox attempted and failed markers update the operation
- clearing/resetting the sync database works

Use targeted Vitest runs for modified tests and the existing expense sync suite where repository API changes affect downstream code.

## Out Of Scope

This design does not change:

- Expense sync behavior
- Expense V1 adapter behavior
- REST API routes
- TanStack Query cache logic
- quick expense recovery behavior
- optimistic mutation behavior
- existing `app-sync-v1` data preservation

No Server Actions should be added. Validation should use targeted tests plus Prettier and ESLint for modified TypeScript files. Do not use `npm run build` for this refactor.

## Success Criteria

The redesign is complete when:

- `idb` is added as a dependency.
- The native IndexedDB request/transaction wrappers are removed from sync storage code.
- A reusable typed storage client exists under `src/lib/storage/indexed-db/*`.
- The sync repository uses the reusable client and a typed sync `DBSchema`.
- Sync repository behavior remains covered by tests.
- Downstream sync tests pass after adapting to the redesigned repository API.
- Formatting and ESLint pass for modified TypeScript files.
