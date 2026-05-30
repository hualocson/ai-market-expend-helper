import React from "react";

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AIEntrySkeleton from "./AIEntrySkeleton";

describe("AIEntrySkeleton", () => {
  it("renders an expense-row-shaped placeholder", () => {
    const { container } = render(<AIEntrySkeleton input="Cà phê 35k" />);

    expect(
      container.querySelector("[data-ai-entry-skeleton]")
    ).toBeInTheDocument();
    expect(container).toHaveTextContent("Cà phê 35k");
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(
      0
    );
  });
});
