import React from "react";

import { queries } from "@/lib/queries";
import type { DashboardMonthlySummary } from "@/lib/services/dashboard";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import SpendingDashboardHeader from "./SpendingDashboardHeader";
import SpendingDashboardHeaderClient from "./SpendingDashboardHeaderClient";

vi.mock("motion/react", () => ({
  useReducedMotion: () => true,
}));

vi.mock("@/components/SpendingHeatmapChart", () => ({
  default: () => <div data-testid="heatmap-chart" />,
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
  it("renders the large total with compact payer and AI actions", () => {
    globalThis.React = React;

    render(
      <SpendingDashboardHeaderClient
        activeMonth="2026-03"
        payerOptions={["All", "Loc", "Sachi"]}
        totalsByPayer={{
          All: { total: 1_250_000, totals: [100_000, 250_000, 900_000] },
          Loc: { total: 700_000, totals: [100_000, 200_000, 400_000] },
          Sachi: { total: 550_000, totals: [0, 50_000, 500_000] },
        }}
      />
    );

    const total = screen.getByLabelText("1.250.000 Vietnamese dong");
    const picker = screen.getByRole("combobox", {
      name: /select expense payer/i,
    });
    const aiLink = screen.getByRole("link", {
      name: /open spendly ai expense chat/i,
    });
    const amountBlock = total.parentElement;

    expect(total).toBeInTheDocument();
    expect(picker).toBeInTheDocument();
    expect(aiLink).toHaveAttribute("href", "/ai");
    expect(amountBlock).toHaveClass("items-start");
    expect(amountBlock).toHaveClass("fixed");
    expect(amountBlock).toHaveClass("spending-header-gradient");
    expect(amountBlock).not.toHaveClass("ds-glass");
    expect(screen.getByTestId("heatmap-chart")).toBeInTheDocument();
    expect(screen.queryByText(/total spent/i)).not.toBeInTheDocument();
  });

  it("renders hydrated monthly summary data without an immediate fetch", () => {
    globalThis.React = React;

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 60 * 1000,
        },
      },
    });
    const payload: DashboardMonthlySummary = {
      activeMonth: "2026-05",
      payerOptions: ["All", "Loc"],
      totalsByPayer: {
        All: { total: 900_000, totals: [300_000, 600_000] },
        Loc: { total: 900_000, totals: [300_000, 600_000] },
      },
    };
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    queryClient.setQueryData(
      queries.dashboard.monthlySummary().queryKey,
      payload
    );

    render(
      <QueryClientProvider client={queryClient}>
        <SpendingDashboardHeader />
      </QueryClientProvider>
    );

    expect(
      screen.getByLabelText("900.000 Vietnamese dong")
    ).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
