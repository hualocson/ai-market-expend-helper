# Instant First Load Design

## Context

The reference article, [How's Linear so fast? A technical breakdown](https://performance.dev/how-is-linear-so-fast-a-technical-breakdown), describes first-load speed as a product of several coordinated decisions:

- Ship a small critical shell first.
- Inline enough theme/style state to avoid a blank or wrong-themed page.
- Preload or precache likely assets.
- Treat the browser's local database as the first read path.
- Reconcile with the server after useful UI is already visible.
- Keep startup animation cheap, mostly `opacity` and `transform`, with short durations.

Spendly already has some of the right building blocks:

- Next.js App Router pages with TanStack Query hydration.
- Serwist service worker setup in `src/app/sw.ts` and `next.config.ts`.
- An offline page at `src/app/~offline/page.tsx`.
- An Expense sync direction already started under `src/lib/sync/core/*` and `src/lib/sync/expenses/*`.
- Background submit and recovery boundaries documented in `LEARNINGS.md`.

The current home route still waits for server prefetches in `src/app/page.tsx` before rendering the main dashboard and expense list. The root layout also mounts several client-owned systems immediately: React Query provider, theme provider, settings provider, pull-to-refresh, mutation coordinator, recovery host, progressive blur, bottom nav, and toast host. `src/app/loading.tsx` is a client component and imports `motion/react`, so the loading state itself is not a minimal shell.

The design goal is not to clone Linear's architecture completely. It is to apply the first-load principle to this codebase without breaking the existing app-owned data rules: browser reads use TanStack Query query factories and REST routes, writes use mutation hooks or the local sync engine, and no new Server Actions are added.

## Scope

In scope:

- The first visible load of `/`.
- The route loading fallback.
- The root shell paint path.
- Last-known dashboard summary display as a startup hint.
- Last-known Expense list display from IndexedDB as a startup hint.
- Background server validation after initial paint.
- Deferring non-critical root JavaScript.
- Route/code warmup after first paint.
- Service worker behavior for static assets and offline fallback.
- Focused tests for shell persistence, dashboard snapshot parsing, and local Expense query seeding.
- Manual performance verification with Web Vitals and browser throttling.

Out of scope:

- Full local-first migration for budgets, reports, AI, or dashboard-derived data.
- WebSockets or live push.
- A new auth system.
- Server Actions for app-owned data.
- Caching mutable `/api/*` responses in the service worker.
- Rewriting the whole app shell or navigation model.
- Replacing TanStack Query with a custom client database API.

## Considered Approaches

### Recommended: streamed shell plus local startup hints

Keep Next.js App Router and TanStack Query. Split the home page into a static frame, an instant fallback, and a streamed server-prefetched content subtree. The fallback renders immediately using lightweight shell UI, last-known dashboard summary from `localStorage`, and Expense records from IndexedDB converted into the existing `ExpenseListResult` query shape. Server prefetch still runs and hydrates canonical data when ready.

This matches the current migration path. It improves perceived first load without asking every domain to become local-first at once.

### Alternative: full local-first home route

Make the home route read only from IndexedDB/Zustand and treat all server data as sync output. This would be closest to Linear's model, but it is too large for this step because dashboard, budgets, reports, and AI are still server-owned. It also risks duplicating business logic before the Expense sync engine is fully settled.

### Alternative: service-worker cache for API responses

Cache `/api/expenses`, `/api/dashboard/monthly-summary`, and report responses with a stale-while-revalidate strategy. This is simple, but it creates stale mutable data outside TanStack Query and IndexedDB ownership. It would make mutation invalidation harder to reason about and can show data that the app cannot correctly reconcile.

### Alternative: only optimize bundle size

Dynamic-import heavy components, reduce font files, and simplify animations while keeping current server prefetch behavior. This helps transfer and hydration cost, but it does not solve the main UX issue: the first useful home surface still waits for network and database work.

## Design

The first load should have three layers.

Layer 1 is the pre-hydration shell. It is static DOM and CSS rendered by the root layout, with a tiny inline script that applies the last-known theme before React hydrates. The shell approximates the home screen structure: total header area, filter chips, heatmap panel, list rows, and bottom navigation position. It should not fetch data, import animation libraries, or mount query providers. Its job is to prevent blank-screen time and theme flash.

Layer 2 is the instant home fallback. The home route should stream a fallback immediately while server prefetch continues. This fallback can mount normal client components, but it should prefer local startup data. `SpendingDashboardHeader` can use a validated dashboard snapshot from `localStorage` until the query resolves. `ExpenseList` can seed its TanStack infinite query from IndexedDB Expense sync records, using the existing local list builder in `src/lib/sync/expenses/list.ts`.

Layer 3 is the canonical server-backed content. The existing `getDashboardMonthlySummary()` and `getExpenseList()` prefetches should still run, but in a streamed child component. When they finish, TanStack Query receives canonical server data and normal invalidation behavior continues.

The result is:

```txt
HTML starts
-> inline theme/shell script runs
-> static app shell paints
-> React hydrates
-> instant fallback reads local dashboard snapshot and IndexedDB expenses
-> server prefetch resolves
-> canonical TanStack Query data replaces local startup hints
-> background sync/invalidation continues normally
```

## Root Shell

The root layout should include a minimal `InstantAppShell` before the provider-heavy app subtree. This shell must be inert:

- `aria-hidden="true"`
- no interactive controls
- no app-owned data fetches
- no route state dependency
- hidden after hydration using an attribute on `<html>`

The inline script should do only startup-safe work:

- read `spendly:shell:v1` from `localStorage`
- apply `light` or `dark` class before paint
- optionally set a CSS custom property for last-known total text
- mark the document as shell-ready
- catch all errors

The script must not parse large payloads, query IndexedDB, or inspect route data. IndexedDB belongs to the hydrated fallback layer.

## Home Route Streaming

`src/app/page.tsx` should stop awaiting mutable data directly at the page root. Instead:

- `HomeFrame` renders the stable layout wrapper.
- `HomeInstantContent` is the Suspense fallback.
- `HomePrefetchedContent` performs the existing dashboard and expense prefetch in parallel and returns a `HydrationBoundary`.

This keeps server prefetch benefits for users with fast connections, while allowing immediate fallback for slower starts.

The fallback should look like real app UI, not a spinner. A spinner says "wait"; cached or skeleton-like app structure says "the app is here."

## Local Expense Startup Data

Expense startup data should come from the existing sync storage direction, not from service-worker API caching.

The local flow:

```txt
ExpenseList with preferLocalStartupData
-> listSyncRecords("expenses")
-> cast/validate LocalExpense records
-> buildExpenseListResultFromLocalRows(rows, params)
-> wrap as InfiniteData<ExpenseListResult, number>
-> queryClient.setQueryData(queries.expenses.list(params).queryKey, data)
```

This preserves the existing `ExpenseList` rendering path. The list still uses TanStack Query and the query factory key. When the real network query resolves, it replaces or reconciles the startup data through the normal query lifecycle.

Deleted local records must be filtered. Pending rows can be shown because they represent user-visible local work. Failed rows can remain visible if the sync engine marks them clearly later; the first-load seed should not invent new recovery behavior.

## Dashboard Snapshot

Dashboard summary is derived server-owned data, so it should not be treated as a durable local database in this design. It can be used as a startup snapshot only.

Persist a small validated shape:

```ts
type DashboardSnapshot = {
  activeMonth: string;
  payerOptions: string[];
  totalsByPayer: Record<string, { total: number; totals: number[] }>;
  updatedAt: number;
};
```

The snapshot should be written after successful dashboard render and read only by the instant fallback. Invalid shapes must be ignored. The canonical dashboard query remains the source that refreshes reports, monthly totals, and heatmap data.

The root shell may persist only presentation-safe data such as theme and a formatted total string. It should not persist the whole dashboard payload.

## Service Worker and Preloading

Serwist should continue to own static asset precaching and offline document fallback. The service worker should not cache mutable app API responses for expenses, reports, budgets, or dashboard summaries.

Allowed service-worker responsibilities:

- precache generated Next/static assets
- serve `/~offline` for document fallback
- reuse fonts, scripts, styles, and images where safe
- enable navigation preload

Not allowed:

- stale-while-revalidate for `/api/expenses`
- stale-while-revalidate for `/api/dashboard/*`
- stale-while-revalidate for reports or budget API data
- mutation response caching

Route warmup can happen after first paint from a tiny client component. Warm likely next routes such as `/report`, `/budgets`, `/ai`, and `/settings` using `router.prefetch()` during idle time. This should never compete with the first paint.

## JavaScript and Animation Budget

First-load code should be split into critical and deferred work.

Critical:

- root providers required for visible UI
- bottom navigation
- dashboard header
- expense list
- minimal shell bridge

Deferred:

- quick expense mutation coordinator
- recovery sheet host
- edit sheet host until edit intent
- route warmup until idle
- any analytics/reporting beyond Web Vitals measurement

`src/app/loading.tsx` should become server-renderable and CSS-only. It should not import `motion/react`.

Startup animations should avoid blur filters and layout-triggering properties. For first paint, use opacity and small transform transitions only. Any `transition: all` in startup-critical surfaces should be replaced with explicit properties.

## Data Ownership

This design preserves current ownership boundaries:

- Server prefetch calls service/db functions directly.
- Browser reads call query factories and REST route handlers.
- Expense local startup reads from IndexedDB sync records and seeds TanStack Query.
- Browser writes stay in mutation hooks or the Expense sync engine.
- Recovery store remains UI recovery state, not server state.
- Service worker caches static assets, not mutable API data.

No new Server Actions should be added for app-owned data.

## Failure Behavior

If `localStorage` is unavailable, the shell uses the default dark theme and empty shell values.

If IndexedDB is unavailable or blocked, the instant fallback renders without local expense rows and the server query fills the list when ready.

If the dashboard snapshot is invalid or stale, it is ignored. The fallback can show shell structure until the server query resolves.

If the service worker is missing on first visit, the design still works because the pre-hydration shell and streaming fallback are not service-worker-dependent.

If server prefetch fails, existing query error behavior should own the user-visible state. This design does not add a separate offline data authority for reports or budgets.

## Testing Strategy

Focused automated tests:

- shell bridge marks hydration and persists shell state
- dashboard snapshot parser accepts valid shapes and rejects invalid shapes
- Expense query seed builds `InfiniteData<ExpenseListResult, number>`
- Expense query seed filters deleted records
- `ExpenseList` still renders seeded query data and normal query data
- `SpendingDashboardHeader` prefers live query data over cached snapshot

Manual checks:

- cold `/` load shows shell quickly
- second `/` load shows last-known dashboard/expense data before network
- offline document fallback still works
- expense create/edit/delete behavior still follows `LEARNINGS.md`
- no mutable `/api/*` response is served from service-worker cache

Performance checks:

- capture baseline before implementation
- capture cold visit after implementation
- capture second visit after service worker install
- compare FCP, LCP, JS transferred, request count, and visible time-to-shell

## Open Questions

- Should the dashboard snapshot have a TTL, or is "show until server replaces it" acceptable for a personal finance app?
- Should pending/failed local Expense rows display a sync badge on first load, or should this wait for the broader sync-engine UI?
- Should route warmup include `/ai`, which may pull heavier chat code, or should `/ai` warm only on hover/focus of the AI button?

## Recommendation

Proceed with the streamed shell plus local startup hints approach.

It applies the article's first-load lesson without overextending the current architecture. It makes the app feel present immediately, uses IndexedDB only where the repo already has a sync direction, keeps mutable data ownership inside TanStack Query and the sync engine, and avoids service-worker API caching that would make correctness harder.

After this design is reviewed, the implementation plan should be rewritten from this spec rather than using the premature draft plan.
