import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { instantShellScript } from "./instant-shell-script";

const runInstantShellScript = () => {
  new Function(instantShellScript)();
};

describe("instantShellScript", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
    document.documentElement.removeAttribute("data-instant-shell-ready");
    document.documentElement.removeAttribute("data-instant-shell-hydrated");
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("marks the instant shell ready on the home route", () => {
    runInstantShellScript();

    expect(document.documentElement.dataset.instantShellReady).toBe("true");
    expect(document.documentElement.dataset.instantShellHydrated).toBe(
      undefined
    );
  });

  it("marks the shell hydrated immediately outside the home route", () => {
    window.history.replaceState(null, "", "/settings");

    runInstantShellScript();

    expect(document.documentElement.dataset.instantShellReady).toBe("true");
    expect(document.documentElement.dataset.instantShellHydrated).toBe("true");
  });

  it("does not read cached totals from localStorage", () => {
    const getItemSpy = vi.spyOn(Storage.prototype, "getItem");

    runInstantShellScript();

    expect(getItemSpy).not.toHaveBeenCalled();
  });

  it("does not depend on localStorage access", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() => runInstantShellScript()).not.toThrow();
    expect(document.documentElement.dataset.instantShellReady).toBe("true");
  });
});
