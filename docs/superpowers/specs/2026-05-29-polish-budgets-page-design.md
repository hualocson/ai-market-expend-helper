# Polish Budgets Page — Design

Date: 2026-05-29
Branch: `dev-polish-budgets-page`

> **Sync note:** This document was updated post-implementation to match what
> actually shipped. The page went further than the original plan: the segmented
> tab control and the period chips both became borderless pill `Select`s, the add
> button became a glass `Wallet` chip, the summary card was redesigned around a
> hero "Remaining" figure, the header adopted the shared masked-blur class, and
> bottom spacing moved to safe-area insets. Those refinements are reflected below.

## Summary

Restructure the Budgets page for a cleaner, more visual mobile layout and add a
horizontally-scrolling **remaining-budget bar chart**. All work is presentational
and client-side. No database, API, query-factory, or mutation changes — the chart
and layout consume the existing `BudgetListItem` shape already loaded by
`BudgetWeeklyBudgetsClient`.

Target viewport: iPhone 13/14 (mobile-first). Dark-mode only. The visual
direction is **borderless** throughout — surfaces are separated by fill + layered
shadow rather than 1px borders (see `make-interfaces-feel-better`: *shadows over
borders*).

## Files in scope

- `src/app/budgets/page.tsx` — unchanged (server prefetch + hydration stays as-is).
- `src/components/BudgetWeeklyBudgetsClient.tsx` — header restructure; type +
  period pill `Select`s; insert the chart into each tab branch; summary redesign;
  remove the mobile floating add button and the chip scrollers.
- New `src/components/BudgetRemainingChart.tsx` — the chart component.
- New `src/lib/budget-chart.ts` — pure `computeBudgetBars` helper (sorting,
  height scaling, display mode).
- `src/lib/utils.ts` — new `formatVndCompact` helper (abbreviated VND, e.g. `220K`,
  `1.7M`, `-120K`); the chart's bar labels use it.
- New tests: `src/lib/budget-chart.test.ts`, `src/lib/utils.test.ts`,
  `src/components/BudgetRemainingChart.test.tsx`.

Cross-cutting (shared header-blur + spacing, touched alongside this work):

- `src/app/globals.css` — the masked-blur header class `.spending-header-gradient`
  was renamed to the generic `.app-header-blur`.
- `src/components/SpendingDashboardHeaderClient.tsx` — uses the renamed class; its
  payer `Select` trigger was made borderless to match the budgets pills.
- `src/components/BottomNav.tsx`, `src/app/page.tsx` — bottom safe-area spacing
  (see *Layout shell & spacing*).

Existing `BudgetWeeklyBudgetsClient` tests must stay green.

## Layout (top to bottom)

1. **Header** — "Budgets" title + glass add button
2. **View selectors** — a row of pill `Select`s: type (Weekly / Monthly / Custom)
   and, for Weekly/Monthly, the period group
3. **Chart** (new)
4. **Summary card** — hero "Remaining"
5. **Budget list**

### 1. Header

- Sticky container uses the shared **`.app-header-blur`** treatment (translucent
  `--background` fill + `backdrop-filter: blur(24px)` + a bottom gradient mask so
  the blur dissolves into the scrolling content — identical to the home header).
- Back button (`<Link href="/">` + `ArrowLeftIcon`) and the subtitle paragraph are
  removed (`BottomNav` provides navigation).
- **"Budgets"** title, left-aligned, `text-2xl leading-none font-bold`.
- A single **glass icon add button**, top-right, always visible — replaces both the
  old `hidden … sm:flex` text button and the mobile floating add button:
  - `variant="ghost"`, `size="icon"`, `h-11 w-11`, **`rounded-full`**.
  - Background `bg-white/10` with an inset top highlight + ambient shadow
    (`shadow-[inset_0_1px_0_…,_0_10px_24px_…]`); **no** `backdrop-blur` on the
    button itself.
  - **`Wallet`** icon tinted `text-primary` (lime), `aria-label="Add budget"`,
    calls the existing `openCreate`, `active:scale-[0.97]`.

### 2. View selectors (replaces segmented tabs + period chips)

Both the old `role="tablist"` sliding-pill segmented control **and** the
horizontal period chips were replaced with borderless pill `Select`s sitting in a
single `mt-3 flex items-center gap-2` row. The shared trigger style is
`VIEW_SELECT_TRIGGER_CLASS`:

```
bg-secondary hover:bg-surface-3 h-10 w-fit gap-1.5 rounded-full border-0 px-4
text-sm font-semibold shadow-none transition active:scale-[0.97]
```

- **Type select** — `value={activeTab}`, options from `DASHBOARD_TABS`
  (Weekly / Monthly / Custom).
- **Period (group) select** — rendered beside the type select, conditional on tab:
  - Monthly → `monthOptions` (`value={monthFilter}`): "All months" / "This month" /
    specific months.
  - Weekly → `weeklyGroups` (`value={activeWeekKey}`), labelled by the full week
    range (e.g. "25 May - 31 May"); rendered only when `weeklyGroups.length > 0`.
  - Custom → no group select (custom has no period grouping).
- `SelectContent` uses `bg-popover border-border rounded-2xl shadow-xl`.

The `useHorizontalFadeMask` hook and the `monthFade`/`weekFade` instances that only
powered the removed chip scrollers were deleted.

### 3. Chart — `BudgetRemainingChart`

A new component rendered in **every** tab branch, placed **above the summary card**.
It receives the **same budget array** the active tab lists:

- Weekly → `activeWeekGroup?.budgets ?? []`
- Monthly → `filteredMonthlyBudgets`
- Custom → `sortedCustomBudgets`

It renders nothing (returns `null`) when the array is empty, so the existing empty
state is the only thing shown for an empty scope.

#### Props

```ts
interface BudgetRemainingChartProps {
  budgets: BudgetListItem[];
  onSelect: (budget: BudgetListItem) => void;
}
```

`onSelect` is wired to the shared `openBudgetDetail(budget)` handler so tapping a
bar behaves exactly like tapping a list row (`setDetailBudget` + `setDetailOpen`).

#### Visual spec

- Horizontal scroll row, bars bottom-aligned (`items-end`), `no-scrollbar`,
  horizontal padding consistent with the page (`-mx-4 px-4 sm:-mx-6 sm:px-6`),
  `gap-2.5`.
- **Bar width `w-[82px]`** (`flex-none`) — tuned so exactly four bars fit an
  iPhone 13 viewport; the rest are reached by horizontal scroll.
- **One bar per budget.** Bars are **sorted by `remaining` descending** — most
  remaining on the left, over-budget (negative remaining) bars trailing right.
- **Bar height encodes `remaining`** on a shared linear axis: the largest
  `remaining` maps to `MAX_BAR_PX`; others scale proportionally. A `MIN_BAR_PX`
  clamp keeps short/negative bars tall enough to hold their label.
- **Fill color = the budget's color** via `getBudgetColorOption` /
  `swatchClassName`, `rounded-[22px]`.
- **Over budget** (`remaining < 0`): fill uses `destructive` (rose) regardless of
  the budget color; amount renders as a signed negative (e.g. `-120K`).
- **In-bar content** (anchored to the bottom of the fill):
  - Tall bars: emoji on top, amount below (stacked, centered).
  - Short bars: inline `emoji  amount` on a single centered row.
  - The switch is driven by the resolved bar height vs. a threshold.
  - No percent, no budget name, no dashed limit outline.
- Amount uses **`formatVndCompact`** (`src/lib/utils.ts`), so it renders abbreviated
  VND (e.g. `220K`, `-120K`).
- Tapping a bar (`button`) calls `onSelect(budget)`.

#### Pure helper — `computeBudgetBars`

Extracted so scaling/sorting/labelling is unit-testable without rendering.

```ts
type BudgetBarDisplay = "stack" | "inline";

interface BudgetBar {
  budget: BudgetListItem;
  heightPx: number;        // resolved pixel height after scaling + clamp
  isOver: boolean;         // remaining < 0
  display: BudgetBarDisplay;
}

function computeBudgetBars(
  budgets: BudgetListItem[],
  options?: { maxPx?: number; minPx?: number; inlineThresholdPx?: number },
): BudgetBar[];
```

Behavior:

- Returns `[]` for an empty input.
- Sorts by `remaining` descending (tie-break by `name` then `id` for deterministic
  test ordering).
- Scale reference is the **maximum `remaining`** across the set. If all remaining
  values are `<= 0`, every bar uses `minPx`.
- `heightPx = clamp(minPx, maxPx, round(maxPx * remaining / maxRemaining))`;
  negative/zero remaining resolves to `minPx`.
