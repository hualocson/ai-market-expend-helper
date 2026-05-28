import React from "react";

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SpendingDashboardHeader from "./SpendingDashboardHeader";

const useQueryMock = vi.hoisted(() => vi.fn());
const useSuspenseQueryMock = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-query", () => ({
  useQuery: useQueryMock,
  useSuspenseQuery: useSuspenseQueryMock,
}));

vi.mock("@/components/SpendingDashboardHeaderClient", () => ({
  default: ({ activeMonth }: { activeMonth: string }) => (
    <div data-testid="dashboard-header-client">{activeMonth}</div>
  ),
}));

const originalGlobalReact = globalThis.React;

beforeEach(() => {
  globalThis.React = React;
  useQueryMock.mockReturnValue({
    data: {
      activeMonth: "2026-05",
      payerOptions: ["All"],
      totalsByPayer: {
        All: { total: 900_000, totals: [900_000] },
      },
    },
  });
  useSuspenseQueryMock.mockReturnValue({
    data: {
      activeMonth: "2026-05",
      payerOptions: ["All"],
      totalsByPayer: {
        All: { total: 900_000, totals: [900_000] },
      },
    },
  });
});

afterEach(() => {
  vi.clearAllMocks();

  if (typeof originalGlobalReact === "undefined") {
    Reflect.deleteProperty(globalThis, "React");
    return;
  }

  globalThis.React = originalGlobalReact;
});

describe("SpendingDashboardHeader", () => {
  it("reads the monthly summary with useSuspenseQuery", () => {
    render(<SpendingDashboardHeader />);

    expect(useSuspenseQueryMock).toHaveBeenCalledTimes(1);
    expect(useQueryMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("dashboard-header-client")).toHaveTextContent(
      "2026-05"
    );
  });
});
