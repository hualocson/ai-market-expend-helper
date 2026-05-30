import React from "react";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AIQuickEntryPendingStack from "./AIQuickEntryPendingStack";
import type { QuickEntry } from "./types";

const pending = (id: string, input: string): QuickEntry => ({
  id,
  input,
  status: "pending",
});

describe("AIQuickEntryPendingStack", () => {
  it("renders nothing with no pending entries", () => {
    const { container } = render(
      <AIQuickEntryPendingStack
        pendingEntries={[]}
        expanded={false}
        onToggleExpanded={() => {}}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders one pending row without a hidden count", () => {
    render(
      <AIQuickEntryPendingStack
        pendingEntries={[pending("1", "Cà phê 35k")]}
        expanded={false}
        onToggleExpanded={() => {}}
      />
    );

    expect(screen.getByText("Cà phê 35k")).toBeInTheDocument();
    expect(screen.queryByText(/\+1 parsing/)).toBeNull();
  });

  it("collapses many pending entries to at most three visible stack cards", () => {
    render(
      <AIQuickEntryPendingStack
        pendingEntries={[
          pending("1", "First"),
          pending("2", "Second"),
          pending("3", "Third"),
          pending("4", "Newest"),
        ]}
        expanded={false}
        onToggleExpanded={() => {}}
      />
    );

    expect(screen.getByText("Newest")).toBeInTheDocument();
    expect(screen.queryByText("First")).toBeNull();
    expect(screen.getAllByTestId("ai-pending-stack-card")).toHaveLength(3);
    expect(screen.getByText("+3 parsing")).toBeInTheDocument();
  });

  it("toggles expansion when the collapsed stack is clicked", () => {
    const onToggleExpanded = vi.fn();

    render(
      <AIQuickEntryPendingStack
        pendingEntries={[pending("1", "First"), pending("2", "Newest")]}
        expanded={false}
        onToggleExpanded={onToggleExpanded}
      />
    );

    fireEvent.click(screen.getByRole("button"));

    expect(onToggleExpanded).toHaveBeenCalledTimes(1);
  });

  it("renders all pending rows in expanded state", () => {
    render(
      <AIQuickEntryPendingStack
        pendingEntries={[
          pending("1", "First"),
          pending("2", "Second"),
          pending("3", "Newest"),
        ]}
        expanded
        onToggleExpanded={() => {}}
      />
    );

    expect(screen.getByText("Newest")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
  });
});
