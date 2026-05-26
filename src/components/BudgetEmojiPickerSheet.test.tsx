import React from "react";
import type { ReactNode } from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import BudgetEmojiPickerSheet from "./BudgetEmojiPickerSheet";

vi.mock("next/dynamic", () => ({
  default: () =>
    function MockDynamicEmojiPicker({
      onEmojiClick,
    }: {
      onEmojiClick: (emoji: { emoji: string }) => void;
    }) {
      return (
        <button type="button" onClick={() => onEmojiClick({ emoji: "🛒" })}>
          Pick cart emoji
        </button>
      );
    },
}));

vi.mock("emoji-picker-react", () => ({
  EmojiStyle: {
    APPLE: "apple",
    NATIVE: "native",
  },
  Theme: {
    DARK: "dark",
  },
  default: () => null,
}));

vi.mock("@/components/ui/sheet", () => {
  const SheetContext = React.createContext<{
    open: boolean;
    onOpenChange: (open: boolean) => void;
  } | null>(null);

  const Sheet = ({
    children,
    open: controlledOpen,
    onOpenChange,
  }: {
    children: ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => {
    const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
    const open = controlledOpen ?? uncontrolledOpen;
    const setOpen = onOpenChange ?? setUncontrolledOpen;

    return (
      <SheetContext.Provider value={{ open, onOpenChange: setOpen }}>
        <div>{children}</div>
      </SheetContext.Provider>
    );
  };

  const SheetTrigger = ({ children }: { children: ReactNode }) => {
    const sheet = React.useContext(SheetContext);

    if (!React.isValidElement(children)) {
      return null;
    }

    const child = children as React.ReactElement<
      React.HTMLAttributes<HTMLElement>
    >;

    return React.cloneElement(child, {
      onClick: (event: React.MouseEvent<HTMLElement>) => {
        child.props.onClick?.(event);
        sheet?.onOpenChange(true);
      },
    } as Partial<React.HTMLAttributes<HTMLElement>>);
  };

  const SheetContent = ({ children }: { children: ReactNode }) => {
    const sheet = React.useContext(SheetContext);

    if (!sheet?.open) {
      return null;
    }

    return <div role="dialog">{children}</div>;
  };

  const wrap = (Tag: "div" | "h2") => {
    function WrappedComponent({ children }: { children: ReactNode }) {
      return <Tag>{children}</Tag>;
    }

    return WrappedComponent;
  };

  return {
    Sheet,
    SheetTrigger,
    SheetContent,
    SheetDescription: wrap("div"),
    SheetHeader: wrap("div"),
    SheetTitle: wrap("h2"),
  };
});

describe("BudgetEmojiPickerSheet", () => {
  it("opens the picker sheet and selects an emoji", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(<BudgetEmojiPickerSheet value="💰" onSelect={onSelect} />);

    await user.click(
      screen.getByRole("button", { name: /choose budget emoji/i })
    );

    expect(
      screen.getByRole("heading", { name: /choose emoji/i })
    ).toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: /pick cart/i }));

    expect(onSelect).toHaveBeenCalledWith("🛒");

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: /choose emoji/i })
      ).not.toBeInTheDocument();
    });
  });
});
