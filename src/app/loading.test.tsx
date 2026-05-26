import React from "react";

import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import Loading from "./loading";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

describe("Loading", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-instant-shell-hydrated");
  });

  it("renders the inert shell fallback", () => {
    render(<Loading />);

    expect(screen.getByTestId("instant-app-shell")).toBeInTheDocument();
  });

  it("uses a route-loading shell that stays distinct from the hydrated root shell", () => {
    document.documentElement.dataset.instantShellHydrated = "true";

    render(<Loading />);

    const shell = screen.getByTestId("instant-app-shell");
    expect(shell).toHaveAttribute("id", "instant-app-loading-shell");
    expect(shell).not.toHaveAttribute("data-instant-shell-root");
  });

  it("keeps the hydrated hide rule scoped to the root instant shell", () => {
    const css = readFileSync(
      join(process.cwd(), "src/app/globals.css"),
      "utf8"
    );

    expect(css).toContain(
      'html[data-instant-shell-hydrated="true"]\n' +
        '  #instant-app-shell[data-instant-shell-root="true"]'
    );
    expect(css).not.toContain(
      'html[data-instant-shell-hydrated="true"] .instant-app-shell'
    );
  });

  it("does not import motion/react", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/loading.tsx"),
      "utf8"
    );

    expect(source).not.toContain('"use client"');
    expect(source).not.toContain("motion/react");
  });
});
