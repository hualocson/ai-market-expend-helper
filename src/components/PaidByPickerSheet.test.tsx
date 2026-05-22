import React from "react";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PaidBy } from "@/enums";
import PaidByPickerSheet from "./PaidByPickerSheet";

const renderSheet = (
  override: Partial<React.ComponentProps<typeof PaidByPickerSheet>> = {}
) => {
  const onChange = vi.fn();
  const onOpenChange = vi.fn();
  const utils = render(
    <PaidByPickerSheet
      open
      onOpenChange={onOpenChange}
      value={PaidBy.CUBI}
      onChange={onChange}
      {...override}
    />
  );
  return { ...utils, onChange, onOpenChange };
};

describe("PaidByPickerSheet", () => {
  it("renders all paid-by options", () => {
    renderSheet();
    expect(screen.getByRole("button", { name: /Cubi/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Embe/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Other/ })).toBeInTheDocument();
  });

  it("calls onChange and closes on select", async () => {
    const user = userEvent.setup();
    const { onChange, onOpenChange } = renderSheet();
    await user.click(screen.getByRole("button", { name: /Embe/ }));
    expect(onChange).toHaveBeenCalledWith(PaidBy.EMBE);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("marks active row with aria-pressed", () => {
    renderSheet({ value: PaidBy.OTHER });
    expect(screen.getByRole("button", { name: /Other/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: /Cubi/ })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });
});
