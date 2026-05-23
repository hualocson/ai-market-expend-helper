# TanStack Query Migration Plan

Goal: migrate app-owned reads and writes to TanStack Query backed by Next.js route handlers, while keeping server-side rendering where it improves first paint.

The migration should be split into separate PRs. Each phase below is one PR.

## Current State

- TanStack Query is already installed and globally provided.
- `@lukemorales/query-key-factory` is not installed yet. The migration should add it and make it the canonical query-key/query-option layer.
- `src/lib/get-query-client.ts` already follows the App Router pattern: new `QueryClient` per server render, singleton in the browser, `staleTime: 60s`, and pending-query dehydration.
- `src/app/budgets/page.tsx` already uses server `prefetchQuery` plus `HydrationBoundary`.
- Budget reads already have query modules in `src/lib/queries/budgets.ts` and `src/lib/queries/budget-weekly.ts`.
- Most transaction, dashboard, prefill, and report reads still happen directly in Server Components.
- Client mutations still call Server Actions directly. There is no current `useMutation` usage.

## Target Architecture

Use this layering:

```txt
Client useQuery/useMutation
-> query factory entry with browser queryFn
-> /api/... route handler
-> shared db/service function

Server Component page shell
-> getQueryClient().prefetchQuery(...)
-> query factory entry for queryKey only
-> shared db/service function directly
-> HydrationBoundary
-> Client component uses same factory entry with REST fetcher
```

Server Component prefetch should call shared service functions directly, not the app's own `/api/*` route. Browser query and mutation functions should call route handlers.

Do not render the same prefetched query data in a Server Component and a Client Component that can later refetch. TanStack Query cannot update the Server Component after client invalidation.

Use `@lukemorales/query-key-factory` for all query keys and query functions:

- Feature files should use `createQueryKeys`, for example `src/lib/queries/expenses.ts`, `src/lib/queries/reports.ts`, and updated budget query files.
- `src/lib/queries/index.ts` should use `mergeQueryKeys` and export a single `queries` object.
- Components should call `useQuery(queries.expenses.list(params))` or spread a factory entry when adding component-specific options such as `enabled`, `staleTime`, or `gcTime`.
- Server prefetch should reuse the factory `queryKey`, but override `queryFn` with the server service function: `{ queryKey: queries.expenses.list(params).queryKey, queryFn: () => getExpenseList(params) }`.
- Invalidation should use factory prefix keys such as `queries.expenses.list._def`, `queries.budgets.overview.queryKey`, or feature roots such as `queries.reports._def`.

## PR 1: Query Factory And API Client Foundation

Scope:

- Add `@lukemorales/query-key-factory` as a dependency.
- Add `src/lib/queries/expenses.ts` using `createQueryKeys('expenses', ...)`.
- Add expense query factory entries:
  - `list({ month, q, mode, recentDays })`
  - `prefills`
- Add `src/lib/queries/dashboard.ts` using `createQueryKeys('dashboard', ...)`.
- Add dashboard query factory entries:
  - `monthlySummary(month)`
- Add `src/lib/queries/reports.ts` using `createQueryKeys('reports', ...)`.
- Add report query factory entries:
  - `monthly(month)`
  - `daily(date)`
- Add `src/lib/queries/index.ts` using `mergeQueryKeys` and export `queries`.
- Start migrating existing budget query modules to query-key-factory entries where it is low risk:
  - `queries.budgets.overview`
  - `queries.budgets.transactions(budgetId, pagination)` or a stable detail entry plus params
  - `queries.budgets.transferCandidates(destinationId)`
  - `queries.budgetWeekly.options(weekStart, targetDate)`
- Add shared HTTP helpers for JSON response parsing and consistent `{ error: string }` handling if useful.
- Keep temporary compatibility exports for old budget query key names only if needed to keep PR 1 small.

Acceptance criteria:

- Query keys and browser query functions are centralized through query-key-factory.
- `queries` is the preferred import for new `useQuery`, `prefetchQuery`, and invalidation code.
- No UI behavior changes.
- Existing tests still pass.

## PR 2: Extract Direct Server Reads Into Services

Scope:

- Extract `ExpenseList` DB logic into a service such as `getExpenseList(params)`.
- Extract `SpendingDashboardHeader` DB logic into `getDashboardMonthlySummary(month)`.
- Extract `ExpensePrefillChips` SQL into `getExpensePrefills()`.
- Extract monthly report DB logic into `getMonthlyReport(month)`.
- Extract daily report DB logic into `getDailyReport(date)`.
- Keep services pure: no `NextResponse`, no React rendering, no route-specific response logic.

