import React from "react";

import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PullToRefresh } from "./PullToRefresh";

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

const setMobileViewport = () => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 390,
  });
  Object.defineProperty(navigator, "maxTouchPoints", {
    configurable: true,
    value: 1,
  });
};

const dispatchTouch = (
  type: "touchstart" | "touchmove" | "touchend",
  clientY: number
) => {
  const event = new Event(type, {
    bubbles: true,
    cancelable: type === "touchmove",
  }) as Event & { touches: Array<{ clientY: number }> };

  Object.defineProperty(event, "touches", {
    configurable: true,
    value: type === "touchend" ? [] : [{ clientY }],
  });

  act(() => {
    document.dispatchEvent(event);
  });
};

beforeEach(() => {
  setMobileViewport();
  vi.spyOn(window, "scrollY", "get").mockReturnValue(0);
});

afterEach(() => {
  hapticsMock.success.mockReset();
  hapticsMock.warning.mockReset();
  hapticsMock.error.mockReset();
  hapticsMock.selection.mockReset();
  hapticsMock.impact.mockReset();
  hapticsMock.trigger.mockReset();
  vi.restoreAllMocks();
});

describe("PullToRefresh", () => {
  it("triggers one light impact when the pull crosses the refresh threshold", () => {
    render(
      <PullToRefresh>
        <main>Content</main>
      </PullToRefresh>
    );

    expect(screen.getByText("Content")).toBeInTheDocument();

    dispatchTouch("touchstart", 0);
    dispatchTouch("touchmove", 180);
    dispatchTouch("touchmove", 220);

    expect(hapticsMock.impact).toHaveBeenCalledTimes(1);
    expect(hapticsMock.impact).toHaveBeenCalledWith("light");
  });
});
