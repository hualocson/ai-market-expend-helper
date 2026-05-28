# Expense Sync Queue And Local List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trigger expense sync immediately after local add/edit/delete writes, serialize overlapping sync requests through a queue, and make the expense list render from IndexedDB sync records instead of fetching `/api/expenses`.

**Architecture:** Add a small queueing scheduler around `syncExpensesNow` so mutation-triggered syncs, mount syncs, focus syncs, and online syncs cannot overlap. Expense mutations keep writing locally first, then request a queued background sync. The expense list query becomes IndexedDB-only: sync writes server state into `syncRecords`, then active list caches render from those local records.

**Tech Stack:** Next.js App Router, React 19, TanStack Query, Zustand, IndexedDB via the existing `syncRepository`, Vitest, React Testing Library.

---

## File Structure

- Create `src/lib/sync/expenses/scheduler.ts`: owns the serialized expense sync queue and exports the default `requestExpenseSync(queryClient)` entry point plus a factory for isolated tests.
- Create `src/lib/sync/expenses/scheduler.test.ts`: unit tests for queue serialization, collapsed follow-up runs, failure handling, and post-drain requests.
- Modify `src/components/ExpenseSyncCoordinator.tsx`: replace component-local in-flight tracking with the shared scheduler.
- Modify `src/components/ExpenseSyncCoordinator.test.tsx`: assert the coordinator requests queued sync on mount, online, and focus without emitting console errors.
- Modify `src/lib/mutations/index.ts`: after local expense create/update/delete success, invalidate existing query families and request queued sync in the background.
- Modify `src/lib/mutations/index.test.tsx`: mock the scheduler and assert create/update/delete expense hooks request sync; budget mutations must not request expense sync.
- Modify `src/lib/queries/expenses.ts`: remove `/api/expenses` fetch fallback from the browser query path; return `ExpenseListResult` built only from IndexedDB sync records.
- Modify `src/lib/queries/read-fetchers.test.ts`: update expense list fetcher tests to assert IndexedDB-only behavior and no `/api/expenses` fetch.
- Modify `src/lib/sync/expenses/coordinator.test.ts`: add or adjust coverage showing pull/flush refresh active list caches from synced IndexedDB records.

Before every commit, run `rtk git status --short` and stage only files touched by that task. This branch may contain unrelated user or prior-agent changes.

---

### Task 1: Shared Expense Sync Queue

**Files:**

- Create: `src/lib/sync/expenses/scheduler.ts`
- Create: `src/lib/sync/expenses/scheduler.test.ts`

- [ ] **Step 1: Write failing scheduler tests**

Create `src/lib/sync/expenses/scheduler.test.ts`:

