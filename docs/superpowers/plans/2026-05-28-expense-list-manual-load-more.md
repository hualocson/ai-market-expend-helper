# Expense List Manual Load More Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the home expense list's automatic `IntersectionObserver` pagination with an explicit `Load more` button on mobile and desktop.

**Architecture:** Keep the existing TanStack `useInfiniteQuery` data model, query key, sync cursor gate, row dedupe, and day grouping. Remove only the observer/sentinel ownership from `ExpenseList`; all next-page fetches should be caused by visible button clicks. Sync hydration remains unchanged and may refresh already loaded pages, but it must not append pages.

**Tech Stack:** Next.js 15 App Router, React 19, TanStack Query infinite queries, fake IndexedDB tests, Vitest, Testing Library, Tailwind v4.

---

## File Structure

- Modify: `src/components/ExpenseList.test.tsx`
  - Replace observer-driven pagination tests with manual button tests.
  - Keep existing mocks and IndexedDB-backed query behavior.

- Modify: `src/components/ExpenseList.tsx`
  - Remove `useRef` import and observer refs.
  - Remove the `IntersectionObserver` effect.
  - Render a visible `Load more` button whenever pagination is available and not gated/loading/erroring.

- No changes:
  - `src/lib/queries/expenses.ts`
  - `src/lib/sync/expenses/coordinator.ts`
  - `src/components/ExpenseSyncCoordinator.tsx`

## Task 1: Write Manual Pagination Tests

**Files:**
- Modify: `src/components/ExpenseList.test.tsx:1`
- Modify: `src/components/ExpenseList.test.tsx:266-431`

- [ ] **Step 1: Update test imports**

Replace the Testing Library import at the top of `src/components/ExpenseList.test.tsx`:

```ts
import { render, screen, waitFor } from "@testing-library/react";
```

with:

```ts
import { act, render, screen, waitFor } from "@testing-library/react";
```

- [ ] **Step 2: Replace the existing observer pagination tests**

Replace the two tests starting at `it("gates load more while the initial expense sync cursor is missing"...` through the end of `it("fetches the next page when the bottom sentinel intersects"...` with these four tests:

