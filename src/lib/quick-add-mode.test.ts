import { describe, expect, it } from "vitest";
import {
  normalizePrefillSource,
  resolveQuickAddMode,
} from "@/lib/quick-add-mode";

describe("resolveQuickAddMode", () => {
  it('returns quick for { source: "home_prefill", hasPrefill: true }', () => {
    expect(
      resolveQuickAddMode({
        hasPrefill: true,
        source: "home_prefill",
      })
    ).toBe("quick");
  });

  it('returns advanced for { source: "home_prefill", hasPrefill: false }', () => {
    expect(
      resolveQuickAddMode({
        hasPrefill: false,
        source: "home_prefill",
      })
    ).toBe("advanced");
  });

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

  it('returns "home_prefill" for "home_prefill"', () => {
    expect(normalizePrefillSource("home_prefill")).toBe("home_prefill");
  });

  it('returns "repeat_entry" for "repeat_entry"', () => {
    expect(normalizePrefillSource("repeat_entry")).toBe("repeat_entry");
  });
});
