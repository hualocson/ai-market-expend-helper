import React from "react";

import { Category } from "@/enums";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AIQuickEntryRow from "./AIQuickEntryRow";
import type { QuickEntry } from "./types";

const resolvedEntry: QuickEntry = {
  id: "entry-1",
  input: "Cà phê 35k",
  status: "resolved",
  result: {
    id: -1,
    date: "2026-05-30",
    amount: 35000,
    note: "Cà phê 35k",
    category: Category.OTHER,
    paidBy: "Cubi",
    budgetId: null,
    budgetName: null,
    budgetIcon: null,
    budgetColor: null,
    syncStatus: "synced",
  },
};

describe("AIQuickEntryRow", () => {
  it("renders a pending entry as one compact row", () => {
    render(
      <AIQuickEntryRow
        entry={{ id: "entry-1", input: "Bánh mì 25k", status: "pending" }}
        variant="pending"
      />
    );

    expect(screen.getByTestId("ai-quick-entry-row")).toHaveAttribute(
      "data-variant",
      "pending"
    );
    expect(screen.getByText("Bánh mì 25k")).toBeInTheDocument();
    expect(
      screen.getByTestId("ai-quick-entry-amount-skeleton")
    ).toBeInTheDocument();
    expect(screen.queryByText("--")).toBeNull();
    expect(screen.queryByTestId("ai-quick-entry-row-secondary")).toBeNull();
  });

  it("renders a resolved entry with note and toast-style amount", () => {
    render(<AIQuickEntryRow entry={resolvedEntry} variant="resolved" />);

    expect(screen.getByTestId("ai-quick-entry-row")).toHaveAttribute(
      "data-variant",
      "resolved"
    );
    expect(screen.getByText("Cà phê 35k")).toBeInTheDocument();
    expect(screen.getByText("35.000")).toBeInTheDocument();
    expect(screen.queryByText("-35K")).toBeNull();
    expect(screen.queryByTestId("expense-row")).toBeNull();
  });

  it("falls back to the original input when a resolved note is empty", () => {
    render(
      <AIQuickEntryRow
        entry={{
          ...resolvedEntry,
          input: "Taxi 90k",
          result: { ...resolvedEntry.result!, note: "" },
        }}
        variant="resolved"
      />
    );

    expect(screen.getByText("Taxi 90k")).toBeInTheDocument();
  });

  it("renders a failed entry as one compact review row", () => {
    render(
      <AIQuickEntryRow
        entry={{
          id: "entry-2",
          input: "hard to parse",
          status: "failed",
          error: "Could not parse expense",
        }}
        variant="failed"
      />
    );

    expect(screen.getByTestId("ai-quick-entry-row")).toHaveAttribute(
      "data-variant",
      "failed"
    );
    expect(screen.getByText("hard to parse")).toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
  });
});
