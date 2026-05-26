import type { BudgetListItem } from "@/types/budget-weekly";
import { describe, expect, it } from "vitest";

import {
  type CandidateGroup,
  groupTransferCandidates,
} from "./budget-transfer-groups";

const makeBudget = (overrides: Partial<BudgetListItem>): BudgetListItem => ({
  id: 1,
  name: "Coffee",
  amount: 500_000,
  spent: 180_000,
  remaining: 320_000,
  icon: "💰",
  color: "lime",
  period: "week",
  periodStartDate: "2026-05-13",
  periodEndDate: "2026-05-19",
  ...overrides,
});

// Reference "now": Saturday 2026-05-16. ISO week (Sun-start) covers 2026-05-10..2026-05-16.
// Last week covers 2026-05-03..2026-05-09. This month: May 2026. Last month: April 2026.
const NOW = new Date(2026, 4, 16);

describe("groupTransferCandidates", () => {
  it("returns an empty array for no candidates", () => {
    expect(groupTransferCandidates([], NOW)).toEqual([]);
  });

  it("buckets a current-week budget into this-week", () => {
    const groups = groupTransferCandidates(
      [
        makeBudget({
          id: 1,
          periodStartDate: "2026-05-10",
          periodEndDate: "2026-05-16",
        }),
      ],
      NOW
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].key.kind).toBe("this-week");
    expect(groups[0].label).toMatch(/this week/i);
    expect(groups[0].candidates.map((c) => c.id)).toEqual([1]);
  });

  it("buckets a previous-week budget into last-week", () => {
    const groups = groupTransferCandidates(
      [
        makeBudget({
          id: 2,
          periodStartDate: "2026-05-03",
          periodEndDate: "2026-05-09",
        }),
      ],
      NOW
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].key.kind).toBe("last-week");
    expect(groups[0].label).toMatch(/last week/i);
  });

  it("buckets a current-month budget into this-month", () => {
    const groups = groupTransferCandidates(
      [
        makeBudget({
          id: 3,
          period: "month",
          periodStartDate: "2026-05-01",
          periodEndDate: "2026-05-31",
        }),
      ],
      NOW
    );
    expect(groups[0].key.kind).toBe("this-month");
    expect(groups[0].label).toMatch(/this month/i);
  });

  it("buckets a previous-month budget into last-month", () => {
    const groups = groupTransferCandidates(
      [
        makeBudget({
          id: 4,
          period: "month",
          periodStartDate: "2026-04-01",
          periodEndDate: "2026-04-30",
        }),
      ],
      NOW
    );
    expect(groups[0].key.kind).toBe("last-month");
    expect(groups[0].label).toMatch(/last month/i);
  });

  it("buckets older weeks, older months, and custom periods into earlier", () => {
    const groups = groupTransferCandidates(
      [
        makeBudget({
          id: 5,
          periodStartDate: "2026-03-01",
          periodEndDate: "2026-03-07",
        }),
        makeBudget({
          id: 6,
          period: "month",
          periodStartDate: "2026-01-01",
          periodEndDate: "2026-01-31",
        }),
        makeBudget({
          id: 7,
          period: "custom",
          periodStartDate: "2026-02-10",
          periodEndDate: "2026-02-25",
        }),
      ],
      NOW
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].key.kind).toBe("earlier");
    expect(groups[0].candidates.map((c) => c.id).sort()).toEqual([5, 6, 7]);
  });

  it("omits empty groups", () => {
    const groups = groupTransferCandidates(
      [
        makeBudget({
          id: 1,
          periodStartDate: "2026-05-10",
          periodEndDate: "2026-05-16",
        }),
        makeBudget({
          id: 3,
          period: "month",
          periodStartDate: "2026-05-01",
          periodEndDate: "2026-05-31",
        }),
      ],
      NOW
    );
    const kinds = groups.map((g) => g.key.kind);
    expect(kinds).toEqual(["this-week", "this-month"]);
  });

  it("orders groups: this-week, last-week, this-month, last-month, earlier", () => {
    const groups = groupTransferCandidates(
      [
        makeBudget({
          id: 99,
          periodStartDate: "2026-03-01",
          periodEndDate: "2026-03-07",
        }), // earlier
        makeBudget({
          id: 4,
          period: "month",
          periodStartDate: "2026-04-01",
          periodEndDate: "2026-04-30",
        }), // last-month
        makeBudget({
          id: 2,
          periodStartDate: "2026-05-03",
          periodEndDate: "2026-05-09",
        }), // last-week
        makeBudget({
          id: 3,
          period: "month",
          periodStartDate: "2026-05-01",
          periodEndDate: "2026-05-31",
        }), // this-month
        makeBudget({
          id: 1,
          periodStartDate: "2026-05-10",
          periodEndDate: "2026-05-16",
        }), // this-week
      ],
      NOW
    );
    expect(groups.map((g) => g.key.kind)).toEqual([
      "this-week",
      "last-week",
      "this-month",
      "last-month",
      "earlier",
    ]);
  });

  it("sorts within a group by remaining desc; non-positive remaining falls to bottom", () => {
    const groups: CandidateGroup[] = groupTransferCandidates(
      [
        makeBudget({
          id: 1,
          periodStartDate: "2026-05-10",
          periodEndDate: "2026-05-16",
          remaining: 50_000,
        }),
        makeBudget({
          id: 2,
          periodStartDate: "2026-05-10",
          periodEndDate: "2026-05-16",
          remaining: 0,
        }),
        makeBudget({
          id: 3,
          periodStartDate: "2026-05-10",
          periodEndDate: "2026-05-16",
          remaining: 200_000,
        }),
        makeBudget({
          id: 4,
          periodStartDate: "2026-05-10",
          periodEndDate: "2026-05-16",
          remaining: -10_000,
        }),
      ],
      NOW
    );
    expect(groups[0].candidates.map((c) => c.id)).toEqual([3, 1, 2, 4]);
  });
});