```ts
import type { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { createExpenseSyncScheduler } from "./scheduler";

const createDeferred = () => {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return { promise, reject, resolve };
};

const queryClient = {} as QueryClient;

describe("expense sync scheduler", () => {
  it("runs a requested sync immediately when idle", async () => {
    const syncNow = vi.fn().mockResolvedValue(undefined);
    const onError = vi.fn();
    const scheduler = createExpenseSyncScheduler({ onError, syncNow });

    await scheduler.request(queryClient);

    expect(syncNow).toHaveBeenCalledTimes(1);
    expect(syncNow).toHaveBeenCalledWith(queryClient);
    expect(onError).not.toHaveBeenCalled();
  });

  it("serializes overlapping requests and collapses them into one follow-up run", async () => {
    const firstRun = createDeferred();
    const secondRun = createDeferred();
    const syncNow = vi
      .fn()
      .mockReturnValueOnce(firstRun.promise)
      .mockReturnValueOnce(secondRun.promise);
    const scheduler = createExpenseSyncScheduler({
      onError: vi.fn(),
      syncNow,
    });

    const firstRequest = scheduler.request(queryClient);
    const secondRequest = scheduler.request(queryClient);
    const thirdRequest = scheduler.request(queryClient);

    expect(syncNow).toHaveBeenCalledTimes(1);

    firstRun.resolve();
    await vi.waitFor(() => expect(syncNow).toHaveBeenCalledTimes(2));

    secondRun.resolve();
    await Promise.all([firstRequest, secondRequest, thirdRequest]);

    expect(syncNow).toHaveBeenCalledTimes(2);
  });

  it("keeps draining a queued follow-up even when the current sync fails", async () => {
    const secondRun = createDeferred();
    const syncError = new Error("Offline");
    const syncNow = vi
      .fn()
      .mockRejectedValueOnce(syncError)
      .mockReturnValueOnce(secondRun.promise);
    const onError = vi.fn();
    const scheduler = createExpenseSyncScheduler({ onError, syncNow });

    const firstRequest = scheduler.request(queryClient);
    const secondRequest = scheduler.request(queryClient);

    await vi.waitFor(() => expect(syncNow).toHaveBeenCalledTimes(2));
    secondRun.resolve();
    await Promise.all([firstRequest, secondRequest]);

    expect(onError).toHaveBeenCalledWith(syncError);
    expect(syncNow).toHaveBeenCalledTimes(2);
  });

  it("starts a new run after the previous queue drains", async () => {
    const syncNow = vi.fn().mockResolvedValue(undefined);
    const scheduler = createExpenseSyncScheduler({
      onError: vi.fn(),
      syncNow,
    });

    await scheduler.request(queryClient);
    await scheduler.request(queryClient);

    expect(syncNow).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run scheduler tests to verify they fail**

Run:

```bash
rtk bunx vitest run src/lib/sync/expenses/scheduler.test.ts
```

Expected: FAIL because `src/lib/sync/expenses/scheduler.ts` does not exist.

- [ ] **Step 3: Implement the queued scheduler**

Create `src/lib/sync/expenses/scheduler.ts`:

```ts
import type { QueryClient } from "@tanstack/react-query";

import { syncExpensesNow } from "./coordinator";

type ExpenseSyncRunner = (queryClient: QueryClient) => Promise<void>;

type ExpenseSyncSchedulerOptions = {
  syncNow?: ExpenseSyncRunner;
  onError?: (error: unknown) => void;
};

export type ExpenseSyncScheduler = {
  request: (queryClient: QueryClient) => Promise<void>;
};

const defaultOnError = (error: unknown) => {
  console.warn("Failed to sync expenses:", error);
};

export const createExpenseSyncScheduler = ({
  syncNow = syncExpensesNow,
  onError = defaultOnError,
}: ExpenseSyncSchedulerOptions = {}): ExpenseSyncScheduler => {
  let runningPromise: Promise<void> | null = null;
  let followUpRequested = false;
  let latestQueryClient: QueryClient | null = null;

  const drainQueue = async (initialQueryClient: QueryClient) => {
    latestQueryClient = initialQueryClient;

    do {
      followUpRequested = false;
      const queryClient = latestQueryClient;

      if (!queryClient) {
        return;
      }

      try {
        await syncNow(queryClient);
      } catch (error) {
        onError(error);
      }
    } while (followUpRequested);
  };

  return {
    request: (queryClient) => {
      latestQueryClient = queryClient;

      if (runningPromise) {
        followUpRequested = true;
        return runningPromise;
      }

      runningPromise = drainQueue(queryClient).finally(() => {
        runningPromise = null;
        latestQueryClient = null;
      });

      return runningPromise;
    },
  };
};

const expenseSyncScheduler = createExpenseSyncScheduler();

export const requestExpenseSync = (queryClient: QueryClient): Promise<void> =>
  expenseSyncScheduler.request(queryClient);
