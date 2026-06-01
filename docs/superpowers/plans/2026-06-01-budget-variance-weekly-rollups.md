# Budget Variance Weekly Rollups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `/report` budget variance section readable when a month contains many weekly budgets by showing a prioritized default subset and expandable one-line weekly rollups.

**Architecture:** Keep the existing `report.insights.budgetVariance.rows` API shape and calculate grouping in the UI. Convert only `BudgetVarianceCard` to a client component for local expand/collapse state, while keeping all data reads in the existing monthly report path. Add small local helpers inside `BudgetVarianceCard.tsx` for sorting, grouping, date labels, and rollup totals.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, TanStack Query existing report path, Tailwind v4, lucide-react icons, Vitest, React Testing Library, `@testing-library/user-event`.

---

## File Structure

- Modify `src/components/report/BudgetVarianceCard.tsx`
  - Add `"use client"` because the card will own local expanded/collapsed state.
  - Add local helper functions for row priority sorting, weekly grouping, date range labels, and rollup metrics.
  - Render at most 5 prioritized rows by default.
  - Render a compact `Show all` control and grouped weekly rollups when more rows exist.
  - Keep the existing empty state.
- Modify `src/components/report/MonthlyReportInsights.test.tsx`
  - Add dense weekly budget fixtures.
  - Add interaction tests for default collapsed rows and expanded rollups.
  - Add prioritization and mixed monthly/weekly coverage.

No service, query, API, or helper calculation files should change unless a test exposes an unrelated bug.

## Task 1: Add Dense Budget Variance Component Tests

**Files:**

- Modify: `src/components/report/MonthlyReportInsights.test.tsx`

- [ ] **Step 1: Add user-event import**

At the top of `src/components/report/MonthlyReportInsights.test.tsx`, add:

```tsx
import userEvent from "@testing-library/user-event";
```

The import block should become:

```tsx
import React from "react";

import type { MonthlyReportInsights as MonthlyReportInsightsData } from "@/lib/reports/monthly-insights";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
```

If `within` is not already imported, add it as shown because the expanded rollup assertions should be scoped.

- [ ] **Step 2: Add dense row fixture helpers**

Below `baseInsights`, add these helpers:

```tsx
type BudgetVarianceRow =
  MonthlyReportInsightsData["budgetVariance"]["rows"][number];

const budgetRow = (
  overrides: Partial<BudgetVarianceRow>
): BudgetVarianceRow => ({
  budgetId: overrides.budgetId ?? 100,
  name: overrides.name ?? "Budget row",
  icon: overrides.icon ?? "💸",
  color: overrides.color ?? "amber",
  period: overrides.period ?? "week",
  periodStartDate: overrides.periodStartDate ?? "2026-05-05",
  periodEndDate: overrides.periodEndDate ?? "2026-05-11",
  allowance: overrides.allowance ?? 700_000,
  assignedSpend: overrides.assignedSpend ?? 100_000,
  variance: overrides.variance ?? 600_000,
  percentUsed: overrides.percentUsed ?? 14.3,
  status: overrides.status ?? "under",
});

const denseWeeklyRows: BudgetVarianceRow[] = [
  budgetRow({
    budgetId: 1,
    name: "Week 1 over",
    status: "over",
    assignedSpend: 900_000,
    allowance: 700_000,
    variance: -200_000,
    percentUsed: 128.6,
    periodStartDate: "2026-05-05",
    periodEndDate: "2026-05-11",
  }),
  budgetRow({
    budgetId: 2,
    name: "Week 2 near",
    status: "near",
    assignedSpend: 620_000,
    allowance: 700_000,
    variance: 80_000,
    percentUsed: 88.6,
    periodStartDate: "2026-05-12",
    periodEndDate: "2026-05-18",
  }),
  budgetRow({
    budgetId: 3,
    name: "Week 1 large",
    status: "under",
    assignedSpend: 500_000,
    allowance: 700_000,
    variance: 200_000,
    percentUsed: 71.4,
    periodStartDate: "2026-05-05",
    periodEndDate: "2026-05-11",
  }),
  budgetRow({
    budgetId: 4,
    name: "Week 2 medium",
    status: "under",
    assignedSpend: 300_000,
    allowance: 700_000,
    variance: 400_000,
    percentUsed: 42.9,
    periodStartDate: "2026-05-12",
    periodEndDate: "2026-05-18",
  }),
  budgetRow({
    budgetId: 5,
    name: "Week 3 medium",
    status: "under",
    assignedSpend: 250_000,
    allowance: 700_000,
    variance: 450_000,
    percentUsed: 35.7,
    periodStartDate: "2026-05-19",
    periodEndDate: "2026-05-25",
  }),
  budgetRow({
    budgetId: 6,
    name: "Week 4 hidden",
    status: "under",
    assignedSpend: 200_000,
    allowance: 700_000,
    variance: 500_000,
    percentUsed: 28.6,
    periodStartDate: "2026-05-26",
    periodEndDate: "2026-05-31",
  }),
  budgetRow({
    budgetId: 7,
    name: "Week 1 smallest",
    status: "under",
    assignedSpend: 50_000,
    allowance: 700_000,
    variance: 650_000,
    percentUsed: 7.1,
    periodStartDate: "2026-05-05",
    periodEndDate: "2026-05-11",
  }),
];
```

