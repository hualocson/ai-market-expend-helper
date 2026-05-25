# Cold-Start Expense List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fresh browsers with existing server expenses render the first expense page immediately, seed that page into IndexedDB after hydration, and gate further local pagination until the expense sync cursor exists.

**Architecture:** Restore server prefetch for the first home expense page while keeping browser expense reads IndexedDB-only. Add a client bootstrap in the existing sync coordinator that converts the hydrated first page into synced IndexedDB records without creating outbox operations. Gate infinite-scroll load-more until `syncRepository.metadata.getCursor("expenses")` returns a cursor.

**Tech Stack:** Next.js 15 App Router, React 19, TanStack Query infinite queries, Zustand sync store, IndexedDB via `idb`, Drizzle services, Vitest, Testing Library.

---

## File Structure

- Modify `src/lib/services/expenses.ts`
  - Include `expenses.clientId` in server list rows so hydrated rows can be seeded into local sync storage with stable identity.
- Modify `src/lib/services/expenses.test.ts`
  - Assert `getExpenseList()` carries `clientId` into `ExpenseListResult.rows`.
- Modify `src/app/page.tsx`
  - Restore first-page expense `prefetchInfiniteQuery` using `getExpenseList()` directly.
- Modify `src/app/page.test.tsx`
  - Assert dashboard and first expense page are both prefetched.
- Modify `src/lib/sync/expenses/coordinator.ts`
  - Add `seedExpenseListResultInSyncStorage()` helper for writing server list rows as synced records.
- Modify `src/components/ExpenseSyncCoordinator.tsx`
  - Seed the hydrated home expense first page before requesting sync.
- Modify `src/components/ExpenseSyncCoordinator.test.tsx`
  - Assert hydrated page seeding writes synced records and does not create outbox operations.
- Modify `src/components/ExpenseList.tsx`
  - Check sync cursor and gate load-more until initial pull has completed.
- Modify `src/components/ExpenseList.test.tsx`
  - Assert no-cursor pagination gate and cursor-enabled load-more behavior.

## Task 1: Restore Home Server Prefetch And Preserve Client Identity

**Files:**
- Modify: `src/lib/services/expenses.test.ts`
- Modify: `src/lib/services/expenses.ts`
- Modify: `src/app/page.test.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Update the service test to require `clientId` in list rows**

In `src/lib/services/expenses.test.ts`, update the mocked rows in the `"returns one requested page and reports whether more rows exist"` test so the first two returned rows include `clientId`, and add an assertion for the returned client ids:

```ts
dbMocks.offset.mockResolvedValue([
  {
    id: 3,
    clientId: "server-client-3",
    date: "2026-05-23",
    amount: 300,
    note: "Dinner",
    category: "Food",
    paidBy: "Cubi",
    budgetId: null,
    budgetName: null,
  },
  {
    id: 2,
    clientId: "server-client-2",
    date: "2026-05-22",
    amount: 200,
    note: "Lunch",
    category: "Food",
    paidBy: "Embe",
    budgetId: null,
    budgetName: null,
  },
  {
    id: 1,
    clientId: null,
    date: "2026-05-21",
    amount: 100,
    note: "Coffee",
    category: "Food",
    paidBy: "Cubi",
    budgetId: null,
    budgetName: null,
  },
]);
```

Add this assertion after the existing `result.rows.map((row) => row.id)` assertion:

```ts
expect(result.rows.map((row) => row.clientId)).toEqual([
  "server-client-3",
  "server-client-2",
]);
```

- [ ] **Step 2: Run the service test and verify it fails**

Run:

```bash
rtk bunx vitest run src/lib/services/expenses.test.ts -t "returns one requested page"
```

Expected: FAIL because `getExpenseList()` does not yet select or return `clientId`.

- [ ] **Step 3: Include `clientId` in server expense list rows**

In `src/lib/services/expenses.ts`, add `clientId` to the select projection:

```ts
const rows = await db
  .select({
    id: expenses.id,
    clientId: expenses.clientId,
    date: expenses.date,
    amount: expenses.amount,
    note: expenses.note,
    category: expenses.category,
    paidBy: expenses.paidBy,
    budgetId: expenseBudgets.budgetId,
    budgetName: budgets.name,
  })
