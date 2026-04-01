import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DialogCompanionSlot from "./DialogCompanionSlot";

describe("DialogCompanionSlot", () => {
  it("renders a decorative idle mascot with passthrough classes", () => {
    render(
      <DialogCompanionSlot
        className="slot-class"
        mascotClassName="mascot-class"
      />
    );

    const slot = screen.getByTestId("dialog-companion-slot");
    const mascot = screen.getByTestId("idle-mascot");

    expect(slot).toHaveClass("slot-class");
    expect(mascot).toHaveClass("mascot-class");
    expect(mascot).toHaveAttribute("aria-hidden", "true");
    expect(mascot).toHaveAttribute("focusable", "false");
  });
});