Source files to migrate from:

- `src/components/ExpenseList.tsx`
- `src/components/SpendingDashboardHeader.tsx`
- `src/components/ExpensePrefillChips.tsx`
- `src/app/report/page.tsx`
- `src/app/report/day/[date]/page.tsx`

Acceptance criteria:

- Pages render the same data as before.
- Direct DB queries are moved out of React components/pages into service functions.
- No TanStack Query UI migration yet, unless needed only to preserve behavior.

## PR 3: Add REST Read Routes

Scope:

- Add `GET /api/expenses?month=&q=&mode=&recentDays=`.
- Add `GET /api/dashboard/monthly-summary?month=`.
- Add `GET /api/expense-prefills`.
- Add `GET /api/reports/monthly?month=`.
- Add `GET /api/reports/daily?date=`.
- Each route should validate query params, call the shared service, return JSON, and use consistent errors.
- Add browser fetchers inside the query factory entries from PR 1.

Acceptance criteria:

- Routes return the same shapes consumed by current UI.
- Invalid query params return `400` with `{ error: string }`.
- Service logic is not duplicated inside route handlers.

## PR 4: Migrate Expense List To TanStack Query

Scope:

- Convert `ExpenseList` into a Client Component backed by `useQuery(queries.expenses.list(params))`.
- Keep server wrappers/page shells for `/` and `/transactions` that prefetch `queries.expenses.list(params).queryKey` with `getExpenseList(params)` and wrap the client list in `HydrationBoundary`.
- Preserve existing recent mode, month tabs, search behavior, grouped rows, empty states, and item actions.

Acceptance criteria:

- `/` recent expenses render with hydrated data.
- `/transactions` full list renders with hydrated data.
- Search and month filters use query keys correctly.
- No immediate duplicate fetch on hydration under the configured `staleTime`.

## PR 5: Migrate Dashboard Header And Prefill Chips

Scope:

- Convert monthly dashboard totals to `useQuery` using `queries.dashboard.monthlySummary(month)`.
- Convert expense prefill chips to `useQuery` using `queries.expenses.prefills`.
- Add server prefetch only for above-the-fold data that should appear on first paint.
- Keep client-only fetching acceptable for non-critical prefill chips if the loading state feels better.

Acceptance criteria:

- Home dashboard header renders the same totals and payer options.
- Prefill chips still dispatch the existing prefill event.
- Expense mutations can later invalidate both query families.

## PR 6: Migrate Report Pages To TanStack Query

Scope:

- Convert `/report` monthly report data to `useQuery` with `queries.reports.monthly(month)`.
- Convert `/report/day/[date]` daily report data to `useQuery` with `queries.reports.daily(date)`.
- Use server prefetch plus `HydrationBoundary` for route-critical report data.
- Keep charts and cards visually unchanged.

Acceptance criteria:

- Monthly report totals, payer totals, and charts match current output.
- Daily report totals, weekly pace, charts, and transaction list match current output.
- Date/month route params are reflected in query keys.

## PR 7: Normalize Runtime Validation And Error Contracts

Scope:

- Add shared runtime schemas for:
  - expense create/update
  - budget create/update
  - expense-budget assignment
  - budget transfer
  - common route params and pagination params
- Standardize route errors to `{ error: string }` with appropriate status codes.
- Add `zod` as a direct dependency if continuing to use it for validation.
- Decide and document whether public mutation routes are app-internal, protected, or acceptable unauthenticated for this app.

Acceptance criteria:

- Route handlers do not trust raw `request.json()` casts.
- Validation behavior is consistent between expense, budget, assignment, and transfer routes.
- Auth decision is explicit in docs or code comments.

Runtime route auth decision for PR 7:

- Browser-facing mutation routes under `/api/expenses`, `/api/weekly-budgets`, and `/api/transaction-budget` are treated as app-internal UI endpoints for this personal app. They remain unauthenticated in this migration to avoid changing UI behavior before mutation hooks land.
- Protected integration/admin-style routes stay under `/api/internal/*` and must continue to require `INTERNAL_API_TOKEN` via `x-internal-token` or `Authorization: Bearer`.
- These browser-facing mutation routes should not be presented as a public third-party API without adding an explicit auth/session model first.

## PR 8: Complete REST Mutation Routes

Scope:

- Add `PATCH /api/expenses/[id]`.
- Add `DELETE /api/expenses/[id]`.
- Add `POST /api/budgets/transfer`.
- Keep or reuse existing routes:
  - `POST /api/expenses`
  - `POST /api/weekly-budgets`
  - `PATCH /api/weekly-budgets/[id]`
  - `DELETE /api/weekly-budgets/[id]`
  - `POST /api/transaction-budget`
