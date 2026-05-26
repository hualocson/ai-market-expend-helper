import React from "react";

import type { BudgetWeeklyOption } from "@/lib/queries/budget-weekly";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import BudgetPickerSheet from "./BudgetPickerSheet";

const weeklyBudgetOptionsMock = vi.hoisted(() =>
  vi.fn<
    (weekStart: string, targetDate?: string) => Promise<BudgetWeeklyOption[]>
  >(
    async (): Promise<BudgetWeeklyOption[]> => [
      {
        id: 1,
        name: "Food week",
        period: "week",
        periodStartDate: "2026-05-18",
        periodEndDate: "2026-05-24",
        amount: 100,
        spent: 0,
        remaining: 100,
        icon: "🍜",
        color: "rose",
      },
      {
        id: 2,
        name: "Rent month",
        period: "month",
        periodStartDate: "2026-05-01",
        periodEndDate: "2026-05-31",
        amount: 500,
        spent: 200,
        remaining: 300,
        icon: "🏠",
        color: "sky",
      },
    ]
  )
);

vi.mock("@/lib/queries", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/queries")>("@/lib/queries");
  const options = Object.assign(
    (weekStart: string, targetDate?: string) => ({
      queryKey: ["budgetWeekly", "options", weekStart, targetDate],
      queryFn: () => weeklyBudgetOptionsMock(weekStart, targetDate),
    }),
    { _def: ["budgetWeekly", "options"] }
  );

  return {
    ...actual,
    queries: {
      ...actual.queries,
      budgetWeekly: {
        ...actual.queries.budgetWeekly,
        options,
      },
    },
  };
});

const renderSheet = (
  override: Partial<React.ComponentProps<typeof BudgetPickerSheet>> = {}
) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const onChange = vi.fn();
  const onOpenChange = vi.fn();
  const utils = render(
    <QueryClientProvider client={client}>
      <BudgetPickerSheet
        open
        onOpenChange={onOpenChange}
        value={null}
        onChange={onChange}
        weekStart="2026-05-18"
        targetDate="2026-05-22"
        {...override}
      />
    </QueryClientProvider>
  );
  return { ...utils, onChange, onOpenChange };
};

describe("BudgetPickerSheet", () => {
  it("renders week and month groups for fetched budgets", async () => {
    renderSheet();
    expect(await screen.findByText("Food week")).toBeInTheDocument();
    expect(
      await screen.findByLabelText("Budget: Food week")
    ).toBeInTheDocument();
    expect(screen.getByText("🍜")).toBeInTheDocument();
    expect(screen.getByText("Rent month")).toBeInTheDocument();
  });

  it("calls onChange(id) and closes when a budget is selected", async () => {
    const user = userEvent.setup();
    const { onChange, onOpenChange } = renderSheet();
    await user.click(await screen.findByRole("button", { name: /Food week/i }));
    expect(onChange).toHaveBeenCalledWith(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("requests focus restoration from the budget selection click path", async () => {
    const user = userEvent.setup();
    const onRestoreFocusRequest = vi.fn();

    renderSheet({ onRestoreFocusRequest });

    await user.click(await screen.findByRole("button", { name: /Food week/i }));

    expect(onRestoreFocusRequest).toHaveBeenCalledTimes(1);
  });

  it("requests focus restoration from outside pointer dismissal", () => {
    const onRestoreFocusRequest = vi.fn();
    const { onOpenChange } = renderSheet({ onRestoreFocusRequest });

    fireEvent.pointerDown(
      document.querySelector('[data-slot="sheet-overlay"]')!,
      {
        button: 0,
      }
    );

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onRestoreFocusRequest).toHaveBeenCalledTimes(1);
  });

  it("calls onChange(null) when 'No budget' is selected", async () => {
    const user = userEvent.setup();
    const { onChange } = renderSheet({ value: 1 });
    await user.click(await screen.findByRole("button", { name: /no budget/i }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
