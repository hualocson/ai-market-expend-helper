# IDB Storage Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the native IndexedDB wrapper with `jakearchibald/idb`, introduce a reusable typed IndexedDB client, and migrate the sync repository to a redesigned typed API.

**Architecture:** Add a domain-neutral storage client under `src/lib/storage/indexed-db/*`, define the sync `DBSchema` in `src/lib/sync/core/idb.ts`, and expose a grouped sync repository API for records, outbox, metadata, and testing. Use database name `app-sync-v2`; no migration from `app-sync-v1` is required.

**Tech Stack:** Next.js, TypeScript, `idb`, fake-indexeddb, Vitest, IndexedDB, TanStack Query callers.

---

## File Structure

- `package.json`, `bun.lock`
  - Add direct dependency on `idb`.
- `src/lib/storage/indexed-db/types.ts`
  - Generic type helpers for typed database clients.
- `src/lib/storage/indexed-db/client.ts`
  - Reusable `idb`-backed client factory with open, close, delete, and transaction helpers.
- `src/lib/storage/indexed-db/client.test.ts`
  - Fake IndexedDB coverage for the reusable client.
- `src/lib/sync/core/idb.ts`
  - Sync `DBSchema`, store constants, stored value types, and `syncDbClient`.
- `src/lib/sync/core/repository.ts`
  - New grouped repository API: `syncRepository.records`, `syncRepository.outbox`, `syncRepository.metadata`, `syncRepository.testing`.
- `src/lib/sync/core/repository.test.ts`
  - Repository behavior tests updated to the grouped API.
- Downstream callers to migrate:
  - `src/lib/queries/expenses.ts`
  - `src/components/QuickExpenseMutationCoordinator.tsx`
  - `src/lib/sync/expenses/actions.ts`
  - `src/lib/sync/expenses/coordinator.ts`
- Downstream tests to migrate:
  - `src/components/QuickExpenseMutationCoordinator.test.tsx`
  - `src/lib/queries/read-fetchers.test.ts`
  - `src/lib/sync/expenses/actions.test.ts`
  - `src/lib/sync/expenses/coordinator.test.ts`
  - `src/lib/mutations/index.test.tsx`

---

## Task 1: Add `idb` And Generic Typed Storage Client

**Files:**
- Modify: `package.json`
- Modify: `bun.lock`
- Create: `src/lib/storage/indexed-db/types.ts`
- Create: `src/lib/storage/indexed-db/client.ts`
- Create: `src/lib/storage/indexed-db/client.test.ts`

- [ ] **Step 1: Add the direct dependency**

Run:

```bash
rtk bun add idb
```

Expected: `package.json` includes `idb` in `dependencies`; `bun.lock` records the direct dependency. `idb` may already exist transitively through `serwist`, but this project should depend on it directly because app code imports it.

- [ ] **Step 2: Write failing generic storage client tests**

Create `src/lib/storage/indexed-db/client.test.ts`:

```ts
import { deleteDB, type DBSchema } from "idb";
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";

import { createIndexedDbClient } from "./client";

interface TestDbSchema extends DBSchema {
  items: {
    key: string;
    value: {
      id: string;
      group: string;
      value: number;
    };
    indexes: {
      group: string;
    };
  };
  metadata: {
    key: string;
    value: {
      key: string;
      value: string | number | null;
    };
  };
}

const TEST_DB_NAME = "test-indexed-db-client";

const createTestClient = () =>
  createIndexedDbClient<TestDbSchema>({
    name: TEST_DB_NAME,
    version: 1,
    upgrade(database) {
      if (!database.objectStoreNames.contains("items")) {
        const store = database.createObjectStore("items", { keyPath: "id" });
        store.createIndex("group", "group", { unique: false });
      }
      if (!database.objectStoreNames.contains("metadata")) {
        database.createObjectStore("metadata", { keyPath: "key" });
      }
    },
  });

afterEach(async () => {
  await deleteDB(TEST_DB_NAME);
});

describe("indexed db client", () => {
  it("opens a typed database and runs the upgrade callback", async () => {
    const client = createTestClient();

    const database = await client.open();

    expect(database.name).toBe(TEST_DB_NAME);
    expect(database.objectStoreNames.contains("items")).toBe(true);
    expect(database.objectStoreNames.contains("metadata")).toBe(true);
  });

  it("runs readwrite and readonly transactions", async () => {
    const client = createTestClient();

    await client.withTransaction(["items"], "readwrite", async (transaction) => {
      await transaction.objectStore("items").put({
        id: "item-1",
        group: "food",
        value: 12,
      });
    });

    const result = await client.withTransaction(
      ["items"],
      "readonly",
      async (transaction) =>
        transaction.objectStore("items").index("group").getAll("food")
    );

    expect(result).toEqual([{ id: "item-1", group: "food", value: 12 }]);
  });

  it("waits for transaction completion before resolving writes", async () => {
    const client = createTestClient();

    await client.withTransaction(["metadata"], "readwrite", async (transaction) => {
      await transaction
        .objectStore("metadata")
        .put({ key: "cursor", value: "2026-05-25T00:00:00.000Z" });
    });

    const reopened = createTestClient();
    const entry = await reopened.withTransaction(
      ["metadata"],
      "readonly",
      async (transaction) => transaction.objectStore("metadata").get("cursor")
    );

    expect(entry?.value).toBe("2026-05-25T00:00:00.000Z");
  });

  it("closes and deletes the database", async () => {
    const client = createTestClient();
    await client.open();

    await client.deleteDatabase();
    const database = await client.open();

    expect(database.objectStoreNames.contains("items")).toBe(true);
  });

  it("propagates transaction failures", async () => {
    const client = createTestClient();

    await expect(
      client.withTransaction(["items"], "readwrite", async () => {
        throw new Error("transaction failed");
      })
    ).rejects.toThrow("transaction failed");
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run:

```bash
rtk bunx vitest run src/lib/storage/indexed-db/client.test.ts
```

Expected: FAIL because `src/lib/storage/indexed-db/client.ts` does not exist.

- [ ] **Step 4: Create generic storage types**

Create `src/lib/storage/indexed-db/types.ts`:

```ts
import type {
  DBSchema,
  IDBPDatabase,
  IDBPTransaction,
  StoreNames,
} from "idb";

