# Expense List Manual Load More Design

Date: 2026-05-28

## Goal

Stop the home expense list from auto-loading the full expense history on mobile or desktop. The list should render the server-prefetched first page, allow sync hydration to refresh already loaded pages, and load additional pages only after an explicit user action.

## Diagnosis Summary

`ExpenseList` currently combines `useInfiniteQuery` with an `IntersectionObserver` sentinel. The observer root is the expense list container, but that container uses `overflow-y-auto` without a constrained height. On the home page, the layout uses document scrolling and lets the list grow with content. Once expense sync marks the cursor ready, the sentinel can stay intersecting after each appended page. That lets one visible sentinel chain through repeated `fetchNextPage()` calls until `hasMore` becomes false.

Sync hydration is not the direct pagination loop. It seeds and refreshes active infinite query pages from IndexedDB while preserving the currently loaded `pageParams`. It can change row data and cursor readiness, but page count grows because the observer keeps requesting the next page.

## Design

Replace automatic sentinel loading with an explicit `Load more` button for all viewports.

`ExpenseList` will keep `useInfiniteQuery`, `getNextPageParam`, page flattening, deduping, grouping, and the existing sync cursor gate. The observer refs and `IntersectionObserver` effect will be removed. When `hasNextPage` is true and loading is not gated, the list footer will render a visible button. Pressing it calls `fetchNextPage()` once. While that request is active, the footer shows the existing loading state. If the request fails, the existing retry action remains available.

The sync cursor gate stays in place: before the initial sync cursor exists, the footer should not allow pagination and should continue showing the current syncing message. After the cursor is ready, the user can load exactly one page per button press.

## Components And Data Flow

- `src/components/ExpenseList.tsx`
  - Owns infinite query state.
  - Renders the first hydrated page plus any pages the user explicitly requests.
  - Uses `fetchNextPage()` only from button click handlers.
  - Removes observer-root and sentinel behavior.

- `src/lib/queries/expenses.ts`
  - No change. Query key and query function already match infinite query rules.

- `src/lib/sync/expenses/coordinator.ts`
  - No change. Active infinite list refresh should preserve loaded `pageParams`; it should not append new pages.

## User Experience

The home list initially shows the first page, currently 30 expenses. If more records exist, the footer shows a compact `Load more` button. Tapping or clicking the button loads the next page and appends it. This is intentionally the same on mobile and desktop so pagination behavior is predictable and cannot run away in either environment.

## Error Handling

Keep the current retry behavior for `isFetchNextPageError`. Retry also calls `fetchNextPage()` from an explicit button click. Loading state disables further pagination while `isFetchingNextPage` is true.

## Tests

Update `src/components/ExpenseList.test.tsx` to cover:

- No `IntersectionObserver` is needed for loading more.
- With a missing sync cursor, the list remains gated and does not load more.
- With a sync cursor and `hasNextPage`, clicking `Load more` appends exactly one page.
- Re-rendering after the next page is appended does not automatically fetch another page.
- Retry still calls `fetchNextPage()` explicitly after a next-page error.

## Verification

Run targeted checks after implementation:

```bash
rtk bunx vitest run src/components/ExpenseList.test.tsx src/components/ExpenseSyncCoordinator.test.tsx
rtk bunx prettier --write src/components/ExpenseList.tsx src/components/ExpenseList.test.tsx
rtk bunx prettier --check src/components/ExpenseList.tsx src/components/ExpenseList.test.tsx
rtk bunx eslint src/components/ExpenseList.tsx src/components/ExpenseList.test.tsx
```

Manual verification:

- On an iPhone 13/14 viewport, load the home page and wait for sync/network idle.
- Confirm the list remains near the initial page size, not hundreds of rows.
- Tap `Load more` and confirm only one additional page appears per tap.

## Non-Goals

- No list virtualization.
- No broad sync hydration refactor.
- No new REST routes, Server Actions, or query factories.
- No desktop-specific layout optimization.
- No changes to expense row rendering or edit behavior.
