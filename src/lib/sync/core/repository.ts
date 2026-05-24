import {
  SYNC_DB_NAME,
  SYNC_METADATA_STORE,
  SYNC_OUTBOX_STORE,
  SYNC_RECORDS_STORE,
  closeSyncDb,
  openSyncDb,
} from "./idb";
import type { SyncEntityName, SyncOperation, SyncRecord } from "./types";

type StoredSyncRecord = SyncRecord & {
  key: string;
};

type StoredSyncOperation = SyncOperation & {
  queuedAtSequence: number;
};

type SyncMetadataEntry = {
  key: string;
  value: number | string | null;
};

const buildRecordKey = (entity: SyncEntityName, clientId: string) =>
  `${entity}:${clientId}`;

const buildCursorKey = (entity: SyncEntityName) => `${entity}:lastCursor`;

const OUTBOX_SEQUENCE_KEY = "syncOutbox:nextSequence";

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

const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const transactionDone = (transaction: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction aborted."));
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed."));
  });

const deleteDatabase = (name: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("Deleting IndexedDB sync database was blocked."));
  });

const updateSyncOperation = async (
  operationId: string,
  update: (operation: SyncOperation) => SyncOperation
): Promise<void> => {
  const database = await openSyncDb();
  const transaction = database.transaction(SYNC_OUTBOX_STORE, "readwrite");
  const store = transaction.objectStore(SYNC_OUTBOX_STORE);
  const request = store.get(operationId);

  request.onsuccess = () => {
    const operation = request.result as StoredSyncOperation | undefined;

    if (operation) {
      store.put({
        ...update(fromStoredSyncOperation(operation)),
        queuedAtSequence: operation.queuedAtSequence,
      });
    }
  };

  await transactionDone(transaction);
};

export const clearSyncDb = async (): Promise<void> => {
  await closeSyncDb();
  await deleteDatabase(SYNC_DB_NAME);
};

export const getSyncCursor = async (
  entity: SyncEntityName
): Promise<string | null> => {
  const database = await openSyncDb();
  const transaction = database.transaction(SYNC_METADATA_STORE, "readonly");
  const store = transaction.objectStore(SYNC_METADATA_STORE);
  const entry = await requestToPromise<SyncMetadataEntry | undefined>(
    store.get(buildCursorKey(entity))
  );

  return typeof entry?.value === "string" ? entry.value : null;
};

export const setSyncCursor = async (
  entity: SyncEntityName,
  cursor: string | null
): Promise<void> => {
  const database = await openSyncDb();
  const transaction = database.transaction(SYNC_METADATA_STORE, "readwrite");
  transaction
    .objectStore(SYNC_METADATA_STORE)
    .put({ key: buildCursorKey(entity), value: cursor });
  await transactionDone(transaction);
};

export const listSyncRecords = async (
  entity: SyncEntityName
): Promise<SyncRecord[]> => {
  const database = await openSyncDb();
  const transaction = database.transaction(SYNC_RECORDS_STORE, "readonly");
  const store = transaction.objectStore(SYNC_RECORDS_STORE);
  const index = store.index("entity");
  const records = await requestToPromise<StoredSyncRecord[]>(
    index.getAll(entity)
  );

  return records.map(fromStoredSyncRecord);
};

export const putSyncRecord = async (record: SyncRecord): Promise<void> => {
  const database = await openSyncDb();
  const transaction = database.transaction(SYNC_RECORDS_STORE, "readwrite");
  transaction.objectStore(SYNC_RECORDS_STORE).put(toStoredSyncRecord(record));
  await transactionDone(transaction);
};

export const putSyncRecords = async (records: SyncRecord[]): Promise<void> => {
  const database = await openSyncDb();
  const transaction = database.transaction(SYNC_RECORDS_STORE, "readwrite");
  const store = transaction.objectStore(SYNC_RECORDS_STORE);

  for (const record of records) {
    store.put(toStoredSyncRecord(record));
  }

  await transactionDone(transaction);
};

export const deleteSyncRecord = async (
  entity: SyncEntityName,
  clientId: string
): Promise<void> => {
  const database = await openSyncDb();
  const transaction = database.transaction(SYNC_RECORDS_STORE, "readwrite");
  transaction
    .objectStore(SYNC_RECORDS_STORE)
    .delete(buildRecordKey(entity, clientId));
  await transactionDone(transaction);
};

export const putSyncOperation = async (
  operation: SyncOperation
): Promise<void> => {
  const database = await openSyncDb();
  const transaction = database.transaction(
    [SYNC_METADATA_STORE, SYNC_OUTBOX_STORE],
    "readwrite"
  );
  const metadataStore = transaction.objectStore(SYNC_METADATA_STORE);
  const outboxStore = transaction.objectStore(SYNC_OUTBOX_STORE);
  const existingOperationRequest = outboxStore.get(operation.operationId);

  existingOperationRequest.onsuccess = () => {
    const existingOperation = existingOperationRequest.result as
      | StoredSyncOperation
      | undefined;

    if (existingOperation) {
      outboxStore.put({
        ...operation,
        queuedAtSequence: existingOperation.queuedAtSequence,
      });
      return;
    }

    const sequenceRequest = metadataStore.get(OUTBOX_SEQUENCE_KEY);

    sequenceRequest.onsuccess = () => {
      const entry = sequenceRequest.result as SyncMetadataEntry | undefined;
      const nextSequence =
        typeof entry?.value === "number" ? entry.value : Number(entry?.value);
      const queuedAtSequence = Number.isFinite(nextSequence) ? nextSequence : 1;

      outboxStore.put({ ...operation, queuedAtSequence });
      metadataStore.put({
        key: OUTBOX_SEQUENCE_KEY,
        value: queuedAtSequence + 1,
      });
    };
  };

  await transactionDone(transaction);
};

export const listQueuedSyncOperations = async (
  entity: SyncEntityName
): Promise<SyncOperation[]> => {
  const database = await openSyncDb();
  const transaction = database.transaction(SYNC_OUTBOX_STORE, "readonly");
  const store = transaction.objectStore(SYNC_OUTBOX_STORE);
  const index = store.index("entityCreatedAtSequence");
  const range = IDBKeyRange.bound(
    [entity, "", 0],
    [entity, "\uffff", Number.MAX_SAFE_INTEGER]
  );

  const operations = await requestToPromise<StoredSyncOperation[]>(
    index.getAll(range)
  );

  return operations.map(fromStoredSyncOperation);
};

export const deleteSyncOperation = async (
  operationId: string
): Promise<void> => {
  const database = await openSyncDb();
  const transaction = database.transaction(SYNC_OUTBOX_STORE, "readwrite");
  transaction.objectStore(SYNC_OUTBOX_STORE).delete(operationId);
  await transactionDone(transaction);
};

export const markSyncOperationFailed = async (
  operationId: string,
  error: string
): Promise<void> => {
  await updateSyncOperation(operationId, (operation) => ({
    ...operation,
    lastError: error,
  }));
};

export const markSyncOperationAttempted = async (
  operationId: string,
  attemptedAt: string
): Promise<void> => {
  await updateSyncOperation(operationId, (operation) => ({
    ...operation,
    attemptCount: operation.attemptCount + 1,
    lastAttemptAt: attemptedAt,
  }));
};
