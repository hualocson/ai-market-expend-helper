# Spending Heatmap Chart — Design

**Status:** Draft
**Date:** 2026-05-17
**Scope:** Replace the area chart on `/` with a calendar-style spending heatmap.

## Goal

Swap the daily-spending area chart in `SpendingDashboardHeader` for a heatmap rendered as a 7-column calendar grid. Same data, different encoding: each day cell's color intensity reflects how that day's spend compares to other days in the same month.

## Non-goals

- Multi-month or year-at-a-glance heatmaps.
- Per-payer color overlays inside a single cell.
- Click-through from a day to its transaction list.
- Animations on bucket transitions when the payer changes.

## User-facing behavior

- The home page (`/`) renders a 7-column calendar grid for the active month, with weekday headers (`Mon … Sun`) on top.
- Each in-month day is a tappable button. Background opacity encodes spending magnitude using five quantile buckets:
  - Bucket 0 — no spend that day → transparent.
  - Buckets 1–4 — quartiles of the **non-zero** days for the month → increasing `--accent` opacity (`18% / 35% / 55% / 80%`).
- Leading and trailing cells from the neighboring months display their day numbers in a muted style and are non-interactive.
- Tapping a day toggles selection. A persistent detail row below the grid shows `Day {n} · {amount} VND` for the selected day, or a hint (`Tap a day to see details`) when none is selected. If the month has no spending at all, the row reads `No spending in {Month YYYY}`.
- A small legend strip in the bottom-right of the card shows the five-bucket gradient with `Less … More` labels.
- Switching the payer (existing selector) re-renders the heatmap with that payer's totals and clears the selection.

## Architecture

### Files touched

| File | Change |
|------|--------|
| `src/components/SpendingTrendChart.tsx` | **Delete.** Replaced by the new heatmap component. |
| `src/components/SpendingHeatmapChart.tsx` | **New.** Client component, ~80 lines. Renders the grid, owns selected-day state, renders detail row + legend. |
| `src/components/SpendingDashboardHeader.tsx` | Pass `activeMonth: string` (`YYYY-MM`) to the client, alongside existing `totalsByPayer`. |
| `src/components/SpendingDashboardHeaderClient.tsx` | Replace `SpendingTrendChart` import + JSX with `SpendingHeatmapChart`. Pass `activeMonth` plus the active payer's `totals`. Change the card header label from `"Spending trend"` to `"Spending heatmap"`. |
| `src/lib/heatmap-buckets.ts` | **New.** Pure helper `getQuantileBuckets(totals: number[]): number[]`. |
| `src/lib/heatmap-buckets.test.ts` | **New.** Unit tests for the helper. |

No new dependencies. No DB query changes. No route changes.

### Data flow

```
SpendingDashboardHeader (server, async)
  └─ queries Drizzle, builds totalsByPayer + activeMonth string
     └─ SpendingDashboardHeaderClient (client)
        ├─ owns payer selector state
        └─ SpendingHeatmapChart (client, leaf)
           ├─ derives daysInMonth + firstWeekday from activeMonth via dayjs
           ├─ calls getQuantileBuckets(totals)
           └─ owns selectedDay state
```

The server-side query and aggregation in `SpendingDashboardHeader` are unchanged. We just additionally surface the month string the server already computed.

### `SpendingHeatmapChart` props

```ts
type SpendingHeatmapChartProps = {
  totals: number[];        // length = daysInMonth, index 0 = day 1
  activeMonth: string;     // "YYYY-MM"
};
```

### Internal layout

The component renders a single card-fragment (no outer card — the existing `ds-glass` container in `SpendingDashboardHeaderClient` already wraps it):

1. **Grid** — `<div role="grid" className="grid grid-cols-7 gap-1.5">`
   - Weekday header row (7 muted `<span>`s).
   - Leading pad cells — dim day numbers from the previous month, `pointer-events-none`, no background fill.
   - Active-month cells — `<button>` per day, background driven by bucket, `aria-label="Day {n}, {formatted amount} VND"`, `aria-pressed`, focusable.
   - Trailing pad cells — same treatment as leading.
