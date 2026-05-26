import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const firstScreenFiles = [
  "src/components/SpendingDashboardHeaderClient.tsx",
  "src/components/ExpenseList.tsx",
];

describe("first-screen startup motion", () => {
  it("does not use blur filters in startup motion", () => {
    for (const file of firstScreenFiles) {
      const source = readFileSync(join(process.cwd(), file), "utf8");

      expect(source, file).not.toContain('filter: "blur');
      expect(source, file).not.toContain("filter: 'blur");
    }
  });
});