- [ ] **Step 3: Add failing collapsed density test**

Add this test inside `describe("MonthlyReportInsights", () => { ... })`:

```tsx
it("shows a prioritized collapsed budget subset when many weekly budgets exist", () => {
  render(
    <MonthlyReportInsights
      insights={{
        ...baseInsights,
        budgetVariance: {
          summary: {
            totalAllowance: 4_900_000,
            totalAssignedSpend: 2_820_000,
            totalVariance: 2_080_000,
            unassignedSpend: 0,
          },
          rows: denseWeeklyRows,
        },
      }}
    />
  );

  expect(screen.getByText("7 budgets")).toBeInTheDocument();
  expect(screen.getByText("1 over")).toBeInTheDocument();
  expect(screen.getByText("1 near")).toBeInTheDocument();
  expect(screen.getByText("Week 1 over")).toBeInTheDocument();
  expect(screen.getByText("Week 2 near")).toBeInTheDocument();
  expect(screen.getByText("Week 1 large")).toBeInTheDocument();
  expect(screen.getByText("Week 2 medium")).toBeInTheDocument();
  expect(screen.getByText("Week 3 medium")).toBeInTheDocument();
  expect(screen.queryByText("Week 4 hidden")).not.toBeInTheDocument();
  expect(screen.queryByText("Week 1 smallest")).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Show all 2 more budgets" })
  ).toBeInTheDocument();
});
```

- [ ] **Step 4: Add failing expanded rollup test**

Add this test:

```tsx
it("expands dense weekly budgets into one-line icon rollups", async () => {
  const user = userEvent.setup();

  render(
    <MonthlyReportInsights
      insights={{
        ...baseInsights,
        budgetVariance: {
          summary: {
            totalAllowance: 4_900_000,
            totalAssignedSpend: 2_820_000,
            totalVariance: 2_080_000,
            unassignedSpend: 0,
          },
          rows: denseWeeklyRows,
        },
      }}
    />
  );

  await user.click(
    screen.getByRole("button", { name: "Show all 2 more budgets" })
  );

  const firstWeek = screen.getByLabelText("Budget rollup May 5-11");
  expect(within(firstWeek).getByText("May 5-11")).toBeInTheDocument();
  expect(within(firstWeek).getByText("3 budgets")).toBeInTheDocument();
  expect(within(firstWeek).getByText("1 over")).toBeInTheDocument();
  expect(within(firstWeek).getByText(/1\.450\.000/)).toBeInTheDocument();
  expect(firstWeek).not.toHaveTextContent("·");

  expect(screen.getByText("Week 4 hidden")).toBeInTheDocument();
  expect(screen.getByText("Week 1 smallest")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Show fewer budget rows" })
  ).toBeInTheDocument();
});
```

- [ ] **Step 5: Add failing mixed monthly and weekly test**

Add this test:

```tsx
it("keeps monthly budgets coherent when mixed with dense weekly budgets", async () => {
  const user = userEvent.setup();
  const monthlyRow = budgetRow({
    budgetId: 50,
    name: "Monthly rent",
    period: "month",
    status: "under",
    assignedSpend: 1_000_000,
    allowance: 3_100_000,
    variance: 2_100_000,
    percentUsed: 32.3,
    periodStartDate: "2026-05-01",
    periodEndDate: "2026-05-31",
  });

  render(
    <MonthlyReportInsights
      insights={{
        ...baseInsights,
        budgetVariance: {
          summary: {
            totalAllowance: 8_000_000,
            totalAssignedSpend: 3_820_000,
            totalVariance: 4_180_000,
            unassignedSpend: 0,
          },
          rows: [monthlyRow, ...denseWeeklyRows],
        },
      }}
    />
  );

  await user.click(
    screen.getByRole("button", { name: "Show all 3 more budgets" })
  );

  expect(screen.getByText("Monthly budgets")).toBeInTheDocument();
  expect(screen.getByText("Monthly rent")).toBeInTheDocument();
  expect(screen.getByLabelText("Budget rollup May 5-11")).toBeInTheDocument();
});
```

