import { describe, expect, it } from "vitest";

import { formatVndCompact } from "./utils";

describe("formatVndCompact", () => {
  it("abbreviates thousands with K", () => {
    expect(formatVndCompact(40000)).toBe("40K");
    expect(formatVndCompact(220000)).toBe("220K");
    expect(formatVndCompact(500000)).toBe("500K");
  });

  it("abbreviates millions with one decimal", () => {
    expect(formatVndCompact(1700000)).toBe("1.7M");
    expect(formatVndCompact(2400000)).toBe("2.4M");
  });

  it("keeps a leading minus for negatives", () => {
    expect(formatVndCompact(-120000)).toBe("-120K");
  });

  it("renders small values plainly", () => {
    expect(formatVndCompact(0)).toBe("0");
    expect(formatVndCompact(950)).toBe("950");
  });

  it("returns empty string for non-finite input", () => {
    expect(formatVndCompact(Number.NaN)).toBe("");
    expect(formatVndCompact(Number.POSITIVE_INFINITY)).toBe("");
  });
});
