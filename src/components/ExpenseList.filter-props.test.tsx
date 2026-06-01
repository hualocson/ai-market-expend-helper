import React from "react";

import { Category } from "@/enums";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ExpenseList from "./ExpenseList";

describe("ExpenseList filter props", () => {
  it("includes filter props in the query key", () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ExpenseList categories={[Category.FOOD]} hasBudget={false} />
      </QueryClientProvider>
    );
    const keys = queryClient
      .getQueryCache()
      .getAll()
      .map((entry) => JSON.stringify(entry.queryKey));
    expect(keys.some((key) => key.includes('"hasBudget":false'))).toBe(true);
    expect(keys.some((key) => key.includes("Food"))).toBe(true);
  });
});
