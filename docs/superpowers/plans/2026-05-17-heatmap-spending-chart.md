# Spending Heatmap Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the area chart on `/` with a calendar-style spending heatmap that maps each day's total to one of five quantile color buckets.

**Architecture:** Single-callsite swap. A new client component `SpendingHeatmapChart` renders a CSS-grid calendar. A pure helper `getQuantileBuckets` computes bucket indices. The server component additionally surfaces the active month in `YYYY-MM` format; no DB query changes.

**Tech Stack:** Next.js 15 App Router · React 19 · TypeScript · Tailwind v4 · dayjs · Vitest.

**Spec:** `docs/superpowers/specs/2026-05-17-heatmap-spending-chart-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/heatmap-buckets.ts` | Create | Pure helper: total → quantile bucket index. |
| `src/lib/heatmap-buckets.test.ts` | Create | Unit tests for the helper. |
| `src/components/SpendingHeatmapChart.tsx` | Create | Client component: renders the calendar grid, detail row, legend. Owns selected-day state. |
| `src/components/SpendingTrendChart.tsx` | Delete | Replaced by the heatmap chart. |
| `src/components/SpendingDashboardHeader.tsx` | Modify | Pass `activeMonth: string` (`YYYY-MM`) to the client. |
| `src/components/SpendingDashboardHeaderClient.tsx` | Modify | Accept `activeMonth`, render `SpendingHeatmapChart` instead of `SpendingTrendChart`, change card label. |

**Conventions:**
- Week starts on Monday (consistent with VN locale; spec note resolved by hardcoding rather than adding a dayjs plugin).
- `dayjs(activeMonth, "YYYY-MM", true)` parses; `.day()` returns `0=Sun..6=Sat` which we convert to `0=Mon..6=Sun` via `(day + 6) % 7`.

---

## Task 1: Quantile bucket helper

**Files:**
- Create: `src/lib/heatmap-buckets.ts`
- Test: `src/lib/heatmap-buckets.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/heatmap-buckets.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { getQuantileBuckets } from "@/lib/heatmap-buckets";

describe("getQuantileBuckets", () => {
  it("returns all zeros when every total is zero", () => {
    expect(getQuantileBuckets([0, 0, 0, 0, 0])).toEqual([0, 0, 0, 0, 0]);
  });

  it("returns all zeros for an empty input", () => {
    expect(getQuantileBuckets([])).toEqual([]);
  });

  it("maps a single non-zero day to bucket 4 and zeros for the rest", () => {
    expect(getQuantileBuckets([0, 0, 100, 0, 0])).toEqual([0, 0, 4, 0, 0]);
  });

  it("maps every non-zero day to bucket 4 when all non-zero values are equal", () => {
    expect(getQuantileBuckets([0, 50, 50, 50, 50])).toEqual([0, 4, 4, 4, 4]);
  });

  it("distributes a well-spread set across buckets 1..4", () => {
    // non-zero sorted: [10, 20, 30, 40, 50, 60, 70, 80]
    // q25 index = floor(7*0.25)=1 -> 20
    // q50 index = floor(7*0.5)=3 -> 40
    // q75 index = floor(7*0.75)=5 -> 60
    // buckets: <=20 -> 1, <=40 -> 2, <=60 -> 3, else -> 4
    const totals = [10, 20, 30, 40, 50, 60, 70, 80];
    expect(getQuantileBuckets(totals)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
  });

  it("preserves monotonicity: larger total never gets a smaller bucket", () => {
    const totals = [0, 5, 5, 12, 12, 33, 33, 90, 90, 200];
    const buckets = getQuantileBuckets(totals);
    for (let i = 0; i < totals.length; i++) {
      for (let j = 0; j < totals.length; j++) {
        if (totals[i] < totals[j]) {
          expect(buckets[i]).toBeLessThanOrEqual(buckets[j]);
        }
      }
    }
  });

  it("treats negative totals as zero spend (bucket 0)", () => {
    expect(getQuantileBuckets([-5, 0, 10, 20])).toEqual([0, 0, 4, 4]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/lib/heatmap-buckets.test.ts`
