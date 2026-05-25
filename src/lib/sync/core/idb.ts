import { createIndexedDbClient } from "@/lib/storage/indexed-db/client";
import type { DBSchema } from "idb";

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
