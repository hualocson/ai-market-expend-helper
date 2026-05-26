import React from "react";

import { BUDGET_COLOR_OPTIONS } from "@/lib/budget-appearance";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import BudgetColorList from "./BudgetColorList";

describe("BudgetColorList", () => {
  it("renders budget colors in a horizontal scroll list", () => {
    render(<BudgetColorList value="rose" onChange={vi.fn()} />);

    const list = screen.getByLabelText("Budget colors");
    expect(list).toHaveClass("overflow-x-auto");
    expect(list).toHaveClass("flex-nowrap");
    expect(
      screen.getAllByRole("button", { name: /Budget color/i })
    ).toHaveLength(BUDGET_COLOR_OPTIONS.length);
    expect(screen.getByRole("button", { name: /Rose/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("calls onChange when a color is selected", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<BudgetColorList value="rose" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /Sky/i }));

    expect(onChange).toHaveBeenCalledWith("sky");
  });
});