```

- [ ] **Step 4: Run scheduler tests to verify they pass**

Run:

```bash
rtk bunx vitest run src/lib/sync/expenses/scheduler.test.ts
```

Expected: PASS.

- [ ] **Step 5: Format and lint Task 1 files**

Run:

```bash
rtk bunx prettier --write src/lib/sync/expenses/scheduler.ts src/lib/sync/expenses/scheduler.test.ts
rtk bunx prettier --check src/lib/sync/expenses/scheduler.ts src/lib/sync/expenses/scheduler.test.ts
rtk bunx eslint src/lib/sync/expenses/scheduler.ts src/lib/sync/expenses/scheduler.test.ts
```

Expected: Prettier check passes and ESLint exits 0.

- [ ] **Step 6: Commit**

Run:

```bash
rtk git status --short
rtk git add src/lib/sync/expenses/scheduler.ts src/lib/sync/expenses/scheduler.test.ts
rtk git commit -m "feat: add queued expense sync scheduler"
```

Expected: commit succeeds and stages only Task 1 files.

---

### Task 2: Trigger Queued Sync From Coordinator And Expense Mutations

**Files:**

- Modify: `src/components/ExpenseSyncCoordinator.tsx`
- Modify: `src/components/ExpenseSyncCoordinator.test.tsx`
- Modify: `src/lib/mutations/index.ts`
- Modify: `src/lib/mutations/index.test.tsx`

- [ ] **Step 1: Write failing coordinator tests for scheduler usage**

In `src/components/ExpenseSyncCoordinator.test.tsx`, replace the `syncExpensesNow` mock with a scheduler mock:

```ts
const requestExpenseSyncMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/sync/expenses/scheduler", () => ({
  requestExpenseSync: requestExpenseSyncMock,
}));
```

Update the existing failure-no-console-error test:

```ts
it("does not emit console errors for background sync failures", async () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  requestExpenseSyncMock.mockRejectedValue(
    new Error("Failed to sync expenses")
  );

  renderCoordinator();

  await waitFor(() => expect(requestExpenseSyncMock).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(consoleError).not.toHaveBeenCalled());
});
```

Add this test:

```ts
it("requests queued sync on mount, online, and focus", async () => {
  requestExpenseSyncMock.mockResolvedValue(undefined);

  renderCoordinator();
  await waitFor(() => expect(requestExpenseSyncMock).toHaveBeenCalledTimes(1));

  window.dispatchEvent(new Event("online"));
  window.dispatchEvent(new Event("focus"));

  await waitFor(() => expect(requestExpenseSyncMock).toHaveBeenCalledTimes(3));
});
```

- [ ] **Step 2: Write failing mutation tests for post-write sync requests**

In `src/lib/mutations/index.test.tsx`, add the scheduler mock near the existing imports:

```ts
const requestExpenseSyncMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/sync/expenses/scheduler", () => ({
  requestExpenseSync: requestExpenseSyncMock,
}));
```

In `beforeEach`, add:

```ts
requestExpenseSyncMock.mockResolvedValue(undefined);
```

In `"creates an expense locally and invalidates affected query families"`, after invalidation assertions add:

```ts
expect(requestExpenseSyncMock).toHaveBeenCalledTimes(1);
expect(requestExpenseSyncMock).toHaveBeenCalledWith(queryClient);
```

In `"updates and deletes expenses locally through the existing id-based API"`, after invalidation assertions add:

```ts
expect(requestExpenseSyncMock).toHaveBeenCalledTimes(2);
expect(requestExpenseSyncMock).toHaveBeenCalledWith(queryClient);
```

Add this budget guard test after the budget mutation tests:

```ts
it("does not request expense sync for budget mutations", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    jsonResponse(successEnvelope({ id: 8 }), { status: 201 })
  );
  const { result } = renderMutationHook(() => useCreateBudgetMutation());

  await act(async () => {
    await result.current.mutateAsync({
      name: "Dining",
      amount: 200000,
      period: "month",
      periodStartDate: "2026-05-01",
      periodEndDate: "2026-05-31",
    });
  });

  expect(requestExpenseSyncMock).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
