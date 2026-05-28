import React from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CompactBottomNavPreview from "./CompactBottomNavPreview";

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

describe("CompactBottomNavPreview", () => {
  it("renders collapsed primary controls and the add expense trigger", () => {
    render(<CompactBottomNavPreview />);

    expect(screen.getByRole("link", { name: /home/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /budgets/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /expand navigation/i })
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("link", { name: /reports/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /settings/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add expense/i })
    ).toBeInTheDocument();
  });

  it("expands and collapses the secondary report and settings controls", async () => {
    const user = userEvent.setup();

    render(<CompactBottomNavPreview />);

    const expandButton = screen.getByRole("button", {
      name: /expand navigation/i,
    });

    await user.click(expandButton);

    expect(
      screen.getByRole("button", { name: /collapse navigation/i })
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: /reports/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /settings/i })).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /collapse navigation/i })
    );

    expect(
      screen.getByRole("button", { name: /expand navigation/i })
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("link", { name: /reports/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /settings/i })
    ).not.toBeInTheDocument();
  });

  it("marks the active route with aria-current", async () => {
    const user = userEvent.setup();
    pathnameState.value = "/report/day/2026-05-28";

    render(<CompactBottomNavPreview />);

    await user.click(
      screen.getByRole("button", { name: /expand navigation/i })
    );

    expect(screen.getByRole("link", { name: /reports/i })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("link", { name: /home/i })).not.toHaveAttribute(
      "aria-current"
    );
  });

  it.each([
    {
      pathname: "/budgets-old",
      linkName: /budgets/i,
      expand: false,
    },
    {
      pathname: "/reporting",
      linkName: /reports/i,
      expand: true,
    },
    {
      pathname: "/settings-old",
      linkName: /settings/i,
      expand: true,
    },
  ])(
    "does not mark sibling route $pathname as active",
    async ({ pathname, linkName, expand }) => {
      const user = userEvent.setup();
      pathnameState.value = pathname;

      render(<CompactBottomNavPreview />);

      if (expand) {
        await user.click(
          screen.getByRole("button", { name: /expand navigation/i })
        );
      }

      expect(screen.getByRole("link", { name: linkName })).not.toHaveAttribute(
        "aria-current"
      );
    }
  );

  it("triggers medium impact haptics when add expense is clicked", async () => {
    const user = userEvent.setup();

    render(<CompactBottomNavPreview />);

    await user.click(screen.getByRole("button", { name: /add expense/i }));

    expect(hapticsMock.impact).toHaveBeenCalledTimes(1);
    expect(hapticsMock.impact).toHaveBeenCalledWith("medium");
  });
});
