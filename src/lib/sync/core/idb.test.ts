import { describe, expect, it } from "vitest";

import { SYNC_DB_NAME } from "./idb";

describe("sync core IndexedDB configuration", () => {
  it("names the database by environment", () => {
    expect(SYNC_DB_NAME).toBe(`spendly_databases_${process.env.NODE_ENV}`);
  });
});
