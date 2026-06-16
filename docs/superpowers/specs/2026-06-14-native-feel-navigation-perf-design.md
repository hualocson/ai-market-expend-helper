# Native-Feel Navigation Performance — Design

- **Date:** 2026-06-14
- **Status:** Proposed (diagnosis + design only; no implementation in this phase)
- **Scope:** Tier 1 + Tier 2 (stable APIs). Tier 3 deferred to a follow-up phase.
- **Target:** Mobile iPhone 13/14 PWA, slow-network resilience.

---

## 1. Problem

Navigating between top-level pages does not feel like a native app. The user's
chief symptom, in their words:

> "Tap a nav item → nothing changes for 1-2 seconds → then the UI changes."

Secondary symptoms: data loads slowly after the page shell appears; no
transition/animation between routes; the first interaction after load feels
laggy.

## 2. Evidence (measured)

Profiled on the production Vercel deployment under emulated **iPhone 13 viewport
+ Slow 4G + 4× CPU throttle** (Chrome DevTools performance traces). Cross-checked
against a static read of the codebase.

| Measurement | Result | Meaning |
| --- | --- | --- |
| Cold home load LCP | **2.0 s** (TTFB 569 ms, **render delay 1.44 s**) | Screen sits after HTML arrives while JS hydrates before painting. |
| Home CLS | 0.00 | Layout stability is fine. |
| Home JS chunks | **22 requests** | Heavy eager client bundle; nothing code-split. |
| Home data | `/api/budgets` (×2), `/api/expenses/sync`, `/api/dashboard/monthly-summary` fired **client-side after hydration** | Data is not in the prerendered payload; appears late on slow networks. `/api/budgets` duplicated — minor. |
| Tap input latency (INP) | **54 ms** | The tap handler is *not* the bottleneck. |
| Home → Budget nav | After the tap: `GET /budgets?_rsc` **+ 3 page JS chunks** (`app/budgets/page`, etc.) downloaded **only then** | Route was never prefetched → cold network fetch of code *and* payload on every tap. |
| `/budgets` RSC response | `x-vercel-cache: HIT`, `x-nextjs-prerender: 1`, `x-nextjs-stale-time: 300` | The route is ISR-prerendered; the *server* is fast. The delay is the round-trip + un-prefetched chunks, not server render. |

**Conclusion:** the freeze is dominated by **missing route prefetch**, not slow
servers, slow taps, or layout shift.

## 3. Root causes (ranked)

1. **Bottom nav uses `<button onClick={router.push()}>`, not `<Link>`.**
   `src/components/BottomNav.tsx:133-137` (`handleNavigate` → `router.push`),
   rendered at `:173-192` (expanded) and `:201-224` (collapsed). Next.js App
   Router prefetches route segments **only via `<Link>` in the viewport**.
   `router.push` does no prefetch, so every tap fetches RSC payload + JS chunks
   cold. **This is the primary "nothing happens for 1-2s" driver.**

2. **Dynamic routes `await` DB-backed prefetch with no Suspense fallback.**
   `src/app/report/page.tsx:19` and `src/app/report/day/[date]/page.tsx:20` are
   `async` components that `await queryClient.prefetchQuery(...)` against real
   Drizzle queries. The segment cannot stream until the DB resolves. (Contrast:
   `src/app/page.tsx:10,28-29` is a **sync** component using non-blocking
   `void prefetch` and streams immediately — the pattern we want everywhere.)

3. **No instant loading fallback.** Only `src/app/loading.tsx` exists and it
   `return null` (`:1-3`). No `loading.tsx` for `/budgets`, `/report`,
   `/report/day/[date]`. With no fallback, the router shows nothing new until the
   server resolves → the old screen sits frozen, and there is **no transition
   animation**.

4. **Heavy eager hydration (context, not fixed this phase).** 22 chunks, 1.44 s
   render delay, zero `dynamic()` imports in `src/`, heavy client components
   (`AIQuickEntry`, charts, drawers) eagerly imported in `src/app/layout.tsx`.
   Causes the laggy first interaction. **Deferred to Tier 3.**

5. **No `placeholderData`/`keepPreviousData`.** Param-keyed report pages blank-
   flash when switching month/day instead of showing stale-while-loading.

**Already correct (no change needed):** `src/lib/get-query-client.ts` is the
proper asymmetric singleton (new client per request on server, one in browser),
with `staleTime: 60_000` and `shouldDehydrateQuery` configured to **dehydrate
pending queries** (`:13-18`). This is what makes the streaming pattern in change
E viable.

**Notable dead code:** `src/app/instant-shell-script.ts` and
`src/components/InstantAppShell.tsx` are never referenced at runtime (an
abandoned attempt at this exact fix). Out of scope here; flagged for cleanup.

## 4. Goals & non-goals

**Goals (this phase):**
- Eliminate the 1-2s blank gap on tab navigation.
- Show an instant skeleton + smooth transition on every route change.
- Stream dynamic-route data under a loading boundary instead of blocking.
- No blank flash when switching report params (month/day).
- Use only **stable** Next.js 15 / React 19 / TanStack Query v5 APIs.

