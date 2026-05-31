import React from "react";

import { Category, PaidBy } from "@/enums";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AIQuickEntryRow from "./AIQuickEntryRow";
import type { QuickEntry } from "./types";

const savedEntry: QuickEntry = {
  id: "entry-1",
  input: "Cà phê 35k",
  status: "saved",
  createdAt: 1,
  savedExpense: {
    id: -1,
    date: "30/05/2026",
    amount: 35000,
    note: "Cà phê 35k",
    category: Category.OTHER,
    paidBy: PaidBy.CUBI,
    budgetId: null,
    budgetName: null,
    budgetIcon: null,
    budgetColor: null,
    syncStatus: "synced",
  },
};

describe("AIQuickEntryRow", () => {
  it("renders a parsing entry as one compact active row", () => {
    render(
      <AIQuickEntryRow
        entry={{
          id: "entry-1",
          input: "Bánh mì 25k",
          status: "parsing",
          createdAt: 1,
        }}
        variant="active"
      />
    );

    expect(screen.getByTestId("ai-quick-entry-row")).toHaveAttribute(
      "data-variant",
      "active"
    );
    expect(screen.getByText("Bánh mì 25k")).toBeInTheDocument();
    expect(
      screen.getByTestId("ai-quick-entry-amount-skeleton")
    ).toBeInTheDocument();
    expect(screen.queryByText("--")).toBeNull();
    expect(screen.queryByTestId("ai-quick-entry-row-secondary")).toBeNull();
    expect(screen.getByLabelText("Parsing expense: Bánh mì 25k")).toBeVisible();
  });

  it("renders a saving active entry with a saving label", () => {
    render(
      <AIQuickEntryRow
        entry={{
          ...savedEntry,
          status: "saving",
          savedExpense: undefined,
          reviewDraft: savedEntry.savedExpense,
        }}
        variant="active"
      />
    );

    expect(screen.getByText("Saving")).toBeInTheDocument();
    expect(screen.queryByTestId("ai-quick-entry-amount-skeleton")).toBeNull();
    expect(screen.getByLabelText("Saving expense: Cà phê 35k")).toBeVisible();
  });

  it("renders a saved entry with note and toast-style amount", () => {
    render(<AIQuickEntryRow entry={savedEntry} variant="saved" />);

    expect(screen.getByTestId("ai-quick-entry-row")).toHaveAttribute(
      "data-variant",
      "saved"
    );
    expect(screen.getByText("Cà phê 35k")).toBeInTheDocument();
    expect(screen.getByText("35.000")).toBeInTheDocument();
    expect(screen.queryByText("-35K")).toBeNull();
    expect(screen.queryByTestId("expense-row")).toBeNull();
  });

  it("uses the budget icon for a saved entry with a budget", () => {
    render(
      <AIQuickEntryRow
        entry={{
          ...savedEntry,
          savedExpense: {
            ...savedEntry.savedExpense!,
            budgetId: 2,
            budgetName: "Cà phê",
            budgetIcon: "☕",
            budgetColor: "lime",
          },
        }}
        variant="saved"
      />
    );

    expect(screen.getByText("☕")).toBeInTheDocument();
  });

  it("falls back to the original input when a saved note is empty", () => {
    render(
      <AIQuickEntryRow
        entry={{
          ...savedEntry,
          input: "Taxi 90k",
          savedExpense: { ...savedEntry.savedExpense!, note: "" },
        }}
        variant="saved"
      />
    );

    expect(screen.getByText("Taxi 90k")).toBeInTheDocument();
  });

  it("renders a needs-review entry as one compact review row", () => {
    render(
      <AIQuickEntryRow
        entry={{
          id: "entry-2",
          input: "hard to parse",
          status: "needsReview",
          createdAt: 1,
          reviewDraft: {
            date: "30/05/2026",
            amount: 0,
            note: "hard to parse",
            category: Category.FOOD,
            paidBy: PaidBy.CUBI,
            budgetId: null,
            budgetName: null,
            budgetIcon: null,
            budgetColor: null,
          },
          errorReason: "parse_error",
        }}
        variant="needsReview"
      />
    );

    expect(screen.getByTestId("ai-quick-entry-row")).toHaveAttribute(
      "data-variant",
      "needsReview"
    );
    expect(screen.getByText("hard to parse")).toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Expense needs review: hard to parse")
    ).toBeVisible();
  });
});
