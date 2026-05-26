import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  INSTANT_SHELL_SNAPSHOT_KEY,
  parseInstantShellSnapshot,
  readInstantShellSnapshot,
  writeInstantShellSnapshot,
} from "./snapshot";

describe("instant shell snapshot", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts a valid display-only snapshot", () => {
    expect(
      parseInstantShellSnapshot({
        totalText: "1.250.000",
        updatedAt: 1779786000000,
      })
    ).toEqual({
      totalText: "1.250.000",
      updatedAt: 1779786000000,
    });
  });

  it("rejects theme persistence", () => {
    expect(
      parseInstantShellSnapshot({
        theme: "light",
        totalText: "1.250.000",
        updatedAt: 1779786000000,
      })
    ).toBeNull();
  });

  it("rejects invalid shapes", () => {
    expect(parseInstantShellSnapshot(null)).toBeNull();
    expect(parseInstantShellSnapshot({ totalText: 1250000 })).toBeNull();
    expect(
      parseInstantShellSnapshot({ totalText: "1", updatedAt: "now" })
    ).toBeNull();
  });

  it("reads and writes the browser snapshot safely", () => {
    writeInstantShellSnapshot({
      totalText: "900.000",
      updatedAt: 1779786000000,
    });

    expect(localStorage.getItem(INSTANT_SHELL_SNAPSHOT_KEY)).toBe(
      JSON.stringify({ totalText: "900.000", updatedAt: 1779786000000 })
    );
    expect(readInstantShellSnapshot()).toEqual({
      totalText: "900.000",
      updatedAt: 1779786000000,
    });
  });

  it("returns null for corrupt storage", () => {
    localStorage.setItem(INSTANT_SHELL_SNAPSHOT_KEY, "{not-json");

    expect(readInstantShellSnapshot()).toBeNull();
  });

  it("returns null when storage reads are blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(readInstantShellSnapshot()).toBeNull();
  });

  it("does not throw when storage writes are blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() =>
      writeInstantShellSnapshot({
        totalText: "900.000",
        updatedAt: 1779786000000,
      })
    ).not.toThrow();
  });

  it("handles blocked storage property access", () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      "localStorage"
    );

    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get: () => {
        throw new Error("blocked");
      },
    });

    try {
      expect(readInstantShellSnapshot()).toBeNull();
      expect(() =>
        writeInstantShellSnapshot({
          totalText: "900.000",
          updatedAt: 1779786000000,
        })
      ).not.toThrow();
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(globalThis, "localStorage", originalDescriptor);
      }
    }
  });

  it("does not persist theme from a wider object", () => {
    const snapshot = {
      theme: "light",
      totalText: "900.000",
      updatedAt: 1779786000000,
    };

    writeInstantShellSnapshot(snapshot);

    expect(localStorage.getItem(INSTANT_SHELL_SNAPSHOT_KEY)).toBe(
      JSON.stringify({ totalText: "900.000", updatedAt: 1779786000000 })
    );
  });

  it("does not persist arbitrary extra fields from a wider object", () => {
    const snapshot = {
      currency: "VND",
      nested: { foo: "bar" },
      totalText: "900.000",
      updatedAt: 1779786000000,
    };

    writeInstantShellSnapshot(snapshot);

    expect(localStorage.getItem(INSTANT_SHELL_SNAPSHOT_KEY)).toBe(
      JSON.stringify({ totalText: "900.000", updatedAt: 1779786000000 })
    );
  });
});
