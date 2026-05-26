import React from "react";
import type { ReactNode } from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import BudgetEmojiPickerDrawer from "./BudgetEmojiPickerDrawer";

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

vi.mock("@/components/ui/drawer", () => {
  const DrawerContext = React.createContext<{
    open: boolean;
    onOpenChange: (open: boolean) => void;
  } | null>(null);

  const Drawer = ({
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
      <DrawerContext.Provider value={{ open, onOpenChange: setOpen }}>
        <div>{children}</div>
      </DrawerContext.Provider>
    );
  };

  const DrawerTrigger = ({ children }: { children: ReactNode }) => {
    const drawer = React.useContext(DrawerContext);

    if (!React.isValidElement(children)) {
      return null;
    }

    const child = children as React.ReactElement<
      React.HTMLAttributes<HTMLElement>
    >;

    return React.cloneElement(child, {
      onClick: (event: React.MouseEvent<HTMLElement>) => {
        child.props.onClick?.(event);
        drawer?.onOpenChange(true);
      },
    } as Partial<React.HTMLAttributes<HTMLElement>>);
  };

  const DrawerContent = ({ children }: { children: ReactNode }) => {
    const drawer = React.useContext(DrawerContext);

    if (!drawer?.open) {
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
    Drawer,
    DrawerTrigger,
    DrawerContent,
    DrawerDescription: wrap("div"),
    DrawerFooter: wrap("div"),
    DrawerHeader: wrap("div"),
    DrawerTitle: wrap("h2"),
  };
});

describe("BudgetEmojiPickerDrawer", () => {
  it("opens the picker drawer and confirms a selected emoji", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(<BudgetEmojiPickerDrawer value="💰" onSelect={onSelect} />);

    await user.click(
      screen.getByRole("button", { name: /choose budget emoji/i })
    );

    expect(
      screen.getByRole("heading", { name: /choose emoji/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/budget: preview/i)).toHaveTextContent("💰");

    await user.click(await screen.findByRole("button", { name: /pick cart/i }));

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/budget: preview/i)).toHaveTextContent("🛒");
    expect(
      screen.getByRole("heading", { name: /choose emoji/i })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /confirm emoji/i }));

    expect(onSelect).toHaveBeenCalledWith("🛒");

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: /choose emoji/i })
      ).not.toBeInTheDocument();
    });
  });
});