export type IndexedDbUpgradeCallback<TSchema extends DBSchema> = (
  database: IDBPDatabase<TSchema>,
  oldVersion: number,
  newVersion: number | null,
  transaction: IDBPTransaction<
    TSchema,
    StoreNames<TSchema>[],
    "versionchange"
  >
) => void;

export type IndexedDbClientOptions<TSchema extends DBSchema> = {
  name: string;
  version: number;
  upgrade: IndexedDbUpgradeCallback<TSchema>;
};
```

- [ ] **Step 5: Implement the generic storage client**

Create `src/lib/storage/indexed-db/client.ts`:

```ts
import {
  deleteDB,
  openDB,
  type DBSchema,
  type IDBPDatabase,
  type IDBPTransaction,
  type StoreNames,
} from "idb";

import type { IndexedDbClientOptions } from "./types";

export const createIndexedDbClient = <TSchema extends DBSchema>({
  name,
  version,
  upgrade,
}: IndexedDbClientOptions<TSchema>) => {
  let databasePromise: Promise<IDBPDatabase<TSchema>> | null = null;

  const clearCachedDatabase = () => {
    databasePromise = null;
  };

  const open = async (): Promise<IDBPDatabase<TSchema>> => {
    if (!databasePromise) {
      databasePromise = openDB<TSchema>(name, version, {
        upgrade,
        blocked() {
          clearCachedDatabase();
          throw new Error(`Opening IndexedDB database "${name}" was blocked.`);
        },
        blocking(database) {
          database.close();
          clearCachedDatabase();
        },
        terminated() {
          clearCachedDatabase();
        },
      }).catch((error) => {
        clearCachedDatabase();
        throw error;
      });
    }

    return databasePromise;
  };

  const close = async (): Promise<void> => {
    const database = await databasePromise?.catch(() => null);
    database?.close();
    clearCachedDatabase();
  };

  const deleteDatabase = async (): Promise<void> => {
    await close();
    await deleteDB(name);
  };

  const withTransaction = async <
    TStores extends StoreNames<TSchema>[],
    TMode extends IDBTransactionMode,
    TResult,
  >(
    stores: TStores,
    mode: TMode,
    callback: (
      transaction: IDBPTransaction<TSchema, TStores, TMode>
    ) => TResult | Promise<TResult>
  ): Promise<TResult> => {
    const database = await open();
    const transaction = database.transaction(stores, mode);

    try {
      const result = await callback(transaction);
      await transaction.done;
      return result;
    } catch (error) {
      try {
        transaction.abort();
      } catch {
        // The transaction may already be finished or inactive.
      }
      await transaction.done.catch(() => undefined);
      throw error;
    }
  };

  return {
    open,
    close,
    deleteDatabase,
    withTransaction,
  };
};
```

- [ ] **Step 6: Verify Task 1**

Run:

```bash
rtk bunx vitest run src/lib/storage/indexed-db/client.test.ts
rtk bunx prettier --write package.json src/lib/storage/indexed-db/types.ts src/lib/storage/indexed-db/client.ts src/lib/storage/indexed-db/client.test.ts
rtk bunx prettier --check package.json src/lib/storage/indexed-db/types.ts src/lib/storage/indexed-db/client.ts src/lib/storage/indexed-db/client.test.ts
rtk bunx eslint src/lib/storage/indexed-db/types.ts src/lib/storage/indexed-db/client.ts src/lib/storage/indexed-db/client.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 1**

