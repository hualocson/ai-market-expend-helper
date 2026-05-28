import React from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import BottomNav from "./BottomNav";

const { hapticsMock, pathnameState } = vi.hoisted(() => ({
  hapticsMock: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    selection: vi.fn(),
    impact: vi.fn(),
    trigger: vi.fn(),
  },
  pathnameState: {
    value: "/",
  },
}));

vi.mock("@/hooks/useAppHaptics", () => ({
  useAppHaptics: () => hapticsMock,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameState.value,
}));

vi.mock("@/components/QuickExpenseDrawer", () => ({
  default: ({
    onTriggerClick,
  }: {
    compact?: boolean;
    onTriggerClick?: () => void;
  }) => (
    <button type="button" onClick={onTriggerClick}>
      Add expense
    </button>
  ),
}));

const originalGlobalReact = (globalThis as unknown as Record<string, unknown>)
  .React;

beforeEach(() => {
  (globalThis as unknown as Record<string, unknown>).React = React;
  pathnameState.value = "/";
  hapticsMock.success.mockReset();
  hapticsMock.warning.mockReset();
  hapticsMock.error.mockReset();
  hapticsMock.selection.mockReset();
  hapticsMock.impact.mockReset();
  hapticsMock.trigger.mockReset();
});

afterEach(() => {
  if (typeof originalGlobalReact === "undefined") {
    Reflect.deleteProperty(globalThis, "React");
    return;
  }
  (globalThis as unknown as Record<string, unknown>).React =
    originalGlobalReact;
});

describe("BottomNav", () => {
  it("does not render on the compact bottom nav preview route", () => {
    pathnameState.value = "/dev/bottom-nav";

    render(<BottomNav />);

    expect(screen.queryByRole("navigation", { name: /primary/i })).toBeNull();
  });

  it("triggers medium impact haptics when the add expense button is clicked", async () => {
    const user = userEvent.setup();

    render(<BottomNav />);

    await user.click(screen.getByRole("button", { name: /add expense/i }));

    expect(hapticsMock.impact).toHaveBeenCalledTimes(1);
    expect(hapticsMock.impact).toHaveBeenCalledWith("medium");
  });

  it("only marks section links active for exact or child routes", () => {
    pathnameState.value = "/reporting";

    const { rerender } = render(<BottomNav />);

    expect(screen.getByRole("link", { name: /reports/i })).not.toHaveAttribute(
      "aria-current"
    );

    pathnameState.value = "/report/weekly";
    rerender(<BottomNav />);

    expect(screen.getByRole("link", { name: /reports/i })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });
});