Expected: FAIL — module `@/lib/heatmap-buckets` cannot be resolved.

- [ ] **Step 3: Implement the helper**

Create `src/lib/heatmap-buckets.ts`:

```ts
export const getQuantileBuckets = (totals: number[]): number[] => {
  const nonZero = totals.filter((t) => t > 0).sort((a, b) => a - b);
  if (nonZero.length === 0) {
    return totals.map(() => 0);
  }

  const q = (p: number) => nonZero[Math.floor((nonZero.length - 1) * p)];
  const q25 = q(0.25);
  const q50 = q(0.5);
  const q75 = q(0.75);

  // Degenerate distribution (1 unique value or 1 non-zero day): all
  // quartiles collapse, and the main mapper's `t <= q25` would misroute
  // the single non-zero value to bucket 1. Promote those days to bucket 4.
  if (q25 === q50 && q50 === q75) {
    return totals.map((t) => (t > 0 ? 4 : 0));
  }

  return totals.map((t) => {
    if (t <= 0) {
      return 0;
    }
    if (t <= q25) {
      return 1;
    }
    if (t <= q50) {
      return 2;
    }
    if (t <= q75) {
      return 3;
    }
    return 4;
  });
};
```

**Note:** All `if` statements need braces — the project's ESLint config sets `curly: "error"`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/lib/heatmap-buckets.test.ts`
Expected: PASS — 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/heatmap-buckets.ts src/lib/heatmap-buckets.test.ts
git commit -m "feat(heatmap): add quantile bucket helper"
```

---

## Task 2: SpendingHeatmapChart component

**Files:**
- Create: `src/components/SpendingHeatmapChart.tsx`

This task is a pure UI component with no test (per `.agents/rules/nextjs-code.md` §11 — no snapshot/component tests for dynamic UI). Verification is manual in Task 5.

- [ ] **Step 1: Create the component file**

Create `src/components/SpendingHeatmapChart.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";

import dayjs from "@/configs/date";
import { getQuantileBuckets } from "@/lib/heatmap-buckets";
import { cn, formatVnd } from "@/lib/utils";

type SpendingHeatmapChartProps = {
  totals: number[];
  activeMonth: string;
};

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const BUCKET_OPACITY = [0, 18, 35, 55, 80] as const;

const bucketStyle = (bucket: number): React.CSSProperties => ({
  backgroundColor: `color-mix(in srgb, var(--accent) ${BUCKET_OPACITY[bucket]}%, transparent)`,
});

const toMondayIndex = (sundayBasedDay: number) => (sundayBasedDay + 6) % 7;

