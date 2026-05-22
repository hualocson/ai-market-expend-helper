import { renderHook } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it } from "vitest";

import { useAutoShrinkFont } from "./useAutoShrinkFont";

const setup = (scrollWidth: number, clientWidth: number) => {
  const input = document.createElement("input");
  Object.defineProperty(input, "scrollWidth", { value: scrollWidth, configurable: true });
  Object.defineProperty(input, "clientWidth", { value: clientWidth, configurable: true });
  document.body.appendChild(input);
  return input;
};

describe("useAutoShrinkFont", () => {
  it("does nothing when content fits", () => {
    const input = setup(100, 200);
    renderHook(() => {
      const ref = useRef(input);
      useAutoShrinkFont(ref, { max: 16, min: 11, step: 1 });
      return null;
    });
    expect(input.style.fontSize).toBe("16px");
  });

  it("shrinks step-by-step until content fits or floor reached", () => {
    const input = setup(400, 100);
    renderHook(() => {
      const ref = useRef(input);
      useAutoShrinkFont(ref, { max: 16, min: 11, step: 1 });
      return null;
    });
    expect(input.style.fontSize).toBe("11px");
  });

  it("re-applies on input event", () => {
    const input = setup(400, 100);
    renderHook(() => {
      const ref = useRef(input);
      useAutoShrinkFont(ref, { max: 16, min: 11, step: 1 });
      return null;
    });
    expect(input.style.fontSize).toBe("11px");

    Object.defineProperty(input, "scrollWidth", { value: 50, configurable: true });
    input.dispatchEvent(new Event("input"));
    expect(input.style.fontSize).toBe("16px");
  });
});