- [ ] **Step 6: Run tests and verify failure**

Run:

```bash
rtk bun run test src/components/report/MonthlyReportInsights.test.tsx
```

Expected: FAIL because `BudgetVarianceCard` does not render budget counts, does not collapse to five rows, has no `Show all` control, and does not render rollups.

## Task 2: Implement Budget Row Sorting, Summary Counts, And Collapsed Limit

**Files:**

- Modify: `src/components/report/BudgetVarianceCard.tsx`

- [ ] **Step 1: Add client directive and imports**

At the top of `src/components/report/BudgetVarianceCard.tsx`, change the first lines to:

```tsx
"use client";

import React, { useMemo, useState } from "react";

import type { BudgetVarianceSummary } from "@/lib/reports/monthly-insights";
import { cn, formatVnd, formatVndSigned } from "@/lib/utils";
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  WalletCards,
} from "lucide-react";
```

Keep the existing `Card`, `CardContent`, `CardHeader`, `CardTitle`, and `VndSymbol` imports.

- [ ] **Step 2: Add row types, constants, and sorting helpers**

Below `type BudgetVarianceCardProps`, add:

```tsx
type BudgetVarianceRow = BudgetVarianceSummary["rows"][number];

const DEFAULT_VISIBLE_ROWS = 5;

const statusPriority = {
  over: 0,
  near: 1,
  under: 2,
  "no-allowance": 3,
} satisfies Record<BudgetVarianceRow["status"], number>;

const sortBudgetRows = (rows: BudgetVarianceRow[]) =>
  [...rows].sort((first, second) => {
    const statusDelta =
      statusPriority[first.status] - statusPriority[second.status];
    if (statusDelta !== 0) return statusDelta;

    const spendDelta = second.assignedSpend - first.assignedSpend;
    if (spendDelta !== 0) return spendDelta;

    const varianceDelta = Math.abs(second.variance) - Math.abs(first.variance);
    if (varianceDelta !== 0) return varianceDelta;

    return first.name.localeCompare(second.name);
  });

const getBudgetCounts = (rows: BudgetVarianceRow[]) => ({
  total: rows.length,
  over: rows.filter((row) => row.status === "over").length,
  near: rows.filter((row) => row.status === "near").length,
});
```

- [ ] **Step 3: Add state and collapsed-row derivation**

Inside `BudgetVarianceCard`, immediately after `const { rows, summary } = budgetVariance;`, add:

```tsx
const [expanded, setExpanded] = useState(false);
const sortedRows = useMemo(() => sortBudgetRows(rows), [rows]);
const budgetCounts = useMemo(() => getBudgetCounts(rows), [rows]);
const hasOverflow = sortedRows.length > DEFAULT_VISIBLE_ROWS;
const visibleRows =
  expanded || !hasOverflow
    ? sortedRows
    : sortedRows.slice(0, DEFAULT_VISIBLE_ROWS);
const hiddenRowCount = Math.max(sortedRows.length - DEFAULT_VISIBLE_ROWS, 0);
```

- [ ] **Step 4: Render count context below summary cards**

After the existing two-column summary grid, insert:

```tsx
<div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
  <span>{budgetCounts.total} budgets</span>
  <span>{budgetCounts.over} over</span>
  <span>{budgetCounts.near} near</span>
</div>
```

This uses short text for compact context. The icon-only weekly rollup requirement applies to weekly rollup rows, not this count context.

- [ ] **Step 5: Render visibleRows instead of rows**

Change:

```tsx
{rows.map((row) => (
```

to:

```tsx
{visibleRows.map((row) => (
```

- [ ] **Step 6: Add Show all / Show fewer control**

After the row list and before the unassigned-spend footer, add:

```tsx
{
  hasOverflow ? (
    <button
      type="button"
      className="text-muted-foreground hover:text-foreground flex min-h-10 items-center justify-center gap-1 rounded-xl px-3 text-xs font-medium transition-colors"
      onClick={() => setExpanded((current) => !current)}
      aria-expanded={expanded}
    >
      {expanded ? (
        <>
          Show fewer budget rows
          <ChevronUp className="size-3.5" aria-hidden="true" />
        </>
      ) : (
        <>
          Show all {hiddenRowCount} more budgets
          <ChevronDown className="size-3.5" aria-hidden="true" />
        </>
      )}
    </button>
  ) : null;
}
```

- [ ] **Step 7: Run tests and verify partial progress**

Run:

```bash
rtk bun run test src/components/report/MonthlyReportInsights.test.tsx
```

Expected: collapsed subset test PASS. Expanded rollup and mixed monthly/weekly tests still FAIL because the expanded view currently shows all rows without weekly rollups.

## Task 3: Implement Weekly Rollup Grouping And Expanded Layout

**Files:**

- Modify: `src/components/report/BudgetVarianceCard.tsx`

- [ ] **Step 1: Add date and attention helpers**

In `src/components/report/BudgetVarianceCard.tsx`, add this import:

```tsx
import dayjs from "@/configs/date";
```

Then add these helpers below `getBudgetCounts`:

```tsx
type WeeklyBudgetGroup = {
  key: string;
  label: string;
  rows: BudgetVarianceRow[];
  assignedSpend: number;
  overCount: number;
  nearCount: number;
  attentionLabel: string;
};

const formatBudgetPeriodRange = (startDate: string, endDate: string) => {
  const start = dayjs(startDate);
  const end = dayjs(endDate);

  if (start.isSame(end, "month")) {
    return `${start.format("MMM D")}-${end.format("D")}`;
  }

  return `${start.format("MMM D")}-${end.format("MMM D")}`;
};

const getAttentionLabel = (rows: BudgetVarianceRow[]) => {
  const overCount = rows.filter((row) => row.status === "over").length;
  const nearCount = rows.filter((row) => row.status === "near").length;

  if (overCount > 0) return `${overCount} over`;
  if (nearCount > 0) return `${nearCount} near`;
  return "0 over";
};

const groupWeeklyBudgetRows = (rows: BudgetVarianceRow[]) => {
  const groups = new Map<string, BudgetVarianceRow[]>();

  rows
    .filter((row) => row.period === "week")
    .forEach((row) => {
      const key = `${row.periodStartDate}|${row.periodEndDate}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    });

  return Array.from(groups.entries())
    .map(([key, groupRows]): WeeklyBudgetGroup => {
      const [periodStartDate, periodEndDate] = key.split("|");
      const sortedGroupRows = sortBudgetRows(groupRows);
      const overCount = sortedGroupRows.filter(
        (row) => row.status === "over"
      ).length;
      const nearCount = sortedGroupRows.filter(
        (row) => row.status === "near"
      ).length;

      return {
        key,
        label: formatBudgetPeriodRange(periodStartDate, periodEndDate),
        rows: sortedGroupRows,
        assignedSpend: sortedGroupRows.reduce(
          (sum, row) => sum + row.assignedSpend,
          0
        ),
        overCount,
        nearCount,
        attentionLabel: getAttentionLabel(sortedGroupRows),
      };
    })
    .sort((first, second) => first.key.localeCompare(second.key));
};

const getMonthlyBudgetRows = (rows: BudgetVarianceRow[]) =>
  sortBudgetRows(rows.filter((row) => row.period === "month"));
