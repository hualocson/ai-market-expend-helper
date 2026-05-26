# Returning User Instant Shell Design

**Date:** 2026-05-26
**Status:** Draft for review

## Goal

Make returning visits to Spendly show a recognizable app shell sooner, without weakening the current `/` server prefetch, TanStack Query hydration, IndexedDB expense sync, or service-worker correctness boundaries.

The target feeling is: when a returning user opens the app, the screen should look like Spendly immediately, even while the real server-prefetched dashboard and expense list are still being prepared.

## Current Context

The codebase has changed since the earlier first-load brainstorm. The app now has a stronger local-first Expense foundation:

- `src/app/page.tsx` server-prefetches both `getDashboardMonthlySummary()` and `getExpenseList({ limit: 30 })` in parallel.
- Browser Expense reads in `src/lib/queries/expenses.ts` are IndexedDB-only and build list results from sync records.
- `src/components/ExpenseSyncCoordinator.tsx` reads the hydrated first Expense page from TanStack Query, seeds those rows into IndexedDB sync storage, then requests normal sync.
- `src/components/ExpenseList.tsx` gates infinite loading until the Expense sync cursor exists, avoiding a false "load more" path before local pagination is ready.
- `src/app/sw.ts` explicitly uses `NetworkOnly` for `/api/*`, RSC payloads, and app documents before falling through to Serwist defaults for static assets.

Those pieces should stay intact. The first-load problem is now narrower: the real app still cannot visibly render until the current route tree is ready, and the fallback path is too heavy. `src/app/loading.tsx` is a client component that imports `motion/react`. The root layout eagerly mounts several client systems, including sync, quick expense mutation coordination, recovery host, pull-to-refresh, progressive blur, bottom nav, theme/settings/query providers, and toasts. First-screen dashboard/list components still use blur-filter startup motion.

## Scope

In scope:

- Returning-user perceived first load of `/`.
- A pre-hydration, inert app shell that appears before the real app subtree is ready.
- Tiny persisted presentation hints, such as last-known formatted total text.
- Keeping the existing `/` server prefetch exactly as the canonical first real content path.
- Making `src/app/loading.tsx` server-renderable and CSS-only.
- Removing or reducing expensive blur-filter startup animation on first-screen surfaces.
- Deferring non-critical root work that does not need to run before first paint.
- Focused tests for shell persistence/hiding behavior and service-worker boundaries where touched.

Out of scope:

- Changing the home page's server-prefetch behavior.
- Streaming a new `HomeInstantContent` fallback for this iteration.
- Reintroducing `/api/expenses` browser fallbacks.
- Caching mutable app API responses in the service worker.
- Changing Expense sync semantics, outbox behavior, cursor gating, or local pagination.
- Making dashboard, report, budget, or AI data fully local-first.
- Adding Server Actions.
- Building route warmup before the shell path is stable.

## Considered Approaches

### Recommended: pre-hydration returning shell plus startup-cost cleanup

Add an inert shell at the root layout level. The shell is plain DOM and CSS, with a tiny script that reads safe presentation hints from `localStorage` before hydration. It appears while the real app subtree is pending and disappears after hydration. The existing `/` server prefetch remains unchanged and still provides the real dashboard and first Expense page.

This approach gives returning users an immediate visual anchor without creating a second data path. It is intentionally conservative: the shell is not data ownership, not a cache, and not a replacement for server-prefetched content.

### Alternative: stream `/` with an instant Suspense fallback

Move the current home prefetch into a child component and let the route stream an interactive fallback. This could help both cold and returning users, but it changes the home route composition and risks overlapping with the existing cold-start Expense list design. It is better saved for a later pass if the inert shell is not enough.

### Alternative: only reduce JavaScript and animation cost

Make `loading.tsx` server-only, remove blur-filter motion, defer recovery hosts, and reduce font cost without adding a shell. This improves hydration and animation work, but it still may show a blank or generic loading state until the route is ready. It should be included as supporting cleanup, not the whole design.

## Architecture

The returning-user load path should be:

```txt
Browser receives HTML
-> tiny shell script applies stored presentation hints
-> inert Spendly shell paints
-> existing / server prefetch continues unchanged
-> React hydrates provider/app subtree
-> shell bridge hides inert shell
-> real dashboard and Expense list render from hydrated TanStack Query
-> ExpenseSyncCoordinator seeds hydrated Expense page into IndexedDB and syncs
```

The shell is independent from route data. It does not query IndexedDB, call REST routes, use TanStack Query, or import app components that carry client behavior. It is a paint bridge only.

## Shell Shape

The shell should visually match the stable structure of the home screen:

- top spending amount area
- payer chip row
- heatmap-sized panel
- recent Expense row placeholders
- reserved bottom navigation/blur area

It should not show detailed stale Expense rows. For this returning-user-first design, showing detailed local records in the pre-hydration shell would require IndexedDB access before hydration, which is too much work for the shell layer. The real hydrated route already shows the server-prefetched first page, and the existing sync coordinator handles IndexedDB seeding.

The shell may show a last-known formatted total string because it is presentation-only. It should not store or render the full dashboard payload.

## Shell Persistence

Spendly is a dark-mode-only app. The instant shell must not persist, infer, or switch themes. It should render with the same dark tokens as the real app and treat dark as the only valid visual mode.

Use a small namespaced localStorage key for display hints only, for example:

```ts
type InstantShellSnapshot = {
  totalText: string | null;
  updatedAt: number;
};
```

Rules:

- The snapshot is optional.
- Invalid JSON or invalid shapes are ignored.
- `totalText` is a display hint only. It should be formatted text, not raw dashboard state.
- The shell script must catch all errors because storage can be blocked.

