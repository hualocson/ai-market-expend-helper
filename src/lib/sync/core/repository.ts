import {
  SYNC_METADATA_STORE,
  SYNC_OUTBOX_STORE,
  SYNC_RECORDS_STORE,
  type StoredSyncOperation,
  type StoredSyncRecord,
  type SyncMetadataEntry,
  syncDbClient,
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

  delete: async (entity: SyncEntityName, clientId: string): Promise<void> =>
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
