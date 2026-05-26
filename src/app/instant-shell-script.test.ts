import { INSTANT_SHELL_SNAPSHOT_KEY } from "@/lib/instant-shell/snapshot";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { instantShellScript } from "./instant-shell-script";

const runInstantShellScript = () => {
  new Function(instantShellScript)();
};

const controlCharacterPattern = new RegExp(
  `[${String.fromCharCode(0)}-${String.fromCharCode(31)}${String.fromCharCode(127)}]`
);

describe("instantShellScript", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-instant-shell-ready");
    document.documentElement.style.removeProperty("--instant-shell-total");
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("marks the instant shell ready without stored hints and leaves the total blank", () => {
    runInstantShellScript();

    expect(document.documentElement.dataset.instantShellReady).toBe("true");
    expect(
      document.documentElement.style.getPropertyValue("--instant-shell-total")
    ).toBe("");
  });

  it("applies a valid stored totalText as a CSS custom property", () => {
    localStorage.setItem(
      INSTANT_SHELL_SNAPSHOT_KEY,
      JSON.stringify({ totalText: "1.250.000", updatedAt: 1779786000000 })
    );

    runInstantShellScript();

    expect(
      document.documentElement.style.getPropertyValue("--instant-shell-total")
    ).toBe('"1.250.000"');
  });

  it("escapes quotes, backslashes, and control characters in the CSS custom property", () => {
    localStorage.setItem(
      INSTANT_SHELL_SNAPSHOT_KEY,
      JSON.stringify({
        totalText: '1"2\\3\n4\r5\f6\t7\b8\u00009\u001f10\u007f11',
        updatedAt: 1779786000000,
      })
    );

    runInstantShellScript();

    const propertyValue = document.documentElement.style.getPropertyValue(
      "--instant-shell-total"
    );

    expect(propertyValue).toBe(
      '"1\\"2\\\\3\\A 4\\D 5\\C 6\\9 7\\8 8\\0 9\\1F 10\\7F 11"'
    );
    expect(propertyValue).not.toMatch(controlCharacterPattern);
  });

  it("marks the instant shell ready when stored JSON is corrupt", () => {
    localStorage.setItem(INSTANT_SHELL_SNAPSHOT_KEY, "{not-json");

    expect(() => runInstantShellScript()).not.toThrow();
    expect(document.documentElement.dataset.instantShellReady).toBe("true");
    expect(
      document.documentElement.style.getPropertyValue("--instant-shell-total")
    ).toBe("");
  });

  it("marks the instant shell ready when localStorage reads throw", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() => runInstantShellScript()).not.toThrow();
    expect(document.documentElement.dataset.instantShellReady).toBe("true");
    expect(
      document.documentElement.style.getPropertyValue("--instant-shell-total")
    ).toBe("");
  });

  it("ignores snapshots containing theme", () => {
    localStorage.setItem(
      INSTANT_SHELL_SNAPSHOT_KEY,
      JSON.stringify({
        theme: "light",
        totalText: "1.250.000",
        updatedAt: 1779786000000,
      })
    );

    runInstantShellScript();

    expect(document.documentElement.dataset.instantShellReady).toBe("true");
    expect(
      document.documentElement.style.getPropertyValue("--instant-shell-total")
    ).toBe("");
  });
});
