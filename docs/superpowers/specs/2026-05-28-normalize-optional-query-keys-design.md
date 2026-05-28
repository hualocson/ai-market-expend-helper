# Normalize Optional TanStack Query Keys Design

## Context

The app uses `@lukemorales/query-key-factory` for app-owned TanStack Query keys. Project rules require optional query parameters to be normalized so omitted fields, explicit `undefined`, and empty optional values do not create duplicate cache entries.

`expenses.list` already follows this pattern by storing optional params in a stable object with `null` values. A few query factories still place optional primitive arguments directly in array key segments. Those entries are the target of this bugfix.

## Scope

Normalize optional primitive query-key values from `undefined` to `null` in:

- `dashboard.monthlySummary(month?)`
- `reports.monthly(month?)`
- `budgetWeekly.options(weekStart, targetDate?)`

Do not change fetcher behavior, request URLs, route handlers, mutation invalidation, optimistic cache ownership, or query families that are outside the stated bug.

## Non-Goals

- Do not audit every query key for values that affect returned data but are not currently in the key.
- Do not change `budgets.transactions` key shape in this bugfix.
- Do not add a shared helper unless repeated normalization grows beyond these local one-line changes.
- Do not alter `expenses.list`, because it already emits explicit `null` fields for optional params.

## Design

Update the affected query factories so optional key segments are explicit `null` values:

- `dashboard.monthlySummary`: `queryKey: [month ?? null]`
- `reports.monthly`: `queryKey: [month ?? null]`
- `budgetWeekly.options`: `queryKey: [weekStart, targetDate ?? null]`

This keeps each factory's public call shape unchanged while making the in-memory `queryKey` arrays deterministic. Existing consumers continue calling the same query factory methods.

Fetcher arguments remain unchanged. If a caller omits an optional argument, the fetcher receives the same value it receives today and preserves current request construction.

## Testing

Add targeted regression coverage near the query helpers:

- Dashboard monthly summary keys should store `null` when the month is omitted or passed as `undefined`.
- Monthly report keys should store `null` when the month is omitted or passed as `undefined`.
- Weekly budget option keys should store `null` when `targetDate` is omitted or passed as `undefined`.
- Existing budget weekly coverage should continue proving distinct concrete `targetDate` values produce distinct keys.

Run targeted formatter and ESLint checks for modified TypeScript files after implementation, following `AGENTS.md`.

## Risks

The change is intentionally small. The main compatibility risk is tests or debug code that assert raw `undefined` in query-key arrays. That expectation conflicts with the project rule and should be updated to assert `null`.
