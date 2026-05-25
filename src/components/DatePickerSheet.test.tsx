import React from "react";

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import DatePickerSheet from "./DatePickerSheet";

vi.mock("@/components/ui/date-picker", () => ({
  default: ({
    value,
    onChange,
  }: {
    value?: Date;
    onChange?: (date: Date | undefined) => void;
  }) => (
    <button type="button" onClick={() => onChange?.(new Date(2026, 4, 20))}>
      Pick mocked date {value?.getDate()}
    </button>
  ),
}));

const renderSheet = (
  override: Partial<React.ComponentProps<typeof DatePickerSheet>> = {}
) => {
  const onChange = vi.fn();
  const onOpenChange = vi.fn();
  const utils = render(
    <DatePickerSheet
      open
      onOpenChange={onOpenChange}
      value="19/05/2026"
      onChange={onChange}
      {...override}
    />
  );
  return { ...utils, onChange, onOpenChange };
};

describe("DatePickerSheet", () => {
  it("renders the date picker drawer and Done button", () => {
    renderSheet();

    expect(screen.getByRole("heading", { name: "Date" })).toBeInTheDocument();
    expect(screen.getByText("Pick the expense date.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /pick mocked date 19/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /done/i })).toBeInTheDocument();
  });

  it("stages date changes until Done is clicked", async () => {
    const user = userEvent.setup();
    const { onChange, onOpenChange } = renderSheet();

    await user.click(screen.getByRole("button", { name: /pick mocked date/i }));

    expect(onChange).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);

    await user.click(screen.getByRole("button", { name: /done/i }));

    expect(onChange).toHaveBeenCalledWith("20/05/2026");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("requests focus restoration from the Done click path", async () => {
    const user = userEvent.setup();
    const onRestoreFocusRequest = vi.fn();

    renderSheet({ onRestoreFocusRequest });

    await user.click(screen.getByRole("button", { name: /done/i }));

    expect(onRestoreFocusRequest).toHaveBeenCalledTimes(1);
  });

  it("requests focus restoration from outside pointer dismissal", () => {
    const onRestoreFocusRequest = vi.fn();
    const { onOpenChange } = renderSheet({ onRestoreFocusRequest });

    fireEvent.pointerDown(
      document.querySelector('[data-slot="sheet-overlay"]')!,
      {
        button: 0,
      }
    );

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onRestoreFocusRequest).toHaveBeenCalledTimes(1);
  });

  it("resets the pending date from value when reopened", async () => {
    const user = userEvent.setup();
    const { rerender } = renderSheet();

    await user.click(screen.getByRole("button", { name: /pick mocked date/i }));

    rerender(
      <DatePickerSheet
        open={false}
        onOpenChange={vi.fn()}
        value="21/05/2026"
        onChange={vi.fn()}
      />
    );
    rerender(
      <DatePickerSheet
        open
        onOpenChange={vi.fn()}
        value="21/05/2026"
        onChange={vi.fn()}
      />
    );

    expect(
      screen.getByRole("button", { name: /pick mocked date 21/i })
    ).toBeInTheDocument();
  });
});
