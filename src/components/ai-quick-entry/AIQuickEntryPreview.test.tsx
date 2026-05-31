import React from "react";

import { Category } from "@/enums";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AIQuickEntryPreview from "./AIQuickEntryPreview";
import type { QuickEntry } from "./types";

const pending = (id: string, input: string): QuickEntry => ({
  id,
  input,
  status: "pending",
});

const resolved = (id: string, input: string): QuickEntry => ({
  id,
  input,
  status: "resolved",
  result: {
    id: Number(id),
    date: "2026-05-31",
    amount: 35000,
    note: input,
    category: Category.OTHER,
    paidBy: "Cubi",
    budgetId: null,
    budgetName: null,
    budgetIcon: null,
    budgetColor: null,
    syncStatus: "synced",
  },
});

const failed = (id: string, input: string): QuickEntry => ({
  id,
  input,
  status: "failed",
  error: "Could not parse expense",
});

describe("AIQuickEntryPreview", () => {
  it("renders pending, completed, and failed sections", () => {
    render(
      <AIQuickEntryPreview
        pendingEntries={[pending("1", "Cơm trưa 60k")]}
        completedEntries={[resolved("2", "Cà phê 35k")]}
        failedEntries={[failed("3", "bad input")]}
        onDone={() => {}}
      />
    );

    expect(screen.getByText("AI Quick Entry")).toBeInTheDocument();
    expect(screen.getByText("Parsing")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Needs review")).toBeInTheDocument();
    expect(screen.getByText("Cơm trưa 60k")).toBeInTheDocument();
    expect(screen.getByText("Cà phê 35k")).toBeInTheDocument();
    expect(screen.getByText("bad input")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Parsing expense: Cơm trưa 60k")
    ).toHaveAttribute("data-variant", "pending");
    expect(
      screen.getByTestId("ai-quick-entry-amount-skeleton")
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Parsed expense: Cà phê 35k, 35.000")
    ).toHaveAttribute("data-variant", "resolved");
    expect(screen.getByText("35.000")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Expense needs review: bad input")
    ).toHaveAttribute("data-variant", "failed");
    expect(screen.getByText("Review")).toBeInTheDocument();
  });

  it("hides empty sections", () => {
    render(
      <AIQuickEntryPreview
        pendingEntries={[]}
        completedEntries={[resolved("2", "Cà phê 35k")]}
        failedEntries={[]}
        onDone={() => {}}
      />
    );

    expect(screen.queryByText("Parsing")).not.toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.queryByText("Needs review")).not.toBeInTheDocument();
  });

  it("calls onDone from the bottom X button", () => {
    const onDone = vi.fn();

    render(
      <AIQuickEntryPreview
        pendingEntries={[pending("1", "Cơm trưa 60k")]}
        completedEntries={[]}
        failedEntries={[]}
        onDone={onDone}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Return to quick entry" })
    );

    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
