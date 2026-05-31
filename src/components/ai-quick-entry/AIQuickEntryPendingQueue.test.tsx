import React from "react";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AIQuickEntryPendingQueue from "./AIQuickEntryPendingQueue";
import type { QuickEntry } from "./types";

const active = (id: string, input: string, createdAt: number): QuickEntry => ({
  id,
  input,
  status: "parsing",
  createdAt,
});

describe("AIQuickEntryPendingQueue", () => {
  it("renders nothing with no active entries", () => {
    const { container } = render(
      <AIQuickEntryPendingQueue activeEntries={[]} onOpenPreview={() => {}} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders one compact active row", () => {
    render(
      <AIQuickEntryPendingQueue
        activeEntries={[active("1", "Cà phê 35k", 1)]}
        onOpenPreview={() => {}}
      />
    );

    expect(screen.getByText("Cà phê 35k")).toBeInTheDocument();
    expect(
      screen.getByTestId("ai-quick-entry-amount-skeleton")
    ).toBeInTheDocument();
    expect(screen.queryByText(/more active/)).not.toBeInTheDocument();
  });

  it("renders two newest active rows without overflow", () => {
    render(
      <AIQuickEntryPendingQueue
        activeEntries={[active("1", "Older", 1), active("2", "Newest", 2)]}
        onOpenPreview={() => {}}
      />
    );

    expect(screen.getByText("Newest")).toBeInTheDocument();
    expect(screen.getByText("Older")).toBeInTheDocument();
    expect(
      screen.getAllByTestId("ai-quick-entry-row").map((row) => row.textContent)
    ).toEqual(["Newest", "Older"]);
    expect(screen.queryByText(/more active/)).not.toBeInTheDocument();
  });

  it("renders two newest rows plus overflow when more than two are active", () => {
    render(
      <AIQuickEntryPendingQueue
        activeEntries={[
          active("1", "First", 1),
          active("2", "Second", 2),
          active("3", "Third", 3),
          active("4", "Newest", 4),
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
    expect(screen.getByText("+2 more active")).toBeInTheDocument();
  });

  it("opens preview when an active row is tapped", () => {
    const onOpenPreview = vi.fn();

    render(
      <AIQuickEntryPendingQueue
        activeEntries={[active("1", "Cà phê 35k", 1)]}
        onOpenPreview={onOpenPreview}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: /preview active expense/i })
    );

    expect(onOpenPreview).toHaveBeenCalledTimes(1);
  });

  it("opens preview when the overflow row is tapped", () => {
    const onOpenPreview = vi.fn();

    render(
      <AIQuickEntryPendingQueue
        activeEntries={[
          active("1", "First", 1),
          active("2", "Second", 2),
          active("3", "Newest", 3),
        ]}
        onOpenPreview={onOpenPreview}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Preview 1 more active expense" })
    );

    expect(onOpenPreview).toHaveBeenCalledTimes(1);
  });

  it("keeps the overflow preview opener at least 44px tall", () => {
    render(
      <AIQuickEntryPendingQueue
        activeEntries={[
          active("1", "First", 1),
          active("2", "Second", 2),
          active("3", "Newest", 3),
        ]}
        onOpenPreview={() => {}}
      />
    );

    expect(
      screen.getByRole("button", { name: "Preview 1 more active expense" })
    ).toHaveClass("min-h-11");
  });
});
