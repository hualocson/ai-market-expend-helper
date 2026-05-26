import React from "react";

import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import Loading from "./loading";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

describe("Loading", () => {
  it("does not render the instant shell as a global route fallback", () => {
    const { container } = render(<Loading />);

    expect(container).toBeEmptyDOMElement();
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
    expect(source).not.toContain("InstantAppShell");
    expect(source).not.toContain("motion/react");
  });
});
