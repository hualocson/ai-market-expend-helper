import React from "react";

import { queries } from "@/lib/queries";
import type { DailyReport } from "@/lib/services/reports";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import DailyReportContent from "./DailyReportContent";

vi.mock("motion/react", () => ({
  motion: {
    div: ({
      animate,
      children,
      initial,
      transition,
      variants,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>) => {
      void animate;
      void initial;
      void transition;
      void variants;

      return <div {...props}>{children}</div>;
    },
  },
  useReducedMotion: () => true,
}));

vi.mock("@/components/CategorySpendPieChart", () => ({
  default: ({ monthLabel }: { monthLabel: string }) => (
    <div data-testid="category-chart">{monthLabel}</div>
  ),
}));

vi.mock("@/components/ExpenseListItem", () => ({
  default: ({
    expense,
    onEditExpense,
  }: {
    expense: { note: string };
    onEditExpense: (expense: { note: string }) => void;
  }) => (
    <button
      type="button"
      data-testid="expense-item"
      onClick={() => onEditExpense(expense)}
    >
      {expense.note}
    </button>
  ),
}));

vi.mock("@/components/ExpenseEditSheetHost", () => ({
  default: ({
    expense,
    open,
  }: {
    expense: { note: string } | null;
    open: boolean;
  }) => (
    <div data-testid="expense-edit-sheet-host" data-open={String(open)}>
      {expense?.note ?? ""}
    </div>
  ),
}));

const originalGlobalReact = globalThis.React;

afterEach(() => {
  vi.restoreAllMocks();

  if (typeof originalGlobalReact === "undefined") {
    Reflect.deleteProperty(globalThis, "React");
    return;
  }

  globalThis.React = originalGlobalReact;
});

function renderWithClient(ui: React.ReactElement, client: QueryClient) {
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>
  );
}

describe("DailyReportContent", () => {
  const buildClient = () =>
    new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 60 * 1000,
        },
      },
    });

  const buildReport = (): DailyReport => ({
    activeDate: "2026-05-23",
    dailyCategoryTotals: [{ category: "Food", total: 120_000 }],
    dailyExpenses: [
      {
        id: 1,
        date: "2026-05-23",
        amount: 120_000,
        note: "Lunch",
        category: "Food",
        paidBy: "Loc",
        budgetId: null,
        budgetName: null,
        budgetIcon: null,
        budgetColor: null,
      },
    ],
    dailyRemaining: 30_000,
    dailyTarget: 150_000,
    dateKey: "2026-05-23",
    dayIndex: 6,
    expectedSpendToDate: 900_000,
    hasWeeklyBudget: true,
    monthKey: "2026-05",
    paceDelta: -100_000,
    paceProgress: 0.6,
    paceStatus: "On pace",
    totalSpentToday: 120_000,
    weekEndKey: "2026-05-24",
    weekLabel: "18 May - 24 May",
    weekSpentToDate: 800_000,
    weekStartKey: "2026-05-18",
    weeklyBudgetTotal: 1_050_000,
  });

  it("renders hydrated daily report data without an immediate fetch", () => {
    globalThis.React = React;

    const queryClient = buildClient();
    const payload = buildReport();
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    queryClient.setQueryData(
      queries.reports.daily("2026-05-23").queryKey,
      payload
    );

    render(
      <QueryClientProvider client={queryClient}>
        <DailyReportContent date="2026-05-23" />
      </QueryClientProvider>
    );

    expect(
      screen.getByRole("heading", { name: "Daily report" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "" })).toHaveAttribute("href", "/");
    expect(screen.getByText("Saturday, 23 May 2026")).toBeInTheDocument();
    expect(screen.getByText(/-120\.000/)).toBeInTheDocument();
    expect(screen.getByText("1 transactions")).toBeInTheDocument();
    expect(screen.getByText("Day 6 of 7")).toBeInTheDocument();
    expect(screen.getAllByText("On pace")).toHaveLength(2);
    expect(screen.getByText("23 May 2026")).toBeInTheDocument();
    expect(screen.getByTestId("expense-item")).toHaveTextContent("Lunch");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("opens one central edit sheet host when a daily expense item requests edit", async () => {
    globalThis.React = React;

    const user = userEvent.setup();
    const queryClient = buildClient();
    const payload = buildReport();

    queryClient.setQueryData(
      queries.reports.daily("2026-05-23").queryKey,
      payload
    );

    render(
      <QueryClientProvider client={queryClient}>
        <DailyReportContent date="2026-05-23" />
      </QueryClientProvider>
    );

    expect(screen.getAllByTestId("expense-edit-sheet-host")).toHaveLength(1);
    expect(screen.getByTestId("expense-edit-sheet-host")).toHaveAttribute(
      "data-open",
      "false"
    );

    await user.click(screen.getByTestId("expense-item"));

    expect(screen.getByTestId("expense-edit-sheet-host")).toHaveAttribute(
      "data-open",
      "true"
    );
    expect(screen.getByTestId("expense-edit-sheet-host")).toHaveTextContent(
      "Lunch"
    );
  });

  it("shows a skeleton (not null) while there is no data yet", () => {
    globalThis.React = React;

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { container } = renderWithClient(
      <DailyReportContent date="2026-06-14" />,
      client
    );
    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0);
  });

  it("uses keepPreviousData on the daily query", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/DailyReportContent.tsx"),
      "utf8"
    );
    expect(source).toContain("keepPreviousData");
  });
});
