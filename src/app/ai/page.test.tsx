import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AIChatPage from "./page";

vi.mock("@/components/AIExpenseChat", () => ({
  default: () => <div data-testid="ai-expense-chat" />,
}));

const originalGlobalReact = globalThis.React;

beforeEach(() => {
  globalThis.React = React;
});

afterEach(() => {
  if (typeof originalGlobalReact === "undefined") {
    Reflect.deleteProperty(globalThis, "React");
  } else {
    globalThis.React = originalGlobalReact;
  }
});

describe("/ai page", () => {
  it("renders the AI chat page shell", () => {
    render(<AIChatPage />);

    expect(
      screen.getByRole("heading", { name: /spendly ai/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /back to home/i })
    ).toHaveAttribute("href", "/");
    expect(screen.getByTestId("ai-expense-chat")).toBeInTheDocument();
  });
});
