# Source Budget Picker Redesign — Design

**Date:** 2026-05-16
**Status:** Draft (awaiting implementation plan)

## Summary

Redesign the nested "select source budget" drawer inside `BudgetTransferDrawer`. Today it renders a flat unsorted list of every budget in memory with a single inline `period · remaining` microline. The redesign brings the row visual language in line with the recently-polished transaction budget picker (right-side cluster, colored `formatVndSigned(remaining)`, tabular-nums), groups rows by period instance to disambiguate duplicate names across weeks/months, and switches the list to a lazy server-fetched query so we no longer rely on the parent's full overview.

## Goals

- Mobile-first picker: ≥48px tap targets, sticky destination header, bottom-sheet behavior, single column, no horizontal scroll.
- Disambiguate budgets that share a name across periods (e.g. "Coffee" exists for every week) without forcing the user to read dates inline on every row.
- Surface the operative number for transfers — `remaining` (safe-to-pull cap) — instead of burying it in a microline.
- Stop relying on the parent's full budget array; fetch only the candidates this picker needs.
- Preserve all existing transfer behavior (`transferBudgetAmount` server action, invalidations, "go over budget anyway" override).

## Non-goals

- Changing the transfer mutation, atomicity, or override behavior.
- Search/filter inside the picker (YAGNI; candidate counts stay small).
- Per-row capacity bar (rejected for visual noise).
- Pagination of candidates (a flat cap of 100 is sufficient for now; see Open questions).
- Restructuring the parent `BudgetTransferDrawer` (header, amount input, after-transfer preview, footer button) — only the nested drawer body changes, plus the prop change for `budgets`.

## Decisions (from brainstorming)

| # | Decision | Choice |
|---|---|---|
| 1 | Visual language | Match transaction picker — right-side cluster with `formatVndSigned(remaining)` colored success/destructive |
| 2 | Disambiguation | Group rows by **period instance** ("This week · May 13 – May 19"), not by period type |
| 3 | Sort within group | `remaining` desc; disabled rows fall to bottom of their group |
| 4 | Disabled rule | `remaining <= 0` (was `amount === 0`) — underwater budgets cannot lend |
| 5 | Destination context | Sticky compact card at top of the nested drawer |
| 6 | Fetch strategy | Lazy `useQuery` inside the drawer; new server action returns only candidates |
| 7 | Loading state | Skeleton rows inside the nested drawer body |
| 8 | Mobile focus | Tap targets ≥48px, no hover-only states, tabular-nums VND, sticky header |

## Architecture

Two layers change:

1. **Server action + query** — a new dedicated fetcher returns only transfer candidates for a given destination, so the picker no longer depends on the parent's full overview.
2. **`BudgetTransferDrawer`** — the nested drawer body is rebuilt: sticky destination header, period-instance groups, redesigned rows, skeleton/empty states. The outer drawer (header, amount input, after-transfer preview, footer button) is unchanged.

### Data layer

`src/app/actions/budget-weekly-actions.ts` — add:

```ts
export type TransferCandidate = BudgetListItem;

export type GetTransferCandidatesResult = {
  candidates: TransferCandidate[];
};

export async function getTransferCandidates(input: {
  destinationBudgetId: number;
}): Promise<GetTransferCandidatesResult>;
```

