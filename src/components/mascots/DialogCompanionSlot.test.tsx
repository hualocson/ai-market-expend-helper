import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DialogCompanionSlot from "./DialogCompanionSlot";

describe("DialogCompanionSlot", () => {
  it("renders a default decorative idle mascot", () => {
    render(<DialogCompanionSlot />);

    expect(screen.getByTestId("dialog-companion-slot")).toBeInTheDocument();
    expect(screen.getByTestId("idle-mascot")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
    expect(screen.getByTestId("idle-mascot")).toHaveAttribute(
      "focusable",
      "false"
    );
  });
});