```

- [ ] **Step 2: Add grouped data derivation**

Inside `BudgetVarianceCard`, below `visibleRows`, add:

```tsx
const monthlyRows = useMemo(() => getMonthlyBudgetRows(rows), [rows]);
const weeklyGroups = useMemo(() => groupWeeklyBudgetRows(rows), [rows]);
```

- [ ] **Step 3: Extract row renderer**

Before `const BudgetVarianceCard = ...`, add:

```tsx
const BudgetVarianceRowItem = ({ row }: { row: BudgetVarianceRow }) => (
  <div className="bg-muted/20 flex min-h-16 flex-col items-start gap-3 rounded-2xl px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex max-w-full min-w-0 items-center gap-3">
      <span
        className="bg-background/70 flex size-9 shrink-0 items-center justify-center rounded-xl text-base"
        aria-hidden="true"
      >
        {row.icon}
      </span>
      <div className="min-w-0">
        <div className="text-foreground truncate text-sm font-medium">
          {row.name}
        </div>
        <div className="text-muted-foreground text-xs">
          {formatPercentUsed(row.percentUsed)}
        </div>
      </div>
    </div>

    <div className="flex max-w-full flex-wrap items-center gap-2 sm:flex-col sm:items-end">
      <span
        className={cn(
          "rounded-full px-2 py-1 text-[11px] font-semibold capitalize",
          statusClassName[row.status]
        )}
      >
        {row.status.replace("-", " ")}
      </span>
      <span className="text-muted-foreground flex max-w-full flex-wrap items-center gap-x-1 gap-y-1 text-xs break-all tabular-nums sm:justify-end sm:text-right">
        {formatVnd(row.assignedSpend)}
        <VndSymbol className="size-3" aria-hidden="true" />
      </span>
    </div>
  </div>
);
```

Then replace the existing inline row markup with:

```tsx
<BudgetVarianceRowItem key={row.budgetId} row={row} />
```

- [ ] **Step 4: Add weekly rollup renderer**

Before `BudgetVarianceCard`, add:

```tsx
const WeeklyBudgetRollup = ({ group }: { group: WeeklyBudgetGroup }) => (
  <div className="flex flex-col gap-2">
    <div
      className="text-muted-foreground bg-muted/20 flex min-h-10 max-w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-3 py-2 text-xs"
      aria-label={`Budget rollup ${group.label}`}
    >
      <span className="text-foreground flex items-center gap-1 font-medium">
        <CalendarDays className="size-3.5" aria-hidden="true" />
        {group.label}
      </span>
      <span className="flex items-center gap-1">
        <WalletCards className="size-3.5" aria-hidden="true" />
        {group.rows.length} budgets
      </span>
      <span className="flex items-center gap-1">
        <TriangleAlert className="size-3.5" aria-hidden="true" />
        {group.attentionLabel}
      </span>
      <span className="flex max-w-full items-center gap-1 break-all tabular-nums">
        <VndSymbol className="size-3.5" aria-hidden="true" />
        {formatVnd(group.assignedSpend)} used
      </span>
    </div>
    <div className="flex flex-col gap-2">
      {group.rows.map((row) => (
        <BudgetVarianceRowItem key={row.budgetId} row={row} />
      ))}
    </div>
  </div>
);
```

Also update the lucide import from Task 2 to include `TriangleAlert`:

```tsx
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  TriangleAlert,
  WalletCards,
} from "lucide-react";
```

- [ ] **Step 5: Render collapsed rows or expanded groups**

Replace the row-list block:

```tsx
<div className="flex flex-col gap-2">
  {visibleRows.map((row) => (
    <BudgetVarianceRowItem key={row.budgetId} row={row} />
  ))}