Run:

```bash
rtk git add package.json bun.lock src/lib/storage/indexed-db
rtk git commit -m "feat: add typed indexeddb client"
```

---

## Task 2: Define Sync `DBSchema` And Redesign Repository API

**Files:**
- Modify: `src/lib/sync/core/idb.ts`
- Modify: `src/lib/sync/core/repository.ts`
- Modify: `src/lib/sync/core/repository.test.ts`

- [ ] **Step 1: Replace repository tests with grouped API tests**

Rewrite imports in `src/lib/sync/core/repository.test.ts`:

```ts
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";

import { syncRepository } from "./repository";
import type { SyncOperation, SyncRecord } from "./types";
```

Replace direct repository calls with grouped calls:

```ts
beforeEach(async () => {
  await syncRepository.testing.clearSyncDb();
});
```

Use these representative expectations in the existing test bodies:

```ts
await syncRepository.records.put(buildExpense());
await expect(syncRepository.records.list("expenses")).resolves.toEqual([
  buildExpense(),
]);

await syncRepository.outbox.put(buildOperation({ operationId: "op-1" }));
await expect(
  syncRepository.outbox
    .list("expenses")
    .then((operations) => operations.map((operation) => operation.operationId))
).resolves.toEqual(["op-1"]);

await syncRepository.metadata.setCursor(
  "expenses",
  "2026-05-24T10:00:00.000Z"
);
await expect(syncRepository.metadata.getCursor("expenses")).resolves.toBe(
  "2026-05-24T10:00:00.000Z"
);
```

Add one new test proving same-operation updates preserve sequence:

```ts
it("preserves outbox sequence when updating an existing operation", async () => {
  await syncRepository.outbox.put(
    buildOperation({
      operationId: "op-1",
      clientId: "client-1",
      createdAt: "2026-05-24T09:00:00.000Z",
    })
  );
  await syncRepository.outbox.put(
    buildOperation({
      operationId: "op-2",
      clientId: "client-2",
      createdAt: "2026-05-24T09:00:00.000Z",
    })
  );
  await syncRepository.outbox.put(
    buildOperation({
      operationId: "op-1",
      clientId: "client-1",
      createdAt: "2026-05-24T09:00:00.000Z",
      lastError: "Retry payload",
    })
  );

  await expect(
    syncRepository.outbox
      .list("expenses")
      .then((operations) => operations.map((operation) => operation.operationId))
  ).resolves.toEqual(["op-1", "op-2"]);
});
```

- [ ] **Step 2: Run repository tests to verify they fail**

Run:

```bash
rtk bunx vitest run src/lib/sync/core/repository.test.ts
```

Expected: FAIL because `syncRepository` is not exported and the repository still uses native IndexedDB wrappers.

- [ ] **Step 3: Define the sync DB schema with `idb`**

Replace `src/lib/sync/core/idb.ts` with:

```ts
import type { DBSchema } from "idb";

import { createIndexedDbClient } from "@/lib/storage/indexed-db/client";

import type { SyncEntityName, SyncOperation, SyncRecord } from "./types";

export const SYNC_DB_NAME = "app-sync-v2";
export const SYNC_DB_VERSION = 1;

export const SYNC_RECORDS_STORE = "syncRecords";
export const SYNC_OUTBOX_STORE = "syncOutbox";
export const SYNC_METADATA_STORE = "syncMetadata";

export type StoredSyncRecord = SyncRecord & {
  key: string;
};

export type StoredSyncOperation = SyncOperation & {
  queuedAtSequence: number;
};

export type SyncMetadataEntry = {
  key: string;
  value: number | string | null;
};

export interface SyncDbSchema extends DBSchema {
  [SYNC_RECORDS_STORE]: {
    key: string;
    value: StoredSyncRecord;
    indexes: {
      entity: SyncEntityName;
    };
  };
  [SYNC_OUTBOX_STORE]: {
    key: string;
    value: StoredSyncOperation;
    indexes: {
      entity: SyncEntityName;
      entityCreatedAtSequence: [SyncEntityName, string, number];
    };
  };
  [SYNC_METADATA_STORE]: {
    key: string;
    value: SyncMetadataEntry;
  };
}

export const syncDbClient = createIndexedDbClient<SyncDbSchema>({
  name: SYNC_DB_NAME,
  version: SYNC_DB_VERSION,
  upgrade(database) {
    if (!database.objectStoreNames.contains(SYNC_RECORDS_STORE)) {
      const recordsStore = database.createObjectStore(SYNC_RECORDS_STORE, {
        keyPath: "key",
      });
      recordsStore.createIndex("entity", "entity", { unique: false });
    }

    if (!database.objectStoreNames.contains(SYNC_OUTBOX_STORE)) {
      const outboxStore = database.createObjectStore(SYNC_OUTBOX_STORE, {
        keyPath: "operationId",
      });
      outboxStore.createIndex("entity", "entity", { unique: false });
      outboxStore.createIndex(
        "entityCreatedAtSequence",
        ["entity", "createdAt", "queuedAtSequence"],
        { unique: false }
      );
    }

    if (!database.objectStoreNames.contains(SYNC_METADATA_STORE)) {
      database.createObjectStore(SYNC_METADATA_STORE, { keyPath: "key" });
    }
  },
});
```

