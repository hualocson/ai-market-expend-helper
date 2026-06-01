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

  it("does not render raw q text as a filter chip", () => {
    render(
      <SearchFilterChips
        filter={{ q: "coffee", categories: [Category.FOOD] }}
        onRemove={vi.fn()}
      />
    );

    expect(screen.getByText(Category.FOOD)).toBeInTheDocument();
    expect(screen.queryByText(/text:/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /remove text/i })
    ).not.toBeInTheDocument();
  });
});
