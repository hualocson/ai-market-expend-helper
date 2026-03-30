import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import SpendingDashboardHeaderClient from "./SpendingDashboardHeaderClient";

vi.mock("./ui/siri-orb", () => ({
  default: () => <div data-testid="siri-orb" />,
}));

vi.mock("@/components/SpendingTrendChart", () => ({
  default: () => <div data-testid="trend-chart" />,
}));

const originalGlobalReact = globalThis.React;

afterEach(() => {
  if (typeof originalGlobalReact === "undefined") {
    Reflect.deleteProperty(globalThis, "React");
    return;
  }

  globalThis.React = originalGlobalReact;
});

describe("SpendingDashboardHeaderClient", () => {
  it("clips decorative glow inside the total spent card", () => {
    globalThis.React = React;

    render(
      <SpendingDashboardHeaderClient
        activeMonthLabel="March 2026"
        payerOptions={["All", "Loc", "Sachi"]}
        totalsByPayer={{
          All: { total: 1_250_000, totals: [100_000, 250_000, 900_000] },
          Loc: { total: 700_000, totals: [100_000, 200_000, 400_000] },
          Sachi: { total: 550_000, totals: [0, 50_000, 500_000] },
        }}
      />
    );

    const totalSpentLabel = screen.getByText(/total spent/i);
    const totalSpentCard = totalSpentLabel.closest(".ds-glass");

    expect(totalSpentCard).toBeInTheDocument();
    expect(totalSpentCard).toHaveClass("overflow-hidden");
  });
});