- [ ] **Step 4: Rewrite the sync repository around grouped APIs**

Replace `src/lib/sync/core/repository.ts` with:

```ts
import {
  SYNC_METADATA_STORE,
  SYNC_OUTBOX_STORE,
  SYNC_RECORDS_STORE,
  syncDbClient,
  type StoredSyncOperation,
  type StoredSyncRecord,
  type SyncMetadataEntry,
} from "./idb";
import type { SyncEntityName, SyncOperation, SyncRecord } from "./types";

const OUTBOX_SEQUENCE_KEY = "syncOutbox:nextSequence";

const buildRecordKey = (entity: SyncEntityName, clientId: string) =>
  `${entity}:${clientId}`;

const buildCursorKey = (entity: SyncEntityName) => `${entity}:lastCursor`;

const toStoredSyncRecord = (record: SyncRecord): StoredSyncRecord => ({
  ...record,
  key: buildRecordKey(record.entity, record.clientId),
});

const fromStoredSyncRecord = ({
  key: _key,
  ...record
}: StoredSyncRecord): SyncRecord => record;

const fromStoredSyncOperation = ({
  queuedAtSequence: _queuedAtSequence,
  ...operation
}: StoredSyncOperation): SyncOperation => operation;

const getNextOutboxSequence = (entry: SyncMetadataEntry | undefined) => {
  const value =
    typeof entry?.value === "number" ? entry.value : Number(entry?.value);
  return Number.isFinite(value) ? value : 1;
};

const updateOutboxOperation = async (
  operationId: string,
  update: (operation: SyncOperation) => SyncOperation
): Promise<void> => {
  await syncDbClient.withTransaction(
    [SYNC_OUTBOX_STORE],
    "readwrite",
    async (transaction) => {
      const store = transaction.objectStore(SYNC_OUTBOX_STORE);
      const existingOperation = await store.get(operationId);
      if (!existingOperation) {
        return;
      }

      await store.put({
        ...update(fromStoredSyncOperation(existingOperation)),
        queuedAtSequence: existingOperation.queuedAtSequence,
      });
    }
  );
};

export const syncRecords = {
  list: async (entity: SyncEntityName): Promise<SyncRecord[]> =>
    syncDbClient.withTransaction(
      [SYNC_RECORDS_STORE],
      "readonly",
      async (transaction) => {
        const records = await transaction
          .objectStore(SYNC_RECORDS_STORE)
          .index("entity")
          .getAll(entity);

        return records.map(fromStoredSyncRecord);
      }
    ),

  put: async (record: SyncRecord): Promise<void> =>
    syncDbClient.withTransaction(
      [SYNC_RECORDS_STORE],
      "readwrite",
      async (transaction) => {
        await transaction
          .objectStore(SYNC_RECORDS_STORE)
          .put(toStoredSyncRecord(record));
      }
    ),

  putMany: async (records: SyncRecord[]): Promise<void> =>
    syncDbClient.withTransaction(
      [SYNC_RECORDS_STORE],
      "readwrite",
      async (transaction) => {
        const store = transaction.objectStore(SYNC_RECORDS_STORE);
        for (const record of records) {
          await store.put(toStoredSyncRecord(record));
        }
      }
    ),

  delete: async (
    entity: SyncEntityName,
    clientId: string
  ): Promise<void> =>
    syncDbClient.withTransaction(
      [SYNC_RECORDS_STORE],
      "readwrite",
      async (transaction) => {
        await transaction
          .objectStore(SYNC_RECORDS_STORE)
          .delete(buildRecordKey(entity, clientId));
      }
    ),
};

export const syncOutbox = {
  put: async (operation: SyncOperation): Promise<void> =>
    syncDbClient.withTransaction(
      [SYNC_METADATA_STORE, SYNC_OUTBOX_STORE],
      "readwrite",
      async (transaction) => {
        const metadataStore = transaction.objectStore(SYNC_METADATA_STORE);
        const outboxStore = transaction.objectStore(SYNC_OUTBOX_STORE);
        const existingOperation = await outboxStore.get(operation.operationId);

        if (existingOperation) {
          await outboxStore.put({
            ...operation,
            queuedAtSequence: existingOperation.queuedAtSequence,
          });
          return;
        }

        const sequenceEntry = await metadataStore.get(OUTBOX_SEQUENCE_KEY);
        const queuedAtSequence = getNextOutboxSequence(sequenceEntry);

        await outboxStore.put({ ...operation, queuedAtSequence });
        await metadataStore.put({
          key: OUTBOX_SEQUENCE_KEY,
          value: queuedAtSequence + 1,
        });
      }
    ),

  list: async (entity: SyncEntityName): Promise<SyncOperation[]> =>
    syncDbClient.withTransaction(
      [SYNC_OUTBOX_STORE],
      "readonly",
      async (transaction) => {
        const range = IDBKeyRange.bound(
          [entity, "", 0],
          [entity, "\uffff", Number.MAX_SAFE_INTEGER]
        );
        const operations = await transaction
          .objectStore(SYNC_OUTBOX_STORE)
          .index("entityCreatedAtSequence")
          .getAll(range);

        return operations.map(fromStoredSyncOperation);
      }
    ),

  delete: async (operationId: string): Promise<void> =>
    syncDbClient.withTransaction(
      [SYNC_OUTBOX_STORE],
      "readwrite",
      async (transaction) => {
        await transaction.objectStore(SYNC_OUTBOX_STORE).delete(operationId);
      }
    ),

  markAttempted: async (
    operationId: string,
    attemptedAt: string
  ): Promise<void> =>
    updateOutboxOperation(operationId, (operation) => ({
      ...operation,
      attemptCount: operation.attemptCount + 1,
      lastAttemptAt: attemptedAt,
    })),

  markFailed: async (operationId: string, error: string): Promise<void> =>
    updateOutboxOperation(operationId, (operation) => ({
      ...operation,
      lastError: error,
    })),
};

export const syncMetadata = {
  getCursor: async (entity: SyncEntityName): Promise<string | null> =>
    syncDbClient.withTransaction(
      [SYNC_METADATA_STORE],
      "readonly",
      async (transaction) => {
        const entry = await transaction
          .objectStore(SYNC_METADATA_STORE)
          .get(buildCursorKey(entity));

        return typeof entry?.value === "string" ? entry.value : null;
      }
    ),

  setCursor: async (
    entity: SyncEntityName,
    cursor: string | null
  ): Promise<void> =>
    syncDbClient.withTransaction(
      [SYNC_METADATA_STORE],
      "readwrite",
      async (transaction) => {
        await transaction
          .objectStore(SYNC_METADATA_STORE)
          .put({ key: buildCursorKey(entity), value: cursor });
      }
    ),
};

export const syncTesting = {
  clearSyncDb: () => syncDbClient.deleteDatabase(),
};

export const syncRepository = {
  records: syncRecords,
  outbox: syncOutbox,
  metadata: syncMetadata,
  testing: syncTesting,
};
```

