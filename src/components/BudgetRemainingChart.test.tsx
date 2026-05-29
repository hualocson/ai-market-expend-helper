import React from "react";

import type { BudgetListItem } from "@/types/budget-weekly";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import BudgetRemainingChart from "./BudgetRemainingChart";

const makeBudget = (overrides: Partial<BudgetListItem>): BudgetListItem => ({
  id: 1,
  name: "Budget",
  icon: "💰",
  color: "lime",
  amount: 1000,
  spent: 0,
  remaining: 1000,
  period: "week",
  periodStartDate: "2026-05-25",
  periodEndDate: null,
  ...overrides,
});

describe("BudgetRemainingChart", () => {
  it("renders nothing when there are no budgets", () => {
    const { container } = render(
      <BudgetRemainingChart budgets={[]} onSelect={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders one bar per budget", () => {
    render(
      <BudgetRemainingChart
        budgets={[
          makeBudget({ id: 1, name: "Coffee", remaining: 220000 }),
          makeBudget({ id: 2, name: "Transport", remaining: 150000 }),
        ]}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("calls onSelect with the tapped budget", () => {
    const onSelect = vi.fn();
    const coffee = makeBudget({ id: 7, name: "Coffee", remaining: 220000 });
    render(<BudgetRemainingChart budgets={[coffee]} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledWith(coffee);
  });

  it("shows a signed negative amount for an over-budget bar", () => {
    render(
      <BudgetRemainingChart
        budgets={[makeBudget({ id: 3, name: "Clothes", remaining: -120000 })]}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByText("-120K")).toBeInTheDocument();
  });
});
