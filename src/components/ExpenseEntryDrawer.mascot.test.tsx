import React from "react";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import ExpenseEntryDrawer from "./ExpenseEntryDrawer";

vi.mock("@/components/ManualExpenseForm", () => ({
  default: React.forwardRef(function ManualExpenseFormMock(_, ref) {
    React.useImperativeHandle(ref, () => ({ submit: vi.fn() }));
    return <div data-testid="manual-expense-form" />;
  }),
}));

vi.mock("@/components/ui/sheet", () => {
  const SheetContext = React.createContext<{
    open: boolean;
    onOpenChange?: (open: boolean) => void;
  } | null>(null);

  const Sheet = ({
    children,
    open = false,
    onOpenChange,
  }: {
    children: ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => (
    <SheetContext.Provider value={{ open, onOpenChange }}>
      <div>{children}</div>
    </SheetContext.Provider>
  );

  const SheetTrigger = ({
    children,
  }: {
    children: ReactNode;
  }) => {
    const sheet = React.useContext(SheetContext);
    const child = React.Children.only(children);

    if (!React.isValidElement(child)) {
      return child;
    }

    return React.cloneElement(child, {
      "aria-expanded": sheet?.open ?? false,
      onClick: (event: React.MouseEvent<HTMLElement>) => {
        child.props.onClick?.(event);
        sheet?.onOpenChange?.(!(sheet?.open ?? false));
      },
    });
  };

  const SheetContent = ({ children }: { children: ReactNode }) => {
    const sheet = React.useContext(SheetContext);

    if (!sheet?.open) {
      return null;
    }

    return <div role="dialog">{children}</div>;
  };

  return {
    Sheet,
    SheetContent,
    SheetDescription: ({ children }: { children: ReactNode }) => (
      <p>{children}</p>
    ),
    SheetFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    SheetHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    SheetTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
    SheetTrigger,
  };
});

describe("ExpenseEntryDrawer mascot", () => {
  it("keeps the sheet closed until the trigger is used, then shows the mascot header", async () => {
    const user = userEvent.setup();
    render(<ExpenseEntryDrawer />);

    expect(
      screen.queryByRole("heading", { name: /add a new expense/i })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /add expense/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /add a new expense/i })
    ).toBeInTheDocument();
    expect(screen.getByTestId("dialog-companion-slot")).toBeInTheDocument();
    expect(screen.getByTestId("idle-mascot")).toBeInTheDocument();
  });
});
