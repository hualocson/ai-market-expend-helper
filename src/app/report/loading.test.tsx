import React from "react";

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Loading from "./loading";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

describe("Report loading", () => {
  it("renders skeleton placeholders as an instant fallback", () => {
    const { container } = render(<Loading />);
    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0);
  });
});
