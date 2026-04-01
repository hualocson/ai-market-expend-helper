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

  it("merges wrapper and mascot class overrides with the required base classes", () => {
    render(
      <DialogCompanionSlot
        className="slot-class"
        mascotClassName="mascot-class"
      />
    );

    expect(screen.getByTestId("dialog-companion-slot")).toHaveClass(
      "mx-auto",
      "mb-1",
      "flex",
      "h-20",
      "w-20",
      "absolute",
      "items-center",
      "justify-center",
      "slot-class"
    );
    expect(screen.getByTestId("idle-mascot")).toHaveClass(
      "absolute",
      "inset-0",
      "h-full",
      "w-full",
      "mascot-class"
    );
  });
});
