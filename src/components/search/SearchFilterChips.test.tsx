import React from "react";

import { Category } from "@/enums";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SearchFilterChips from "./SearchFilterChips";

describe("SearchFilterChips", () => {
  it("renders a chip per active field and removes on click", () => {
    const onRemove = vi.fn();
    render(
      <SearchFilterChips
        filter={{ categories: [Category.FOOD], hasBudget: false }}
        onRemove={onRemove}
      />
    );
    expect(screen.getByText("No budget")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /remove No budget/i }));
    expect(onRemove).toHaveBeenCalledWith("hasBudget");
  });
});
