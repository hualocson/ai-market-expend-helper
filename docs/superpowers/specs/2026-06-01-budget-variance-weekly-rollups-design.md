# Budget Variance Weekly Rollups — Design Spec

**Date:** 2026-06-01
**Status:** Draft for review
**Feature:** Make the monthly report budget variance section usable when a month contains many weekly budget rows.

## Problem

The monthly report now includes assigned budget variance. For users who create 6-8 weekly budgets every week, a selected month can contain 24-40 weekly budget rows. Rendering every row by default makes the report hard to scan on iPhone 13/14 viewports and pushes the rest of the monthly narrative too far down the page.

The calculation should stay complete. The UI should summarize first, then let the user expand into weekly detail.

## Goals

- Keep all budget variance rows in the existing `report.insights.budgetVariance.rows` payload.
- Make the default budget variance card short enough for mobile scanning.
- Prioritize rows that need attention: over budgets, near budgets, then highest assigned spend.
- Add weekly rollups for overflow rows.
- Use a one-line icon-led rollup row with no dot separators.
- Keep the feature read-only.
- Keep existing category and payer sections unchanged.

## Non-Goals

- No API shape change unless implementation proves local grouping too awkward.
- No budget editing from the report.
- No new budget aggregation tables.
- No mutation behavior, optimistic updates, background submits, or persisted recovery state.
- No desktop-specific redesign.

## Default Card Behavior

`BudgetVarianceCard` keeps the current summary at the top:

- assigned spend,
- variance,
- unassigned spend when present.

Add a small count context when rows exist:

- total budgets included,
- number over,
- number near.

By default, show at most 5 budget rows.

Sort visible rows by:

1. `over`,
2. `near`,
3. highest assigned spend,
4. largest absolute variance,
5. budget name as a stable tie-breaker.

This keeps the default card focused on rows that are actionable.

## Overflow Behavior

When more than 5 rows exist:

- show a compact `Show all` control,
- show a count such as `23 more budgets`,
- expanding reveals grouped weekly rollups and all rows.

The expanded state can be local component state. This makes `BudgetVarianceCard` a client component, but it remains read-only and does not fetch or mutate data.

## Weekly Rollups

Expanded rows are grouped by their `periodStartDate` and `periodEndDate`.

Each weekly group starts with one compact line. The line uses icons instead of dot-separated text.

Target structure:

```txt
[CalendarDays] May 1-7  [WalletCards] 6 budgets  [TriangleAlert] 2 over  [VndSymbol] 1.2M used
```

Rules:

- one line on normal iPhone 13/14 width,
- no `·` separators,
- use `lucide-react` icons where available,
- use existing `VndSymbol` for the amount,
- allow wrapping only if the viewport or translated text forces it,
- keep row text compact and tabular for amounts.

Recommended icons:

- `CalendarDays` for the period,
- `WalletCards` or `Layers` for budget count,
- `TriangleAlert` for over/near attention count,
- `VndSymbol` for assigned spend.

The attention count should prefer over count. If no budgets are over but some are near, show near count. If none are over or near, show `0 over`.

## Expanded Detail Rows

Under each weekly rollup, render that week’s budget rows using the existing compact row style.

Rows should continue to stack safely on mobile:

- budget icon and name on the left,
- status and assigned spend on the right or below on narrow widths,
- long VND values must wrap without horizontal overflow.

Monthly budgets can remain in their own group above weekly groups if present. Use a compact heading such as `Monthly budgets` and the same row style.

## Empty State

Keep the current empty state:

```txt
No assigned budget spend this month.
```

Do not add explanations or instructions.

## Testing

Add component coverage for:

- more than 5 weekly budget rows renders only the prioritized default subset,
- `Show all` reveals weekly rollups and all rows,
- rollup line uses icon labels/content and does not use dot-separated copy,
- over and near rows are prioritized above under rows,
- monthly budgets still render coherently when mixed with weekly budgets,
- empty state still renders when rows are empty.

Existing focused checks remain:

```sh
rtk bun run test src/components/report/MonthlyReportInsights.test.tsx
rtk bunx prettier --write <modified-files>
rtk bunx prettier --check <modified-files>
rtk bunx eslint <modified-files>
```

## Implementation Notes

Prefer local UI helpers inside `BudgetVarianceCard.tsx` or a small colocated helper file if the card becomes difficult to scan.

Do not change `buildMonthlyReportInsights()` unless a calculation bug is discovered. This feature is about presentation density.

Do not change the API response shape in the first pass. The existing row fields are enough for grouping, sorting, and rollups.