```tsx
  it("gates manual load more while the initial expense sync cursor is missing", async () => {
    globalThis.React = React;
    await syncRepository.testing.clearSyncDb();

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

    render(
      <QueryClientProvider client={queryClient}>
        <ExpenseList />
      </QueryClientProvider>
    );

    expect(
      await screen.findByText("Syncing all expenses before loading more.")
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Load more" })
    ).not.toBeInTheDocument();

    const cachedData = queryClient.getQueryData<
      InfiniteData<ExpenseListResult, number>
    >(queries.expenses.list(params).queryKey);
    expect(cachedData?.pages).toHaveLength(1);

    await syncRepository.testing.clearSyncDb();
  });

  it("fetches exactly one next page when Load more is clicked", async () => {
    globalThis.React = React;
    await syncRepository.testing.clearSyncDb();
    await syncRepository.metadata.setCursor(
      "expenses",
      "2026-05-24T10:00:00.000Z"
    );
    await syncRepository.records.putMany(
      Array.from({ length: 61 }, (_, index) => ({
        entity: "expenses",
        clientId: `client-${index}`,
        serverId: 100 + index,
        syncStatus: "synced",
        lastError: null,
        updatedAt: "2026-05-24T10:00:00.000Z",
        serverUpdatedAt: "2026-05-24T10:00:00.000Z",
        payload: {
          date: "2026-05-24",
          amount: 50000 + index,
          note: `Local expense ${index}`,
          category: "Food",
          paidBy: "Cubi",
          budgetId: null,
          budgetName: null,
          budgetIcon: null,
          budgetColor: null,
        },
      }))
    );

    const user = userEvent.setup();
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
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    render(
      <QueryClientProvider client={queryClient}>
        <ExpenseList />
      </QueryClientProvider>
    );

    const loadMoreButton = await screen.findByRole("button", {
      name: "Load more",
    });
    expect(
      queryClient.getQueryData<InfiniteData<ExpenseListResult, number>>(
        queries.expenses.list(params).queryKey
      )?.pages
    ).toHaveLength(1);

    await user.click(loadMoreButton);

    await waitFor(() => {
      const cachedData = queryClient.getQueryData<
        InfiniteData<ExpenseListResult, number>
      >(queries.expenses.list(params).queryKey);

      expect(cachedData?.pages).toHaveLength(2);
      expect(cachedData?.pages[1]?.pagination).toMatchObject({
        limit: 30,
        offset: 30,
        hasMore: true,
      });
      expect(cachedData?.pages[1]?.rows).toHaveLength(30);
      expect(cachedData?.pages[1]?.rows[0]).toEqual(
        expect.objectContaining({
          id: 130,
          note: "Local expense 30",
        })
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(
      queryClient.getQueryData<InfiniteData<ExpenseListResult, number>>(
        queries.expenses.list(params).queryKey
      )?.pages
    ).toHaveLength(2);
    expect(fetchSpy).not.toHaveBeenCalled();

    await syncRepository.testing.clearSyncDb();
  });

  it("does not create an IntersectionObserver for manual load more", async () => {
    globalThis.React = React;
    await syncRepository.testing.clearSyncDb();
    await syncRepository.metadata.setCursor(
      "expenses",
      "2026-05-24T10:00:00.000Z"
    );

    const observe = vi.fn();
    const originalIntersectionObserver = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = vi.fn(() => ({
      observe,
      unobserve: vi.fn(),
      disconnect: vi.fn(),
      root: null,
      rootMargin: "",
      thresholds: [],
      takeRecords: () => [],
    })) as unknown as typeof IntersectionObserver;

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
        await screen.findByRole("button", { name: "Load more" })
      ).toBeInTheDocument();
      expect(globalThis.IntersectionObserver).not.toHaveBeenCalled();
      expect(observe).not.toHaveBeenCalled();
    } finally {
      globalThis.IntersectionObserver = originalIntersectionObserver;
      await syncRepository.testing.clearSyncDb();
    }
  });

  it("retries next-page loading only after Retry loading more is clicked", async () => {
    globalThis.React = React;
    await syncRepository.testing.clearSyncDb();
    await syncRepository.metadata.setCursor(
      "expenses",
      "2026-05-24T10:00:00.000Z"
    );
    await syncRepository.records.putMany(
      Array.from({ length: 31 }, (_, index) => ({
        entity: "expenses",
        clientId: `retry-client-${index}`,
        serverId: 200 + index,
        syncStatus: "synced",
        lastError: null,
        updatedAt: "2026-05-24T10:00:00.000Z",
        serverUpdatedAt: "2026-05-24T10:00:00.000Z",
        payload: {
          date: "2026-05-24",
          amount: 60000 + index,
          note: `Retry expense ${index}`,
          category: "Food",
          paidBy: "Cubi",
          budgetId: null,
          budgetName: null,
          budgetIcon: null,
          budgetColor: null,
        },
      }))
    );

    const user = userEvent.setup();
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
    const recordsListSpy = vi
      .spyOn(syncRepository.records, "list")
      .mockRejectedValueOnce(new Error("IndexedDB unavailable"));

    render(
      <QueryClientProvider client={queryClient}>
        <ExpenseList />
      </QueryClientProvider>
    );

    await user.click(
      await screen.findByRole("button", { name: "Load more" })
    );

    expect(
      await screen.findByRole("button", { name: "Retry loading more" })
    ).toBeInTheDocument();
    expect(
      queryClient.getQueryData<InfiniteData<ExpenseListResult, number>>(
        queries.expenses.list(params).queryKey
      )?.pages
    ).toHaveLength(1);

    recordsListSpy.mockRestore();
    await user.click(screen.getByRole("button", { name: "Retry loading more" }));

    await waitFor(() => {
      const cachedData = queryClient.getQueryData<
        InfiniteData<ExpenseListResult, number>
      >(queries.expenses.list(params).queryKey);

      expect(cachedData?.pages).toHaveLength(2);
      expect(cachedData?.pages[1]?.pagination).toMatchObject({
        limit: 30,
        offset: 30,
        hasMore: false,
      });
      expect(cachedData?.pages[1]?.rows).toEqual([
        expect.objectContaining({
          id: 200,
          note: "Retry expense 0",
        }),
      ]);
    });

    await syncRepository.testing.clearSyncDb();
  });
```

- [ ] **Step 3: Run the focused test file and verify failures**

Run:

```bash
rtk bunx vitest run src/components/ExpenseList.test.tsx
```

Expected: fail because `Load more` is not rendered and the current implementation still creates an `IntersectionObserver`.

- [ ] **Step 4: Commit the failing tests**

Run:

```bash
rtk git add src/components/ExpenseList.test.tsx
rtk git commit -m "test: cover manual expense list pagination"
```

Expected: commit succeeds with only `src/components/ExpenseList.test.tsx` staged.

## Task 2: Implement Manual Load More

**Files:**
- Modify: `src/components/ExpenseList.tsx:3`
- Modify: `src/components/ExpenseList.tsx:93-94`
- Modify: `src/components/ExpenseList.tsx:153-173`
- Modify: `src/components/ExpenseList.tsx:205-209`
- Modify: `src/components/ExpenseList.tsx:252-276`