**Non-goals (deferred to Tier 3 / later):**
- Service worker caching rework (Serwist `cacheOnNavigation`, SWR/NetworkFirst).
  Touches mutation invalidation — requires `LEARNINGS.md` review.
- `dynamic()` bundle splitting of heavy client components.
- Experimental View Transitions API (documented as a phase-2 upgrade).
- Partial Prerendering (experimental on Next 15; only stable as `cacheComponents`
  on Next 16). Skip until a Next 16 upgrade.
- Resolving the dead instant-shell code (separate cleanup).

## 5. Design

### A. `BottomNav` — `<button>` → `<Link prefetch>`

Replace the two navigating `<button>` clusters with `next/link` `<Link>`:
- Collapsed `primaryItems` cluster (`:196-224`).
- Expanded `menuItems` cluster (`:168-192`).

Keep the local side-effects (`setActiveItem`, `setExpanded`) in the `<Link>`'s
`onClick`; remove `router.push` from `handleNavigate`. The existing
`useEffect([pathname])` (`:107-109`) already re-syncs `activeItem`, so the
optimistic highlight remains correct.

```tsx
// before (collapsed item)
<button type="button" onClick={() => handleNavigate(item)} ...>
  ...
</button>

// after
<Link
  href={item.href}
  prefetch
  aria-label={item.label}
  aria-current={active ? "page" : undefined}
  onClick={() => { setActiveItem(item.id); setExpanded(false); }}
  ...
>
  ...
</Link>
```

- Use `prefetch` (full prefetch) — the tab destinations are a small, high-intent
  set, so prefetching code + data for all of them in the viewport is justified.
- Note: secondary items (Report/Settings) only render while the nav is expanded,
  so their prefetch fires on expand rather than on initial paint. Acceptable
  (low intent until expanded); revisit only if Report nav still feels slow.
- iOS focus rule (`.agents/rules/ios-input-focus.md`): the nav is not part of an
  active text-input workflow, so `onPointerDown` preventDefault is **not** added
  here.

*Fixes root cause 1. Highest impact, lowest effort.*

### B. Per-route `loading.tsx` skeletons

Add skeleton `loading.tsx` to each slow route, matching the real layout closely
enough to avoid a jarring swap:
- `src/app/budgets/loading.tsx`
- `src/app/report/loading.tsx`
- `src/app/report/day/[date]/loading.tsx`

**Leave the root `src/app/loading.tsx` returning `null`** — this is intentional
and test-enforced (`src/app/loading.test.tsx` asserts an empty global fallback so
the shared shell does not flash a skeleton on every navigation). Per-route
loading files give the correct granularity. Skeletons should preserve the shared
shell (header/tab-bar stays painted) and only skeletonize the data region.

*Fixes root cause 3. Provides the prefetched fallback that makes navigation paint
instantly, and the surface the transition (C) animates.*

### C. Route transition (CSS now; View Transitions later)

Add a small client `RouteTransition` wrapper, keyed on `usePathname()`, that
runs a stable enter animation (Tailwind `animate-in fade-in slide-in-from-right`
via the existing animate utilities) on the streamed content container. Keep the
shared shell (tab bar, header) static so only page content animates — the native
tab-swap feel.

- Duration ~200-250 ms, ease-out, respect `prefers-reduced-motion`.
- **Phase-2 upgrade (documented, not built):** Next 15.2 `experimental.viewTransition`
  + `unstable_ViewTransition` for shared-element morph (e.g. a day row morphing
  into the day-report header). iOS 18+ / Safari 18 support with graceful instant
  fallback elsewhere. Deferred because it opts the whole app into React's
  experimental build.

*Fixes the "no transition / janky" symptom.*

### D. `placeholderData: keepPreviousData` on report queries

On the param-keyed report consumers, add `placeholderData: keepPreviousData`
(the v5 function form; the v4 boolean was removed) so switching month/day keeps
showing the previous data while the new key loads:
- `MonthlyReportContent` (consumes `queries.reports.monthly(selectedMonth)`).
- `DailyReportContent` (consumes `queries.reports.daily(date)`).

```ts
import { keepPreviousData } from "@tanstack/react-query";

useQuery({ ...queries.reports.monthly(selectedMonth), placeholderData: keepPreviousData });
```

*Fixes the blank-flash on param-change navigation.*

### E. Stream dynamic routes (adopt Home's non-blocking pattern)

Adopt the **Home pattern's** non-blocking prefetch on `src/app/report/page.tsx`
and `src/app/report/day/[date]/page.tsx`. These components stay `async` (they
still `await params`/`searchParams`), but the data prefetch changes from
`await queryClient.prefetchQuery(...)` to **`void queryClient.prefetchQuery(...)`**
so the segment no longer blocks on the DB query. Because the query client already
dehydrates **pending** queries (`get-query-client.ts:15-17`), the in-flight
promise streams to the client.