- [ ] **Step 5: Verify Task 2**

Run:

```bash
rtk bunx vitest run src/lib/storage/indexed-db/client.test.ts src/lib/sync/core/repository.test.ts
rtk bunx prettier --write src/lib/sync/core/idb.ts src/lib/sync/core/repository.ts src/lib/sync/core/repository.test.ts
rtk bunx prettier --check src/lib/sync/core/idb.ts src/lib/sync/core/repository.ts src/lib/sync/core/repository.test.ts
rtk bunx eslint src/lib/sync/core/idb.ts src/lib/sync/core/repository.ts src/lib/sync/core/repository.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

Run:

```bash
rtk git add src/lib/sync/core/idb.ts src/lib/sync/core/repository.ts src/lib/sync/core/repository.test.ts
rtk git commit -m "feat: redesign sync repository around idb"
```

---

## Task 3: Migrate Expense Sync Callers To The New Repository API

**Files:**
- Modify: `src/lib/queries/expenses.ts`
- Modify: `src/components/QuickExpenseMutationCoordinator.tsx`
- Modify: `src/lib/sync/expenses/actions.ts`
- Modify: `src/lib/sync/expenses/coordinator.ts`

- [ ] **Step 1: Migrate read/query caller imports**

In `src/lib/queries/expenses.ts`, replace:

```ts
import { listSyncRecords, putSyncRecords } from "@/lib/sync/core/repository";
```

with:

```ts
import { syncRepository } from "@/lib/sync/core/repository";
```

Replace calls:

```ts
await listSyncRecords(EXPENSE_SYNC_ENTITY);
await putSyncRecords(records);
```

with:

```ts
await syncRepository.records.list(EXPENSE_SYNC_ENTITY);
await syncRepository.records.putMany(records);
```

- [ ] **Step 2: Migrate quick expense recovery coordinator**

In `src/components/QuickExpenseMutationCoordinator.tsx`, replace:

```ts
import { listQueuedSyncOperations } from "@/lib/sync/core/repository";
```

with:

```ts
import { syncRepository } from "@/lib/sync/core/repository";
```

Replace:

```ts
const operations = await listQueuedSyncOperations("expenses").catch(
  () => null
);
```

with:

```ts
const operations = await syncRepository.outbox
  .list("expenses")
  .catch(() => null);