const SpendingHeatmapChart = ({
  totals,
  activeMonth,
}: SpendingHeatmapChartProps) => {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  useEffect(() => {
    setSelectedDay(null);
  }, [totals]);

  const parsed = dayjs(activeMonth, "YYYY-MM", true);
  const monthStart = parsed.isValid() ? parsed.startOf("month") : dayjs().startOf("month");
  const daysInMonth = monthStart.daysInMonth();
  const monthLabel = monthStart.format("MMMM YYYY");
  const leadingPad = toMondayIndex(monthStart.day());
  const trailingPad = (7 - ((leadingPad + daysInMonth) % 7)) % 7;

  const buckets = useMemo(() => getQuantileBuckets(totals), [totals]);
  const totalSpend = useMemo(
    () => totals.reduce((sum, t) => sum + t, 0),
    [totals]
  );

  const leadingDays = useMemo(
    () =>
      Array.from({ length: leadingPad }, (_, i) =>
        monthStart.subtract(leadingPad - i, "day").date()
      ),
    [leadingPad, monthStart]
  );

  const trailingDays = useMemo(
    () => Array.from({ length: trailingPad }, (_, i) => i + 1),
    [trailingPad]
  );

  const detailMessage = (() => {
    if (totalSpend === 0) {
      return `No spending in ${monthLabel}`;
    }
    if (selectedDay === null) {
      return "Tap a day to see details";
    }
    const amount = totals[selectedDay - 1] ?? 0;
    return `Day ${selectedDay} · ${formatVnd(amount)} VND`;
  })();

  return (
    <div className="flex flex-col gap-3">
      <div role="grid" className="grid grid-cols-7 gap-1.5">
        {WEEKDAY_LABELS.map((label) => (
          <span
            key={label}
            className="text-muted-foreground text-center text-[10px] font-semibold tracking-[0.18em] uppercase"
          >
            {label}
          </span>
        ))}

        {leadingDays.map((day, index) => (
          <span
            key={`lead-${index}`}
            aria-hidden="true"
            className="text-muted-foreground/40 pointer-events-none flex aspect-square items-center justify-center rounded-md text-[11px] tabular-nums"
          >
            {day}
          </span>
        ))}

        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const amount = totals[day - 1] ?? 0;
          const bucket = buckets[day - 1] ?? 0;
          const isSelected = selectedDay === day;
          return (
            <button
              key={day}
              type="button"
              aria-pressed={isSelected}
              aria-label={`Day ${day}, ${formatVnd(amount)} VND`}
              onClick={() =>
                setSelectedDay((prev) => (prev === day ? null : day))
              }
              style={bucketStyle(bucket)}
              className={cn(
                "border-border/50 text-foreground/90 focus-visible:ring-ring/40 flex aspect-square items-center justify-center rounded-md border text-[11px] font-medium tabular-nums transition focus-visible:ring-2 focus-visible:outline-none",
                isSelected && "ring-foreground/60 ring-2"
              )}
            >
              {day}
            </button>
          );
        })}

        {trailingDays.map((day, index) => (
          <span
            key={`trail-${index}`}
            aria-hidden="true"
            className="text-muted-foreground/40 pointer-events-none flex aspect-square items-center justify-center rounded-md text-[11px] tabular-nums"
          >
            {day}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-foreground/80 font-mono text-sm tabular-nums">
          {detailMessage}
        </p>

        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground text-[10px] tracking-[0.18em] uppercase">
            Less
          </span>
          {BUCKET_OPACITY.map((_, bucket) => (
            <span
              key={bucket}
              aria-hidden="true"
              style={bucketStyle(bucket)}
              className="border-border/50 h-3 w-3 rounded-sm border"
            />
          ))}
          <span className="text-muted-foreground text-[10px] tracking-[0.18em] uppercase">
            More
          </span>
        </div>
      </div>
    </div>
  );
};

export default SpendingHeatmapChart;
```

- [ ] **Step 2: Type-check the new file**

Run: `npx tsc --noEmit`
Expected: PASS — no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/SpendingHeatmapChart.tsx
git commit -m "feat(heatmap): add SpendingHeatmapChart component"
```

---

## Task 3: Wire `activeMonth` from server to client

**Files:**
- Modify: `src/components/SpendingDashboardHeader.tsx`
- Modify: `src/components/SpendingDashboardHeaderClient.tsx`

- [ ] **Step 1: Pass `activeMonth` from the server component**

In `src/components/SpendingDashboardHeader.tsx`, locate the `return` block at line ~99 that renders `SpendingDashboardHeaderClient`. Add an `activeMonth` prop with the `YYYY-MM` string:

```tsx
  return (
    <SpendingDashboardHeaderClient
      activeMonth={activeMonth.format("YYYY-MM")}
      activeMonthLabel={activeMonth.format("MMMM YYYY")}
      payerOptions={Object.keys(totalsForDisplay)}
      totalsByPayer={totalsForDisplay}
    />
  );
```

- [ ] **Step 2: Accept `activeMonth` on the client component**

In `src/components/SpendingDashboardHeaderClient.tsx`, update the props type and destructure:

```tsx
type SpendingDashboardHeaderClientProps = {
  activeMonth: string;
  activeMonthLabel: string;
  payerOptions: string[];
  totalsByPayer: Record<string, { total: number; totals: number[] }>;
};

const SpendingDashboardHeaderClient = ({
  activeMonth,
  activeMonthLabel,
  payerOptions,
  totalsByPayer,
}: SpendingDashboardHeaderClientProps) => {
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/SpendingDashboardHeader.tsx src/components/SpendingDashboardHeaderClient.tsx
git commit -m "feat(heatmap): pass activeMonth string from server to client header"
```

---

## Task 4: Swap chart in client header, delete old chart

**Files:**
- Modify: `src/components/SpendingDashboardHeaderClient.tsx`
- Delete: `src/components/SpendingTrendChart.tsx`

- [ ] **Step 1: Replace the chart import and JSX**

In `src/components/SpendingDashboardHeaderClient.tsx`:

Replace the import:

```tsx
import SpendingHeatmapChart from "@/components/SpendingHeatmapChart";
```

(remove the `import SpendingTrendChart from "@/components/SpendingTrendChart";` line.)

Update the card to use the new label and component (the existing block currently reads `Spending trend` and renders `<SpendingTrendChart totals={...} />`):

```tsx
        <div className="ds-glass rounded-[28px] border p-4">
          <div className="flex items-center justify-between">
            <p className="text-foreground/80 text-xs font-semibold">
              Spending heatmap
            </p>
            <span className="text-muted-foreground bg-surface-3 border-border/70 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[0.2em] uppercase">
              This month
            </span>
          </div>

          <div className="mt-4">
            <SpendingHeatmapChart
              activeMonth={activeMonth}
              totals={activeTotals?.totals ?? []}
            />
          </div>
        </div>
```

- [ ] **Step 2: Delete the old chart**

Run: `git rm src/components/SpendingTrendChart.tsx`
Expected: file removed; git index updated.

- [ ] **Step 3: Verify nothing else imports the deleted file**

Run: `grep -rn "SpendingTrendChart" src/`
Expected: no matches.

- [ ] **Step 4: Type-check and run unit tests**

Run: `npx tsc --noEmit`
Expected: PASS.

Run: `bun run test`
Expected: PASS (all existing tests + new heatmap-buckets tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/SpendingDashboardHeaderClient.tsx
git commit -m "feat(heatmap): swap area chart for calendar heatmap on /"
```

---

## Task 5: Manual verification

No code changes; this task verifies the feature end-to-end before considering the work done.

- [ ] **Step 1: Start the dev server**

Run: `bun run dev`
Open the home page in a desktop browser at `max-w-md` width (resize to ~440px) and on a mobile viewport via devtools.

- [ ] **Step 2: Verify mixed-spending month**

Default payer ("All") — confirm:
- 7-column grid with `Mon … Sun` headers.
- Day cells show day numbers, colored by bucket. At least 2–3 distinct shades visible if the month has varied spending.
- Leading/trailing pad cells display prev/next month day numbers in a muted color and do not respond to taps.
- Legend strip shows 5 squares between `Less` and `More`.
- Detail row reads "Tap a day to see details" until a day is tapped.

- [ ] **Step 3: Verify selection interaction**

- Tap a non-zero day → ring outline appears, detail row reads `Day {n} · {amount} VND` with monospace digits.
- Tap the same day again → selection clears, detail row reverts to the hint.
- Tap a different day → ring moves; detail row updates.

- [ ] **Step 4: Verify payer switching**

- Switch the payer selector to another payer. The grid re-colors based on that payer's totals. Selection (if any) is cleared.
- Switch to a payer with no spend (if available) → all cells render at bucket 0 (transparent); detail row reads `No spending in {Month YYYY}`.

- [ ] **Step 5: Verify keyboard accessibility**

- Tab into the grid → focus ring appears on the first day button.
- Arrow / Tab through cells, press Enter or Space → selection toggles like clicks.
- `aria-pressed` reflects state (inspect via devtools accessibility tree).

- [ ] **Step 6: Lint the touched files**

Run: `npx eslint src/lib/heatmap-buckets.ts src/lib/heatmap-buckets.test.ts src/components/SpendingHeatmapChart.tsx src/components/SpendingDashboardHeader.tsx src/components/SpendingDashboardHeaderClient.tsx`
Expected: no errors.

- [ ] **Step 7: Final commit if any tweaks were needed**

If verification surfaced small fixes, commit them with `fix(heatmap): …`. Otherwise no commit needed.
