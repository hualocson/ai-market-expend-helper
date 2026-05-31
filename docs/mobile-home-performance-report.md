# Mobile Home Page Performance Report

Date: 2026-05-28  
URL: https://ai-market-expend-helper-jade.vercel.app/  
Viewport tested: iPhone 14 mobile emulation, 390 x 844 CSS px

## Summary

The page feels slow on mobile mainly because it does too much client-side work after the first paint. The initial network payload is not extreme, but the app quickly syncs and renders almost the full expense history. In the measured mobile session, the home page reached 23,338 DOM nodes with 924 rendered expense rows and 141 day-group links. That is far too much for a mobile scrolling surface, especially because every expense row is an interactive `motion` draggable item.

Lighthouse still reports an acceptable score because the first content appears quickly, but the runtime numbers show the lag source: 8.1 s of main-thread work, 5.8 s of JavaScript boot-up time, 290 ms total blocking time, and 4.8 s time to interactive.

## Measurements

| Metric                             |       Result |
| ---------------------------------- | -----------: |
| Lighthouse mobile performance      |           87 |
| First Contentful Paint             |        1.2 s |
| Largest Contentful Paint           |        3.1 s |
| Speed Index                        |        3.0 s |
| Total Blocking Time                |       290 ms |
| Time to Interactive                |        4.8 s |
| Main-thread work                   |        8.1 s |
| JavaScript boot-up                 |        5.8 s |
| Total transfer size                |       460 KB |
| Requests                           |           37 |
| Live DOM after mobile network idle | 23,338 nodes |
| Rendered expense rows              |          924 |
| Rendered day-group links           |          141 |

Largest observed payloads:

| Resource                                            | Transfer |  Decoded |
| --------------------------------------------------- | -------: | -------: |
| `/_next/static/chunks/4bd1b696-100b9d70ed4e49c1.js` |  55.9 KB | 173.0 KB |
| `/_next/static/chunks/6061-77d32c99ef898cc7.js`     |  47.6 KB | 177.5 KB |
| `/_next/static/chunks/905-88617ef18fb0da98.js`      |  38.8 KB | 112.1 KB |
| `/_next/static/chunks/2898-9e2fc98dcb9f5d24.js`     |  28.1 KB |  87.5 KB |
| `/api/expenses/sync`                                |  25.7 KB | 258.6 KB |
| Main CSS chunk                                      |  23.8 KB | 144.6 KB |

The `/api/expenses/sync` response returned 941 changes in the test. Browser timing showed that request taking about 1.9-2.0 s.

## Root Causes

### 1. Infinite loading is effectively loading the whole history

`src/components/ExpenseList.tsx` sets up `useInfiniteQuery` and then attaches an `IntersectionObserver` to the load-more sentinel. The observer root is `listContainerRef.current`, and that container has `overflow-y-auto`, but no constrained height:

- `src/components/ExpenseList.tsx:123` starts at page 0.
- `src/components/ExpenseList.tsx:124` keeps returning a next page while `hasMore` is true.
- `src/components/ExpenseList.tsx:159` creates the load-more observer.
- `src/components/ExpenseList.tsx:172` uses the list container as the observer root.
- `src/components/ExpenseList.tsx:221` gives the list `overflow-y-auto`, but it can still grow with content.

On mobile, once the sync cursor is ready, the sentinel remains eligible for intersection and the page keeps fetching local pages. The result is 924 rendered expense rows instead of a small initial page.

### 2. Startup sync does heavy work on the main thread

`ExpenseSyncCoordinator` starts sync on mount:

- `src/components/ExpenseSyncCoordinator.tsx:32` runs the mount effect.
- `src/components/ExpenseSyncCoordinator.tsx:49` starts bootstrap sync immediately.
- `src/lib/sync/expenses/coordinator.ts:591` runs hydrate, flush, and pull in sequence.
- `src/lib/sync/expenses/coordinator.ts:577` fetches `/api/expenses/sync`.
- `src/lib/sync/expenses/coordinator.ts:581` reconciles server rows.
- `src/lib/sync/expenses/coordinator.ts:583` refreshes local store and active query lists.

