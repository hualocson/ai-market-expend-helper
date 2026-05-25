import "fake-indexeddb/auto";
import { type DBSchema, deleteDB, openDB } from "idb";
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
const BLOCKED_OPERATION_TIMEOUT_MS = 100;

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

const rejectIfPending = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage = "operation timed out"
): Promise<T> =>
  await Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(timeoutMessage));
      }, timeoutMs);
    }),
  ]);

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

    await client.withTransaction(
      ["items"],
      "readwrite",
      async (transaction) => {
        await transaction.objectStore("items").put({
          id: "item-1",
          group: "food",
          value: 12,
        });
      }
    );

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

    await client.withTransaction(
      ["metadata"],
      "readwrite",
      async (transaction) => {
        await transaction
          .objectStore("metadata")
          .put({ key: "cursor", value: "2026-05-25T00:00:00.000Z" });
      }
    );

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

  it("aborts queued writes when the transaction callback fails", async () => {
    const client = createTestClient();

    await expect(
      client.withTransaction(["items"], "readwrite", async (transaction) => {
        await transaction.objectStore("items").put({
          id: "item-rollback",
          group: "food",
          value: 99,
        });
        throw new Error("transaction failed");
      })
    ).rejects.toThrow("transaction failed");

    const entry = await client.withTransaction(
      ["items"],
      "readonly",
      async (transaction) =>
        transaction.objectStore("items").get("item-rollback")
    );

    expect(entry).toBeUndefined();
  });

  it("rejects blocked opens with a clear error", async () => {
    const openConnection = await openDB<TestDbSchema>(TEST_DB_NAME, 1, {
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
    const blockedClient = createIndexedDbClient<TestDbSchema>({
      name: TEST_DB_NAME,
      version: 2,
      upgrade(database) {
        if (!database.objectStoreNames.contains("metadata")) {
          database.createObjectStore("metadata", { keyPath: "key" });
        }
      },
    });
    const blockedOpen = blockedClient.open();

    try {
      await expect(
        rejectIfPending(
          blockedOpen,
          BLOCKED_OPERATION_TIMEOUT_MS,
          "open timed out"
        )
      ).rejects.toThrow(
        `Opening IndexedDB database "${TEST_DB_NAME}" was blocked.`
      );
    } finally {
      openConnection.close();
      await rejectIfPending(
        blockedOpen.then((database) => database.close()).catch(() => undefined),
        BLOCKED_OPERATION_TIMEOUT_MS
      ).catch(() => undefined);
    }
  });

  it("rejects blocked deletes with a clear error", async () => {
    const openConnection = await openDB<TestDbSchema>(TEST_DB_NAME, 1, {
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
    const client = createTestClient();
    const blockedDelete = client.deleteDatabase();

    try {
      await expect(
        rejectIfPending(
          blockedDelete,
          BLOCKED_OPERATION_TIMEOUT_MS,
          "delete timed out"
        )
      ).rejects.toThrow(
        `Deleting IndexedDB database "${TEST_DB_NAME}" was blocked.`
      );
    } finally {
      openConnection.close();
      await rejectIfPending(
        blockedDelete.catch(() => undefined),
        BLOCKED_OPERATION_TIMEOUT_MS
      ).catch(() => undefined);
    }
  });
});
