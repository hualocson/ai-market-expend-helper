import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ExpenseEntryDrawer from "./ExpenseEntryDrawer";

const originalGlobalReact = globalThis.React;

const ensureReactGlobal = () => {
  globalThis.React = React;
};

const restoreReactGlobal = () => {
  if (typeof originalGlobalReact === "undefined") {
    Reflect.deleteProperty(globalThis, "React");
    return;
  }

  globalThis.React = originalGlobalReact;
};

vi.mock("@/components/ManualExpenseForm", () => ({
  default: React.forwardRef(function ManualExpenseFormMock(_, ref) {
    React.useImperativeHandle(ref, () => ({ submit: vi.fn() }));
    return <div data-testid="manual-expense-form" />;
  }),
}));

vi.mock("@/components/ui/sheet", () => {
  const Wrap = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;

  return {
    Sheet: Wrap,
    SheetContent: Wrap,
    SheetDescription: Wrap,
    SheetFooter: Wrap,
    SheetHeader: Wrap,
    SheetTitle: Wrap,
    SheetTrigger: Wrap,
  };
});

afterEach(() => {
  restoreReactGlobal();
});

describe("ExpenseEntryDrawer mascot", () => {
  it("renders the dialog companion slot and idle mascot in the header", () => {
    ensureReactGlobal();
    render(<ExpenseEntryDrawer />);

    expect(screen.getByTestId("dialog-companion-slot")).toBeInTheDocument();
    expect(screen.getByTestId("idle-mascot")).toBeInTheDocument();
  });
});
