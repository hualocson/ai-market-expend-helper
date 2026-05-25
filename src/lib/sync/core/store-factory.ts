import { createStore } from "zustand/vanilla";

import type { SyncEntityName, SyncRecord } from "./types";

export type SyncEntityStoreState<TRecord extends SyncRecord> = {
  entity: SyncEntityName;
  hydrated: boolean;
  recordsByClientId: Record<string, TRecord>;
  orderedClientIds: string[];
  pendingCount: number;
  failedCount: number;
  hydrate: (records: TRecord[]) => void;
  upsertRecord: (record: TRecord) => void;
  removeRecord: (clientId: string) => void;
  markRecordFailed: (clientId: string, error: string) => void;
};

const getSyncCounts = <TRecord extends SyncRecord>(records: TRecord[]) => ({
  pendingCount: records.filter((record) => record.syncStatus === "pending")
    .length,
  failedCount: records.filter((record) => record.syncStatus === "failed")
    .length,
});

const sortClientIds = <TRecord extends SyncRecord>(
  records: TRecord[],
  sortRecords: (a: TRecord, b: TRecord) => number
) => [...records].sort(sortRecords).map((record) => record.clientId);

export const createSyncEntityStore = <TRecord extends SyncRecord>(
  entity: SyncEntityName,
  sortRecords: (a: TRecord, b: TRecord) => number
) =>
  createStore<SyncEntityStoreState<TRecord>>()((set) => ({
    entity,
    hydrated: false,
    recordsByClientId: {},
    orderedClientIds: [],
    pendingCount: 0,
    failedCount: 0,
    hydrate: (records) => {
      const recordsByClientId = Object.fromEntries(
        records.map((record) => [record.clientId, record])
      );

      set({
        hydrated: true,
        recordsByClientId,
        orderedClientIds: sortClientIds(records, sortRecords),
        ...getSyncCounts(records),
      });
    },
    upsertRecord: (record) =>
      set((state) => {
        const recordsByClientId = {
          ...state.recordsByClientId,
          [record.clientId]: record,
        };
        const records = Object.values(recordsByClientId);

        return {
          recordsByClientId,
          orderedClientIds: sortClientIds(records, sortRecords),
          ...getSyncCounts(records),
        };
      }),
    removeRecord: (clientId) =>
      set((state) => {
        if (!state.recordsByClientId[clientId]) {
          return state;
        }

        const { [clientId]: _removed, ...recordsByClientId } =
          state.recordsByClientId;
        const records = Object.values(recordsByClientId);

        return {
          recordsByClientId,
          orderedClientIds: sortClientIds(records, sortRecords),
          ...getSyncCounts(records),
        };
      }),
    markRecordFailed: (clientId, error) =>
      set((state) => {
        const record = state.recordsByClientId[clientId];
        if (!record) {
          return state;
        }

        const recordsByClientId = {
          ...state.recordsByClientId,
          [clientId]: {
            ...record,
            syncStatus: "failed" as const,
            lastError: error,
          },
        };
        const records = Object.values(recordsByClientId);

        return {
          recordsByClientId,
          orderedClientIds: sortClientIds(records, sortRecords),
          ...getSyncCounts(records),
        };
      }),
  }));
