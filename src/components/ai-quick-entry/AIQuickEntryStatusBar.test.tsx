import React from "react";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AIQuickEntryStatusBar from "./AIQuickEntryStatusBar";

describe("AIQuickEntryStatusBar", () => {
  it("renders pending and completed counts without total count text", () => {
    render(
      <AIQuickEntryStatusBar
        totalCount={7}
        pendingCount={2}
        completedCount={5}
        failedCount={0}
        completedOpen={false}
        onToggleCompleted={() => {}}
      />
    );

    expect(
      screen.queryByTestId("ai-status-total-count")
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("ai-status-pending-count")).toHaveTextContent(
      "2"
    );
    expect(screen.getByTestId("ai-status-completed-count")).toHaveTextContent(
      "5"
    );
    expect(screen.getByRole("button")).not.toHaveTextContent("·");
    expect(screen.getByRole("button")).not.toHaveTextContent(
      /entries|parsing|done/
    );
    expect(screen.getByRole("button")).toHaveAccessibleName(
      "AI quick entry status: 2 parsing, 5 completed. Show completed entries."
    );
  });

  it("renders failed count when present", () => {
    render(
      <AIQuickEntryStatusBar
        totalCount={3}
        pendingCount={0}
        completedCount={2}
        failedCount={1}
        completedOpen={true}
        onToggleCompleted={() => {}}
      />
    );

    expect(
      screen.queryByTestId("ai-status-total-count")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("ai-status-pending-count")
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("ai-status-completed-count")).toHaveTextContent(
      "2"
    );
    expect(screen.getByTestId("ai-status-failed-count")).toHaveTextContent("1");
    expect(screen.getByRole("button")).not.toHaveTextContent("·");
    expect(screen.getByRole("button")).not.toHaveTextContent(
      /entries|done|failed/
    );
    expect(screen.getByRole("button")).toHaveAccessibleName(
      "AI quick entry status: 2 completed, 1 failed. Hide completed entries."
    );
  });

  it("renders as a compact dark island", () => {
    render(
      <AIQuickEntryStatusBar
        totalCount={2}
        pendingCount={1}
        completedCount={1}
        failedCount={0}
        completedOpen={false}
        onToggleCompleted={() => {}}
      />
    );

    expect(screen.getByRole("button")).toHaveClass(
      "glass-border",
      "ds-glass",
      "bg-amber-200/15",
      "min-w-[150px]",
      "text-white"
    );
  });

  it("calls onToggleCompleted when clicked", () => {
    const onToggleCompleted = vi.fn();

    render(
      <AIQuickEntryStatusBar
        totalCount={1}
        pendingCount={1}
        completedCount={0}
        failedCount={0}
        completedOpen={false}
        onToggleCompleted={onToggleCompleted}
      />
    );

    fireEvent.click(screen.getByRole("button"));

    expect(onToggleCompleted).toHaveBeenCalledTimes(1);
  });
});
