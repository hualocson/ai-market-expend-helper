# Cold-Start Expense List Design

## Goal

Fresh browsers with existing server expenses should show the first expense page on the initial home render. The app should still keep Expense browser reads local-first after startup, with IndexedDB as the durable local database and the sync cursor as the signal that full local pagination is ready.

## Problem

The current `/` route prefetches the dashboard only. `ExpenseList` uses `queries.expenses.list`, whose browser query function reads only IndexedDB sync records. On a fresh browser or cleared storage, IndexedDB is empty, so the list can render an empty state even when the server has expenses. `ExpenseSyncCoordinator` starts a background sync after mount, but that happens after the first render and can briefly show a false empty list.

Earlier sync planning considered a server fallback in `fetchExpenseList`, but the current local-list plan intentionally made the browser fetcher IndexedDB-only. This design keeps that local-first boundary and fixes first paint through server prefetch plus a client bootstrap bridge.

## Chosen Approach

Use server-prefetched first page plus client-side IndexedDB seeding.

The home page restores server prefetch for the first expense page:

```txt
/ server render
-> prefetch dashboard summary from service
-> prefetch first expense page from getExpenseList({ limit: 30 })
-> hydrate TanStack Query
-> ExpenseList renders page 1 immediately
```

After hydration, a client bootstrap reads the hydrated first expense page from TanStack Query and writes those rows to IndexedDB as synced expense records. The normal sync coordinator still performs pull/push reconciliation and writes the sync cursor.

Browser expense query functions remain IndexedDB-only. They should not fall back to `/api/expenses`.

## Data Flow

Startup flow:

```txt
Home server component
-> getExpenseList({ limit: 30 })
-> prefetchInfiniteQuery(queries.expenses.list({ limit: 30 }))
-> HydrationBoundary
-> ExpenseList displays hydrated first page
-> client bootstrap reads hydrated page 1
-> seed IndexedDB syncRecords with synced rows
-> ExpenseSyncCoordinator runs requestExpenseSync(queryClient)
-> pull writes full changes and cursor
-> active list caches refresh from IndexedDB
```

Pagination flow:

```txt
ExpenseList has hydrated page 1 and hasMore = true
-> check sync metadata cursor
-> if cursor missing, do not request page 2
-> show bottom status: "Syncing all expenses before loading more."
-> when cursor exists, normal infinite scroll can fetch from IndexedDB
```

## Components And Modules

`src/app/page.tsx`

- Restore `prefetchInfiniteQuery` for `queries.expenses.list({ limit: 30 })`.
- Use direct `getExpenseList` service call for the server query function.
- Keep dashboard prefetch in parallel.

`src/components/ExpenseSyncCoordinator.tsx` or a small adjacent bootstrap component

- Read the hydrated first expense list page from the query client.
- Convert server list rows into synced IndexedDB records.
- Write records without creating outbox operations.
- Then let the existing sync scheduler run normally.

`src/lib/sync/expenses/coordinator.ts`

- Add reusable helper code if needed for seeding synced server list rows into IndexedDB.
- Keep reconciliation and cursor ownership in the existing pull path.

`src/components/ExpenseList.tsx`

- Keep rendering hydrated page 1 normally.
- Before observing the load-more sentinel, check whether the expense sync cursor exists.
- If `hasNextPage` is true and the cursor is missing, render the subtle bottom status instead of auto-fetching.
- Once cursor exists, allow existing infinite-scroll behavior.

`src/lib/queries/expenses.ts`

- Keep `fetchExpenseList` IndexedDB-only.
- Do not reintroduce `/api/expenses` fallback.

## Cursor Semantics

`syncRepository.metadata.getCursor("expenses") !== null` means the first pull has completed. This is the gate for loading pages beyond the server-prefetched first page.

If the initial pull fails, the cursor remains missing. The first hydrated page stays visible, but additional local pagination is blocked until a later focus, online, or write-triggered sync succeeds.

## User Experience

Fresh browser:

- The first server page appears immediately after hydration.
- If there are more server rows and sync is not complete yet, the list bottom shows:

```txt
Syncing all expenses before loading more.
```

The message should be low-noise and placed where the load-more control normally appears. It should not replace the visible first page and should not look like a blocking error.

Existing browser with cursor:

- IndexedDB remains the normal browser read path.
- Infinite scroll works as it does today.

IndexedDB unavailable:

- The server-prefetched first page still displays on `/`.
- Local pagination remains gated because there is no cursor.
- Sync retries continue through existing coordinator behavior.

## Data Ownership Rules

- Server components call service/database functions directly.
- Browser reads use TanStack Query query factories.
- Expense browser query fetchers read IndexedDB only.
- Browser writes stay in mutation hooks and the Expense sync engine.
- Client bootstrap may seed synced records into IndexedDB, but must not create outbox operations.
- No Server Actions.
- No mutable `/api/*` service-worker caching.

## Testing Strategy

Focused tests:

- Home page prefetches dashboard and first expense page.
- Hydrated first expense page renders without waiting for IndexedDB.
- Bootstrap seeds hydrated server rows into IndexedDB as `syncStatus: "synced"` records.
- Bootstrap does not create outbox operations.
- `ExpenseList` with `hasMore: true` and no cursor shows the bottom sync status and does not fetch the next page.
- `ExpenseList` with a cursor allows normal load-more behavior.
- `pullExpenseChanges` still writes the cursor and refreshes active list caches.

Targeted verification should use Vitest for the modified tests plus Prettier and ESLint for edited TypeScript/TSX files. Do not run `npm run build` for this scoped change.

## Open Questions

None. Decisions resolved:

- Fresh browsers should show server data immediately.
- Use server prefetch plus client IDB seeding.
- Gate load-more until the expense sync cursor exists.
- Show the gate status at the list bottom.