```

Update the normalized row mapping to include `clientId`:

```ts
const normalizedRows = rows.slice(0, pageLimit).map((expense) => ({
  id: Number(expense.id),
  clientId: expense.clientId ?? null,
  date: String(expense.date),
  amount: Number(expense.amount ?? 0),
  note: expense.note ?? "",
  category: expense.category ?? "",
  paidBy: expense.paidBy ?? "",
  budgetId: expense.budgetId === null ? null : Number(expense.budgetId),
  budgetName: expense.budgetName ?? null,
}));
```

- [ ] **Step 4: Run the service test and verify it passes**

Run:

```bash
rtk bunx vitest run src/lib/services/expenses.test.ts -t "returns one requested page"
```

Expected: PASS.

- [ ] **Step 5: Update the home page test to expect expense prefetch**

In `src/app/page.test.tsx`, replace the current `"prefetches dashboard summary without hydrating expenses from the server"` test with:

```tsx
it("prefetches dashboard summary and the first expense page", async () => {
  prefetchQueryMock.mockResolvedValue(undefined);
  prefetchInfiniteQueryMock.mockResolvedValue(undefined);

  render(await Home());

  expect(prefetchQueryMock).toHaveBeenCalledTimes(1);
  expect(prefetchQueryMock).toHaveBeenCalledWith(
    expect.objectContaining({
      queryKey: expect.arrayContaining(["dashboard", "monthlySummary"]),
      queryFn: expect.any(Function),
    })
  );
  expect(prefetchInfiniteQueryMock).toHaveBeenCalledTimes(1);
  expect(prefetchInfiniteQueryMock).toHaveBeenCalledWith(
    expect.objectContaining({
      queryKey: expect.arrayContaining(["expenses", "list"]),
      queryFn: expect.any(Function),
      initialPageParam: 0,
    })
  );

  const prefetchOptions = prefetchInfiniteQueryMock.mock.calls[0]?.[0] as {
    queryFn: (context: { pageParam: number }) => Promise<unknown>;
  };
  await prefetchOptions.queryFn({ pageParam: 0 });

  expect(getExpenseListMock).toHaveBeenCalledWith({ limit: 30, offset: 0 });
  expect(screen.getByTestId("dashboard-header")).toBeInTheDocument();
  expect(screen.getByTestId("expense-list")).toBeInTheDocument();
});
```

- [ ] **Step 6: Run the home page test and verify it fails**

Run:

```bash
rtk bunx vitest run src/app/page.test.tsx
```

Expected: FAIL because `prefetchInfiniteQuery` is not called yet.

- [ ] **Step 7: Restore first expense page prefetch on `/`**

In `src/app/page.tsx`, add the server expense service import:

```ts
import { getExpenseList } from "@/lib/services/expenses";
```

Replace the single dashboard prefetch with parallel dashboard and first-page expense prefetch:

```tsx
export default async function Home() {
  const expenseListParams = { limit: 30 };
  const expenseListQuery = queries.expenses.list(expenseListParams);
  const queryClient = getQueryClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queries.dashboard.monthlySummary().queryKey,
      queryFn: () => getDashboardMonthlySummary(),
    }),
    queryClient.prefetchInfiniteQuery({
      queryKey: expenseListQuery.queryKey,
      queryFn: ({ pageParam }) =>
        getExpenseList({
          ...expenseListParams,
          offset: typeof pageParam === "number" ? pageParam : 0,
        }),
      initialPageParam: 0,
    }),
  ]);

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col items-stretch px-4 pt-6 pb-28 sm:px-6 sm:pt-8">
      <div className="flex flex-col items-stretch gap-6">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <SpendingDashboardHeader />

          <ExpenseList />
        </HydrationBoundary>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Run Task 1 tests and verify they pass**

Run:

```bash
rtk bunx vitest run src/lib/services/expenses.test.ts src/app/page.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit Task 1**

Run:

```bash
rtk git add src/lib/services/expenses.ts src/lib/services/expenses.test.ts src/app/page.tsx src/app/page.test.tsx
rtk git commit -m "Restore home expense first page prefetch"
```

Expected: commit succeeds with only Task 1 files staged.

## Task 2: Seed Hydrated First Page Into IndexedDB

**Files:**
- Modify: `src/lib/sync/expenses/coordinator.ts`
- Modify: `src/components/ExpenseSyncCoordinator.tsx`
- Modify: `src/components/ExpenseSyncCoordinator.test.tsx`

- [ ] **Step 1: Add a failing coordinator test for hydrated page seeding**

In `src/components/ExpenseSyncCoordinator.test.tsx`, add these imports:

```tsx
import { queries } from "@/lib/queries";
import type { ExpenseListResult } from "@/lib/services/expenses";
import { syncRepository } from "@/lib/sync/core/repository";
import type { InfiniteData } from "@tanstack/react-query";
import "fake-indexeddb/auto";
```

Change `renderCoordinator` to accept an optional query client:

```tsx
const renderCoordinator = (queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
})) => {
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return render(<ExpenseSyncCoordinator />, { wrapper });
};
```

Add this helper inside `describe("ExpenseSyncCoordinator", () => { ... })` before the tests:

```tsx
const buildExpensePage = (): ExpenseListResult => ({
  activeMonth: "2026-05",
  effectiveRecentDays: 7,
  groupedRows: [
    {
      key: "2026-05-24",
      label: "Sunday, 24/05/2026",
      totalAmount: 50000,
      items: [
        {
          id: 30,
          clientId: "server-client-30",
          date: "2026-05-24",
          amount: 50000,
          note: "Hydrated lunch",
          category: "Food",
          paidBy: "Cubi",
          budgetId: 7,
          budgetName: "Meals",
        },
      ],
    },
  ],
  isRecent: false,
  pagination: {
    limit: 30,
    offset: 0,
    hasMore: true,
  },
  rows: [
    {
      id: 30,
      clientId: "server-client-30",
      date: "2026-05-24",
      amount: 50000,
      note: "Hydrated lunch",
      category: "Food",
      paidBy: "Cubi",
      budgetId: 7,
      budgetName: "Meals",
    },
  ],
});
```

Add this test:

```tsx
it("seeds hydrated first expense page into IndexedDB without creating outbox operations", async () => {
  await syncRepository.testing.clearSyncDb();
  requestExpenseSyncMock.mockResolvedValue(undefined);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const params = { limit: 30 };
  queryClient.setQueryData<InfiniteData<ExpenseListResult, number>>(
    queries.expenses.list(params).queryKey,
    {
      pageParams: [0],
      pages: [buildExpensePage()],
    }
  );

  renderCoordinator(queryClient);

  await waitFor(async () => {
    const records = await syncRepository.records.list("expenses");
    expect(records).toEqual([
      expect.objectContaining({
        entity: "expenses",
        clientId: "server-client-30",
        serverId: 30,
        syncStatus: "synced",
        lastError: null,
        payload: expect.objectContaining({
          date: "2026-05-24",
          amount: 50000,
          note: "Hydrated lunch",
          category: "Food",
          paidBy: "Cubi",
          budgetId: 7,
          budgetName: "Meals",
        }),
      }),
    ]);
  });
  await expect(syncRepository.outbox.list("expenses")).resolves.toEqual([]);
  expect(requestExpenseSyncMock).toHaveBeenCalledWith(queryClient);

  await syncRepository.testing.clearSyncDb();
});
```

- [ ] **Step 2: Run the coordinator seeding test and verify it fails**

Run:

```bash
rtk bunx vitest run src/components/ExpenseSyncCoordinator.test.tsx -t "seeds hydrated first expense page"
```

Expected: FAIL because `ExpenseSyncCoordinator` does not seed hydrated query data yet.

- [ ] **Step 3: Add the sync-storage seed helper**

In `src/lib/sync/expenses/coordinator.ts`, add this import near the existing imports:

```ts
import type { ExpenseListResult } from "@/lib/expenses/list-model";
```

Add these helpers after `localExpenseToSyncRecord`:

```ts
const buildServerListClientId = (serverId: number) =>
  `expense-server-${serverId}`;

const findExistingRecordForExpenseListItem = (
  row: ExpenseListResult["rows"][number],
  records: SyncRecord<unknown>[]
) => {
  const rowClientId = row.clientId ?? null;
  if (rowClientId) {
    const byClientId = records.find(
      (record) => record.clientId === rowClientId
    );
    if (byClientId) {
      return byClientId;
    }
  }

  return records.find((record) => record.serverId === row.id);
};

