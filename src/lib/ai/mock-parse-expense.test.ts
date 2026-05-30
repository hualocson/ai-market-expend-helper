import { Category } from "@/enums";
import { describe, expect, it } from "vitest";

import { mockParseExpense } from "./mock-parse-expense";

describe("mockParseExpense", () => {
  it("returns an expense-list item populated from the input", () => {
    const result = mockParseExpense("Cà phê 35k", { paidBy: "Cubi" });

    expect(result.note).toBe("Cà phê 35k");
    expect(result.amount).toBeGreaterThan(0);
    expect(result.paidBy).toBe("Cubi");
    expect(result.syncStatus).toBe("synced");
    expect(result.budgetId).toBeNull();
  });

  it("produces a valid category and ISO date", () => {
    const result = mockParseExpense("lunch", { paidBy: "Cubi" });

    expect(Object.values(Category)).toContain(result.category);
    expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("gives each call a unique id", () => {
    const a = mockParseExpense("a", { paidBy: "Cubi" });
    const b = mockParseExpense("b", { paidBy: "Cubi" });

    expect(a.id).not.toBe(b.id);
  });
});
