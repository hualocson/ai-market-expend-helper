export const SYNC_DB_NAME = "app-sync-v1";
export const SYNC_DB_VERSION = 1;

export const SYNC_RECORDS_STORE = "syncRecords";
export const SYNC_OUTBOX_STORE = "syncOutbox";
export const SYNC_METADATA_STORE = "syncMetadata";

let syncDbPromise: Promise<IDBDatabase> | null = null;

const createSyncStores = (database: IDBDatabase) => {
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
      {
        unique: false,
      }
    );
  }

  if (!database.objectStoreNames.contains(SYNC_METADATA_STORE)) {
    database.createObjectStore(SYNC_METADATA_STORE, { keyPath: "key" });
  }
};

export const openSyncDb = (): Promise<IDBDatabase> => {
  if (syncDbPromise) {
    return syncDbPromise;
  }

  syncDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(SYNC_DB_NAME, SYNC_DB_VERSION);

    request.onupgradeneeded = () => {
      createSyncStores(request.result);
    };

    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        syncDbPromise = null;
      };
      resolve(database);
    };

    request.onerror = () => {
      syncDbPromise = null;
      reject(request.error);
    };

    request.onblocked = () => {
      syncDbPromise = null;
      reject(new Error("Opening IndexedDB sync database was blocked."));
    };
  });

  return syncDbPromise;
};

export const closeSyncDb = async (): Promise<void> => {
  const database = await syncDbPromise?.catch(() => null);
  database?.close();
  syncDbPromise = null;
};
