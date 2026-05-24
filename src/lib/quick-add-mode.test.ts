import { describe, expect, it } from "vitest";
import {
  normalizePrefillSource,
  resolveQuickAddMode,
} from "@/lib/quick-add-mode";

describe("resolveQuickAddMode", () => {
  it('returns advanced for { source: "manual", hasPrefill: false }', () => {
    expect(
      resolveQuickAddMode({
        hasPrefill: false,
        source: "manual",
      })
    ).toBe("advanced");
  });

  it('returns advanced for { source: "manual", hasPrefill: true }', () => {
    expect(
      resolveQuickAddMode({
        hasPrefill: true,
        source: "manual",
      })
    ).toBe("advanced");
  });

  it('returns quick for { source: "repeat_entry", hasPrefill: true }', () => {
    expect(
      resolveQuickAddMode({
        hasPrefill: true,
        source: "repeat_entry",
      })
    ).toBe("quick");
  });
});

describe("normalizePrefillSource", () => {
  it('returns "manual" for undefined', () => {
    expect(normalizePrefillSource(undefined)).toBe("manual");
  });

  it('returns "manual" for invalid input', () => {
    expect(normalizePrefillSource("not_a_real_source")).toBe("manual");
  });

  it('returns "manual" for "manual"', () => {
    expect(normalizePrefillSource("manual")).toBe("manual");
  });

  it('returns "repeat_entry" for "repeat_entry"', () => {
    expect(normalizePrefillSource("repeat_entry")).toBe("repeat_entry");
  });
});