</div>
```

with:

```tsx
{
  expanded && hasOverflow ? (
    <div className="flex flex-col gap-4">
      {monthlyRows.length ? (
        <div className="flex flex-col gap-2">
          <div className="text-muted-foreground px-1 text-xs font-medium">
            Monthly budgets
          </div>
          {monthlyRows.map((row) => (
            <BudgetVarianceRowItem key={row.budgetId} row={row} />
          ))}
        </div>
      ) : null}

      {weeklyGroups.map((group) => (
        <WeeklyBudgetRollup key={group.key} group={group} />
      ))}
    </div>
  ) : (
    <div className="flex flex-col gap-2">
      {visibleRows.map((row) => (
        <BudgetVarianceRowItem key={row.budgetId} row={row} />
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Run component tests and verify pass**

Run:

```bash
rtk bun run test src/components/report/MonthlyReportInsights.test.tsx
```

Expected: PASS.

The rollup amount assertion uses a regular expression because the final rendered text includes both the amount and the word `used` in the same inline group.

## Task 4: Polish Mobile Layout And Accessibility

**Files:**

- Modify: `src/components/report/BudgetVarianceCard.tsx`
- Modify: `src/components/report/MonthlyReportInsights.test.tsx`

- [ ] **Step 1: Make the Show all button mobile-safe**

Ensure the button from Task 2 uses this class string:

```tsx
className =
  "text-muted-foreground hover:text-foreground flex min-h-10 max-w-full flex-wrap items-center justify-center gap-x-1 gap-y-1 rounded-xl px-3 text-xs font-medium transition-colors";
```

This prevents long translated button text from overflowing.

- [ ] **Step 2: Add accessible labels for summary counts**

Replace the count context added in Task 2 with:

```tsx
<div
  className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs"
  aria-label={`${budgetCounts.total} budgets, ${budgetCounts.over} over, ${budgetCounts.near} near`}
>
  <span>{budgetCounts.total} budgets</span>
  <span>{budgetCounts.over} over</span>
  <span>{budgetCounts.near} near</span>
</div>
```

- [ ] **Step 3: Assert no dot separators in rollups**

In the expanded rollup test from Task 1, keep this assertion:

```tsx
expect(firstWeek).not.toHaveTextContent("·");
```

Add this assertion after it:

```tsx
expect(firstWeek.textContent).not.toContain("•");
```

- [ ] **Step 4: Run component tests**

Run:

```bash
rtk bun run test src/components/report/MonthlyReportInsights.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit component implementation**

Run:

```bash
rtk git add src/components/report/BudgetVarianceCard.tsx src/components/report/MonthlyReportInsights.test.tsx
rtk git commit -m "feat(report): group dense budget variance rows"
```

Expected: commit succeeds.

## Task 5: Required Formatting, Lint, And Focused Verification

**Files:**

- Check: `src/components/report/BudgetVarianceCard.tsx`
- Check: `src/components/report/MonthlyReportInsights.test.tsx`

- [ ] **Step 1: Format modified files**

Run:

```bash
rtk bunx prettier --write src/components/report/BudgetVarianceCard.tsx src/components/report/MonthlyReportInsights.test.tsx
```

Expected: files are rewritten or reported unchanged.

- [ ] **Step 2: Check formatting**

Run:

```bash
rtk bunx prettier --check src/components/report/BudgetVarianceCard.tsx src/components/report/MonthlyReportInsights.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run ESLint**

Run:

```bash
rtk bunx eslint src/components/report/BudgetVarianceCard.tsx src/components/report/MonthlyReportInsights.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Run focused component tests**

Run:

```bash
rtk bun run test src/components/report/MonthlyReportInsights.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit formatting fixes if needed**

Run:

```bash
rtk git status --short
```

If either modified file changed after Task 4 commit, run:

```bash
rtk git add src/components/report/BudgetVarianceCard.tsx src/components/report/MonthlyReportInsights.test.tsx
rtk git commit -m "chore(report): format budget variance rollups"
```

If no tracked files changed, skip this commit.

## Task 6: Manual Mobile UI Check

**Files:**

- Verify: `/report`

- [ ] **Step 1: Start the dev server**

Run:

```bash
rtk bun run dev
```

Expected: Next.js starts and prints a local URL, usually `http://localhost:3000`.

- [ ] **Step 2: Open report at iPhone size**

Use `agent-browser` if available:

```bash
agent-browser set device "iPhone 14"
agent-browser open http://localhost:3000/report?month=2026-05
agent-browser wait --load networkidle
agent-browser screenshot --full
```

Expected:

- budget variance card summary is visible without a long list,
- only five budget rows render before expansion when dense data exists,
- `Show all` is tappable and uses at least a 40px hit area,
- expanded weekly rollup line is icon-led and has no dot separators,
- rollup line stays on one line at iPhone 13/14 width unless content genuinely forces wrapping,
- category and payer sections remain below insights,
- no text overlaps or horizontal page scroll.

- [ ] **Step 3: Stop the dev server**

Stop the server with `Ctrl-C`.

Confirm port 3000 is clear:

```bash
rtk lsof -nP -iTCP:3000 -sTCP:LISTEN
```

Expected: no listening process.

- [ ] **Step 4: Commit manual polish if needed**

If visual inspection required polish changes, run focused checks:

```bash
rtk bun run test src/components/report/MonthlyReportInsights.test.tsx
rtk bunx prettier --write src/components/report/BudgetVarianceCard.tsx src/components/report/MonthlyReportInsights.test.tsx
rtk bunx prettier --check src/components/report/BudgetVarianceCard.tsx src/components/report/MonthlyReportInsights.test.tsx
rtk bunx eslint src/components/report/BudgetVarianceCard.tsx src/components/report/MonthlyReportInsights.test.tsx
```

Then commit:

```bash
rtk git add src/components/report/BudgetVarianceCard.tsx src/components/report/MonthlyReportInsights.test.tsx
rtk git commit -m "style(report): polish budget variance rollups"
```

If no files changed, skip this commit.