```

- [ ] **Step 3: Migrate local-first expense actions**

In `src/lib/sync/expenses/actions.ts`, replace the repository import with:

```ts
import { syncRepository } from "@/lib/sync/core/repository";
```

Replace calls:

```ts
await putSyncRecord(toSyncRecord(expense));
await putSyncOperation(toOutboxOperation(expense, type, expense.updatedAt));
await listQueuedSyncOperations(EXPENSE_SYNC_ENTITY);
await deleteSyncOperation(operation.operationId);
await deleteSyncRecord(EXPENSE_SYNC_ENTITY, clientId);
```

with:

```ts
await syncRepository.records.put(toSyncRecord(expense));
await syncRepository.outbox.put(
  toOutboxOperation(expense, type, expense.updatedAt)
);
await syncRepository.outbox.list(EXPENSE_SYNC_ENTITY);
await syncRepository.outbox.delete(operation.operationId);
await syncRepository.records.delete(EXPENSE_SYNC_ENTITY, clientId);
```

- [ ] **Step 4: Migrate the expense sync coordinator**

In `src/lib/sync/expenses/coordinator.ts`, replace repository imports with:

```ts
import { syncRepository } from "@/lib/sync/core/repository";
```

Replace calls:

```ts
await getSyncCursor(EXPENSE_SYNC_ENTITY);
await setSyncCursor(EXPENSE_SYNC_ENTITY, result.cursor);
await listQueuedSyncOperations(EXPENSE_SYNC_ENTITY);
await markSyncOperationAttempted(operation.operationId, attemptedAt);
await markSyncOperationFailed(operation.operationId, error);
await listSyncRecords(EXPENSE_SYNC_ENTITY);
await putSyncRecord(record);
await putSyncRecords(records);
await deleteSyncOperation(operation.operationId);
```

with:

```ts
await syncRepository.metadata.getCursor(EXPENSE_SYNC_ENTITY);
await syncRepository.metadata.setCursor(EXPENSE_SYNC_ENTITY, result.cursor);
await syncRepository.outbox.list(EXPENSE_SYNC_ENTITY);
await syncRepository.outbox.markAttempted(operation.operationId, attemptedAt);
await syncRepository.outbox.markFailed(operation.operationId, error);
await syncRepository.records.list(EXPENSE_SYNC_ENTITY);
await syncRepository.records.put(record);
await syncRepository.records.putMany(records);
await syncRepository.outbox.delete(operation.operationId);
```

- [ ] **Step 5: Run caller type/test checks**

Run:

```bash
rtk bunx vitest run src/lib/sync/expenses/actions.test.ts src/lib/sync/expenses/coordinator.test.ts src/lib/queries/read-fetchers.test.ts src/components/QuickExpenseMutationCoordinator.test.tsx
```

Expected: FAIL until tests are migrated to the new repository API.

- [ ] **Step 6: Format migrated callers**

Run:

```bash
rtk bunx prettier --write src/lib/queries/expenses.ts src/components/QuickExpenseMutationCoordinator.tsx src/lib/sync/expenses/actions.ts src/lib/sync/expenses/coordinator.ts
```

- [ ] **Step 7: Commit Task 3 only after downstream tests are migrated in Task 4**

Do not commit yet if tests still import removed repository functions. Continue to Task 4.

---

## Task 4: Migrate Tests And Remove Legacy Repository Imports

**Files:**
- Modify: `src/components/QuickExpenseMutationCoordinator.test.tsx`
- Modify: `src/lib/queries/read-fetchers.test.ts`
- Modify: `src/lib/sync/expenses/actions.test.ts`
- Modify: `src/lib/sync/expenses/coordinator.test.ts`
- Modify: `src/lib/mutations/index.test.tsx`

- [ ] **Step 1: Migrate test imports**

In each modified test, replace imports like:

```ts
import {
  clearSyncDb,
  listQueuedSyncOperations,
  listSyncRecords,
  putSyncOperation,
  putSyncRecord,
  setSyncCursor,
  getSyncCursor,
} from "@/lib/sync/core/repository";
```

with:

```ts
import { syncRepository } from "@/lib/sync/core/repository";
```

- [ ] **Step 2: Migrate test helper type references**

In `src/lib/sync/expenses/coordinator.test.ts`, replace helper signatures:

```ts
const expenseRecord = (
  overrides: Partial<Parameters<typeof putSyncRecord>[0]> = {}
): Parameters<typeof putSyncRecord>[0] => ({ ... });

