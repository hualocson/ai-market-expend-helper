import React from "react";

import { useAIQuickEntryStore } from "@/stores/ai-quick-entry-store";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import BottomNav from "./BottomNav";

const { hapticsMock, pathnameState, routerPushMock } = vi.hoisted(() => ({
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
  routerPushMock: vi.fn(),
}));

vi.mock("@/hooks/useAppHaptics", () => ({
  useAppHaptics: () => hapticsMock,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameState.value,
  useRouter: () => ({
    push: routerPushMock,
  }),
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
  routerPushMock.mockReset();
  hapticsMock.success.mockReset();
  hapticsMock.warning.mockReset();
  hapticsMock.error.mockReset();
  hapticsMock.selection.mockReset();
  hapticsMock.impact.mockReset();
  hapticsMock.trigger.mockReset();
  useAIQuickEntryStore.getState().setOpen(false);
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
  it("does not render on hidden routes", () => {
    pathnameState.value = "/ai";

    render(<BottomNav />);

    expect(screen.queryByRole("navigation", { name: /primary/i })).toBeNull();
  });

  it("renders collapsed primary controls as buttons", () => {
    render(<BottomNav />);

    expect(screen.getByRole("button", { name: /home/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: /^budget$/i })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(
      screen.getByRole("button", { name: /expand navigation/i })
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("button", { name: /^report$/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add expense/i })
    ).toBeInTheDocument();
  });

  it("pushes routes from collapsed nav buttons and updates local active state", async () => {
    const user = userEvent.setup();

    render(<BottomNav />);

    await user.click(screen.getByRole("button", { name: /^budget$/i }));

    expect(routerPushMock).toHaveBeenCalledTimes(1);
    expect(routerPushMock).toHaveBeenCalledWith("/budgets");
    expect(screen.getByRole("button", { name: /^budget$/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: /home/i })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("expands into a vertical menu and pushes routes from expanded items", async () => {
    const user = userEvent.setup();

    render(<BottomNav />);

    await user.click(
      screen.getByRole("button", { name: /expand navigation/i })
    );

    const menuButtons = screen
      .getAllByRole("button")
      .filter((button) =>
        ["Home", "Budget", "Report", "Settings"].includes(
          button.getAttribute("aria-label") ?? ""
        )
      );

    expect(
      menuButtons.map((button) => button.getAttribute("aria-label"))
    ).toEqual(["Home", "Budget", "Report", "Settings"]);

    await user.click(screen.getByRole("button", { name: /^report$/i }));

    expect(routerPushMock).toHaveBeenCalledWith("/report");
    expect(
      screen.getByRole("button", { name: /expand navigation/i })
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("button", { name: /^report$/i })
    ).not.toBeInTheDocument();
  });

  it("syncs local active state from the current route", async () => {
    const user = userEvent.setup();
    pathnameState.value = "/report/weekly";

    const { rerender } = render(<BottomNav />);

    await user.click(
      screen.getByRole("button", { name: /expand navigation/i })
    );

    expect(screen.getByRole("button", { name: /^report$/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    pathnameState.value = "/reporting";
    rerender(<BottomNav />);

    expect(screen.getByRole("button", { name: /^report$/i })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("closes the expanded menu when clicking outside", async () => {
    const user = userEvent.setup();

    render(
      <>
        <button type="button">Outside target</button>
        <BottomNav />
      </>
    );

    await user.click(
      screen.getByRole("button", { name: /expand navigation/i })
    );

    await user.click(screen.getByRole("button", { name: /outside target/i }));

    expect(
      screen.getByRole("button", { name: /expand navigation/i })
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("button", { name: /^report$/i })
    ).not.toBeInTheDocument();
  });

  it("triggers medium impact haptics when the add expense button is clicked", async () => {
    const user = userEvent.setup();

    render(<BottomNav />);

    await user.click(screen.getByRole("button", { name: /add expense/i }));

    expect(hapticsMock.impact).toHaveBeenCalledTimes(1);
    expect(hapticsMock.impact).toHaveBeenCalledWith("medium");
  });

  it("opens AI quick entry when the AI button is tapped", async () => {
    const user = userEvent.setup();

    render(<BottomNav />);

    await user.click(
      screen.getByRole("button", { name: /open ai quick entry/i })
    );

    expect(useAIQuickEntryStore.getState().open).toBe(true);
    expect(hapticsMock.impact).toHaveBeenCalledWith("medium");
  });

  it("renders the AI button before the Add button", () => {
    render(<BottomNav />);

    const aiButton = screen.getByRole("button", {
      name: /open ai quick entry/i,
    });
    const addButton = screen.getByRole("button", { name: /add expense/i });

    expect(
      aiButton.compareDocumentPosition(addButton) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});