rtk bunx vitest run src/components/ExpenseSyncCoordinator.test.tsx src/lib/mutations/index.test.tsx
```

Expected: FAIL because the coordinator still imports `syncExpensesNow` and mutation hooks do not call `requestExpenseSync`.

- [ ] **Step 4: Update the coordinator to use the scheduler**

Replace `src/components/ExpenseSyncCoordinator.tsx` with:

```tsx
"use client";

import { useEffect } from "react";

import { requestExpenseSync } from "@/lib/sync/expenses/scheduler";
import { useQueryClient } from "@tanstack/react-query";

const ExpenseSyncCoordinator = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const runSync = () => {
      void requestExpenseSync(queryClient);
    };

    runSync();

    window.addEventListener("online", runSync);
    window.addEventListener("focus", runSync);

    return () => {
      window.removeEventListener("online", runSync);
      window.removeEventListener("focus", runSync);
    };
  }, [queryClient]);

  return null;
};

export default ExpenseSyncCoordinator;
```

- [ ] **Step 5: Update expense mutation hooks to request queued sync**

In `src/lib/mutations/index.ts`, add:

```ts
import { requestExpenseSync } from "@/lib/sync/expenses/scheduler";
```

Add a helper near `invalidateExpenseMutationQueries`:

```ts
const requestExpenseSyncAfterLocalWrite = (queryClient: QueryClient) => {
  void requestExpenseSync(queryClient);
};
```

Update only the three expense mutation hooks:

```ts
export const useCreateExpenseMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateExpenseInput) =>
      createLocalExpense(expenseSyncStore, input),
    onSuccess: async () => {
      await invalidateExpenseMutationQueries(queryClient);
      requestExpenseSyncAfterLocalWrite(queryClient);
    },
  });
};

export const useUpdateExpenseMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: UpdateExpenseVariables) =>
      updateLocalExpense(
        expenseSyncStore,
        ensureLocalExpenseForUpdate(id, input),
        input
      ),
    onSuccess: async () => {
      await invalidateExpenseMutationQueries(queryClient);
      requestExpenseSyncAfterLocalWrite(queryClient);
    },
  });
};

export const useDeleteExpenseMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      deleteLocalExpense(expenseSyncStore, ensureLocalExpenseForDelete(id)),
    onSuccess: async () => {
      await invalidateExpenseMutationQueries(queryClient);
      requestExpenseSyncAfterLocalWrite(queryClient);
    },
  });
};
```

- [ ] **Step 6: Run tests to verify they pass**

Run:

```bash
rtk bunx vitest run src/components/ExpenseSyncCoordinator.test.tsx src/lib/mutations/index.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Format and lint Task 2 files**

Run:

```bash
rtk bunx prettier --write src/components/ExpenseSyncCoordinator.tsx src/components/ExpenseSyncCoordinator.test.tsx src/lib/mutations/index.ts src/lib/mutations/index.test.tsx
rtk bunx prettier --check src/components/ExpenseSyncCoordinator.tsx src/components/ExpenseSyncCoordinator.test.tsx src/lib/mutations/index.ts src/lib/mutations/index.test.tsx
rtk bunx eslint src/components/ExpenseSyncCoordinator.tsx src/components/ExpenseSyncCoordinator.test.tsx src/lib/mutations/index.ts src/lib/mutations/index.test.tsx
```

Expected: Prettier check passes and ESLint exits 0.

- [ ] **Step 8: Commit**

Run:

```bash
rtk git status --short
rtk git add src/components/ExpenseSyncCoordinator.tsx src/components/ExpenseSyncCoordinator.test.tsx src/lib/mutations/index.ts src/lib/mutations/index.test.tsx
rtk git commit -m "feat: request expense sync after local writes"
```

Expected: commit succeeds and stages only Task 2 files.

---

### Task 3: Make Expense List Query IndexedDB-Only

**Files:**

- Modify: `src/lib/queries/expenses.ts`
- Modify: `src/lib/queries/read-fetchers.test.ts`
- Modify: `src/lib/sync/expenses/coordinator.test.ts`

- [ ] **Step 1: Write failing read fetcher tests for IndexedDB-only list reads**