const outboxOperation = (
  overrides: Partial<Parameters<typeof putSyncOperation>[0]> = {}
): Parameters<typeof putSyncOperation>[0] => ({ ... });
```

with:

```ts
import type { SyncOperation, SyncRecord } from "@/lib/sync/core/types";

const expenseRecord = (
  overrides: Partial<SyncRecord> = {}
): SyncRecord => ({ ... });

const outboxOperation = (
  overrides: Partial<SyncOperation> = {}
): SyncOperation => ({ ... });
```

- [ ] **Step 3: Replace test calls**

Use this mapping in all affected tests:

```ts
clearSyncDb() -> syncRepository.testing.clearSyncDb()
listSyncRecords(entity) -> syncRepository.records.list(entity)
putSyncRecord(record) -> syncRepository.records.put(record)
putSyncRecords(records) -> syncRepository.records.putMany(records)
deleteSyncRecord(entity, clientId) -> syncRepository.records.delete(entity, clientId)
listQueuedSyncOperations(entity) -> syncRepository.outbox.list(entity)
putSyncOperation(operation) -> syncRepository.outbox.put(operation)
deleteSyncOperation(operationId) -> syncRepository.outbox.delete(operationId)
markSyncOperationAttempted(operationId, attemptedAt) -> syncRepository.outbox.markAttempted(operationId, attemptedAt)
markSyncOperationFailed(operationId, error) -> syncRepository.outbox.markFailed(operationId, error)
getSyncCursor(entity) -> syncRepository.metadata.getCursor(entity)
setSyncCursor(entity, cursor) -> syncRepository.metadata.setCursor(entity, cursor)
```

- [ ] **Step 4: Verify there are no legacy repository imports**

Run:

```bash
rtk rg -n "clearSyncDb|getSyncCursor|setSyncCursor|listSyncRecords|putSyncRecord|putSyncRecords|deleteSyncRecord|putSyncOperation|listQueuedSyncOperations|deleteSyncOperation|markSyncOperationFailed|markSyncOperationAttempted" src -g '*.ts' -g '*.tsx'
```

Expected: no matches except text inside `src/lib/sync/core/repository.test.ts` only if the test deliberately mentions old names in strings. Prefer zero matches.

- [ ] **Step 5: Verify migrated callers and tests**

Run:

```bash
rtk bunx vitest run \
  src/lib/storage/indexed-db/client.test.ts \
  src/lib/sync/core/repository.test.ts \
  src/lib/sync/expenses/actions.test.ts \
  src/lib/sync/expenses/coordinator.test.ts \
  src/lib/queries/read-fetchers.test.ts \
  src/components/QuickExpenseMutationCoordinator.test.tsx \
  src/lib/mutations/index.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Format and lint migrated files**

Run:

```bash
rtk bunx prettier --write \
  src/lib/queries/expenses.ts \
  src/components/QuickExpenseMutationCoordinator.tsx \
  src/lib/sync/expenses/actions.ts \
  src/lib/sync/expenses/coordinator.ts \
  src/components/QuickExpenseMutationCoordinator.test.tsx \
  src/lib/queries/read-fetchers.test.ts \
  src/lib/sync/expenses/actions.test.ts \
  src/lib/sync/expenses/coordinator.test.ts \
  src/lib/mutations/index.test.tsx

rtk bunx prettier --check \
  src/lib/queries/expenses.ts \
  src/components/QuickExpenseMutationCoordinator.tsx \
  src/lib/sync/expenses/actions.ts \
  src/lib/sync/expenses/coordinator.ts \
  src/components/QuickExpenseMutationCoordinator.test.tsx \
  src/lib/queries/read-fetchers.test.ts \
  src/lib/sync/expenses/actions.test.ts \
  src/lib/sync/expenses/coordinator.test.ts \
  src/lib/mutations/index.test.tsx

rtk bunx eslint \
  src/lib/queries/expenses.ts \
  src/components/QuickExpenseMutationCoordinator.tsx \
  src/lib/sync/expenses/actions.ts \
  src/lib/sync/expenses/coordinator.ts \
  src/components/QuickExpenseMutationCoordinator.test.tsx \
  src/lib/queries/read-fetchers.test.ts \
  src/lib/sync/expenses/actions.test.ts \
  src/lib/sync/expenses/coordinator.test.ts \
  src/lib/mutations/index.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit Tasks 3 and 4 together**

Run:

```bash
rtk git add \
  src/lib/queries/expenses.ts \
  src/components/QuickExpenseMutationCoordinator.tsx \
  src/lib/sync/expenses/actions.ts \
  src/lib/sync/expenses/coordinator.ts \
  src/components/QuickExpenseMutationCoordinator.test.tsx \
  src/lib/queries/read-fetchers.test.ts \
  src/lib/sync/expenses/actions.test.ts \
  src/lib/sync/expenses/coordinator.test.ts \
  src/lib/mutations/index.test.tsx