2. **Detail row** — flex row below the grid. Uses the same `font-mono tabular-nums` treatment as the existing "Total spent" tile.
3. **Legend strip** — bottom-right: 5 mini-squares with `Less` … `More` labels, `text-[10px]` muted.

### Color mapping

Bucket → `--accent` opacity percentages: `[0, 18, 35, 55, 80]`. Applied via inline style:

```ts
backgroundColor: `color-mix(in srgb, var(--accent) ${OPACITY[bucket]}%, transparent)`
```

Selected day adds a `ring-2 ring-foreground/60` outline; no change to bucket color.

## Bucket math

```ts
export const getQuantileBuckets = (totals: number[]): number[] => {
  const nonZero = totals.filter((t) => t > 0).sort((a, b) => a - b);
  if (nonZero.length === 0) return totals.map(() => 0);

  const q = (p: number) => nonZero[Math.floor((nonZero.length - 1) * p)];
  const q25 = q(0.25);
  const q50 = q(0.5);
  const q75 = q(0.75);

  return totals.map((t) => {
    if (t <= 0) return 0;
    if (t <= q25) return 1;
    if (t <= q50) return 2;
    if (t <= q75) return 3;
    return 4;
  });
};
```

Quantiles are computed over **non-zero days only**, so a month with many zero days doesn't compress every spending day into the top bucket.

## Edge cases

| Case | Behavior |
|------|----------|
| Month has zero spending | All cells render bucket 0 (transparent). Detail row shows `No spending in {Month YYYY}`. Legend still rendered. |
| Single non-zero day | That day is bucket 4; rest are bucket 0. Acceptable — it's the truth. |
| All non-zero days have identical amounts | Quartile boundaries collapse; every non-zero day lands in bucket 4. Acceptable. |
| Payer with zero spend (after selector change) | Same as the empty-month case. |
| Payer or month changes while a day is selected | `useEffect(() => setSelectedDay(null), [totals])` resets selection on every change of the totals reference. |
| Locale week start | Use `dayjs.weekday()` / configured locale (existing `@/configs/date`); weekday headers and leading-pad calculation honor whatever start-of-week is configured there. |

## Accessibility

- Each in-month cell is a `<button>` with an `aria-label` containing the day number and formatted amount, and `aria-pressed` reflecting selection.
- Pad cells are non-focusable (`<span>` with `pointer-events-none`).
- The grid container uses `role="grid"`.
- Color is not the sole signal: every cell exposes its amount via `aria-label`, and the detail row provides the same information for the currently selected day.

## Testing

- **Unit (`src/lib/heatmap-buckets.test.ts`):**
  - All-zero input → all zeros.
  - All-equal non-zero → all 4s.
  - Single non-zero day → one 4, rest 0.
  - Well-distributed sample → asserts 0/1/2/3/4 mapping at known thresholds.
  - Monotonicity → for any two non-zero indices `i`, `j`, `totals[i] < totals[j]` implies `bucket[i] ≤ bucket[j]`.
- **No component-level test** for the heatmap UI itself (per `.agents/rules/nextjs-code.md` §11 and `AGENTS.md`).
- **Manual verification** on the dev server:
  - Current month with mixed spending — colors visibly differ across days.
  - Payer with zero spend — empty-month rendering.
  - Tap a day, tap again to deselect, tap a different day.
  - Keyboard: focus moves through day buttons, Enter/Space toggles selection.
  - Mobile width (~max-w-md) — cells stay legible, grid doesn't overflow.

## Risks and open questions

- **Card label change** — `"Spending trend"` → `"Spending heatmap"` is a small copy change; flagging here so it isn't a surprise during review.
- **Start-of-week assumption** — relying on the existing `@/configs/date` config; if no explicit locale is set, dayjs defaults to Sunday-start. Implementation should read `dayjs().localeData().firstDayOfWeek()` rather than hard-coding.

## Rollout

Single PR. No feature flag, no migration. The change is purely client-rendering; the server query is unchanged save for additionally surfacing the month string.
