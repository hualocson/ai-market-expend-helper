import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAppHaptics } from "./useAppHaptics";

const { triggerMock } = vi.hoisted(() => ({
  triggerMock: vi.fn(),
}));

vi.mock("web-haptics/react", () => ({
  useWebHaptics: () => ({
    trigger: triggerMock,
  }),
}));

beforeEach(() => {
  triggerMock.mockReset();
});

describe("useAppHaptics", () => {
  it("maps notification and selection methods to web-haptics presets", () => {
    const { result } = renderHook(() => useAppHaptics());

    act(() => {
      result.current.success();
      result.current.warning();
      result.current.error();
      result.current.selection();
    });

    expect(triggerMock).toHaveBeenNthCalledWith(1, "success");
    expect(triggerMock).toHaveBeenNthCalledWith(2, "warning");
    expect(triggerMock).toHaveBeenNthCalledWith(3, "error");
    expect(triggerMock).toHaveBeenNthCalledWith(4, "selection");
  });

  it("maps impact levels and the direct trigger method", () => {
    const { result } = renderHook(() => useAppHaptics());

    act(() => {
      result.current.impact("light");
      result.current.impact();
      result.current.trigger("heavy");
    });

    expect(triggerMock).toHaveBeenNthCalledWith(1, "light");
    expect(triggerMock).toHaveBeenNthCalledWith(2, "medium");
    expect(triggerMock).toHaveBeenNthCalledWith(3, "heavy");
  });
});
