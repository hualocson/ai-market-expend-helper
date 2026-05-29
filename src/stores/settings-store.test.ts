import { beforeEach, describe, expect, it } from "vitest";

import { createSettingsStore, defaultInitState } from "./settings-store";

describe("settings store", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("defaults keepDrawerOpen to false", () => {
    expect(defaultInitState.keepDrawerOpen).toBe(false);
    expect(createSettingsStore().getState().keepDrawerOpen).toBe(false);
  });

  it("setKeepDrawerOpen updates the flag", () => {
    const store = createSettingsStore();
    store.getState().setKeepDrawerOpen(true);
    expect(store.getState().keepDrawerOpen).toBe(true);
  });
});