- `display = heightPx < inlineThresholdPx ? "inline" : "stack"`.
- Defaults: `maxPx = 190`, `minPx = 40`, `inlineThresholdPx = 64`.

### 4. Summary card — hero "Remaining" (`renderSectionSummary`)

Redesigned from the flat 3-column Budgeted/Spent/Remaining grid into a
remaining-focused card. Positioned between the chart and the list in each tab.

- **Borderless surface**: `bg-card/70` + a two-layer soft shadow (contact +
  ambient via `color-mix(... var(--background) ...)`); no border.
- Header row: title + subtitle on the left, a borderless `bg-muted/50` rounded-full
  **"N budgets"** count chip on the right.
- **Hero figure**: a `Remaining` micro-label over a `text-2xl font-bold` signed
  amount (`formatVndSigned`), colored `text-success` (or `text-destructive` when
  over budget).
- **Subline**: `{spent} spent of {budgeted}` (small, muted, `formatVnd`).
- **Aggregate progress bar**: spent ÷ budgeted, clamped 0–100%, `bg-success`
  (or `bg-destructive` when over), with an animated `transition-[width]` fill that
  respects `motion-reduce`.
- All money figures use **`tabular-nums`** to prevent layout shift.

### 5. Budget list

Unchanged. Existing `renderBudgetItem` rows (badge + signed remaining + status +
progress bar); tap opens the detail drawer (now via the shared `openBudgetDetail`).

## Layout shell & spacing

Bottom spacing relies on the **bottom nav's own footprint + safe-area insets**
rather than fixed reserved padding:

- `src/app/page.tsx`: home content `pb-28` → `standalone:pb-[calc(env(safe-area-inset-bottom))]`.
- `src/components/BudgetWeeklyBudgetsClient.tsx`: dropped the section `pb-6` and the
  content `pt-4 pb-[calc(env(safe-area-inset-bottom)+40px)]` →
  `standalone:pb-[calc(env(safe-area-inset-bottom))]`.
- `src/components/BottomNav.tsx`: nav `pb-[calc(env(safe-area-inset-bottom)+1rem)]`
  → `pb-[calc(env(safe-area-inset-bottom))]`.

## Interaction & edge cases

- **Empty scope:** chart hidden; existing empty state shown.
- **Single budget:** one full-height bar (`maxPx`).
- **All over budget:** all bars at `minPx`, all rose.
- **Mixed signs:** positive bars scale against the max remaining; over-budget bars
  clamp to `minPx` and trail on the right by the descending sort.
- **iOS focus rule:** not applicable — the chart and selects are not part of an
  active text-input workflow, so no `onPointerDown` preventDefault is added (per
  `.agents/rules/ios-input-focus.md`, applied narrowly).

## Testing

- `budget-chart.test.ts` (pure helper):
  - empty input → `[]`
  - descending sort by remaining, deterministic tie-break
  - height scaling against max remaining; proportionality
  - `minPx` clamp for small/zero/negative remaining
  - all-non-positive set → all `minPx`
  - `display` threshold (`inline` vs `stack`)
  - `isOver` flag for `remaining < 0`
- `utils.test.ts` (`formatVndCompact`): thousands → `K`, millions → one-decimal `M`,
  signed negatives, small values rendered plainly, `""` for non-finite input.
- `BudgetRemainingChart.test.tsx` (render):
  - renders one bar per budget
  - tapping a bar calls `onSelect` with the right budget
  - renders nothing for an empty array
  - over-budget bar shows a signed negative amount
- `SpendingDashboardHeaderClient.test.tsx`: assertion updated for the renamed
  `.app-header-blur` class.
- Existing `BudgetWeeklyBudgetsClient.test.tsx` stays green. Note:
  `BudgetWeeklyBudgetsClient.mascot.test.tsx` has 5 **pre-existing** failures
  (a create-drawer "budget icon" flow) that predate this branch and are unrelated.

## Validation (per AGENTS.md)

- `rtk bunx prettier --write` + `--check` and `rtk bunx eslint` on every modified
  `.ts`/`.tsx` file.
- `bunx vitest run` for the new and affected tests.
- `npm run build` only before pushing.

## Out of scope

- No changes to budget data model, API routes, query factories, or mutations.
- No light-mode/theme work.
- No desktop-specific optimization beyond remaining coherent.
- No changes to the detail drawer, transfer drawer, create/edit flows, or budget
  creation logic.