The real dashboard component can update this snapshot after it successfully renders live query data. That write should be isolated in a small helper module, not scattered across components.

## Root Layout Design

Add three small pieces:

- `InstantAppShell`: server-rendered inert shell markup.
- `instantShellScript`: tiny inline script that runs before hydration and applies safe display hints.
- `InstantShellBridge`: client component that marks hydration complete and persists current shell presentation hints when live data becomes available.

`InstantAppShell` should render before the provider-heavy app subtree in `src/app/layout.tsx`.

The hiding mechanism should be a document attribute, for example:

```txt
html[data-instant-shell-hydrated="true"] #instant-app-shell { display: none; }
```

The shell should be `aria-hidden` and should not contain focusable elements. It must not compete with the real `BottomNav` once hydration completes.

## Loading Route Design

`src/app/loading.tsx` should stop importing `motion/react` and stop being a client component. It can render the same inert shell or a smaller CSS-only logo/shell fallback.

The key requirement is that route loading does not pull animation runtime into the critical fallback. If animation is needed, use CSS with `prefers-reduced-motion` support and only opacity/transform.

## Root Work Deferral

Keep eager:

- `ReactQueryProvider`, because hydrated route data needs it.
- `ExpenseSyncCoordinator`, because it seeds the hydrated first page and requests sync.
- `ThemeProvider` and `SettingsStoreProvider`, because they define real app rendering.
- `BottomNav`, because it is part of the first recognizable app frame.
- `Toaster`, unless tests show it adds meaningful startup cost.

Consider deferring:

- `QuickExpenseMutationCoordinator`, because it processes queued recovery mutations and is not needed to paint the first screen.
- `QuickExpenseRecoverySheetHost`, because it renders only when a failed operation is reopened.

Deferral should happen after hydration or during idle time. It must preserve `LEARNINGS.md` rules: queued operations should still be handled by a stable coordinator, and persisted recovery state must not be replayed unsafely. If deferral risks delaying important failed-draft handling too long, keep the coordinator eager and only defer the recovery host.

## Animation And Rendering Budget

First-screen startup animation should avoid blur filters. The current dashboard and Expense list use `filter: "blur(...)"` in `motion/react` entrance states. Replace those first-load effects with cheap opacity/transform transitions or remove them.

Startup-sensitive rules:

- animate `opacity` and `transform`
- avoid `filter`, `height`, `width`, `margin`, `top`, `left`, and `transition-all`
- keep durations short
- respect reduced motion

This is supporting work. The shell should provide the biggest perceived load improvement; animation cleanup should reduce jank during the transition from shell to real UI.

## Service Worker Boundary

Keep the current service-worker correctness rule:

- `/api/*`: network only
- RSC payloads: network only
- app document navigations: network only
- static assets: Serwist/default cache behavior
- `/~offline`: document fallback

Do not add API stale-while-revalidate caching to make the shell feel faster. That would create a second mutable data cache outside TanStack Query and IndexedDB sync.

## Data Ownership

This design preserves current data ownership:

- Server components call service/database functions directly.
- `/` prefetch remains the first real data source for dashboard and page-one Expenses.
- Browser Expense reads remain IndexedDB-only after hydration.
- `ExpenseSyncCoordinator` owns hydrated-page seeding and sync requests.
- Browser writes remain in mutation hooks and the Expense sync engine.
- The inert shell owns only presentation hints.
- The service worker owns static assets and offline fallback, not mutable app data.

No Server Actions should be added.

## Failure Behavior

If `localStorage` is blocked, the shell paints with dark styling and no total text.

If the inline shell script fails, it should fail closed and allow the server-rendered shell CSS to paint.

If hydration fails, the shell may remain visible, but it is inert and should not expose stale interactive UI.

If the server prefetch is slow, the shell remains visible until hydration/real app takeover.

If the server prefetch fails, existing route/query error behavior should own the real app state. The shell should not become an offline data UI.

## Testing Strategy

Automated tests:

- shell snapshot parser accepts valid snapshots and rejects invalid ones
- shell script applies display hints when storage is valid and leaves dark styling unchanged when storage is missing or invalid
- shell bridge marks the document hydrated
- shell bridge hides the inert shell after hydration
- dashboard render writes only presentation-safe shell data
- `loading.tsx` does not import `motion/react`
- service worker still routes `/api/*`, RSC, and document navigations to `NetworkOnly`

Focused regression tests:

- home page still prefetches dashboard and first Expense page
- `ExpenseSyncCoordinator` still seeds hydrated first page into IndexedDB
- Expense browser query fetcher remains IndexedDB-only
- Expense load-more cursor gate remains unchanged

Manual verification:

- returning `/` visit shows a Spendly-shaped shell before real content
- real dashboard and Expense list replace the shell without visible layout jump
- quick expense failed-draft recovery still works after any deferral
- offline document fallback still works
- no mutable API response is served from service-worker cache

Performance verification:

- capture before/after visible time-to-shell
- compare FCP/LCP on returning visit
- compare JS transferred before first content
- verify first-screen transition does not show blur jank

## Success Criteria

The design succeeds when:

- returning users see a branded Spendly shell quickly, before the server-prefetched route finishes
- the existing `/` server prefetch is unchanged
- no new mutable data cache is introduced
- Expense sync, cursor gating, and hydrated first-page seeding continue to work
- startup loading no longer depends on `motion/react`
- first-screen startup motion avoids blur filters

## Recommendation

Implement the pre-hydration returning shell first, with minimal presentation persistence and a CSS-only loading fallback. Then measure. Only after that should the app consider route streaming or deeper home fallback changes.

This keeps the architecture honest: the shell makes the app feel present sooner, while the current server-prefetch and IndexedDB sync model continue to own correctness.