Behavior:
- Reads `budgets` where `id != destinationBudgetId` AND `amount > 0`.
- Orders by `periodStartDate` desc, then `(amount - spent)` desc.
- Caps at 100 rows.
- Returns rows shaped exactly as `BudgetListItem` (joining `spent` the same way the overview does — extract into a shared helper if it isn't already).

The destination's own `BudgetListItem` continues to be passed as a prop; we already have it at the call site and re-fetching it would duplicate work.

`src/lib/queries/budgets.ts` — add:

```ts
export const budgetTransferCandidatesQueryKey = (destinationId: number) =>
  ["budgets", "transfer-candidates", destinationId] as const;
```

No new HTTP route. The drawer calls the server action directly via `useQuery`'s `queryFn`.

### UI layer

`src/components/BudgetTransferDrawer.tsx`:

- **Props change:** drop `budgets: BudgetListItem[]`. Keep `destination`, `open`, `onOpenChange`.
- **New self-fetch:** `useQuery({ queryKey: budgetTransferCandidatesQueryKey(destination.id), queryFn: () => getTransferCandidates({ destinationBudgetId: destination.id }), enabled: open })`.
- **Source state:** replace `sourceId` lookup against in-memory `budgets` with a lookup against `data?.candidates`.
- **Loading state:** show 4 skeleton rows inside the nested drawer when `isLoading`.
- **Empty / no-cap state:** if candidates returns empty or all `remaining <= 0`, show the existing dashed empty card (relocated into the nested drawer) with copy: "No budget has cap to spare right now."
- **Invalidation on success:** add `queryClient.invalidateQueries({ queryKey: budgetTransferCandidatesQueryKey(destination.id) })` alongside the existing two invalidations in `handleSubmit`.

`src/components/BudgetWeeklyBudgetsClient.tsx` — at the existing render site (around `BudgetWeeklyBudgetsClient.tsx:1521`) drop the `budgets={...}` prop.

### Period-instance grouping

A pure helper in the drawer file (or a colocated module if it grows):

```ts
type GroupKey =
  | { kind: "this-week" }
  | { kind: "last-week" }
  | { kind: "this-month" }
  | { kind: "last-month" }
  | { kind: "earlier" };

type CandidateGroup = {
  key: GroupKey;
  label: string;         // e.g. "This week · May 13 – May 19"
  candidates: BudgetListItem[];
};

const groupCandidates(
  candidates: BudgetListItem[],
  now: Date
): CandidateGroup[];
```

Rules:
- `this-week`: `period === "week"` and `periodStartDate` falls in the current ISO week (use existing `getWeekRange` from `src/lib/week`).
- `last-week`: `period === "week"` and `periodStartDate` falls in the previous ISO week.
- `this-month`: `period === "month"` and `periodStartDate` is in the current calendar month.
- `last-month`: `period === "month"` and `periodStartDate` is in the previous calendar month.
- `earlier`: everything else — older weeks/months and all `period === "custom"`.
- Empty groups are omitted from the output.
- Group order is fixed: this-week → last-week → this-month → last-month → earlier.
- Within each group, sort by `remaining` desc; rows with `remaining <= 0` fall to the bottom.

Labels use `Intl.DateTimeFormat` ranges, e.g. `"This week · May 13 – May 19"`, `"Last month · April 2026"`, `"Earlier"`.

### Row layout (mobile)

```
┌──────────────────────────────────────────────┐
│ Coffee                       +320,000   ✓    │   ← name left, remaining + check right
│                              500,000         │   ← muted amount under remaining
└──────────────────────────────────────────────┘
```

- Min height 52px (`min-h-13`, current value, preserved).
- Left: `name` (`text-sm font-medium`, truncate).
- Right cluster (`flex items-center gap-2`):
  - Top line: `formatVndSigned(remaining)` — `text-xs font-semibold tabular-nums`, `text-success` if `> 0`, `text-destructive` if `< 0`, `text-muted-foreground` if `= 0`.
  - Bottom line: `formatVnd(amount)` — `text-[10px] text-muted-foreground tabular-nums`.
  - Check icon when selected — `h-4 w-4 text-success`.
- Disabled (`remaining <= 0`): row dims (`opacity-60`), `aria-disabled`, no `bg-muted/60` on click. Replace check slot with one-line microcopy `text-[10px] text-muted-foreground`: `"no cap to pull"`.

### Sticky destination header

Inside the nested drawer, above the scrollable list:

```
┌──────────────────────────────────────────────┐
│ FILLING                        540,000       │
│ Groceries                                    │
└──────────────────────────────────────────────┘
```

Sticky to the top of the scroll container so the user always sees what they're filling. Same visual treatment as the destination block in the parent drawer at `BudgetTransferDrawer.tsx:159-171`, just compacted (smaller padding).

### Group header

```
THIS WEEK · MAY 13 – MAY 19
```

`text-[10px] tracking-wide uppercase text-muted-foreground`, `mt-3 mb-1 px-1`. Stays inline within the scrolling list (not sticky — only the destination header is sticky to keep the mobile sheet simple).

## Mobile UX details

- Container: `no-scrollbar max-h-[60svh] overflow-y-auto` (matches current).
- Sticky destination card: `sticky top-0 z-10` with the drawer body's background.
- Tap target: every row is a `Button` of `min-h-13` — already meets 48px.
- No hover-only states; `bg-muted/60` triggers on selection (touch-friendly).
- Tabular-nums on all VND values for column alignment when remaining-amounts have different digit counts.
- `repositionInputs={false}` stays on the parent `Drawer` to avoid the iOS keyboard reposition jump when the amount input focuses later.

## Loading & error states

- **Loading** (`isLoading`): four skeleton rows of `h-13 rounded-lg bg-muted/40` inside the scroll container, no group headers.
- **Empty** (`candidates.length === 0`): existing dashed empty card, relocated into the nested drawer. Copy: `"No other budgets to pull from yet."`
- **All disabled** (every candidate has `remaining <= 0`): show a dashed card with `"No budget has cap to spare right now."` instead of the empty list.
- **Error** (`isError`): inline `text-destructive text-xs` row with a retry `Button variant="ghost"` calling `refetch()`.

## Tests

`src/components/BudgetTransferDrawer.test.tsx` — extend coverage:

1. Renders skeleton while candidates query is pending.
2. Renders period-instance groups in the correct order (this-week, last-week, this-month, last-month, earlier).
3. Omits empty groups.
4. Disabled row for `remaining <= 0` does not become selectable.
5. Disabled rows sort to bottom of their group.
6. Selecting a candidate stores `sourceId` and shows the after-transfer preview.
7. Empty candidates payload renders the "no other budgets" card.
8. All-disabled candidates payload renders the "no cap to spare" card.
9. Successful transfer invalidates `budgetTransferCandidatesQueryKey(destination.id)` in addition to the existing two query keys.

Mock `getTransferCandidates` directly (via `vi.mock` on `@/app/actions/budget-weekly-actions`) — same pattern the existing test file uses for `transferBudgetAmount`.

## Files touched

- `src/app/actions/budget-weekly-actions.ts` — new `getTransferCandidates` action.
- `src/lib/queries/budgets.ts` — new `budgetTransferCandidatesQueryKey`.
- `src/components/BudgetTransferDrawer.tsx` — props change, `useQuery`, new layout, grouping helper, sticky header, skeleton/empty/error/all-disabled states, extra invalidation.
- `src/components/BudgetTransferDrawer.test.tsx` — new assertions.
- `src/components/BudgetWeeklyBudgetsClient.tsx` — drop `budgets={...}` prop at the render site.

No schema changes. No new dependencies.

## Open questions

1. **Candidate cap of 100** — fine for now? If a user routinely has > 100 active budgets we'd need pagination, but that's a separate spec.
2. **Earlier-bucket label** — keep flat as `"Earlier"` or split further into `"Older weeks"` / `"Older months"` / `"Custom"`? Default: flat, until a real user has enough budgets to make it confusing.
3. **Group header for "Custom" period** — currently bucketed into `Earlier`. Acceptable, or should custom periods get their own group at the bottom?
