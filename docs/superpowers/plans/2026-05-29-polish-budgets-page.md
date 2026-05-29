# Polish Budgets Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the Budgets page header and add a horizontally-scrolling "remaining budget" bar chart between the period chips and the summary strip.

**Architecture:** All work is presentational and client-side in `BudgetWeeklyBudgetsClient`. A new pure helper (`computeBudgetBars`) handles sorting/height-scaling, a new presentational component (`BudgetRemainingChart`) renders the bars, and a new compact money formatter (`formatVndCompact`) abbreviates amounts (`500K`, `1.7M`). No DB/API/query/mutation changes — the chart consumes the `BudgetListItem` data the client already loads.

**Tech Stack:** Next.js 15 / React 19 client component, Tailwind v4, Vitest + @testing-library/react, lucide-react icons. Dark-mode only, mobile-first (iPhone 13/14).

**Spec:** `docs/superpowers/specs/2026-05-29-polish-budgets-page-design.md`

**Tooling note (per AGENTS.md):** after editing any `.ts`/`.tsx` file, run for the modified scope:
- `rtk bunx prettier --write <files>` then `rtk bunx prettier --check <files>`
- `rtk bunx eslint <files>`
Use `bunx vitest run <pattern>` for tests. Do **not** run `npm run build` between tasks — only before pushing.

---

## File Structure

- Create: `src/lib/budget-chart.ts` — pure `computeBudgetBars` helper + types.
- Create: `src/lib/budget-chart.test.ts` — unit tests for the helper.
- Create: `src/components/BudgetRemainingChart.tsx` — presentational bar chart.
- Create: `src/components/BudgetRemainingChart.test.tsx` — render tests.
- Modify: `src/lib/utils.ts` — add `formatVndCompact`.
- Modify: `src/lib/utils.test.ts` — add `formatVndCompact` tests (create the file if it does not exist).
- Modify: `src/components/BudgetWeeklyBudgetsClient.tsx` — header restructure, chart integration, remove floating add button, drop unused imports.

---

## Task 1: Compact money formatter

**Files:**
- Modify: `src/lib/utils.ts` (add after `formatVndSigned`, ~line 24)
- Test: `src/lib/utils.test.ts`

- [ ] **Step 1: Write the failing test**

Create or append to `src/lib/utils.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { formatVndCompact } from "./utils";

describe("formatVndCompact", () => {
  it("abbreviates thousands with K", () => {
    expect(formatVndCompact(40000)).toBe("40K");
    expect(formatVndCompact(220000)).toBe("220K");
    expect(formatVndCompact(500000)).toBe("500K");
  });

  it("abbreviates millions with one decimal", () => {
    expect(formatVndCompact(1700000)).toBe("1.7M");
    expect(formatVndCompact(2400000)).toBe("2.4M");
  });

  it("keeps a leading minus for negatives", () => {
    expect(formatVndCompact(-120000)).toBe("-120K");
  });

  it("renders small values plainly", () => {
    expect(formatVndCompact(0)).toBe("0");
    expect(formatVndCompact(950)).toBe("950");
  });

  it("returns empty string for non-finite input", () => {
    expect(formatVndCompact(Number.NaN)).toBe("");
    expect(formatVndCompact(Number.POSITIVE_INFINITY)).toBe("");
  });
});
```