const expenseListItemToSyncedRecord = (
  row: ExpenseListResult["rows"][number],
  now: string
): SyncRecord<ExpensePayload> | null => {
  if (row.id <= 0) {
    return null;
  }

  return {
    entity: EXPENSE_SYNC_ENTITY,
    clientId: row.clientId ?? buildServerListClientId(row.id),
    serverId: row.id,
    syncStatus: "synced",
    lastError: null,
    updatedAt: now,
    serverUpdatedAt: now,
    payload: {
      date: row.date,
      amount: row.amount,
      note: row.note,
      category: row.category,
      paidBy: row.paidBy,
      budgetId: row.budgetId,
      budgetName: row.budgetName,
    },
  };
};
```

Add this exported helper before `invalidateExpenseDerivedQueries`:

```ts
export const seedExpenseListResultInSyncStorage = async (
  result: ExpenseListResult,
  now = new Date().toISOString()
): Promise<void> => {
  if (result.rows.length === 0) {
    return;
  }

  const existingRecords = await syncRepository.records.list(
    EXPENSE_SYNC_ENTITY
  );
  const records = result.rows.flatMap((row) => {
    const existingRecord = findExistingRecordForExpenseListItem(
      row,
      existingRecords
    );
    if (existingRecord && existingRecord.syncStatus !== "synced") {
      return [];
    }

    const record = expenseListItemToSyncedRecord(row, now);
    return record ? [record] : [];
  });

  if (records.length > 0) {
    await syncRepository.records.putMany(records);
  }
};
```

- [ ] **Step 4: Seed hydrated query data before requesting sync**

In `src/components/ExpenseSyncCoordinator.tsx`, add imports:

```tsx
import { queries } from "@/lib/queries";
import type { ExpenseListResult } from "@/lib/services/expenses";
import { seedExpenseListResultInSyncStorage } from "@/lib/sync/expenses/coordinator";
import type { InfiniteData, QueryClient } from "@tanstack/react-query";
```

Add this helper above the component:

```tsx
const HOME_EXPENSE_LIST_PARAMS = { limit: 30 };

const seedHydratedHomeExpenseList = async (queryClient: QueryClient) => {
  const data = queryClient.getQueryData<InfiniteData<ExpenseListResult, number>>(
    queries.expenses.list(HOME_EXPENSE_LIST_PARAMS).queryKey
  );
  const firstPage = data?.pages[0];
  if (!firstPage) {
    return;
  }

  await seedExpenseListResultInSyncStorage(firstPage);
};
```

Update the effect's `runSync` function:

```tsx
useEffect(() => {
  let active = true;
  const runSync = () => {
    void seedHydratedHomeExpenseList(queryClient).finally(() => {
      if (active) {
        void requestExpenseSync(queryClient);
      }
    });
  };

  runSync();

  window.addEventListener("online", runSync);
  window.addEventListener("focus", runSync);

  return () => {
    active = false;
    window.removeEventListener("online", runSync);
    window.removeEventListener("focus", runSync);
  };
}, [queryClient]);
```

- [ ] **Step 5: Run coordinator tests and verify they pass**

Run:

```bash
rtk bunx vitest run src/components/ExpenseSyncCoordinator.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

Run:

```bash
rtk git add src/lib/sync/expenses/coordinator.ts src/components/ExpenseSyncCoordinator.tsx src/components/ExpenseSyncCoordinator.test.tsx
rtk git commit -m "Seed hydrated expenses into sync storage"
```

Expected: commit succeeds with only Task 2 files staged.

## Task 3: Gate Load-More Until The Expense Sync Cursor Exists

**Files:**
- Modify: `src/components/ExpenseList.test.tsx`
- Modify: `src/components/ExpenseList.tsx`

- [ ] **Step 1: Add a failing no-cursor pagination gate test**

In `src/components/ExpenseList.test.tsx`, add this test before `"fetches the next page when the bottom sentinel intersects"`:

```tsx
it("gates load more while the initial expense sync cursor is missing", async () => {
  globalThis.React = React;
  await syncRepository.testing.clearSyncDb();

  let observerCallback:
    | ((entries: IntersectionObserverEntry[]) => void)
    | undefined;
  const observe = vi.fn();
  const originalIntersectionObserver = globalThis.IntersectionObserver;
  globalThis.IntersectionObserver = vi.fn((callback) => {
    observerCallback = callback;
    return {
      observe,
      unobserve: vi.fn(),
      disconnect: vi.fn(),
      root: null,
      rootMargin: "",
      thresholds: [],
      takeRecords: () => [],
    };
  }) as unknown as typeof IntersectionObserver;

  const queryClient = buildClient();
  const params = { limit: 30 };
  const firstPage: ExpenseListResult = {
    ...buildPage(),
    pagination: {
      limit: 30,
      offset: 0,
      hasMore: true,
    },
  };
  queryClient.setQueryData<InfiniteData<ExpenseListResult, number>>(
    queries.expenses.list(params).queryKey,
    { pageParams: [0], pages: [firstPage] }
  );

  try {
    render(
      <QueryClientProvider client={queryClient}>
        <ExpenseList />
      </QueryClientProvider>
    );

    expect(
      await screen.findByText("Syncing all expenses before loading more.")
    ).toBeInTheDocument();
    expect(observe).not.toHaveBeenCalled();

    observerCallback?.([
      { isIntersecting: true } as IntersectionObserverEntry,
    ]);

    const cachedData = queryClient.getQueryData<
      InfiniteData<ExpenseListResult, number>
    >(queries.expenses.list(params).queryKey);
    expect(cachedData?.pages).toHaveLength(1);
  } finally {
    globalThis.IntersectionObserver = originalIntersectionObserver;
    await syncRepository.testing.clearSyncDb();
  }
});
```

- [ ] **Step 2: Update the existing load-more test to create a cursor**

In the existing `"fetches the next page when the bottom sentinel intersects"` test, after `await syncRepository.testing.clearSyncDb();`, add:

```tsx
await syncRepository.metadata.setCursor(
  "expenses",
  "2026-05-24T10:00:00.000Z"
);
```

- [ ] **Step 3: Run the ExpenseList pagination tests and verify the new test fails**

Run:

```bash
rtk bunx vitest run src/components/ExpenseList.test.tsx -t "load more|gates load more"
```

Expected: FAIL for the new gate test because the component still observes the sentinel and fetches page 2 without checking the cursor.

- [ ] **Step 4: Add cursor readiness state to `ExpenseList`**

In `src/components/ExpenseList.tsx`, add imports:

```tsx
import { syncRepository } from "@/lib/sync/core/repository";
import { EXPENSE_SYNC_ENTITY } from "@/lib/sync/expenses/types";
```

Add state after `editingExpense`:

```tsx
const [expenseSyncCursorReady, setExpenseSyncCursorReady] = useState(false);
```

Add this effect after the `useInfiniteQuery` call:

```tsx
useEffect(() => {
  let active = true;

  void syncRepository.metadata
    .getCursor(EXPENSE_SYNC_ENTITY)
    .then((cursor) => {
      if (active) {
        setExpenseSyncCursorReady(Boolean(cursor));
      }
    })
    .catch(() => {
      if (active) {
        setExpenseSyncCursorReady(false);
      }
    });

  return () => {
    active = false;
  };
}, [data]);
```

Add this derived value before the load-more observer effect:

```tsx
const isLoadMoreGated = Boolean(
  hasNextPage &&
    !expenseSyncCursorReady &&
    !isFetchingNextPage &&
    !isFetchNextPageError
);
```

Update the observer effect guard and dependencies:

```tsx
useEffect(() => {
  const target = loadMoreRef.current;
  if (!target || !hasNextPage || isFetchingNextPage || isLoadMoreGated) {
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        void fetchNextPage();
      }
    },
    {
      root: listContainerRef.current,
      rootMargin: "240px 0px",
    }
  );

  observer.observe(target);
  return () => observer.disconnect();
}, [fetchNextPage, hasNextPage, isFetchingNextPage, isLoadMoreGated]);
```

- [ ] **Step 5: Render the bottom gate status**

In `src/components/ExpenseList.tsx`, replace the load-more block with:

```tsx
{hasNextPage || isFetchingNextPage || isFetchNextPageError ? (
  <div
    ref={isLoadMoreGated ? undefined : loadMoreRef}
    className="flex justify-center py-3"
  >
    {isFetchNextPageError ? (
      <button
        type="button"
        onClick={() => void fetchNextPage()}
        className="text-primary text-sm font-medium underline-offset-4 hover:underline"
      >
        Retry loading more
      </button>
    ) : isFetchingNextPage ? (
      <span className="text-muted-foreground inline-flex items-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading more
      </span>
    ) : isLoadMoreGated ? (
      <span className="text-muted-foreground text-center text-xs">
        Syncing all expenses before loading more.
      </span>
    ) : (
      <span className="sr-only">Loading more transactions</span>
    )}
  </div>
) : null}
```

