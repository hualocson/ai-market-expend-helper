import dayjs from "@/configs/date";
import { describe, expect, it, vi } from "vitest";

import { buildDailyTotals } from "./dashboard";

vi.mock("@/db", () => ({
  db: {},
}));

describe("dashboard services", () => {
  it("builds a full month of daily totals", () => {
    expect(
      buildDailyTotals(dayjs("2026-02-01"), [
        { date: "2026-02-01", amount: 100 },
        { date: "2026-02-01", amount: 50 },
        { date: "2026-02-03", amount: 75 },
      ])
    ).toEqual([
      150, 0, 75, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0,
    ]);
  });
});
