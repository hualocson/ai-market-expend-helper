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
  it("renders the wheel picker with all paid-by labels", () => {
    renderSheet();
    expect(screen.getAllByText(PaidBy.CUBI).length).toBeGreaterThan(0);
    expect(screen.getAllByText(PaidBy.EMBE).length).toBeGreaterThan(0);
    expect(screen.getAllByText(PaidBy.OTHER).length).toBeGreaterThan(0);
  });

  it("Done button commits the initial value and closes", async () => {
    const user = userEvent.setup();
    const { onChange, onOpenChange } = renderSheet();
    await user.click(screen.getByRole("button", { name: /done/i }));
    expect(onChange).toHaveBeenCalledWith(PaidBy.CUBI);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders a Done button", () => {
    renderSheet();
    expect(screen.getByRole("button", { name: /done/i })).toBeInTheDocument();
  });
});
