# TanStack Query Rules

Rules every agent **must** follow when adding or editing app-owned reads and writes in this repo.

These rules reflect the current TanStack Query migration. For app-owned mutable data, this file supersedes older generic guidance in `.agents/rules/nextjs-code.md` that prefers Server Actions for internal calls.

Stack: Next.js 15 App Router · TanStack Query · `@lukemorales/query-key-factory` · route handlers · service/db functions.

---

## 1. Data Flow

Use this layering for browser reads:

```txt
Client component
-> useQuery(queries.feature.entry(params))
-> query factory browser queryFn
-> /api/* route handler
-> shared service/db function
```

Use this layering for browser writes:

```txt
Client component
-> mutation hook from src/lib/mutations
-> /api/* route handler
-> shared service/db function
-> centralized query invalidation
```

Use this layering for server prefetch:

```txt
Server page/shell
-> getQueryClient().prefetchQuery(...)
-> queries.feature.entry(params).queryKey
-> shared service/db function directly
-> HydrationBoundary
-> matching client component useQuery(...)
```

Never call Drizzle from a client component. Browser query and mutation functions call route handlers; server prefetch calls service/db functions directly.

## 2. Query Keys

- Use `@lukemorales/query-key-factory` to manage all app-owned TanStack Query keys.
- Define query families in `src/lib/queries/<feature>.ts` with `createQueryKeys` from `@lukemorales/query-key-factory`.
- Merge feature query families through `src/lib/queries/index.ts` with `mergeQueryKeys` from `@lukemorales/query-key-factory`, then import `queries` from `@/lib/queries` in consumers.
- Do not create ad hoc array keys in components, pages, or mutation hooks.
- Include every value that changes returned data in the query key.
- Normalize optional params in keys so `undefined`, omitted fields, and explicit empty values do not accidentally create duplicate cache entries.
- Use `queries.feature.entry(params).queryKey` for exact cache reads, test seeding, prefetching, and precise invalidation.
- Use `queries.feature.entry._def` or `queries.feature._def` only when intentionally invalidating a whole query family.

Preferred:

```ts
const { data } = useQuery(queries.expenses.list(params));
```

Only spread a query entry when adding component-specific options:

```ts
const query = useQuery({
  ...queries.budgetWeekly.options(weekStart, targetDate),
  enabled: sheetOpen && Boolean(weekStart),
  staleTime: 5 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
  retry: false,
});
```

## 3. Browser Fetchers

- Put browser fetchers beside their query factory in `src/lib/queries/<feature>.ts`.
- Fetch route handlers, not Server Actions.
- Use `cache: "no-store"` for app-owned mutable reads.
- Prefer `fetchJson` from `src/lib/queries/http.ts` for consistent `{ error: string }` parsing.
- Keep query factory functions typed to the service/route response shape.
- Query fetchers should not import from `src/app/actions`.

Example:

```ts
export const fetchDailyReport = async (date: string): Promise<DailyReport> => {
  const query = new URLSearchParams({ date });

  return fetchJson<DailyReport>(`/api/reports/daily?${query}`, {
    method: "GET",
    cache: "no-store",
  });
};

export const reportQueries = createQueryKeys("reports", {
  daily: (date: string) => ({
    queryKey: [date],
    queryFn: () => fetchDailyReport(date),
  }),
});
```

## 4. Server Prefetch

- Server pages use `getQueryClient()` from `src/lib/get-query-client.ts`.
- Prefetch with the same `queries.*.queryKey` the client component will use.
- Override `queryFn` with a direct service/db call. Do not self-fetch the app's own `/api/*` route from a Server Component.
- Wrap the matching client subtree in `HydrationBoundary`.
- Do not render a separate server copy of data that the hydrated client component owns and later invalidates. TanStack Query cannot update Server Component output after client invalidation.

Example:

```tsx
const queryClient = getQueryClient();

await queryClient.prefetchQuery({
  queryKey: queries.expenses.list(expenseListParams).queryKey,
  queryFn: () => getExpenseList(expenseListParams),
});

return (
  <HydrationBoundary state={dehydrate(queryClient)}>
    <ExpenseList {...props} />
  </HydrationBoundary>
);
```

## 5. Mutations

- Components call hooks from `src/lib/mutations`.
- Do not call `fetch("/api/...")` directly from components for app-owned writes.
- Do not add new Server Actions for app-owned expense or budget writes.
- Mutation hooks own route calls, error parsing, and invalidation.
- Use `mutateAsync` in components when the UI flow must wait before closing sheets, resetting forms, or showing success toasts.
- Mutation routes must validate runtime input and return `{ error: string }` with an appropriate status code.
- Route-handler writes should keep `revalidatePath` only for server-rendered surfaces that still need it during the migration.

## 6. Invalidation

- Centralize invalidation in `src/lib/mutations/index.ts`.
- Use exact keys when only one detail cache is affected.
- Use `_def` when all entries in a family can be affected.
- Cancel or remove stale detail queries before invalidating broad surviving surfaces when an entity is deleted.
- Keep invalidation rules narrow enough to avoid refetching invalid queries, but broad enough to update all visible surfaces.

Current patterns:

```ts
await queryClient.invalidateQueries({ queryKey: queries.expenses._def });
await queryClient.invalidateQueries({
  queryKey: queries.budgets.overview.queryKey,
});
await queryClient.invalidateQueries({
  queryKey: queries.budgets.transferCandidates._def,
});
await queryClient.cancelQueries({
  queryKey: queries.budgets.transactions(deletedBudgetId).queryKey,
});
```

## 7. Infinite Queries

- Build the base entry through `queries`.
- Reuse its `queryKey` and `queryFn`.
- Add pagination-specific options in the component: `initialPageParam`, `enabled`, `getNextPageParam`, and any local `staleTime`.
- Include stable identity values, such as entity id, in the query key. Do not include page offsets in the base key unless the query is not an infinite query.

## 8. Tests

- Query fetchers: test request URL, HTTP method, `cache: "no-store"`, successful JSON, and `{ error }` failures.
- Route handlers: test validation, response shapes, status codes, and service/db calls.
- Mutation hooks: test invalidation keys and special delete/transfer behavior.
- Components: prefer real `QueryClientProvider` with seeded `queryClient.setQueryData(...)` for read paths.
- Mock TanStack hooks only when the component's behavior is specifically about query state transitions that are cumbersome to express through a real client.
- Use targeted checks. Do not run `npm run build` for every individual change.

## 9. Anti-Patterns

| Do not | Do |
| --- | --- |
| Import `@/app/actions/*` from query fetchers or components | Use REST routes and mutation hooks |
| Build query keys inline in a component | Add a `@lukemorales/query-key-factory` entry |
| Self-fetch `/api/*` from Server Components | Call the shared service/db function directly |
| Duplicate server-rendered data outside the hydrated client owner | Let the client query own mutable data |
| Invalidate broad roots without checking deleted-detail keys | Cancel exact stale details and invalidate surviving surfaces |
| Put mutation invalidation in components | Keep it in `src/lib/mutations` |
| Add new Server Actions for expense/budget writes | Add or reuse route handlers plus mutation hooks |

## 10. Where To Look First

- Query client defaults: `src/lib/get-query-client.ts`
- Query factories: `src/lib/queries/*`
- Shared query export: `src/lib/queries/index.ts`
- Browser JSON helper: `src/lib/queries/http.ts`
- Mutation hooks and invalidation: `src/lib/mutations/index.ts`
- Read route examples: `src/app/api/expenses/route.ts`, `src/app/api/reports/monthly/route.ts`
- Mutation route examples: `src/app/api/expenses/[id]/route.ts`, `src/app/api/budgets/transfer/route.ts`
- Server prefetch examples: `src/app/page.tsx`, `src/app/transactions/page.tsx`, `src/app/report/page.tsx`
