import React from "react";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AIQuickEntryStatusBar from "./AIQuickEntryStatusBar";

describe("AIQuickEntryStatusBar", () => {
  it("renders total, pending, and completed counts", () => {
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

    expect(screen.getByRole("button")).toHaveTextContent(
      "7 entries · 2 parsing · 5 done"
    );
    expect(screen.getByRole("button")).toHaveAccessibleName(
      "AI quick entry status: 7 entries, 2 parsing, 5 completed. Show completed entries."
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

    expect(screen.getByRole("button")).toHaveTextContent(
      "3 entries · 2 done · 1 failed"
    );
    expect(screen.getByRole("button")).toHaveAccessibleName(
      "AI quick entry status: 3 entries, 2 completed, 1 failed. Hide completed entries."
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
