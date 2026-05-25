import React from "react";

import { Category } from "@/enums";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import CategoryChipRow from "./CategoryChipRow";

describe("CategoryChipRow", () => {
  it("renders only the selected chip when collapsed", () => {
    render(<CategoryChipRow value={Category.FOOD} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /food/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /transport/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /shopping/i })
    ).not.toBeInTheDocument();
  });

  it("expands the full list when the visible chip is tapped", async () => {
    const user = userEvent.setup();
    render(<CategoryChipRow value={Category.FOOD} onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /food/i }));

    expect(screen.getByRole("button", { name: /food/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /transport/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /shopping/i })
    ).toBeInTheDocument();
  });

  it("calls onChange and collapses when another chip is tapped", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CategoryChipRow value={Category.FOOD} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /food/i }));
    await user.click(screen.getByRole("button", { name: /transport/i }));

    expect(onChange).toHaveBeenCalledWith(Category.TRANSPORT);
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /shopping/i })
      ).not.toBeInTheDocument()
    );
  });

  it("collapses without calling onChange when the active chip is re-tapped while expanded", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CategoryChipRow value={Category.FOOD} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /food/i }));
    await user.click(screen.getByRole("button", { name: /food/i }));

    expect(onChange).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /transport/i })
      ).not.toBeInTheDocument()
    );
  });

  it("keeps the active input focused when a category chip is pressed", () => {
    render(
      <>
        <input aria-label="Amount" />
        <CategoryChipRow value={Category.FOOD} onChange={vi.fn()} />
      </>
    );

    const amount = screen.getByLabelText("Amount");
    amount.focus();

    const defaultWasNotPrevented = fireEvent.pointerDown(
      screen.getByRole("button", { name: /food/i }),
      { cancelable: true }
    );

    expect(defaultWasNotPrevented).toBe(false);
    expect(amount).toHaveFocus();
  });
});
