import React from "react";

import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import RouteTransition from "./RouteTransition";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

vi.mock("next/navigation", () => ({
  usePathname: () => "/report",
}));

describe("RouteTransition", () => {
  it("wraps children in an animated container keyed by pathname", () => {
    render(
      <RouteTransition>
        <p>page content</p>
      </RouteTransition>
    );
    const child = screen.getByText("page content");
    expect(child.parentElement).toHaveClass("route-transition");
  });

  it("defines the keyframe and respects reduced motion", () => {
    const css = readFileSync(
      join(process.cwd(), "src/app/globals.css"),
      "utf8"
    );
    expect(css).toContain("@keyframes route-transition-enter");
    expect(css).toContain("prefers-reduced-motion: reduce");
  });
});