The IDB write path also awaits each write inside a loop:

- `src/lib/sync/core/repository.ts:88` defines `putMany`.
- `src/lib/sync/core/repository.ts:94` loops every record.
- `src/lib/sync/core/repository.ts:95` awaits each `store.put`.

For 941 sync changes, that means parsing a large JSON payload, writing many records, reading all local records again, hydrating Zustand, rebuilding active TanStack Query list data, and invalidating derived queries during startup.

### 3. Each rendered row is expensive

`ExpenseListItem` is not a static row. Each row includes:

- a `motion.div` with drag handling,
- `AnimatePresence`,
- `role="button"` interaction,
- swipe action state,
- outside-click/listen-for-open behavior,
- formatted amounts, icons, badges, and shadows.

This is reasonable for 20-40 visible rows. It becomes expensive when 900+ rows are mounted at once.

### 4. Hidden or future UI is loaded too early

The bottom nav imports `QuickExpenseDrawer` directly:

- `src/components/BottomNav.tsx:11` imports `QuickExpenseDrawer`.
- `src/components/BottomNav.tsx:249` renders it inside the fixed plus button.

That drawer pulls in date pickers, drawer/dialog primitives, budget chips, mutation hooks, toasts, haptics, and form logic on the home page before the user opens it.

The visible "Spendly AI" link also used default Next.js prefetching:

- `src/components/SpendingDashboardHeaderClient.tsx:109` linked to `/ai`.

The network trace showed `/ai?_rsc=...` and the `/app/ai/page` chunk loading from the home page. That route and the header AI action have since been removed; Quick AI now lives in the bottom navigation.

### 5. Paint effects amplify the DOM problem

The page uses several effects that are fine in small quantities but costly with a very large scroll surface:

- fixed blurred header: `src/app/globals.css:368-387`,
- bottom nav `backdrop-blur-2xl`: `src/components/BottomNav.tsx:144` and `src/components/BottomNav.tsx:248`,
- digit animation with `filter` and `will-change`: `src/app/globals.css:354-360`,
- fixed multi-layer body background: `src/app/globals.css:206-228`.

These are not the primary bug. They make the lag more visible after the page has already mounted too many nodes.

## Recommended Fixes

### P0

1. Stop auto-loading all expense pages.
   - Make the list scroller a real constrained scroll container, or use the window as the observer root with a sentinel that only triggers near the real viewport.
   - Add a guard so one observer intersection cannot chain through every page.
   - Consider a visible "Load more" fallback on mobile until the observer behavior is stable.

2. Virtualize the expense list.
   - Keep only visible rows mounted.
   - This matters even after fixing infinite loading because returning users can still have hundreds of synced expenses.

3. Move startup sync out of the critical interaction path.
   - Render the server-prefetched first page first.
   - Start full sync after first interaction or `requestIdleCallback`.
   - Chunk large reconcile/write work so the main thread can yield.
   - Avoid rebuilding active list queries from every local record during first paint.

### P1

4. Lazy-load `QuickExpenseDrawer`.
   - Keep the plus button lightweight.
   - Dynamically import the drawer after the user taps the plus button or after idle.

5. Disable eager AI prefetch on the home page.
   - Add `prefetch={false}` to the `/ai` link or schedule prefetch after idle.

6. Reduce mobile paint cost.
   - Remove or reduce backdrop blur on fixed nav/header for mobile.
   - Avoid `filter` animations during startup.
   - Keep the body background static and cheap on iOS.

## Expected Impact

The biggest win should come from fixing the list loading behavior. Reducing the page from 924 mounted rows to roughly 30 rows should drastically reduce DOM size, hydration work, motion setup, scroll cost, and input delay. After that, lazy-loading the drawer and deferring full sync should reduce JavaScript boot-up and make the page feel responsive sooner on mobile.