> Note: if `src/lib/utils.test.ts` already exists, add only the `describe("formatVndCompact", ...)` block and the `formatVndCompact` import; do not duplicate existing imports.

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/lib/utils.test.ts -t formatVndCompact`
Expected: FAIL — `formatVndCompact` is not exported.

- [ ] **Step 3: Add the implementation**

In `src/lib/utils.ts`, add directly below the `formatVndSigned` definition:

```ts
const compactVndFormatter = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export const formatVndCompact = (amount: number) => {
  if (!Number.isFinite(amount)) {
    return "";
  }
  return compactVndFormatter.format(Math.trunc(amount));
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/lib/utils.test.ts -t formatVndCompact`
Expected: PASS (5 assertions green).

- [ ] **Step 5: Format, lint, commit**

```bash
rtk bunx prettier --write src/lib/utils.ts src/lib/utils.test.ts
rtk bunx prettier --check src/lib/utils.ts src/lib/utils.test.ts
rtk bunx eslint src/lib/utils.ts src/lib/utils.test.ts
git add src/lib/utils.ts src/lib/utils.test.ts
git commit -m "feat: add compact VND formatter for budget chart"
```

---

## Task 2: `computeBudgetBars` helper

**Files:**
- Create: `src/lib/budget-chart.ts`
- Test: `src/lib/budget-chart.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/budget-chart.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { computeBudgetBars } from "./budget-chart";
import type { BudgetListItem } from "@/types/budget-weekly";

const makeBudget = (overrides: Partial<BudgetListItem>): BudgetListItem => ({
  id: 1,
  name: "Budget",
  icon: "💰",
  color: "lime",
  amount: 1000,
  spent: 0,
  remaining: 1000,
  period: "week",
  periodStartDate: "2026-05-25",
  periodEndDate: null,
  ...overrides,
});

describe("computeBudgetBars", () => {
  it("returns an empty array for no budgets", () => {
    expect(computeBudgetBars([])).toEqual([]);
  });

  it("sorts by remaining descending", () => {
    const bars = computeBudgetBars([
      makeBudget({ id: 1, remaining: 100 }),
      makeBudget({ id: 2, remaining: 300 }),
      makeBudget({ id: 3, remaining: 200 }),
    ]);
    expect(bars.map((bar) => bar.budget.id)).toEqual([2, 3, 1]);
  });

  it("breaks ties by name then id", () => {
    const bars = computeBudgetBars([
      makeBudget({ id: 5, name: "Beta", remaining: 100 }),
      makeBudget({ id: 4, name: "Alpha", remaining: 100 }),
      makeBudget({ id: 9, name: "Alpha", remaining: 100 }),
    ]);
    expect(bars.map((bar) => bar.budget.id)).toEqual([4, 9, 5]);
  });

  it("scales heights against the largest remaining", () => {
    const bars = computeBudgetBars(
      [
        makeBudget({ id: 1, remaining: 200 }),
        makeBudget({ id: 2, remaining: 100 }),
      ],
      { maxPx: 200, minPx: 40, inlineThresholdPx: 64 },
    );
    expect(bars[0].heightPx).toBe(200);
    expect(bars[1].heightPx).toBe(100);
  });

  it("clamps tiny positive remainders to the minimum height", () => {
    const bars = computeBudgetBars(
      [
        makeBudget({ id: 1, remaining: 1000 }),
        makeBudget({ id: 2, remaining: 1 }),
      ],
      { maxPx: 190, minPx: 40, inlineThresholdPx: 64 },
    );
    expect(bars[1].heightPx).toBe(40);
  });

  it("uses the minimum height and flags over-budget when all remainders are non-positive", () => {
    const bars = computeBudgetBars(
      [
        makeBudget({ id: 1, remaining: 0 }),
        makeBudget({ id: 2, remaining: -50 }),
      ],
      { maxPx: 190, minPx: 40, inlineThresholdPx: 64 },
    );
    expect(bars.every((bar) => bar.heightPx === 40)).toBe(true);
    expect(bars.find((bar) => bar.budget.id === 2)?.isOver).toBe(true);
    expect(bars.find((bar) => bar.budget.id === 1)?.isOver).toBe(false);
  });

  it("chooses inline display for short bars and stacked for tall bars", () => {
    const bars = computeBudgetBars(
      [
        makeBudget({ id: 1, remaining: 1000 }),
        makeBudget({ id: 2, remaining: 10 }),
      ],
      { maxPx: 190, minPx: 40, inlineThresholdPx: 64 },
    );
    expect(bars[0].display).toBe("stack");
    expect(bars[1].display).toBe("inline");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/lib/budget-chart.test.ts`
Expected: FAIL — cannot resolve `./budget-chart`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/budget-chart.ts`:

```ts
import type { BudgetListItem } from "@/types/budget-weekly";

export type BudgetBarDisplay = "stack" | "inline";

export interface BudgetBar {
  budget: BudgetListItem;
  heightPx: number;
  isOver: boolean;
  display: BudgetBarDisplay;
}

export interface ComputeBudgetBarsOptions {
  maxPx?: number;
  minPx?: number;
  inlineThresholdPx?: number;
}

const DEFAULT_MAX_PX = 190;
const DEFAULT_MIN_PX = 40;
const DEFAULT_INLINE_THRESHOLD_PX = 64;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const computeBudgetBars = (
  budgets: BudgetListItem[],
  options: ComputeBudgetBarsOptions = {},
): BudgetBar[] => {
  const maxPx = options.maxPx ?? DEFAULT_MAX_PX;
  const minPx = options.minPx ?? DEFAULT_MIN_PX;
  const inlineThresholdPx =
    options.inlineThresholdPx ?? DEFAULT_INLINE_THRESHOLD_PX;

  if (budgets.length === 0) {
    return [];
  }

  const sorted = [...budgets].sort((a, b) => {
    if (b.remaining !== a.remaining) {
      return b.remaining - a.remaining;
    }
    if (a.name !== b.name) {
      return a.name.localeCompare(b.name);
    }
    return a.id - b.id;
  });

  const maxRemaining = sorted[0].remaining;

  return sorted.map((budget) => {
    const isOver = budget.remaining < 0;
    const heightPx =
      maxRemaining > 0 && budget.remaining > 0
        ? clamp(
            Math.round((maxPx * budget.remaining) / maxRemaining),
            minPx,
            maxPx,
          )
        : minPx;
    const display: BudgetBarDisplay =
      heightPx < inlineThresholdPx ? "inline" : "stack";

    return { budget, heightPx, isOver, display };
  });
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/lib/budget-chart.test.ts`
Expected: PASS (7 tests green).

- [ ] **Step 5: Format, lint, commit**

```bash
rtk bunx prettier --write src/lib/budget-chart.ts src/lib/budget-chart.test.ts
rtk bunx prettier --check src/lib/budget-chart.ts src/lib/budget-chart.test.ts
rtk bunx eslint src/lib/budget-chart.ts src/lib/budget-chart.test.ts
git add src/lib/budget-chart.ts src/lib/budget-chart.test.ts
git commit -m "feat: add computeBudgetBars chart helper"
```

---

## Task 3: `BudgetRemainingChart` component

**Files:**
- Create: `src/components/BudgetRemainingChart.tsx`
- Test: `src/components/BudgetRemainingChart.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/BudgetRemainingChart.test.tsx`:

```tsx
import React from "react";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import BudgetRemainingChart from "./BudgetRemainingChart";
import type { BudgetListItem } from "@/types/budget-weekly";

const makeBudget = (overrides: Partial<BudgetListItem>): BudgetListItem => ({
  id: 1,
  name: "Budget",
  icon: "💰",
  color: "lime",
  amount: 1000,
  spent: 0,
  remaining: 1000,
  period: "week",
  periodStartDate: "2026-05-25",
  periodEndDate: null,
  ...overrides,
});

describe("BudgetRemainingChart", () => {
  it("renders nothing when there are no budgets", () => {
    const { container } = render(
      <BudgetRemainingChart budgets={[]} onSelect={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders one bar per budget", () => {
    render(
      <BudgetRemainingChart
        budgets={[
          makeBudget({ id: 1, name: "Coffee", remaining: 220000 }),
          makeBudget({ id: 2, name: "Transport", remaining: 150000 }),
        ]}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("calls onSelect with the tapped budget", () => {
    const onSelect = vi.fn();
    const coffee = makeBudget({ id: 7, name: "Coffee", remaining: 220000 });
    render(<BudgetRemainingChart budgets={[coffee]} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledWith(coffee);
  });

  it("shows a signed negative amount for an over-budget bar", () => {
    render(
      <BudgetRemainingChart
        budgets={[makeBudget({ id: 3, name: "Clothes", remaining: -120000 })]}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("-120K")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/components/BudgetRemainingChart.test.tsx`
Expected: FAIL — cannot resolve `./BudgetRemainingChart`.

- [ ] **Step 3: Write the implementation**

Create `src/components/BudgetRemainingChart.tsx`:

```tsx
"use client";

import {
  getBudgetColorOption,
  normalizeBudgetColor,
} from "@/lib/budget-appearance";
import { computeBudgetBars } from "@/lib/budget-chart";
import { cn, formatVndCompact } from "@/lib/utils";
import type { BudgetListItem } from "@/types/budget-weekly";

interface BudgetRemainingChartProps {
  budgets: BudgetListItem[];
  onSelect: (budget: BudgetListItem) => void;
}

const BudgetRemainingChart = ({
  budgets,
  onSelect,
}: BudgetRemainingChartProps) => {
  const bars = computeBudgetBars(budgets);

  if (bars.length === 0) {
    return null;
  }

  return (
    <div className="no-scrollbar -mx-4 flex items-end gap-2.5 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
      {bars.map((bar) => {
        const colorOption = getBudgetColorOption(
          normalizeBudgetColor(bar.budget.color),
        );
        const isInline = bar.display === "inline";

        return (
          <button
            key={bar.budget.id}
            type="button"
            onClick={() => onSelect(bar.budget)}
            aria-label={`${bar.budget.name}: ${formatVndCompact(
              bar.budget.remaining,
            )} remaining`}
            style={{ height: `${bar.heightPx}px` }}
            className={cn(
              "flex w-[88px] flex-none flex-col items-center justify-end rounded-[22px] px-2 pb-3 transition-transform active:scale-[0.98]",
              "focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
              bar.isOver
                ? "bg-destructive text-destructive-foreground"
                : cn(colorOption.swatchClassName, "text-background"),
              isInline && "flex-row justify-center gap-1.5 pb-0",
            )}
          >
            <span className={cn("leading-none", isInline ? "text-sm" : "text-xl")}>
              {bar.budget.icon || "💰"}
            </span>
            <span
              className={cn(
                "font-bold leading-none",
                isInline ? "text-xs" : "mt-1.5 text-sm",
              )}
            >
              {formatVndCompact(bar.budget.remaining)}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default BudgetRemainingChart;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/components/BudgetRemainingChart.test.tsx`
Expected: PASS (4 tests green).

- [ ] **Step 5: Format, lint, commit**

```bash
rtk bunx prettier --write src/components/BudgetRemainingChart.tsx src/components/BudgetRemainingChart.test.tsx
rtk bunx prettier --check src/components/BudgetRemainingChart.tsx src/components/BudgetRemainingChart.test.tsx
rtk bunx eslint src/components/BudgetRemainingChart.tsx src/components/BudgetRemainingChart.test.tsx
git add src/components/BudgetRemainingChart.tsx src/components/BudgetRemainingChart.test.tsx
git commit -m "feat: add BudgetRemainingChart component"
```

---

## Task 4: Integrate the chart into the three tab branches

**Files:**
- Modify: `src/components/BudgetWeeklyBudgetsClient.tsx`

This task wires `BudgetRemainingChart` above the summary strip in each tab, using a single shared detail-opener.

- [ ] **Step 1: Import the chart component**

Add to the component-imports group near the other `@/components/*` default imports (e.g. beside the `BudgetBadge` import):

```tsx
import BudgetRemainingChart from "@/components/BudgetRemainingChart";
```

- [ ] **Step 2: Add a shared detail-opener handler**

Inside the `BudgetWeeklyBudgetsClient` component body, near the existing `setDetailBudget` / `setDetailOpen` state, add:

```tsx
const openBudgetDetail = (budget: BudgetListItem) => {
  setDetailBudget(budget);
  setDetailOpen(true);
};
```

- [ ] **Step 3: Insert the chart in the Monthly branch**

In the `activeTab === "month"` branch, immediately **before** the `renderSectionSummary(monthSummary, …)` call (right after the closing `</div>` of the month chips scroller), add:

```tsx
<BudgetRemainingChart
  budgets={filteredMonthlyBudgets}
  onSelect={openBudgetDetail}
/>
```

- [ ] **Step 4: Insert the chart in the Weekly branch**

In the `activeTab === "week"` branch, immediately **before** the `activeWeekGroup ? renderSectionSummary(activeWeekGroup.summary, …)` block (after the week-chips scroller `</div>`), add:

```tsx
<BudgetRemainingChart
  budgets={activeWeekGroup?.budgets ?? []}
  onSelect={openBudgetDetail}
/>
```

- [ ] **Step 5: Insert the chart in the Custom branch**

In the `activeTab === "custom"` branch, immediately **before** the `renderSectionSummary(customSummary, …)` call, add:

```tsx
<BudgetRemainingChart
  budgets={sortedCustomBudgets}
  onSelect={openBudgetDetail}
/>
```

- [ ] **Step 6: Run the client tests**

Run: `bunx vitest run src/components/BudgetWeeklyBudgetsClient.test.tsx src/components/BudgetWeeklyBudgetsClient.mascot.test.tsx`
Expected: PASS — existing tests stay green (chart renders `null` under the mocked empty query data, so no assertions break).

- [ ] **Step 7: Format, lint, commit**

```bash
rtk bunx prettier --write src/components/BudgetWeeklyBudgetsClient.tsx
rtk bunx prettier --check src/components/BudgetWeeklyBudgetsClient.tsx
rtk bunx eslint src/components/BudgetWeeklyBudgetsClient.tsx
git add src/components/BudgetWeeklyBudgetsClient.tsx
git commit -m "feat: show remaining budget chart in each budgets tab"
```

---

## Task 5: Restructure the header & remove the floating add button

**Files:**
- Modify: `src/components/BudgetWeeklyBudgetsClient.tsx`

- [ ] **Step 1: Replace the header markup**

Find the header block (currently the `<div className="flex items-center justify-between gap-2">` containing the back-button `<Link href="/">`, the title, the subtitle paragraph, and the `hidden … sm:flex` "Add budget" button). Replace that entire `justify-between` block with:

```tsx
<div className="flex items-center justify-between gap-2">
  <h1 className="text-foreground text-xl leading-none font-semibold">
    Budgets
  </h1>
  <Button
    onClick={openCreate}
    size="icon"
    aria-label="Add budget"
    className="h-11 w-11 rounded-xl active:scale-[0.97]"
  >
    <Plus className="h-5 w-5" />
  </Button>
</div>
```

This removes the back button, the "Compact view with detail drawer…" subtitle, and the old text add button in one edit. Leave the surrounding sticky container, the tab control below it, and `openCreate` untouched.

- [ ] **Step 2: Remove the mobile floating add button**

Delete the entire floating-button block (the `<div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+102px)] z-40 flex justify-center px-4 sm:hidden">` … `</div>` wrapper and its inner `Button`). The header add button is now always visible, so this is redundant.

- [ ] **Step 3: Remove the now-unused imports**

- Delete the `import Link from "next/link";` line (the back button was its only use).
- Remove `ArrowLeftIcon` from the `lucide-react` import block (its only use was the back button).
- Keep `Plus` — it is still used by the header button and the create sheet.

- [ ] **Step 4: Verify no stale references remain**

Run: `rg -n "ArrowLeftIcon|next/link|sm:hidden\"" src/components/BudgetWeeklyBudgetsClient.tsx`
Expected: no matches for `ArrowLeftIcon` or `next/link`. (Confirm the floating-button `sm:hidden` block is gone; any unrelated `sm:hidden` match is fine.)

- [ ] **Step 5: Run the client tests**

Run: `bunx vitest run src/components/BudgetWeeklyBudgetsClient.test.tsx src/components/BudgetWeeklyBudgetsClient.mascot.test.tsx`
Expected: PASS. If a test asserted the old subtitle text or back-button label, update that assertion to match the new header (title "Budgets" + add button with `aria-label="Add budget"`), then re-run.

- [ ] **Step 6: Format, lint, commit**

```bash
rtk bunx prettier --write src/components/BudgetWeeklyBudgetsClient.tsx
rtk bunx prettier --check src/components/BudgetWeeklyBudgetsClient.tsx
rtk bunx eslint src/components/BudgetWeeklyBudgetsClient.tsx
git add src/components/BudgetWeeklyBudgetsClient.tsx
git commit -m "refactor: simplify budgets header and drop floating add button"
```

---

## Task 6: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full affected test set**

Run: `bunx vitest run src/lib/utils.test.ts src/lib/budget-chart.test.ts src/components/BudgetRemainingChart.test.tsx src/components/BudgetWeeklyBudgetsClient.test.tsx src/components/BudgetWeeklyBudgetsClient.mascot.test.tsx`
Expected: all PASS.

- [ ] **Step 2: Lint the full modified scope**

Run: `rtk bunx eslint src/lib/utils.ts src/lib/budget-chart.ts src/components/BudgetRemainingChart.tsx src/components/BudgetWeeklyBudgetsClient.tsx`
Expected: no errors.

- [ ] **Step 3: Visually verify in the dev app (mobile viewport)**

Run: `bun run dev`, open `/budgets` at an iPhone 13/14 width, and confirm:
- Header shows only the "Budgets" title and a square `＋` add button; no back button or subtitle.
- Each tab (Weekly / Monthly / Custom) shows the bar chart above the summary, sorted with the largest remaining on the left.
- Tall bars show emoji + amount stacked; short/over bars show inline `emoji amount`; over-budget bars are rose with a `-` amount.
- Tapping a bar opens the same detail drawer as tapping a list row.
- A tab/period with no budgets shows the empty state and no chart.

- [ ] **Step 4: Build before pushing**

Run: `npm run build`
Expected: build succeeds. Only run this once, here, before pushing.

---

## Post-implementation refinements (beyond the original 6 tasks)

After the plan's tasks landed, the page was polished further on branch
`dev-polish-budgets-page`. These are reflected in the design spec
(`docs/superpowers/specs/2026-05-29-polish-budgets-page-design.md`):

- **Header tabs → pill `Select`.** The `role="tablist"` segmented control was
  replaced with a borderless rounded-full `Select` pill (`VIEW_SELECT_TRIGGER_CLASS`).
- **Period chips → pill `Select`.** The Weekly/Monthly horizontal chip scrollers
  were replaced with a second pill `Select` beside the type select; the
  `useHorizontalFadeMask` hook and `monthFade`/`weekFade` were removed.
- **Add button.** Now a glass `bg-white/10` `rounded-full` icon button with a
  `Wallet` icon tinted `text-primary` (no `backdrop-blur` on the button).
- **Title** bumped to `text-2xl font-bold`.
- **Header blur.** Adopted the shared masked-blur class, renamed
  `.spending-header-gradient` → `.app-header-blur` (globals.css + home header).
  The home payer `Select` trigger was also made borderless.
- **Summary card** redesigned around a hero "Remaining" figure + aggregate
  spent/budgeted progress bar, borderless soft-shadow surface, `tabular-nums`.
- **Chart bar width** set to `w-[82px]` (4 bars per iPhone 13 viewport).
- **Bottom spacing** moved to safe-area insets across home, bottom nav, and budgets
  (dropped fixed `pb-28` / `pb-6` / `+40px` / `+1rem`).
