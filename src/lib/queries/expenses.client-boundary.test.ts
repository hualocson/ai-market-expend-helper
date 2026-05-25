import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const clientBoundExpenseModules = [
  ["expense query fetcher", "src/lib/queries/expenses.ts"],
  ["local expense list builder", "src/lib/sync/expenses/list.ts"],
] as const;

describe("expense client module boundaries", () => {
  it.each(clientBoundExpenseModules)(
    "%s does not import the server expense service",
    async (_label, filePath) => {
      const source = await readFile(join(process.cwd(), filePath), "utf8");

      expect(source).not.toContain("@/lib/services/expenses");
    }
  );
});
