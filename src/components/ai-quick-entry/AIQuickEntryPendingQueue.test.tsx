import React from "react";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AIQuickEntryPendingQueue from "./AIQuickEntryPendingQueue";
import type { QuickEntry } from "./types";

const pending = (id: string, input: string): QuickEntry => ({
  id,
  input,
  status: "pending",
});

describe("AIQuickEntryPendingQueue", () => {
  it("renders nothing with no pending entries", () => {
    const { container } = render(
      <AIQuickEntryPendingQueue pendingEntries={[]} onOpenPreview={() => {}} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders one compact pending row", () => {
    render(
      <AIQuickEntryPendingQueue
        pendingEntries={[pending("1", "Cà phê 35k")]}
        onOpenPreview={() => {}}
      />
    );

    expect(screen.getByText("Cà phê 35k")).toBeInTheDocument();
    expect(
      screen.getByTestId("ai-quick-entry-amount-skeleton")
    ).toBeInTheDocument();
    expect(screen.queryByText(/more parsing/)).not.toBeInTheDocument();
  });

  it("renders two newest pending rows without overflow", () => {
    render(
      <AIQuickEntryPendingQueue
        pendingEntries={[pending("1", "Older"), pending("2", "Newest")]}
        onOpenPreview={() => {}}
      />
    );

    expect(screen.getByText("Newest")).toBeInTheDocument();
    expect(screen.getByText("Older")).toBeInTheDocument();
    expect(
      screen.getAllByTestId("ai-quick-entry-row").map((row) => row.textContent)
    ).toEqual(["Newest", "Older"]);
    expect(screen.queryByText(/more parsing/)).not.toBeInTheDocument();
  });

  it("renders two newest rows plus overflow when more than two are pending", () => {
    render(
      <AIQuickEntryPendingQueue
        pendingEntries={[
          pending("1", "First"),
          pending("2", "Second"),
          pending("3", "Third"),
          pending("4", "Newest"),
        ]}
        onOpenPreview={() => {}}
      />
    );

    expect(screen.getByText("Newest")).toBeInTheDocument();
    expect(screen.getByText("Third")).toBeInTheDocument();
    expect(
      screen.getAllByTestId("ai-quick-entry-row").map((row) => row.textContent)
    ).toEqual(["Newest", "Third"]);
    expect(screen.queryByText("Second")).not.toBeInTheDocument();
    expect(screen.queryByText("First")).not.toBeInTheDocument();
    expect(screen.getByText("+2 more parsing")).toBeInTheDocument();
  });

  it("opens preview when a pending row is tapped", () => {
    const onOpenPreview = vi.fn();

    render(
      <AIQuickEntryPendingQueue
        pendingEntries={[pending("1", "Cà phê 35k")]}
        onOpenPreview={onOpenPreview}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: /preview pending expense/i })
    );

    expect(onOpenPreview).toHaveBeenCalledTimes(1);
  });

  it("opens preview when the overflow row is tapped", () => {
    const onOpenPreview = vi.fn();

    render(
      <AIQuickEntryPendingQueue
        pendingEntries={[
          pending("1", "First"),
          pending("2", "Second"),
          pending("3", "Newest"),
        ]}
        onOpenPreview={onOpenPreview}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Preview 1 more parsing expense" })
    );

    expect(onOpenPreview).toHaveBeenCalledTimes(1);
  });

  it("keeps the overflow preview opener at least 44px tall", () => {
    render(
      <AIQuickEntryPendingQueue
        pendingEntries={[
          pending("1", "First"),
          pending("2", "Second"),
          pending("3", "Newest"),
        ]}
        onOpenPreview={() => {}}
      />
    );

    expect(
      screen.getByRole("button", { name: "Preview 1 more parsing expense" })
    ).toHaveClass("min-h-11");
  });
});
