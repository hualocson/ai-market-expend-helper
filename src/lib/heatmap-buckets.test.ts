import { describe, expect, it } from "vitest";

import { getQuantileBuckets } from "@/lib/heatmap-buckets";

describe("getQuantileBuckets", () => {
  it("returns all zeros when every total is zero", () => {
    expect(getQuantileBuckets([0, 0, 0, 0, 0])).toEqual([0, 0, 0, 0, 0]);
  });

  it("returns all zeros for an empty input", () => {
    expect(getQuantileBuckets([])).toEqual([]);
  });

  it("maps a single non-zero day to bucket 4 and zeros for the rest", () => {
    expect(getQuantileBuckets([0, 0, 100, 0, 0])).toEqual([0, 0, 4, 0, 0]);
  });

  it("maps every non-zero day to bucket 4 when all non-zero values are equal", () => {
    expect(getQuantileBuckets([0, 50, 50, 50, 50])).toEqual([0, 4, 4, 4, 4]);
  });

  it("distributes a well-spread set across buckets 1..4", () => {
    // non-zero sorted: [10, 20, 30, 40, 50, 60, 70, 80]
    // q25 index = floor(7*0.25)=1 -> 20
    // q50 index = floor(7*0.5)=3 -> 40
    // q75 index = floor(7*0.75)=5 -> 60
    // buckets: <=20 -> 1, <=40 -> 2, <=60 -> 3, else -> 4
    const totals = [10, 20, 30, 40, 50, 60, 70, 80];
    expect(getQuantileBuckets(totals)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
  });

  it("preserves monotonicity: larger total never gets a smaller bucket", () => {
    const totals = [0, 5, 5, 12, 12, 33, 33, 90, 90, 200];
    const buckets = getQuantileBuckets(totals);
    for (let i = 0; i < totals.length; i++) {
      for (let j = 0; j < totals.length; j++) {
        if (totals[i] < totals[j]) {
          expect(buckets[i]).toBeLessThanOrEqual(buckets[j]);
        }
      }
    }
  });

  it("treats negative totals as zero spend (bucket 0)", () => {
    expect(getQuantileBuckets([-5, 0, 10, 20])).toEqual([0, 0, 4, 4]);
  });
});
