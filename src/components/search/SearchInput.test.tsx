import React from "react";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SearchInput from "./SearchInput";

describe("SearchInput", () => {
  it("submits the typed query", () => {
    const onSubmit = vi.fn();
    render(
      <SearchInput onSubmit={onSubmit} isLoading={false} disabled={false} />
    );
    const input = screen.getByPlaceholderText(/search expenses/i);
    fireEvent.change(input, { target: { value: "coffee no budget" } });
    fireEvent.submit(input.closest("form")!);
    expect(onSubmit).toHaveBeenCalledWith("coffee no budget");
  });

  it("does not submit empty input", () => {
    const onSubmit = vi.fn();
    render(
      <SearchInput onSubmit={onSubmit} isLoading={false} disabled={false} />
    );
    fireEvent.submit(
      screen.getByPlaceholderText(/search expenses/i).closest("form")!
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("is disabled and shows a hint when disabled (offline)", () => {
    render(<SearchInput onSubmit={vi.fn()} isLoading={false} disabled />);
    expect(screen.getByPlaceholderText(/needs a connection/i)).toBeDisabled();
  });
});