- Move shared mutation behavior into service functions where needed.
- Add `revalidatePath` or `revalidateTag` only for server-rendered surfaces that still depend on Next cache after earlier PRs.

Acceptance criteria:

- All app mutation operations have REST endpoints.
- Routes use shared validation and service functions.
- Route-handler writes do not leave server-rendered pages stale during the transition.

## PR 9: Add TanStack Mutation Hooks

Scope:

- Add mutation hooks for:
  - `useCreateExpenseMutation`
  - `useUpdateExpenseMutation`
  - `useDeleteExpenseMutation`
  - `useCreateBudgetMutation`
  - `useUpdateBudgetMutation`
  - `useDeleteBudgetMutation`
  - `useAssignTransactionBudgetMutation`
  - `useTransferBudgetMutation`
- Move cache invalidation rules into hooks.
- Use query-key-factory generated keys for all invalidation. Prefer `_def` for broad invalidation and exact `queryKey` for detail invalidation.
- Prefer `mutateAsync` where the component needs sequential UI work such as closing a sheet after success.

Invalidation rules:

- Expense create/update/delete invalidates:
  - `queries.expenses._def`
  - `queries.dashboard._def`
  - `queries.reports._def`
  - `queries.budgets.overview.queryKey`
  - `queries.budgetWeekly.options._def`
- Budget create/update/delete invalidates:
  - `queries.budgets.overview.queryKey`
  - `queries.budgets.transactions._def`
  - `queries.budgets.transferCandidates._def`
  - `queries.budgetWeekly.options._def`
- Transaction-budget assignment invalidates:
  - `queries.expenses._def`
  - `queries.budgets.overview.queryKey`
  - `queries.budgets.transactions._def`
  - `queries.budgetWeekly.options._def`
- Budget transfer invalidates:
  - `queries.budgets.overview.queryKey`
  - `queries.budgets.transactions(sourceId).queryKey`
  - `queries.budgets.transactions(destinationId).queryKey`
  - `queries.budgets.transferCandidates._def`

Acceptance criteria:

- Components no longer duplicate invalidation logic.
- Hooks expose pending/error states cleanly.
- Existing optimistic UI is not required unless separately scoped.

## PR 10: Replace Server Action Calls In UI

Scope:

- Replace expense Server Action usage in:
  - `src/components/QuickExpenseSheet.tsx`
  - `src/components/ManualExpenseForm.tsx`
  - `src/components/ExpenseListItem.tsx`
- Replace budget Server Action usage in:
  - `src/components/BudgetWeeklyBudgetsClient.tsx`
  - `src/components/BudgetTransferDrawer.tsx`
- Remove `router.refresh()` calls that become unnecessary after query invalidation.
- Keep Server Actions temporarily only if they are still needed for compatibility during the rollout.

Acceptance criteria:

- Create, update, delete, assign, and transfer flows use TanStack `useMutation`.
- UI pending states still work.
- Toast success/error behavior is preserved.
- Relevant lists and summaries update through query invalidation, not full route refresh.

## PR 11: Cleanup Server Actions And Dead Paths

Scope:

- Remove unused Server Actions after all UI callers move to REST mutations.
- Remove duplicated mutation boundaries if no longer needed.
- Keep internal token-protected APIs if they serve a separate external automation use case.
- Update tests that mock Server Actions to mock mutation hooks or REST fetchers instead.

Acceptance criteria:

- No UI imports from `src/app/actions/expense-actions.ts` or `src/app/actions/budget-weekly-actions.ts` unless intentionally retained.
- No duplicate public write path remains without a clear reason.
- Test mocks align with the new data layer.

## Verification Strategy

Do targeted checks per PR instead of running a full build for every small change.

Suggested checks:

- Query key and fetcher tests for `src/lib/queries/*`.
- Service tests for extracted DB/query transformation logic where practical.
- Route handler tests for validation and error behavior.
- Component tests for migrated forms, drawers, lists, and reports.
- Manual smoke test for:
  - create expense
  - edit expense
  - delete expense
  - assign expense budget
  - create/edit/delete budget
  - transfer budget amount
  - `/`, `/transactions`, `/budgets`, `/report`, and `/report/day/[date]`

## Recommended First PR

Start with PR 1. It is low risk and creates the naming foundation for every later migration.

Then prioritize PR 2 and PR 4 for the expense list, because `ExpenseList` is reused on both `/` and `/transactions` and is the largest direct-query surface.
