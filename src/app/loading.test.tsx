import React from "react";

import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import Loading from "./loading";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

describe("Loading", () => {
  it("renders the inert shell fallback", () => {
    render(<Loading />);

    expect(screen.getByTestId("instant-app-shell")).toBeInTheDocument();
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
