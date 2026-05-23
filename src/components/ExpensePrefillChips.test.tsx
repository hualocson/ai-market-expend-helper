import React from "react";

import { Category } from "@/enums";
import { EXPENSE_PREFILL_EVENT } from "@/lib/expense-prefill";
import { queries } from "@/lib/queries";
import type { ExpensePrefillItem } from "@/lib/services/expenses";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ExpensePrefillChips from "./ExpensePrefillChips";

vi.mock("@/components/ExpenseItemIcon", () => ({
  default: () => <span data-testid="expense-icon" />,
}));

const originalGlobalReact = globalThis.React;

afterEach(() => {
  vi.restoreAllMocks();

  if (typeof originalGlobalReact === "undefined") {
    Reflect.deleteProperty(globalThis, "React");
    return;
  }

  globalThis.React = originalGlobalReact;
});

describe("ExpensePrefillChips", () => {
  it("renders hydrated prefill chips and dispatches the prefill event", () => {
    globalThis.React = React;

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 60 * 1000,
        },
      },
    });
    const payload: ExpensePrefillItem[] = [
      {
        note: "Lunch",
        category: Category.FOOD,
        totalFrequency: 4,
        amount: 120_000,
      },
    ];
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const prefillHandler = vi.fn();

    queryClient.setQueryData(queries.expenses.prefills.queryKey, payload);
    window.addEventListener(EXPENSE_PREFILL_EVENT, prefillHandler);

    render(
      <QueryClientProvider client={queryClient}>
        <ExpensePrefillChips />
      </QueryClientProvider>
    );

    const chip = screen.getByRole("button", { name: /lunch/i });
    fireEvent.click(chip);

    expect(screen.getByText("Quick add")).toBeInTheDocument();
    expect(chip).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(prefillHandler).toHaveBeenCalledTimes(1);
    expect(prefillHandler.mock.calls[0][0]).toMatchObject({
      detail: {
        amount: 120_000,
        note: "Lunch",
        category: Category.FOOD,
        source: "home_prefill",
      },
    });

    window.removeEventListener(EXPENSE_PREFILL_EVENT, prefillHandler);
  });
});
