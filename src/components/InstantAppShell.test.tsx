import React from "react";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import InstantAppShell from "./InstantAppShell";

describe("InstantAppShell", () => {
  it("renders an inert aria-hidden shell with the expected placeholders", () => {
    const { container } = render(<InstantAppShell />);

    expect(screen.getByTestId("instant-app-shell")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
    expect(screen.getByTestId("instant-app-shell")).toHaveAttribute(
      "id",
      "instant-app-shell"
    );
    expect(screen.getByTestId("instant-app-shell")).toHaveAttribute(
      "data-instant-shell-root",
      "true"
    );
    expect(screen.getByTestId("instant-shell-total")).toBeInTheDocument();
    expect(screen.getAllByTestId("instant-shell-row")).toHaveLength(3);
    expect(
      container.querySelectorAll(
        'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).toHaveLength(0);
  });
});
