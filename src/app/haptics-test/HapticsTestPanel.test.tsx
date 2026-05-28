import React from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HapticsTestPanel from "./HapticsTestPanel";

const { hapticsMock } = vi.hoisted(() => ({
  hapticsMock: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    selection: vi.fn(),
    impact: vi.fn(),
    trigger: vi.fn(),
  },
}));

vi.mock("@/hooks/useAppHaptics", () => ({
  useAppHaptics: () => hapticsMock,
}));

const originalGlobalReact = globalThis.React;

beforeEach(() => {
  globalThis.React = React;
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
  globalThis.React = originalGlobalReact;
});

describe("HapticsTestPanel", () => {
  it("triggers each haptic preset from its test button", async () => {
    const user = userEvent.setup();

    render(<HapticsTestPanel />);

    await user.click(screen.getByRole("button", { name: /success/i }));
    await user.click(screen.getByRole("button", { name: /warning/i }));
    await user.click(screen.getByRole("button", { name: /error/i }));
    await user.click(screen.getByRole("button", { name: /selection/i }));
    await user.click(screen.getByRole("button", { name: /light impact/i }));
    await user.click(screen.getByRole("button", { name: /medium impact/i }));
    await user.click(screen.getByRole("button", { name: /heavy impact/i }));
    await user.click(screen.getByRole("button", { name: /default trigger/i }));

    expect(hapticsMock.success).toHaveBeenCalledTimes(1);
    expect(hapticsMock.warning).toHaveBeenCalledTimes(1);
    expect(hapticsMock.error).toHaveBeenCalledTimes(1);
    expect(hapticsMock.selection).toHaveBeenCalledTimes(1);
    expect(hapticsMock.impact).toHaveBeenNthCalledWith(1, "light");
    expect(hapticsMock.impact).toHaveBeenNthCalledWith(2, "medium");
    expect(hapticsMock.impact).toHaveBeenNthCalledWith(3, "heavy");
    expect(hapticsMock.trigger).toHaveBeenCalledTimes(1);
  });
});
