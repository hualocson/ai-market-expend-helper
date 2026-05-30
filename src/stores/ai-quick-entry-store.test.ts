import { afterEach, describe, expect, it } from "vitest";

import { useAIQuickEntryStore } from "./ai-quick-entry-store";

afterEach(() => {
  useAIQuickEntryStore.getState().setOpen(false);
});

describe("useAIQuickEntryStore", () => {
  it("defaults to closed", () => {
    expect(useAIQuickEntryStore.getState().open).toBe(false);
  });

  it("opens and closes via setOpen", () => {
    useAIQuickEntryStore.getState().setOpen(true);
    expect(useAIQuickEntryStore.getState().open).toBe(true);

    useAIQuickEntryStore.getState().setOpen(false);
    expect(useAIQuickEntryStore.getState().open).toBe(false);
  });
});
