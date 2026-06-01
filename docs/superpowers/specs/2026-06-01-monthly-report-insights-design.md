# Monthly Report Insights — Design Spec

**Date:** 2026-06-01
**Status:** Approved design
**Feature:** Add month-over-month trends, assigned-budget variance, inferred top merchants from notes, and passive recurring spend detection to `/report`.

## Summary

Expand the existing `/report` page into a guided monthly review. The report keeps its current month selector, category breakdown, payer breakdown, and TanStack Query monthly report path, then adds an `insights` payload to the monthly report response.

The first version is read-only. It does not add merchant storage, recurring rules, reminders, future transactions, or mutation behavior.

## Research Notes

- Plaid's recurring transaction API models recurring streams around merchant/description, cadence, status, transaction ids, average amount, and last amount. Plaid also recommends at least 180 days of history for best recurring results, which supports conservative detection and evidence-based display. Source: [Plaid Transactions API](https://plaid.com/docs/api/products/transactions/).
- Plaid's recurring transaction product notes that recurring streams can help users manage cash flow, monitor subscriptions, reduce spend, and stay on track with bill payments. Source: [Plaid recurring transactions](https://plaid.com/blog/recurring-transactions/).
- Monarch Money separates reports from recurring transaction management. Reports support spending by category or merchant and change over time, while recurring transactions can be reviewed as a separate workflow. Source: [Monarch Reports](https://help.monarchmoney.com/hc/en-us/articles/21846787088916-Using-Reports) and [Monarch Recurring Transactions](https://help.monarchmoney.com/hc/en-us/articles/4890751141908-Recurring-Transactions).
- Monarch's recurring documentation calls out same-merchant ambiguity and amount differences, which supports showing evidence and keeping this first version passive instead of automatically creating recurring rules.

## Goals

- Make `/report` the primary home for monthly insights.
- Show a month-over-month headline comparing the selected month with the previous month.
- Show 3-month average context beside the headline so one unusual prior month does not mislead.
- Compare assigned spend against active weekly and monthly budgets that overlap the selected month.
- Infer top merchants from existing note text without adding a merchant field.
- Detect recurring spend conservatively and passively.
- Keep the mobile iPhone 13/14 experience clear in dark mode.

## Non-Goals

- No dedicated merchant column or merchant-editing UI.
- No AI merchant extraction.
- No recurring rule creation.
- No future expense generation.
- No reminders or notifications.
- No new mutation lifecycle, optimistic behavior, background submit behavior, or persisted recovery state.
- No desktop-specific redesign beyond remaining functional and coherent.

## Product UI

`/report` becomes a single vertical narrative scroll:

1. Header and month tabs remain at the top.
2. Monthly pulse appears first with selected-month spend, previous-month delta, and 3-month-average context.
3. Budget variance appears next with assigned actual spend versus prorated allowance.
4. Month trend shows recent months, with the selected month highlighted.
5. Top merchants from notes shows inferred merchant groups, total spend, count, and representative notes.
6. Recurring spend shows conservative passive detections with pattern name, cadence, matched count, total impact, and evidence dates.
7. Existing category and payer breakdowns remain lower on the page.

The layout direction is "Narrative Scroll": one primary takeaway per section, details below, no section tabs in the first version.

## Architecture

Extend the existing monthly report path instead of adding a separate insights endpoint:

```txt
src/app/report/page.tsx
  -> queries.reports.monthly(selectedMonth)
  -> /api/reports/monthly
  -> getMonthlyReport(selectedMonth)
  -> report insight helpers
```

`MonthlyReport` keeps its existing fields and adds:

```ts
type MonthlyReportInsights = {
  pulse: MonthlyPulse;
  budgetVariance: BudgetVarianceSummary;
  monthTrend: MonthTrendPoint[];
  topMerchants: InferredMerchantSummary[];
  recurringSpend: RecurringSpendCandidate[];
};
```

The browser read path stays in `src/lib/queries/reports.ts`, and the server prefetch continues to call `getMonthlyReport()` directly. This follows the project's TanStack Query route-handler pattern for app-owned data.

## Data Window

For a selected month, the service needs enough data to calculate:

- selected month totals,
- previous month totals,
- prior 3 complete months,
- 6 recent trend points including the selected month,
- recurring candidates from a 180-day lookback ending at the selected month end.

The 180-day recurring lookback is intentionally wider than the visible trend. It gives monthly recurring patterns enough history for the conservative 3-match rule while keeping the first implementation bounded.

## Month-Over-Month Trend Rules

The headline compares selected month total spend with previous month total spend.

The supporting context compares selected month total spend with the average of the prior 3 complete months.

If history is partial:

- no previous month total: return a state that says comparison needs another month,
- no complete 3-month baseline: return previous-month comparison only,
- zero previous total or zero baseline: return `null` percent delta and a neutral UI label instead of `Infinity%`.

## Budget Variance Rules

Budget variance uses explicit budget assignments only.

Include budgets when:

- budget period is `week` or `month`, and
- the budget active period overlaps the selected month.

Actual spend counts:

- expenses assigned to the budget,
- expense date inside the selected month,
- non-deleted expenses only.

Allowance counts:

- monthly budgets prorated by overlap days inside the selected month,
- weekly budgets prorated by overlap days inside the selected month,
- allowance = `budget.amount * overlappingDays / totalBudgetPeriodDays`.

Each variance row includes:

- budget id,
- budget name,
- icon and color,
- period type,
- period start and end,
- prorated allowance,
- assigned spend,
- variance amount,
- percent used when allowance is greater than zero,
- status: under, near, over, or no allowance.

The summary includes total prorated allowance, total assigned spend, total variance, and unassigned selected-month spend as separate context.

## Merchant Inference Rules

The app has no merchant column, so merchant inference is a deterministic read-model over note text.

Normalization should:

- trim and lowercase notes,
- normalize Vietnamese diacritics for matching,
- remove obvious amount and date fragments,
- remove common payment/noise words,
- collapse repeated whitespace and punctuation,
- choose a stable grouping key from meaningful leading tokens,
- keep the best original note label for display.

Top merchant rows include:

- inferred label,
- normalized key,
- total spend,
- expense count,
- representative notes,
- optional top category or payer context if cheap to compute.

The UI should avoid overstating certainty. It can label this section "Top merchants from notes" or "Top note groups" if the inferred labels are rough.

## Recurring Detection Rules

Recurring detection is passive and conservative.

Show a candidate only when:

- at least 3 matching expenses exist,
- the inferred merchant key matches,
- amount is stable enough for the cadence,
- dates follow a clear weekly, biweekly, monthly, or near-monthly cadence,
- matched expenses are non-deleted.

Each candidate includes:

- label,
- inferred merchant key,
- cadence,
- confidence label,
- matched expense ids,
- evidence dates,
- representative notes,
- average amount,
- total selected-month impact when applicable.

Do not estimate the next charge date in the first version. Do not create recurring rules.

## Empty States And Errors

The report should degrade section by section:

- no previous month: show current spend and explain that another month is needed for comparison,
- no 3-month baseline: show previous-month delta only,
- no assigned budgets: show a quiet empty state for budget variance and keep category/payer reports visible,
- no merchant groups: hide the list or show a small empty state,
- no recurring candidates: show "No recurring patterns detected yet" as neutral information,
- invalid month params: keep current API validation behavior and avoid rendering misleading insight data.

Calculation helpers must avoid divide-by-zero and return `null` for unavailable percentages.

## Component Plan

The existing `MonthlyReportContent` can stay the client owner for the monthly report query. Add small, focused components rather than growing it into one large file:

- `MonthlyPulseCard`
- `BudgetVarianceCard`
- `MonthTrendChart`
- `TopMerchantsCard`
- `RecurringSpendCard`

These components should receive plain report data and render empty states locally. The current category and payer sections can remain in `MonthlyReportContent` initially, then be split only if the file becomes hard to scan during implementation.

## Data Helper Plan

Keep helpers small and unit-testable:

- month range and history window helpers,
- trend summarization,
- budget overlap/proration math,
- merchant note normalization,
- top merchant aggregation,
- recurring cadence detection.

Prefer structured date handling with the existing `dayjs` config. Do not add a new date library.

## Testing

Add or update focused tests:

- unit tests for selected, previous, and prior-3-month trend states,
- unit tests for missing history and zero-baseline deltas,
- unit tests for prorated monthly and weekly budget allowance across month boundaries,
- unit tests for assigned spend versus unassigned spend separation,
- unit tests for merchant normalization with Vietnamese accents and common shorthand,
- unit tests for accepted 3-match recurring cadence,
- unit tests rejecting 2-match candidates,
- unit tests rejecting inconsistent cadence or amount candidates,
- route/query tests for the expanded monthly report response shape,
- component tests for the new insight cards and empty states.

After implementation, run required file-scoped checks for edited `.ts` and `.tsx` files:

```sh
rtk bunx prettier --write <modified-files>
rtk bunx prettier --check <modified-files>
rtk bunx eslint <modified-files>
```

Before pushing, run:

```sh
npm run build
```

## Key Files

- `src/lib/services/reports.ts`
- `src/lib/services/reports.test.ts`
- `src/lib/queries/reports.ts`
- `src/app/api/reports/monthly/route.ts`
- `src/app/api/reports/monthly/route.test.ts`
- `src/app/report/page.tsx`
- `src/components/MonthlyReportContent.tsx`
- new focused report insight components under `src/components/`
