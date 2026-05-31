import React from "react";

import { Category, PaidBy } from "@/enums";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AIQuickEntryPreview from "./AIQuickEntryPreview";
import type { QuickEntry } from "./types";

const active = (id: string, input: string): QuickEntry => ({
  id,
  input,
  status: "parsing",
  createdAt: Number(id),
});

const saved = (id: string, input: string): QuickEntry => ({
  id,
  input,
  status: "saved",
  createdAt: Number(id),
  savedExpense: {
    id: Number(id),
    date: "31/05/2026",
    amount: 35000,
    note: input,
    category: Category.OTHER,
    paidBy: PaidBy.CUBI,
    budgetId: null,
    budgetName: null,
    budgetIcon: null,
    budgetColor: null,
    syncStatus: "synced",
  },
});

const needsReview = (id: string, input: string): QuickEntry => ({
  id,
  input,
  status: "needsReview",
  createdAt: Number(id),
  reviewDraft: {
    date: "31/05/2026",
    amount: 0,
    note: input,
    category: Category.FOOD,
    paidBy: PaidBy.CUBI,
    budgetId: null,
    budgetName: null,
    budgetIcon: null,
    budgetColor: null,
  },
  errorReason: "parse_error",
});

describe("AIQuickEntryPreview", () => {
  it("renders active, saved, and needs-review sections", () => {
    render(
      <AIQuickEntryPreview
        activeEntries={[active("1", "Cơm trưa 60k")]}
        savedEntries={[saved("2", "Cà phê 35k")]}
        reviewEntries={[needsReview("3", "bad input")]}
        onDone={() => {}}
        onSelectSavedEntry={() => {}}
        onSelectReviewEntry={() => {}}
      />
    );

    expect(screen.getByText("AI Quick Entry")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByText("Needs review")).toBeInTheDocument();
    expect(screen.getByText("Cơm trưa 60k")).toBeInTheDocument();
    expect(screen.getByText("Cà phê 35k")).toBeInTheDocument();
    expect(screen.getByText("bad input")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Parsing expense: Cơm trưa 60k")
    ).toHaveAttribute("data-variant", "active");
    expect(
      screen.getByTestId("ai-quick-entry-amount-skeleton")
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Saved expense: Cà phê 35k, 35.000")
    ).toHaveAttribute("data-variant", "saved");
    expect(screen.getByText("35.000")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Expense needs review: bad input")
    ).toHaveAttribute("data-variant", "needsReview");
    expect(screen.getByText("Review")).toBeInTheDocument();
  });

  it("hides empty sections", () => {
    render(
      <AIQuickEntryPreview
        activeEntries={[]}
        savedEntries={[saved("2", "Cà phê 35k")]}
        reviewEntries={[]}
        onDone={() => {}}
        onSelectSavedEntry={() => {}}
        onSelectReviewEntry={() => {}}
      />
    );

    expect(screen.queryByText("Active")).not.toBeInTheDocument();
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.queryByText("Needs review")).not.toBeInTheDocument();
  });

  it("calls onDone from the bottom X button", () => {
    const onDone = vi.fn();

    render(
      <AIQuickEntryPreview
        activeEntries={[active("1", "Cơm trưa 60k")]}
        savedEntries={[]}
        reviewEntries={[]}
        onDone={onDone}
        onSelectSavedEntry={() => {}}
        onSelectReviewEntry={() => {}}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Return to quick entry" })
    );

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("calls selection callbacks from saved and review rows", () => {
    const onSelectSavedEntry = vi.fn();
    const onSelectReviewEntry = vi.fn();
    const savedEntry = saved("2", "Cà phê 35k");
    const reviewEntry = needsReview("3", "bad input");

    render(
      <AIQuickEntryPreview
        activeEntries={[]}
        savedEntries={[savedEntry]}
        reviewEntries={[reviewEntry]}
        onDone={() => {}}
        onSelectSavedEntry={onSelectSavedEntry}
        onSelectReviewEntry={onSelectReviewEntry}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Edit saved expense Cà phê 35k/ })
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Review expense bad input/ })
    );

    expect(onSelectSavedEntry).toHaveBeenCalledWith(savedEntry);
    expect(onSelectReviewEntry).toHaveBeenCalledWith(reviewEntry);
  });
});
