import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

if (typeof Element !== "undefined") {
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
}

if (
  typeof window !== "undefined" &&
  typeof window.getComputedStyle === "function"
) {
  const originalGetComputedStyle = window.getComputedStyle.bind(window);
  window.getComputedStyle = ((
    ...args: Parameters<typeof originalGetComputedStyle>
  ) => {
    const style = originalGetComputedStyle(...args);
    if (style && (style.transform === undefined || style.transform === "")) {
      try {
        Object.defineProperty(style, "transform", {
          value: "none",
          configurable: true,
        });
      } catch {
        // jsdom may make some properties non-configurable; ignore.
      }
    }
    return style;
  }) as typeof window.getComputedStyle;
}

// jsdom does not implement URL.createObjectURL / revokeObjectURL.
// Provide stubs so tests can spy on them without "does not exist" errors.
if (typeof URL.createObjectURL === "undefined") {
  URL.createObjectURL = () => "";
}
if (typeof URL.revokeObjectURL === "undefined") {
  URL.revokeObjectURL = () => {};
}

afterEach(() => {
  cleanup();
});