In `src/lib/queries/read-fetchers.test.ts`, find the expense list fetcher tests that currently mock `/api/expenses` network responses. Replace the representative browser expense list success test with:

```ts
it("builds expense list results from IndexedDB sync records without fetching /api/expenses", async () => {
  await syncRepository.testing.clearSyncDb();
  await syncRepository.records.put({
    entity: "expenses",
    clientId: "client-1",
    serverId: 30,
    syncStatus: "synced",
    lastError: null,
    updatedAt: "2026-05-24T10:00:00.000Z",
    serverUpdatedAt: "2026-05-24T10:00:00.000Z",
    payload: {
      date: "2026-05-24",
      amount: 50000,
      note: "Lunch",
      category: "Food",
      paidBy: "Cubi",
      budgetId: null,
      budgetName: null,
    },
  });
  const fetchSpy = vi.spyOn(globalThis, "fetch");

  const result = await fetchExpenseList({ month: "2026-05", limit: 30 });

  expect(fetchSpy).not.toHaveBeenCalled();
  expect(result.rows).toEqual([
    expect.objectContaining({
      id: 30,
      note: "Lunch",
    }),
  ]);
  expect(result.groupedRows).toEqual([
    expect.objectContaining({
      key: "2026-05-24",
      totalAmount: 50000,
    }),
  ]);
});
```

Add this empty-local test:

```ts
it("returns an empty expense list when IndexedDB has no matching records", async () => {
  await syncRepository.testing.clearSyncDb();
  const fetchSpy = vi.spyOn(globalThis, "fetch");

  const result = await fetchExpenseList({ month: "2026-05", limit: 30 });

  expect(fetchSpy).not.toHaveBeenCalled();
  expect(result.rows).toEqual([]);
  expect(result.groupedRows).toEqual([]);
  expect(result.pagination).toMatchObject({
    limit: 30,
    offset: 0,
    hasMore: false,
  });
});
```

Add this pagination test:

```ts
it("paginates expense list results from IndexedDB records", async () => {
  await syncRepository.testing.clearSyncDb();
  await syncRepository.records.putMany([
    {
      entity: "expenses",
      clientId: "client-1",
      serverId: 31,
      syncStatus: "synced",
      lastError: null,
      updatedAt: "2026-05-24T10:00:00.000Z",
      serverUpdatedAt: "2026-05-24T10:00:00.000Z",
      payload: {
        date: "2026-05-24",
        amount: 50000,
        note: "Lunch",
        category: "Food",
        paidBy: "Cubi",
        budgetId: null,
        budgetName: null,
      },
    },
    {
      entity: "expenses",
      clientId: "client-2",
      serverId: 30,
      syncStatus: "synced",
      lastError: null,
      updatedAt: "2026-05-23T10:00:00.000Z",
      serverUpdatedAt: "2026-05-23T10:00:00.000Z",
      payload: {
        date: "2026-05-23",
        amount: 20000,
        note: "Coffee",
        category: "Food",
        paidBy: "Cubi",
        budgetId: null,
        budgetName: null,
      },
    },
  ]);
  const fetchSpy = vi.spyOn(globalThis, "fetch");

  const firstPage = await fetchExpenseList({ month: "2026-05", limit: 1 });
  const secondPage = await fetchExpenseList({
    month: "2026-05",
    limit: 1,
    offset: 1,
  });

  expect(fetchSpy).not.toHaveBeenCalled();
  expect(firstPage.rows.map((row) => row.note)).toEqual(["Lunch"]);
  expect(firstPage.pagination.hasMore).toBe(true);
  expect(secondPage.rows.map((row) => row.note)).toEqual(["Coffee"]);
  expect(secondPage.pagination.hasMore).toBe(false);
});
```

Remove or rewrite expense-list tests that specifically assert `/api/expenses` network fetches, server fallback, server seeding, or server overlay from `fetchExpenseList`. Keep non-expense read fetcher tests unchanged.

- [ ] **Step 2: Write coordinator cache refresh test for pulled data rendering from IndexedDB**