- [ ] **Step 6: Run ExpenseList tests and verify they pass**

Run:

```bash
rtk bunx vitest run src/components/ExpenseList.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit Task 3**

Run:

```bash
rtk git add src/components/ExpenseList.tsx src/components/ExpenseList.test.tsx
rtk git commit -m "Gate expense pagination until initial sync"
```

Expected: commit succeeds with only Task 3 files staged.

## Task 4: Run Focused Regression Checks

**Files:**
- Verify modified TypeScript and TSX files from Tasks 1-3.

- [ ] **Step 1: Run focused tests for the changed cold-start path**

Run:

```bash
rtk bunx vitest run src/lib/services/expenses.test.ts src/app/page.test.tsx src/components/ExpenseSyncCoordinator.test.tsx src/components/ExpenseList.test.tsx src/lib/sync/expenses/coordinator.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run Prettier write for modified files**

Run:

```bash
rtk bunx prettier --write src/lib/services/expenses.ts src/lib/services/expenses.test.ts src/app/page.tsx src/app/page.test.tsx src/lib/sync/expenses/coordinator.ts src/components/ExpenseSyncCoordinator.tsx src/components/ExpenseSyncCoordinator.test.tsx src/components/ExpenseList.tsx src/components/ExpenseList.test.tsx
```

Expected: Prettier completes successfully.

- [ ] **Step 3: Run Prettier check for modified files**

Run:

```bash
rtk bunx prettier --check src/lib/services/expenses.ts src/lib/services/expenses.test.ts src/app/page.tsx src/app/page.test.tsx src/lib/sync/expenses/coordinator.ts src/components/ExpenseSyncCoordinator.tsx src/components/ExpenseSyncCoordinator.test.tsx src/components/ExpenseList.tsx src/components/ExpenseList.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Run ESLint for modified files**

Run:

```bash
rtk bunx eslint src/lib/services/expenses.ts src/lib/services/expenses.test.ts src/app/page.tsx src/app/page.test.tsx src/lib/sync/expenses/coordinator.ts src/components/ExpenseSyncCoordinator.tsx src/components/ExpenseSyncCoordinator.test.tsx src/components/ExpenseList.tsx src/components/ExpenseList.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Check scoped diff**

Run:

```bash
rtk git diff --stat HEAD
rtk git diff -- src/lib/services/expenses.ts src/lib/services/expenses.test.ts src/app/page.tsx src/app/page.test.tsx src/lib/sync/expenses/coordinator.ts src/components/ExpenseSyncCoordinator.tsx src/components/ExpenseSyncCoordinator.test.tsx src/components/ExpenseList.tsx src/components/ExpenseList.test.tsx
```

Expected: Diff contains only the cold-start expense list changes from this plan.

- [ ] **Step 6: Commit formatting or final verification changes when files changed**

If Step 2 changed files after Task 1-3 commits, run:

```bash
rtk git add src/lib/services/expenses.ts src/lib/services/expenses.test.ts src/app/page.tsx src/app/page.test.tsx src/lib/sync/expenses/coordinator.ts src/components/ExpenseSyncCoordinator.tsx src/components/ExpenseSyncCoordinator.test.tsx src/components/ExpenseList.tsx src/components/ExpenseList.test.tsx
rtk git commit -m "Format cold-start expense list changes"
```

Expected: commit succeeds only if Prettier changed files. If `rtk git diff --stat HEAD` is empty, skip this commit.

## Self-Review

Spec coverage:

- Server first render is covered by Task 1.
- Hydrated first-page IndexedDB seeding is covered by Task 2.
- Browser `fetchExpenseList` remains IndexedDB-only because this plan does not modify `src/lib/queries/expenses.ts`.
- Cursor-gated pagination and bottom status are covered by Task 3.
- Focused tests, Prettier, and ESLint are covered by Task 4.

Placeholder scan:

- No placeholder tasks remain.
- Every code-changing step includes concrete code or a concrete replacement.

Type consistency:

- `ExpenseListResult` is imported from the existing service/list type surface.
- `InfiniteData<ExpenseListResult, number>` matches the current `ExpenseList` query data type.
- Sync records use existing `SyncRecord<ExpensePayload>` and `EXPENSE_SYNC_ENTITY`.