```tsx
// before (report/page.tsx)
export default async function ReportPage({ searchParams }) {
  const { month } = await searchParams;
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({ queryKey: ..., queryFn: () => getMonthlyReport(...) });
  return <HydrationBoundary state={dehydrate(queryClient)}><MonthlyReportContent .../></HydrationBoundary>;
}

// after — non-blocking, streams under loading.tsx
export default async function ReportPage({ searchParams }) {
  const { month } = await searchParams;           // still await params (cheap)
  const selectedMonth = typeof month === "string" ? month : undefined;
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery({ queryKey: ..., queryFn: () => getMonthlyReport(selectedMonth) });
  return <HydrationBoundary state={dehydrate(queryClient)}><MonthlyReportContent selectedMonth={selectedMonth} /></HydrationBoundary>;
}
```

The content components switch their read to `useSuspenseQuery` (or keep `useQuery`
and render the skeleton on `isLoading` instead of `return null`). With `<Link>`
prefetch (A) + `loading.tsx` (B), the flow becomes: tap → skeleton paints
instantly → page RSC streams → data suspends → real content streams in.

> Note: this changes mutation/recovery-adjacent surfaces only indirectly. Per
> `CLAUDE.md`, re-read `LEARNINGS.md` before touching anything that affects
> optimistic mutations, background submits, or mutation lifecycle ownership. This
> change does not alter mutations, but the report surfaces consume invalidated
> queries — verify invalidation still lands after the read switches to suspense.

*Fixes root cause 2.*

## 6. Sequencing

1. **A + B together** — Link prefetch + loading skeletons. This pair alone should
   eliminate most of the perceived freeze and is independently shippable.
2. **C** — route transition (depends on B's content container existing).
3. **D** — placeholderData (independent, small).
4. **E** — stream dynamic routes (depends on B's loading boundaries).

## 7. Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Prefetching all tabs increases data use on slow networks | Tab set is tiny (2-4 routes); destinations are ISR-cached. Acceptable. Revisit hover-only prefetch if it regresses. |
| `useSuspenseQuery` switch causes a refetch/invalidation regression on report surfaces | `staleTime: 60_000` already prevents immediate refetch; verify invalidation still updates report after a mutation. Re-read `LEARNINGS.md`. |
| Skeleton/real layout mismatch causes CLS | Match skeleton dimensions to real content; current CLS is 0 — protect it. |
| Transition animation janky on low-end CPU | Cap at ~200-250 ms, transform/opacity only, honor `prefers-reduced-motion`. |
| iOS keyboard dismiss on nav controls | Nav is not in a text-input workflow; no `onPointerDown` change needed (per project rule). |

## 8. Success criteria (verify on prod build / Slow 4G + 4× CPU)

- Tab tap shows a visible response (skeleton or transition start) in **< 150 ms**
  (today: ~1-2 s blank).
- Repeat navigation to an already-prefetched tab paints in **< 300 ms**.
- No blank flash when switching report month/day.
- Visible enter transition on every route change; reduced-motion respected.
- Home cold LCP and CLS do not regress (LCP ≤ 2.0 s, CLS 0).
- Re-trace Home → Budget: the page JS chunks + RSC are served from prefetch cache,
  not downloaded after the tap.

## 9. Testing strategy

- **Component (`BottomNav`):** renders `<Link href>` for each item; `onClick`
  updates active/expanded state; active item reflects `usePathname()`.
- **Route loading:** each new `loading.tsx` renders its skeleton; root loading no
  longer returns null.
- **Report content:** seed `queryClient.setQueryData(...)` and assert
  `keepPreviousData` keeps prior data visible while the new key is fetching;
  assert skeleton (not null) on first load.
- **Streaming pages:** the report pages render without awaiting the DB query;
  pending query is dehydrated.
- **Manual / trace:** re-run the Chrome DevTools Slow-4G navigation trace and
  confirm prefetch cache hits + the success-criteria timings.
- Follow `CLAUDE.md`: targeted `tsc`/`vitest`/`eslint` on touched scope; run
  `npm run build` only before pushing.

## 10. Follow-ups (Tier 3 / later, out of scope here)

- Serwist: `cacheOnNavigation` + SWR app-shell + `NetworkFirst` for `GET /api/*`
  (after `LEARNINGS.md` review of mutation invalidation interplay).
- `dynamic(…, { ssr: false })` for `AIQuickEntry`, charts, drawers → cut the
  1.44 s render delay / first-tap lag.
- Resolve dead instant-shell code (`instant-shell-script.ts`, `InstantAppShell.tsx`).
- Investigate duplicate `/api/budgets` fetch on home load.
- View Transitions API upgrade for shared-element morph.

## References

- Next.js Linking & Navigating — https://nextjs.org/docs/app/getting-started/linking-and-navigating
- `useLinkStatus` (Next 15.3) — https://nextjs.org/docs/app/api-reference/functions/use-link-status
- `viewTransition` config (Next 15.2) — https://nextjs.org/docs/app/api-reference/config/next-config-js/viewTransition
- TanStack Query v5 Advanced SSR — https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr
- Serwist `cacheOnNavigation` — https://serwist.pages.dev/docs/next/configuring/cache-on-navigation