In `src/lib/sync/expenses/coordinator.test.ts`, add:

```ts
it("refreshes active expense list caches from IndexedDB after pulling server changes", async () => {
  const queryClient = new QueryClient();
  const { query, unsubscribe } = observeInfiniteExpenseList(queryClient);
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    jsonResponse(
      successEnvelope({
        cursor: "2026-05-24T10:00:00.000Z",
        changes: [
          {
            id: 22,
            clientId: "server-client",
            date: "2026-05-24",
            amount: 50000,
            note: "Pulled lunch",
            category: "Food",
            paidBy: "Cubi",
            budgetId: null,
            budgetName: null,
            updatedAt: "2026-05-24T10:00:00.000Z",
            deletedAt: null,
            isDeleted: false,
          },
        ],
      })
    )
  );

  await pullExpenseChanges(queryClient);

  expect(queryClient.getQueryData(query.queryKey)).toMatchObject({
    pages: [
      {
        rows: [
          expect.objectContaining({
            id: 22,
            note: "Pulled lunch",
          }),
        ],
      },
    ],
  });

  unsubscribe();
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
rtk bunx vitest run src/lib/queries/read-fetchers.test.ts src/lib/sync/expenses/coordinator.test.ts
```

Expected: FAIL because `fetchExpenseList` still calls `/api/expenses` for empty/insufficient local rows.

- [ ] **Step 4: Simplify `src/lib/queries/expenses.ts` to IndexedDB-only reads**

In `src/lib/queries/expenses.ts`:

1. Remove this import:

```ts
import { groupExpenseRowsByDate } from "@/lib/expenses/list-model";
```

2. Remove this import:

```ts
import { fetchJson } from "./http";
```

3. Remove these helpers because list reads no longer seed from `/api/expenses` or overlay server responses:

- `SERVER_FIRST_PAGE_AFTER_LOCAL_ONLY_OFFSET`
- `expenseListRowToSyncRecord`
- `seedLocalExpenseRows`
- `reserveLocalExpenseListId`
- `localExpenseToListItem`
- `localExpenseMatchesParams`
- `overlayDirtyLocalRows`
- `buildLocalExpenseListResult`
- `canServeExpenseListFromLocalRows`

4. Replace `fetchExpenseList` with:

```ts
export const fetchExpenseList = async (
  params: ExpenseListQueryParams = {}
): Promise<ExpenseListResult> => {
  if (!isBrowserIndexedDbAvailable()) {
    return buildExpenseListResultFromLocalRows([], params);
  }

  return buildExpenseListResultFromLocalRows(
    await getLocalExpenseRows(),
    params
  );
};
```

5. Keep `expenseQueries.list` unchanged so consumers still use the same query key and infinite query page params:

```ts
export const expenseQueries = createQueryKeys("expenses", {
  list: (params: ExpenseListQueryParams = {}) => ({
    queryKey: [
      {
        month: params.month ?? null,
        q: params.q ?? null,
        mode: params.mode ?? null,
        recentDays: params.recentDays ?? null,
        limit: params.limit ?? null,
      },
    ],
    queryFn: ({ pageParam }) =>
      fetchExpenseList({
        ...params,
        offset: typeof pageParam === "number" ? pageParam : params.offset,
      }),
  }),
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run:

```bash
rtk bunx vitest run src/lib/queries/read-fetchers.test.ts src/lib/sync/expenses/coordinator.test.ts
```

Expected: PASS.

- [ ] **Step 6: Format and lint Task 3 files**

Run:

```bash
rtk bunx prettier --write src/lib/queries/expenses.ts src/lib/queries/read-fetchers.test.ts src/lib/sync/expenses/coordinator.test.ts
rtk bunx prettier --check src/lib/queries/expenses.ts src/lib/queries/read-fetchers.test.ts src/lib/sync/expenses/coordinator.test.ts
rtk bunx eslint src/lib/queries/expenses.ts src/lib/queries/read-fetchers.test.ts src/lib/sync/expenses/coordinator.test.ts
```

Expected: Prettier check passes and ESLint exits 0.

- [ ] **Step 7: Commit**

Run:

```bash
rtk git status --short
rtk git add src/lib/queries/expenses.ts src/lib/queries/read-fetchers.test.ts src/lib/sync/expenses/coordinator.test.ts
rtk git commit -m "refactor: render expenses from local sync records"
```

Expected: commit succeeds and stages only Task 3 files.

---

### Task 4: Final Verification

**Files:**

- Verify files modified in Tasks 1-3.
- Do not edit implementation files unless a verification failure requires a focused fix.

- [ ] **Step 1: Verify no expense list fetcher calls `/api/expenses`**

Run:

```bash
rtk rg -n "fetchJson<ExpenseListResult>|/api/expenses\\$\\{|/api/expenses\\?" src/lib/queries/expenses.ts src/lib/queries/read-fetchers.test.ts
```

Expected: no matches in `src/lib/queries/expenses.ts`. Tests may mention the old URL only if asserting it is not called; prefer no stale URL assertions.

- [ ] **Step 2: Run focused sync and expense list tests**

Run:

```bash
rtk bunx vitest run src/lib/sync/expenses/scheduler.test.ts src/components/ExpenseSyncCoordinator.test.tsx src/lib/mutations/index.test.tsx src/lib/queries/read-fetchers.test.ts src/lib/sync/expenses/coordinator.test.ts src/components/ExpenseList.test.tsx src/lib/sync/expenses/actions.test.ts src/lib/sync/expenses/list.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run final format and lint checks**

Run:

```bash
rtk bunx prettier --write src/lib/sync/expenses/scheduler.ts src/lib/sync/expenses/scheduler.test.ts src/components/ExpenseSyncCoordinator.tsx src/components/ExpenseSyncCoordinator.test.tsx src/lib/mutations/index.ts src/lib/mutations/index.test.tsx src/lib/queries/expenses.ts src/lib/queries/read-fetchers.test.ts src/lib/sync/expenses/coordinator.test.ts
rtk bunx prettier --check src/lib/sync/expenses/scheduler.ts src/lib/sync/expenses/scheduler.test.ts src/components/ExpenseSyncCoordinator.tsx src/components/ExpenseSyncCoordinator.test.tsx src/lib/mutations/index.ts src/lib/mutations/index.test.tsx src/lib/queries/expenses.ts src/lib/queries/read-fetchers.test.ts src/lib/sync/expenses/coordinator.test.ts
rtk bunx eslint src/lib/sync/expenses/scheduler.ts src/lib/sync/expenses/scheduler.test.ts src/components/ExpenseSyncCoordinator.tsx src/components/ExpenseSyncCoordinator.test.tsx src/lib/mutations/index.ts src/lib/mutations/index.test.tsx src/lib/queries/expenses.ts src/lib/queries/read-fetchers.test.ts src/lib/sync/expenses/coordinator.test.ts
```

Expected: Prettier check passes and ESLint exits 0.

- [ ] **Step 4: Manual dev smoke check**

If a dev server is already running on port 3000, use it. Otherwise start one in a separate terminal with:

```bash
rtk bun run dev
```

In the app:

1. Open `/`.
2. Add a new expense.
3. Confirm the row appears immediately.
4. Confirm the Network panel does not show `GET /api/expenses` for list rendering.
5. Confirm the Network panel does show `POST /api/expenses/sync` soon after the local write.
6. Edit the expense and confirm only queued sync calls are made; no overlapping sync requests should be visible.
7. Delete the expense and confirm the row disappears locally before sync finishes.
8. Refresh the page and confirm the list is rebuilt from IndexedDB before/while sync runs.

- [ ] **Step 5: Report final status**

Run:

```bash
rtk git log --oneline -6
rtk git status --short
```

Expected: recent task commits are visible. Worktree is clean or only unrelated pre-existing changes remain.