rtk git commit -m "refactor: migrate sync callers to repository groups"
```

---

## Task 5: Final Verification

**Files:**
- Verify all changed `.ts` and `.tsx` files.

- [ ] **Step 1: Run the targeted sync/storage suite**

Run:

```bash
rtk bunx vitest run \
  src/lib/storage/indexed-db/client.test.ts \
  src/lib/sync/core/repository.test.ts \
  src/lib/sync/core/store-factory.test.ts \
  src/lib/sync/expenses/list.test.ts \
  src/lib/sync/expenses/store.test.ts \
  src/lib/sync/expenses/actions.test.ts \
  src/lib/sync/expenses/coordinator.test.ts \
  src/app/api/read-routes.test.ts \
  src/app/api/mutation-routes.test.ts \
  src/lib/queries/read-fetchers.test.ts \
  src/lib/mutations/index.test.tsx \
  src/components/ExpenseList.test.tsx \
  src/components/QuickExpenseMutationCoordinator.test.tsx \
  src/components/QuickExpenseRecoverySheetHost.test.tsx \
  src/components/QuickExpenseSheet.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Check direct dependency and old DB name**

Run:

```bash
rtk rg -n '"idb"|app-sync-v1|app-sync-v2' package.json src/lib/storage src/lib/sync/core
```

Expected:

- `package.json` contains `"idb"`.
- `src/lib/sync/core/idb.ts` contains `app-sync-v2`.
- No `app-sync-v1` matches remain under `src/lib/sync/core`.

- [ ] **Step 3: Check formatting and ESLint for branch-modified TypeScript files**

Run:

```bash
rtk bunx prettier --check \
  src/lib/storage/indexed-db/types.ts \
  src/lib/storage/indexed-db/client.ts \
  src/lib/storage/indexed-db/client.test.ts \
  src/lib/sync/core/idb.ts \
  src/lib/sync/core/repository.ts \
  src/lib/sync/core/repository.test.ts \
  src/lib/queries/expenses.ts \
  src/components/QuickExpenseMutationCoordinator.tsx \
  src/lib/sync/expenses/actions.ts \
  src/lib/sync/expenses/coordinator.ts \
  src/components/QuickExpenseMutationCoordinator.test.tsx \
  src/lib/queries/read-fetchers.test.ts \
  src/lib/sync/expenses/actions.test.ts \
  src/lib/sync/expenses/coordinator.test.ts \
  src/lib/mutations/index.test.tsx

rtk bunx eslint \
  src/lib/storage/indexed-db/types.ts \
  src/lib/storage/indexed-db/client.ts \
  src/lib/storage/indexed-db/client.test.ts \
  src/lib/sync/core/idb.ts \
  src/lib/sync/core/repository.ts \
  src/lib/sync/core/repository.test.ts \
  src/lib/queries/expenses.ts \
  src/components/QuickExpenseMutationCoordinator.tsx \
  src/lib/sync/expenses/actions.ts \
  src/lib/sync/expenses/coordinator.ts \
  src/components/QuickExpenseMutationCoordinator.test.tsx \
  src/lib/queries/read-fetchers.test.ts \
  src/lib/sync/expenses/actions.test.ts \
  src/lib/sync/expenses/coordinator.test.ts \
  src/lib/mutations/index.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Inspect git status**

Run:

```bash
rtk git status --short
rtk git log --oneline --max-count=6
```

Expected: working tree has no unstaged implementation changes. The unrelated untracked `docs/superpowers/specs/2026-05-24-instant-first-load-design.md` may still be present and should not be staged unless explicitly requested.

- [ ] **Step 5: Final review checkpoint**

Review these invariants manually before declaring done:

- Generic storage layer imports `idb` but not sync or expense modules.
- Sync core may import generic storage, but generic storage must not import sync core.
- Expense modules import only `syncRepository`, not raw `idb` or sync DB internals.
- No Server Actions were added.
- No code attempts network or React Query work inside `withTransaction` callbacks.

If any invariant fails, fix it, rerun the targeted suite, and commit with a clear `fix:` message.