- [ ] **Step 1: Remove unused refs from the React import**

In `src/components/ExpenseList.tsx`, replace:

```ts
import { useCallback, useEffect, useRef, useState } from "react";
```

with:

```ts
import { useCallback, useEffect, useState } from "react";
```

- [ ] **Step 2: Remove observer refs**

Delete these lines from `ExpenseList`:

```ts
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const listContainerRef = useRef<HTMLDivElement | null>(null);
```

- [ ] **Step 3: Remove the IntersectionObserver effect**

Delete this entire effect:

```ts
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

- [ ] **Step 4: Remove the list container ref from JSX**

Replace:

```tsx
      <div
        id="expense-list"
        ref={listContainerRef}
        className={listContainerClassName}
      >
```

with:

```tsx
      <div id="expense-list" className={listContainerClassName}>
```

- [ ] **Step 5: Render a visible manual Load more button**

Replace the footer block:

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

with:

```tsx
        {hasNextPage || isFetchingNextPage || isFetchNextPageError ? (
          <div className="flex justify-center py-3">
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
              <button
                type="button"
                onClick={() => void fetchNextPage()}
                className="text-primary text-sm font-medium underline-offset-4 hover:underline"
              >
                Load more
              </button>
            )}
          </div>
        ) : null}
```

- [ ] **Step 6: Run tests and verify they pass**

Run:

```bash
rtk bunx vitest run src/components/ExpenseList.test.tsx
```

Expected: all tests in `src/components/ExpenseList.test.tsx` pass.

- [ ] **Step 7: Commit implementation**

Run:

```bash
rtk git add src/components/ExpenseList.tsx
rtk git commit -m "fix: require manual expense list pagination"
```

Expected: commit succeeds with only `src/components/ExpenseList.tsx` staged.

## Task 3: Targeted Verification And Formatting

**Files:**
- Check: `src/components/ExpenseList.tsx`
- Check: `src/components/ExpenseList.test.tsx`
- Check: `src/components/ExpenseSyncCoordinator.test.tsx`

- [ ] **Step 1: Format modified TypeScript files**

Run:

```bash
rtk bunx prettier --write src/components/ExpenseList.tsx src/components/ExpenseList.test.tsx
```

Expected: Prettier completes successfully.

- [ ] **Step 2: Check formatting**

Run:

```bash
rtk bunx prettier --check src/components/ExpenseList.tsx src/components/ExpenseList.test.tsx
```

Expected: output includes `All matched files use Prettier code style!`.

- [ ] **Step 3: Run ESLint for modified scope**

Run:

```bash
rtk bunx eslint src/components/ExpenseList.tsx src/components/ExpenseList.test.tsx
```

Expected: command exits successfully with no errors.

- [ ] **Step 4: Run pagination and sync regression tests**

Run:

```bash
rtk bunx vitest run src/components/ExpenseList.test.tsx src/components/ExpenseSyncCoordinator.test.tsx
```

Expected: both test files pass.

- [ ] **Step 5: Inspect final diff**

Run:

```bash
rtk git diff -- src/components/ExpenseList.tsx src/components/ExpenseList.test.tsx
```

Expected:
- `ExpenseList.tsx` no longer imports `useRef`.
- `ExpenseList.tsx` contains no `IntersectionObserver`, `loadMoreRef`, or `listContainerRef`.
- `ExpenseList.tsx` renders a visible `Load more` button.
- `ExpenseList.test.tsx` tests manual click pagination, retry pagination, and no sentinel intersection.

- [ ] **Step 6: Commit formatting/test adjustments if any files changed**

Run:

```bash
rtk git status --short
```

If `src/components/ExpenseList.tsx` or `src/components/ExpenseList.test.tsx` changed after formatting, run:

```bash
rtk git add src/components/ExpenseList.tsx src/components/ExpenseList.test.tsx
rtk git commit -m "chore: format manual expense pagination"
```

Expected: commit succeeds only if formatting changed tracked files. If no modified tracked files remain, skip this commit.

## Manual QA

- [ ] **Step 1: Start the dev server**

Run:

```bash
rtk bun run dev
```

Expected: Next.js starts and prints a local URL, usually `http://localhost:3000`.

- [ ] **Step 2: Verify iPhone-sized behavior**

Open the home page in an iPhone 13/14-sized viewport. Wait for sync/network idle. Expected: the list remains near the first page size, and the footer shows `Load more` if additional local rows exist.

- [ ] **Step 3: Verify one page per user action**

Click or tap `Load more` once. Expected: one additional page appends. The list does not keep appending pages without additional clicks.

- [ ] **Step 4: Stop the dev server**

Use `Ctrl-C` in the terminal running `rtk bun run dev`.
