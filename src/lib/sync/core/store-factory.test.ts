import { describe, expect, it } from "vitest";

import { createSyncEntityStore } from "./store-factory";
import type { SyncRecord } from "./types";

type PartialSyncRecord = Pick<
  SyncRecord,
  | "clientId"
  | "serverId"
  | "syncStatus"
  | "lastError"
  | "updatedAt"
  | "serverUpdatedAt"
>;

const record = (overrides: Partial<SyncRecord> = {}): SyncRecord => ({
  entity: "expenses",
  clientId: "client-1",
  serverId: 1,
  syncStatus: "synced",
  lastError: null,
  updatedAt: "2026-05-24T09:00:00.000Z",
  serverUpdatedAt: "2026-05-24T09:00:00.000Z",
  payload: {},
  ...overrides,
});

const createStore = () =>
  createSyncEntityStore("expenses", (a: SyncRecord, b: SyncRecord) =>
    b.updatedAt.localeCompare(a.updatedAt)
  );

// @ts-expect-error Store records must include the full SyncRecord contract.
createSyncEntityStore<PartialSyncRecord>("expenses", (a, b) =>
  b.updatedAt.localeCompare(a.updatedAt)
);

describe("sync entity Zustand store factory", () => {
  it("hydrates records by client id in sorted order", () => {
    const store = createStore();

    store.getState().hydrate([
      record({
        clientId: "older",
        updatedAt: "2026-05-24T08:00:00.000Z",
      }),
      record({
        clientId: "newer",
        updatedAt: "2026-05-24T10:00:00.000Z",
      }),
    ]);

    expect(store.getState().hydrated).toBe(true);
    expect(store.getState().recordsByClientId.older?.clientId).toBe("older");
    expect(store.getState().orderedClientIds).toEqual(["newer", "older"]);
  });

  it("preserves full sync record fields when hydrating and upserting", () => {
    const store = createStore();

    store.getState().hydrate([
      record({
        clientId: "client-1",
        payload: { note: "Coffee" },
      }),
    ]);
    store.getState().upsertRecord(
      record({
        clientId: "client-2",
        payload: { note: "Lunch" },
      })
    );

    expect(store.getState().recordsByClientId["client-1"]).toMatchObject({
      entity: "expenses",
      payload: { note: "Coffee" },
    });
    expect(store.getState().recordsByClientId["client-2"]).toMatchObject({
      entity: "expenses",
      payload: { note: "Lunch" },
    });
  });

  it("upserts and removes records while recalculating sync counts", () => {
    const store = createStore();

    store.getState().hydrate([record({ clientId: "synced" })]);
    store.getState().upsertRecord(
      record({
        clientId: "pending",
        syncStatus: "pending",
        updatedAt: "2026-05-24T10:00:00.000Z",
      })
    );
    store.getState().upsertRecord(
      record({
        clientId: "failed",
        syncStatus: "failed",
        updatedAt: "2026-05-24T11:00:00.000Z",
      })
    );
    store.getState().removeRecord("pending");

    expect(store.getState().recordsByClientId.pending).toBeUndefined();
    expect(store.getState().orderedClientIds).toEqual(["failed", "synced"]);
    expect(store.getState().pendingCount).toBe(0);
    expect(store.getState().failedCount).toBe(1);
  });

  it("marks a record failed", () => {
    const store = createStore();

    store.getState().hydrate([record({ clientId: "client-1" })]);
    store.getState().markRecordFailed("client-1", "Invalid payload");

    expect(store.getState().recordsByClientId["client-1"]).toMatchObject({
      syncStatus: "failed",
      lastError: "Invalid payload",
    });
    expect(store.getState().failedCount).toBe(1);
  });

  it("does not publish state for missing remove and failure actions", () => {
    const store = createStore();

    store.getState().hydrate([record({ clientId: "client-1" })]);
    const stateBefore = store.getState();
    let notificationCount = 0;
    const unsubscribe = store.subscribe(() => {
      notificationCount += 1;
    });

    store.getState().removeRecord("missing");
    store.getState().markRecordFailed("missing", "Missing record");

    expect(store.getState()).toBe(stateBefore);
    expect(notificationCount).toBe(0);

    unsubscribe();
  });
});
