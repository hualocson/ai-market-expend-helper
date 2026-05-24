# Expense Sync Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable local-first sync engine with an Expense V1 adapter where IndexedDB is durable storage, Zustand is the reactive in-memory store, and REST sync reconciles Expense changes in the background.

**Architecture:** Shared sync records are identified by `entity + clientId` and mapped to server rows with `serverId`; V1 registers only `entity: "expenses"`. Browser reads hydrate generic IndexedDB records into an Expense Zustand store, then bridge into existing TanStack Query expense caches so current screens keep working. Mutations write local state and a generic IndexedDB outbox operation first, then the Expense coordinator flushes to `/api/expenses/sync` and reconciles canonical server rows through reusable core helpers.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Drizzle, PostgreSQL, TanStack Query, Zustand, native IndexedDB, Vitest, fake-indexeddb for tests only.

---

## File Structure

- Create `src/lib/sync/core/types.ts` for shared entity, record, outbox, metadata, and reconciliation types.
- Create `src/lib/sync/core/idb.ts` for the native IndexedDB wrapper with shared stores `syncRecords`, `syncOutbox`, and `syncMetadata`.
- Create `src/lib/sync/core/repository.ts` for durable generic record, outbox, and entity metadata operations.
- Create `src/lib/sync/core/store-factory.ts` for reusable Zustand object-pool store creation and selector helpers.
- Create `src/lib/sync/expenses/types.ts` for Expense payload, local row, sync request, and sync response adapter types.
- Create `src/lib/sync/expenses/list.ts` for Expense-specific local filtering, sorting, pagination, and grouping into `ExpenseListResult`.
- Create `src/lib/sync/expenses/store.ts` for the Expense Zustand store created from the core store factory.
- Create `src/lib/sync/expenses/actions.ts` for Expense local-first create/update/delete operations using the core repository.
- Create `src/lib/sync/expenses/coordinator.ts` for Expense pull, flush, reconcile, and query invalidation helpers using the core outbox.
- Create `src/components/ExpenseSyncCoordinator.tsx` and mount it in `src/app/layout.tsx`.
- Create `src/app/api/expenses/sync/route.ts` and `src/lib/services/expense-sync.ts` for the REST sync contract.
- Modify `src/db/schema.ts`, `src/db/queries.ts`, `src/lib/api/route-schemas.ts`, `src/lib/queries/expenses.ts`, `src/lib/mutations/index.ts`, `src/components/QuickExpenseMutationCoordinator.tsx`, `src/stores/quick-expense-recovery-store.ts`, and existing tests in the same folders.

The shared core must not import from `src/lib/sync/expenses/*`. Expense modules may import from `src/lib/sync/core/*`.

## Task 1: Add Server Identity and Idempotent Create

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/db/queries.ts`
- Modify: `src/db/type.d.ts`
- Modify: `src/lib/api/route-schemas.ts`
- Modify: `src/app/api/expenses/route.ts`
- Modify: `src/app/api/mutation-routes.test.ts`
- Generate: `migrations/0007_expense_client_id.sql`

- [ ] **Step 1: Write failing route and service tests**

Add tests to `src/app/api/mutation-routes.test.ts`:

```ts
it("passes expense clientId through create payloads", async () => {
  const payload = {
    clientId: "expense-client-1",
    date: "23/05/2026",
    note: "Coffee",
    amount: 45000,
    category: "Food",
    paidBy: "Cubi",
    budgetId: null,
  };
  const created = { id: 1, ...payload };
  mocks.createExpense.mockResolvedValue(created);

  const response = await postExpense(
    jsonRequest("http://localhost/api/expenses", payload)
  );

  expect(response.status).toBe(201);
  await expect(response.json()).resolves.toEqual(created);
  expect(mocks.createExpense).toHaveBeenCalledWith(payload);
});
```

Run: `rtk bunx vitest run src/app/api/mutation-routes.test.ts -t "clientId"`

Expected: FAIL because `clientId` is not part of the schema/service type yet.

- [ ] **Step 2: Add `clientId` to schema and input types**

Update `src/db/schema.ts`:

```ts
clientId: text("client_id"),
```

Add this inside the `expenses` table definition near `id`, then add an index in the table callback:

```ts
index("expenses_client_id_unique_idx")
  .on(t.clientId)
  .where(sql`${t.clientId} is not null`),
```

Update `src/db/type.d.ts`:

```ts
export type CreateExpenseInput = Omit<TExpense, "clientId"> & {
  clientId?: string | null;
  paidBy: PaidBy;
  budgetId?: number | null;
};
```

- [ ] **Step 3: Accept `clientId` in route validation**

Update `expenseMutationPayloadSchema` in `src/lib/api/route-schemas.ts`:

```ts
clientId: z.string().min(1).nullable().optional(),
```

- [ ] **Step 4: Make create idempotent by `clientId`**

Update `createExpense` in `src/db/queries.ts` so it uses `clientId` when provided:

```ts
const values = {
  clientId: input.clientId ?? null,
  date: parsedDate.toDate().toDateString(),
  amount: input.amount,
  note: input.note?.trim() || "",
  category: input.category,
  paidBy: input.paidBy,
};

const [created] = input.clientId
  ? await db
      .insert(expenses)
      .values(values)
      .onConflictDoUpdate({
        target: expenses.clientId,
        set: values,
      })
      .returning()
  : await db.insert(expenses).values(values).returning();
```

Keep the existing `setExpenseBudget` call after the returned row exists.

- [ ] **Step 5: Generate and inspect migration**

Run: `rtk bun run db:generate`

Expected: a migration adds nullable `client_id` and a partial unique index on non-null values.

- [ ] **Step 6: Verify focused tests**

Run:

```bash
rtk bunx vitest run src/app/api/mutation-routes.test.ts
rtk bunx prettier --write src/db/schema.ts src/db/queries.ts src/db/type.d.ts src/lib/api/route-schemas.ts src/app/api/expenses/route.ts src/app/api/mutation-routes.test.ts
rtk bunx prettier --check src/db/schema.ts src/db/queries.ts src/db/type.d.ts src/lib/api/route-schemas.ts src/app/api/expenses/route.ts src/app/api/mutation-routes.test.ts
rtk bunx eslint src/db/schema.ts src/db/queries.ts src/lib/api/route-schemas.ts src/app/api/expenses/route.ts src/app/api/mutation-routes.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
rtk git add src/db/schema.ts src/db/queries.ts src/db/type.d.ts src/lib/api/route-schemas.ts src/app/api/expenses/route.ts src/app/api/mutation-routes.test.ts migrations
rtk git commit -m "feat: add expense client identity"
```

## Task 2: Add Expense Sync REST Contract

**Files:**
- Create: `src/lib/services/expense-sync.ts`
- Create: `src/app/api/expenses/sync/route.ts`
- Modify: `src/app/api/read-routes.test.ts`
- Modify: `src/app/api/mutation-routes.test.ts`

- [ ] **Step 1: Write failing sync route tests**

Add mocks and route imports:

```ts
import {
  GET as getExpenseSync,
  POST as postExpenseSync,
} from "./expenses/sync/route";
```

Add service mocks:

```ts
getExpenseChangesSince: vi.fn(),
pushExpenseOperations: vi.fn(),
```

Add tests:

```ts
it("pulls expense sync changes from a cursor", async () => {
  const payload = {
    cursor: "2026-05-24T10:00:00.000Z",
    changes: [],
  };
  mocks.getExpenseChangesSince.mockResolvedValue(payload);

  const response = await getExpenseSync(
    new Request("http://localhost/api/expenses/sync?cursor=2026-05-24T09:00:00.000Z")
  );

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual(payload);
  expect(mocks.getExpenseChangesSince).toHaveBeenCalledWith(
    "2026-05-24T09:00:00.000Z"
  );
});

it("pushes queued expense sync operations", async () => {
  const operations = [
    {
      operationId: "op-1",
      type: "create",
      clientId: "client-1",
      serverId: null,
      payload: {
        clientId: "client-1",
        serverId: null,
        date: "23/05/2026",
        amount: 45000,
        note: "Coffee",
        category: "Food",
        paidBy: "Cubi",
        budgetId: null,
        budgetName: null,
        syncStatus: "pending",
        lastError: null,
        updatedAt: "2026-05-24T09:00:00.000Z",
        serverUpdatedAt: null,
      },
    },
  ];
  const payload = { results: [] };
  mocks.pushExpenseOperations.mockResolvedValue(payload);

  const response = await postExpenseSync(
    jsonRequest("http://localhost/api/expenses/sync", { operations })
  );

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual(payload);
  expect(mocks.pushExpenseOperations).toHaveBeenCalledWith(operations);
});
```

Run: `rtk bunx vitest run src/app/api/read-routes.test.ts src/app/api/mutation-routes.test.ts -t "expense sync|queued expense"`

Expected: FAIL because the route and service do not exist.

- [ ] **Step 2: Add service types and pull implementation**

Create `src/lib/services/expense-sync.ts`:

```ts
import { db } from "@/db";
import { budgets, expenseBudgets, expenses } from "@/db/schema";
import { eq, gt, or } from "drizzle-orm";

export type ExpenseSyncCursor = string | null;

export type ExpenseSyncServerRow = {
  id: number;
  clientId: string | null;
  date: string;
  amount: number;
  note: string;
  category: string;
  paidBy: string;
  budgetId: number | null;
  budgetName: string | null;
  updatedAt: string;
  deletedAt: string | null;
  isDeleted: boolean;
};

export type ExpenseSyncPullResult = {
  cursor: string;
  changes: ExpenseSyncServerRow[];
};

export const getExpenseChangesSince = async (
  cursor: ExpenseSyncCursor
): Promise<ExpenseSyncPullResult> => {
  const cursorDate = cursor ? new Date(cursor) : null;
  const whereClause = cursorDate
    ? or(gt(expenses.updatedAt, cursorDate), gt(expenses.deletedAt, cursorDate))
    : undefined;
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
      updatedAt: expenses.updatedAt,
      deletedAt: expenses.deletedAt,
      isDeleted: expenses.isDeleted,
    })
    .from(expenses)
    .leftJoin(expenseBudgets, eq(expenseBudgets.expenseId, expenses.id))
    .leftJoin(budgets, eq(budgets.id, expenseBudgets.budgetId))
    .where(whereClause);
  const now = new Date().toISOString();

  return {
    cursor: now,
    changes: rows.map((row) => ({
      id: row.id,
      clientId: row.clientId,
      date: String(row.date),
      amount: Number(row.amount),
      note: row.note ?? "",
      category: row.category,
      paidBy: row.paidBy,
      budgetId: row.budgetId === null ? null : Number(row.budgetId),
      budgetName: row.budgetName ?? null,
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
      isDeleted: row.isDeleted,
    })),
  };
};
```

- [ ] **Step 3: Add push operation contract**

Add to `src/lib/services/expense-sync.ts`:

```ts
export type ExpenseSyncPushOperation = {
  operationId: string;
  type: "create" | "update" | "delete";
  clientId: string;
  serverId: number | null;
  payload: {
    date: string;
    amount: number;
    note: string;
    category: string;
    paidBy: string;
    budgetId: number | null;
    clientId: string;
  } | null;
};

export type ExpenseSyncPushResult = {
  results: Array<
    | {
        operationId: string;
        ok: true;
        row: ExpenseSyncServerRow;
      }
    | {
        operationId: string;
        ok: false;
        error: string;
      }
  >;
};
```

Implement `pushExpenseOperations(operations)` by calling existing `createExpense`, `updateExpense`, and `softDeleteExpense`. For update/delete, require `serverId`; return `{ ok: false, error: "Missing server id" }` when absent.

- [ ] **Step 4: Add route validation and handlers**

Create `src/app/api/expenses/sync/route.ts`:

```ts
import { NextResponse } from "next/server";

import {
  getExpenseChangesSince,
  pushExpenseOperations,
} from "@/lib/services/expense-sync";
import { z } from "zod";

const localExpensePayloadSchema = z.object({
  clientId: z.string().min(1),
  serverId: z.number().int().positive().nullable(),
  date: z.string().min(1),
  amount: z.number().finite(),
  note: z.string().optional().default(""),
  category: z.string().min(1),
  paidBy: z.string().min(1),
  budgetId: z.number().int().positive().nullable(),
  budgetName: z.string().nullable(),
  syncStatus: z.enum(["synced", "pending", "failed", "deleted"]),
  lastError: z.string().nullable(),
  updatedAt: z.string().min(1),
  serverUpdatedAt: z.string().nullable(),
});

const expenseSyncOperationSchema = z.object({
  operationId: z.string().min(1),
  type: z.enum(["create", "update", "delete"]),
  clientId: z.string().min(1),
  serverId: z.number().int().positive().nullable(),
  payload: localExpensePayloadSchema.nullable(),
});

const expenseSyncPushSchema = z.object({
  operations: z.array(expenseSyncOperationSchema),
});

export const GET = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");

  try {
    return NextResponse.json(await getExpenseChangesSince(cursor));
  } catch (error) {
    console.error("Failed to pull expense sync changes:", error);
    return NextResponse.json(
      { error: "Failed to sync expenses" },
      { status: 400 }
    );
  }
};

export const POST = async (request: Request) => {
  try {
    const payload = expenseSyncPushSchema.safeParse(await request.json());
    if (!payload.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    return NextResponse.json(
      await pushExpenseOperations(payload.data.operations)
    );
  } catch (error) {
    console.error("Failed to push expense sync operations:", error);
    return NextResponse.json(
      { error: "Failed to sync expenses" },
      { status: 400 }
    );
  }
};
```

Tighten validation with Zod in this route before finalizing the task.

- [ ] **Step 5: Verify focused tests**

Run:

```bash
rtk bunx vitest run src/app/api/read-routes.test.ts src/app/api/mutation-routes.test.ts
rtk bunx prettier --write src/lib/services/expense-sync.ts src/app/api/expenses/sync/route.ts src/app/api/read-routes.test.ts src/app/api/mutation-routes.test.ts
rtk bunx prettier --check src/lib/services/expense-sync.ts src/app/api/expenses/sync/route.ts src/app/api/read-routes.test.ts src/app/api/mutation-routes.test.ts
rtk bunx eslint src/lib/services/expense-sync.ts src/app/api/expenses/sync/route.ts src/app/api/read-routes.test.ts src/app/api/mutation-routes.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
rtk git add src/lib/services/expense-sync.ts src/app/api/expenses/sync/route.ts src/app/api/read-routes.test.ts src/app/api/mutation-routes.test.ts
rtk git commit -m "feat: add expense sync api"
```

## Task 3: Add Reusable IndexedDB Sync Core

**Files:**
- Modify: `package.json`
- Modify: `bun.lock`
- Create: `src/lib/sync/core/types.ts`
- Create: `src/lib/sync/core/idb.ts`
- Create: `src/lib/sync/core/repository.ts`
- Create: `src/lib/sync/core/repository.test.ts`

- [ ] **Step 1: Add IndexedDB test dependency**

Run: `rtk bun add -D fake-indexeddb`

Expected: `package.json` and `bun.lock` update with `fake-indexeddb`.

- [ ] **Step 2: Write failing repository tests**

Create `src/lib/sync/core/repository.test.ts`:

```ts
import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import {
  clearSyncDb,
  getSyncCursor,
  listQueuedSyncOperations,
  listSyncRecords,
  putSyncOperation,
  putSyncRecord,
  setSyncCursor,
} from "./repository";
import type { SyncRecord } from "./types";

const buildExpense = (overrides: Partial<SyncRecord> = {}): SyncRecord => ({
  entity: "expenses",
  clientId: "client-1",
  serverId: null,
  syncStatus: "pending",
  lastError: null,
  updatedAt: "2026-05-24T09:00:00.000Z",
  serverUpdatedAt: null,
  payload: {
    date: "2026-05-23",
    amount: 45000,
    note: "Coffee",
    category: "Food",
    paidBy: "Cubi",
    budgetId: null,
    budgetName: null,
  },
  ...overrides,
});

beforeEach(async () => {
  await clearSyncDb();
});

describe("sync core IndexedDB repository", () => {
  it("persists and lists records by entity", async () => {
    await putSyncRecord(buildExpense());

    await expect(listSyncRecords("expenses")).resolves.toEqual([buildExpense()]);
  });

  it("persists outbox operations in creation order", async () => {
    await putSyncOperation({
      operationId: "op-1",
      entity: "expenses",
      type: "create",
      clientId: "client-1",
      serverId: null,
      payload: buildExpense(),
      createdAt: "2026-05-24T09:00:00.000Z",
      attemptCount: 0,
      lastAttemptAt: null,
      lastError: null,
    });

    await expect(listQueuedSyncOperations("expenses")).resolves.toMatchObject([
      { operationId: "op-1", entity: "expenses", type: "create" },
    ]);
  });

  it("stores the sync cursor", async () => {
    await setSyncCursor("expenses", "2026-05-24T10:00:00.000Z");

    await expect(getSyncCursor("expenses")).resolves.toBe(
      "2026-05-24T10:00:00.000Z"
    );
  });
});
```

Run: `rtk bunx vitest run src/lib/sync/core/repository.test.ts`

Expected: FAIL because repository modules do not exist.

- [ ] **Step 3: Add sync core types**

Create `src/lib/sync/core/types.ts`:

```ts
export type SyncEntityName = "expenses";

export type SyncStatus = "synced" | "pending" | "failed" | "deleted";

export type SyncRecord<TPayload = unknown> = {
  entity: SyncEntityName;
  clientId: string;
  serverId: number | null;
  syncStatus: SyncStatus;
  lastError: string | null;
  updatedAt: string;
  serverUpdatedAt: string | null;
  payload: TPayload;
};

export type SyncOperation<TPayload = unknown> = {
  operationId: string;
  entity: SyncEntityName;
  type: "create" | "update" | "delete";
  clientId: string;
  serverId: number | null;
  payload: TPayload | null;
  createdAt: string;
  attemptCount: number;
  lastAttemptAt: string | null;
  lastError: string | null;
};
```

- [ ] **Step 4: Add native IndexedDB open helper**

Create `src/lib/sync/core/idb.ts` with stores `syncRecords`, `syncOutbox`, and `syncMetadata`. Use database name `app-sync-v1`, version `1`, compound logical keys `${entity}:${clientId}` for records, keyPath `operationId` for outbox, and keyPath `key` for metadata.

- [ ] **Step 5: Add repository functions**

Create `src/lib/sync/core/repository.ts` exporting:

```ts
clearSyncDb()
getSyncCursor(entity)
setSyncCursor(entity, cursor)
listSyncRecords(entity)
putSyncRecord(record)
putSyncRecords(records)
deleteSyncRecord(entity, clientId)
putSyncOperation(operation)
listQueuedSyncOperations(entity)
deleteSyncOperation(operationId)
markSyncOperationFailed(operationId, error)
markSyncOperationAttempted(operationId, attemptedAt)
```

All functions should return promises and use one transaction per logical write.

- [ ] **Step 6: Verify repository**

Run:

```bash
rtk bunx vitest run src/lib/sync/core/repository.test.ts
rtk bunx prettier --write package.json src/lib/sync/core/types.ts src/lib/sync/core/idb.ts src/lib/sync/core/repository.ts src/lib/sync/core/repository.test.ts
rtk bunx prettier --check package.json src/lib/sync/core/types.ts src/lib/sync/core/idb.ts src/lib/sync/core/repository.ts src/lib/sync/core/repository.test.ts
rtk bunx eslint src/lib/sync/core/types.ts src/lib/sync/core/idb.ts src/lib/sync/core/repository.ts src/lib/sync/core/repository.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
rtk git add package.json bun.lock src/lib/sync/core
rtk git commit -m "feat: add reusable sync repository"
```

## Task 4: Add Local Expense List Builder

**Files:**
- Create: `src/lib/sync/expenses/types.ts`
- Create: `src/lib/sync/expenses/list.ts`
- Create: `src/lib/sync/expenses/list.test.ts`

- [ ] **Step 1: Write failing list tests**

Create `src/lib/sync/expenses/list.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { buildExpenseListResultFromLocalRows } from "./list";
import type { LocalExpense } from "./types";

const row = (overrides: Partial<LocalExpense>): LocalExpense => ({
  clientId: "client-1",
  serverId: 1,
  date: "2026-05-23",
  amount: 45000,
  note: "Coffee",
  category: "Food",
  paidBy: "Cubi",
  budgetId: null,
  budgetName: null,
  syncStatus: "synced",
  lastError: null,
  updatedAt: "2026-05-24T09:00:00.000Z",
  serverUpdatedAt: "2026-05-24T09:00:00.000Z",
  ...overrides,
});

describe("local expense list builder", () => {
  it("filters by month and hides deleted rows", () => {
    const result = buildExpenseListResultFromLocalRows(
      [
        row({ clientId: "a", date: "2026-05-23" }),
        row({ clientId: "b", date: "2026-04-23" }),
        row({ clientId: "c", syncStatus: "deleted" }),
      ],
      { month: "2026-05", limit: 30 }
    );

    expect(result.rows.map((expense) => expense.note)).toEqual(["Coffee"]);
    expect(result.groupedRows).toHaveLength(1);
  });

  it("matches accent-insensitive search", () => {
    const result = buildExpenseListResultFromLocalRows(
      [row({ note: "Cà phê" })],
      { q: "ca phe", limit: 30 }
    );

    expect(result.rows).toHaveLength(1);
  });
});
```

Run: `rtk bunx vitest run src/lib/sync/expenses/list.test.ts`

Expected: FAIL because `list.ts` does not exist.

- [ ] **Step 2: Implement local list builder**

Create `src/lib/sync/expenses/types.ts`:

```ts
import type { SyncOperation, SyncRecord } from "@/lib/sync/core/types";

export type ExpensePayload = {
  date: string;
  amount: number;
  note: string;
  category: string;
  paidBy: string;
  budgetId: number | null;
  budgetName: string | null;
};

export type LocalExpense = Omit<SyncRecord<ExpensePayload>, "entity" | "payload"> & {
  entity: "expenses";
} & ExpensePayload;

export type ExpenseOutboxOperation = SyncOperation<LocalExpense> & {
  entity: "expenses";
};

export const EXPENSE_SYNC_ENTITY = "expenses" as const;
```

The adapter should flatten `payload` fields onto `LocalExpense` for UI ergonomics, but conversion helpers must map to and from the core `SyncRecord<ExpensePayload>` shape before IndexedDB writes.

Create `src/lib/sync/expenses/list.ts` with:

```ts
export const buildExpenseListResultFromLocalRows = (
  rows: LocalExpense[],
  params: ExpenseListQueryParams = {}
): ExpenseListResult => {
  const { activeMonth, effectiveRecentDays, isRecent, rangeEnd, rangeStart } =
    resolveExpenseListRange(params);
  const trimmedSearch = params.q?.trim();
  const pageLimit = Math.max(1, Math.floor(params.limit ?? 30));
  const pageOffset = Math.max(0, Math.floor(params.offset ?? 0));
  const filteredRows = rows
    .filter((row) => row.syncStatus !== "deleted")
    .filter((row) => {
      const date = dayjs(row.date, "YYYY-MM-DD", true);
      const inRange =
        !params.month && !isRecent
          ? true
          : date.isValid() &&
            !date.isBefore(rangeStart, "day") &&
            date.isBefore(rangeEnd, "day");
      return inRange && matchesLocalExpenseSearch(row, trimmedSearch ?? "");
    })
    .sort(sortLocalExpenses)
    .map(localExpenseToListItem);
  const pageRows = filteredRows.slice(pageOffset, pageOffset + pageLimit);

  return {
    activeMonth: activeMonth.format("YYYY-MM"),
    effectiveRecentDays,
    groupedRows: groupExpenseRowsByDate(pageRows),
    isRecent,
    pagination: {
      limit: pageLimit,
      offset: pageOffset,
      hasMore: filteredRows.length > pageOffset + pageLimit,
    },
    rows: pageRows,
    trimmedSearch,
  };
};
```

Use the existing behavior from `src/lib/services/expenses.ts` and `src/lib/mutations/expense-optimistic.ts` for month, recent, grouping, sorting, and accent-insensitive search.

- [ ] **Step 3: Verify local list builder**

Run:

```bash
rtk bunx vitest run src/lib/sync/expenses/list.test.ts src/lib/mutations/expense-optimistic.test.ts
rtk bunx prettier --write src/lib/sync/expenses/types.ts src/lib/sync/expenses/list.ts src/lib/sync/expenses/list.test.ts
rtk bunx prettier --check src/lib/sync/expenses/types.ts src/lib/sync/expenses/list.ts src/lib/sync/expenses/list.test.ts
rtk bunx eslint src/lib/sync/expenses/types.ts src/lib/sync/expenses/list.ts src/lib/sync/expenses/list.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
rtk git add src/lib/sync/expenses/types.ts src/lib/sync/expenses/list.ts src/lib/sync/expenses/list.test.ts
rtk git commit -m "feat: build expense sync adapter lists"
```

## Task 5: Add Reusable Zustand Store Factory and Expense Store

**Files:**
- Create: `src/lib/sync/core/store-factory.ts`
- Create: `src/lib/sync/core/store-factory.test.ts`
- Create: `src/lib/sync/expenses/store.ts`
- Create: `src/lib/sync/expenses/store.test.ts`

- [ ] **Step 1: Write failing store tests**

Create `src/lib/sync/expenses/store.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { createExpenseSyncStore } from "./store";

describe("expense sync Zustand store", () => {
  it("hydrates expenses by client id", () => {
    const store = createExpenseSyncStore();

    store.getState().hydrate([
      {
        clientId: "client-1",
        serverId: 1,
        date: "2026-05-23",
        amount: 45000,
        note: "Coffee",
        category: "Food",
        paidBy: "Cubi",
        budgetId: null,
        budgetName: null,
        syncStatus: "synced",
        lastError: null,
        updatedAt: "2026-05-24T09:00:00.000Z",
        serverUpdatedAt: "2026-05-24T09:00:00.000Z",
      },
    ]);

    expect(store.getState().expensesByClientId["client-1"]?.note).toBe("Coffee");
    expect(store.getState().orderedClientIds).toEqual(["client-1"]);
  });

  it("tracks pending and failed counts", () => {
    const store = createExpenseSyncStore();

    store.getState().hydrate([
      {
        clientId: "pending",
        serverId: null,
        date: "2026-05-23",
        amount: 1,
        note: "",
        category: "Food",
        paidBy: "Cubi",
        budgetId: null,
        budgetName: null,
        syncStatus: "pending",
        lastError: null,
        updatedAt: "2026-05-24T09:00:00.000Z",
        serverUpdatedAt: null,
      },
      {
        clientId: "failed",
        serverId: null,
        date: "2026-05-23",
        amount: 1,
        note: "",
        category: "Food",
        paidBy: "Cubi",
        budgetId: null,
        budgetName: null,
        syncStatus: "failed",
        lastError: "Invalid payload",
        updatedAt: "2026-05-24T09:00:00.000Z",
        serverUpdatedAt: null,
      },
    ]);

    expect(store.getState().pendingCount).toBe(1);
    expect(store.getState().failedCount).toBe(1);
  });
});
```

Run: `rtk bunx vitest run src/lib/sync/core/store-factory.test.ts src/lib/sync/expenses/store.test.ts`

Expected: FAIL because the core store factory and Expense store do not exist.

- [ ] **Step 2: Implement reusable store factory**

Create `src/lib/sync/core/store-factory.ts` with a generic factory:

```ts
import { createStore } from "zustand/vanilla";

import type { SyncEntityName, SyncRecord } from "./types";

export type SyncEntityStoreState<TRecord extends SyncRecord> = {
  entity: SyncEntityName;
  hydrated: boolean;
  recordsByClientId: Record<string, TRecord>;
  orderedClientIds: string[];
  pendingCount: number;
  failedCount: number;
  hydrate: (records: TRecord[]) => void;
  upsertRecord: (record: TRecord) => void;
  removeRecord: (clientId: string) => void;
  markRecordFailed: (clientId: string, error: string) => void;
};

export const createSyncEntityStore = <TRecord extends SyncRecord>(
  entity: SyncEntityName,
  sortRecords: (a: TRecord, b: TRecord) => number
) =>
  createStore<SyncEntityStoreState<TRecord>>()((set) => ({
    entity,
    hydrated: false,
    recordsByClientId: {},
    orderedClientIds: [],
    pendingCount: 0,
    failedCount: 0,
    hydrate: (records) => {
      const recordsByClientId = Object.fromEntries(
        records.map((record) => [record.clientId, record])
      );
      const orderedClientIds = [...records]
        .sort(sortRecords)
        .map((record) => record.clientId);
      set({
        hydrated: true,
        recordsByClientId,
        orderedClientIds,
        pendingCount: records.filter((record) => record.syncStatus === "pending").length,
        failedCount: records.filter((record) => record.syncStatus === "failed").length,
      });
    },
    upsertRecord: (record) =>
      set((state) => {
        const recordsByClientId = {
          ...state.recordsByClientId,
          [record.clientId]: record,
        };
        const records = Object.values(recordsByClientId);
        return {
          recordsByClientId,
          orderedClientIds: records.sort(sortRecords).map((item) => item.clientId),
          pendingCount: records.filter((item) => item.syncStatus === "pending").length,
          failedCount: records.filter((item) => item.syncStatus === "failed").length,
        };
      }),
    removeRecord: (clientId) =>
      set((state) => {
        const { [clientId]: _removed, ...recordsByClientId } =
          state.recordsByClientId;
        const records = Object.values(recordsByClientId);
        return {
          recordsByClientId,
          orderedClientIds: records.sort(sortRecords).map((item) => item.clientId),
          pendingCount: records.filter((item) => item.syncStatus === "pending").length,
          failedCount: records.filter((item) => item.syncStatus === "failed").length,
        };
      }),
    markRecordFailed: (clientId, error) =>
      set((state) => {
        const record = state.recordsByClientId[clientId];
        if (!record) return {};
        return {
          recordsByClientId: {
            ...state.recordsByClientId,
            [clientId]: {
              ...record,
              syncStatus: "failed",
              lastError: error,
            },
          },
        };
      }),
  }));
```

- [ ] **Step 3: Implement Expense store**

Create `src/lib/sync/expenses/store.ts` with a vanilla store and exported hook:

```ts
export type ExpenseSyncState = {
  hydrated: boolean;
  expensesByClientId: Record<string, LocalExpense>;
  orderedClientIds: string[];
  pendingCount: number;
  failedCount: number;
  hydrate: (expenses: LocalExpense[]) => void;
  upsertExpense: (expense: LocalExpense) => void;
  removeExpense: (clientId: string) => void;
  markExpenseFailed: (clientId: string, error: string) => void;
};
```

Use `createSyncEntityStore("expenses", sortExpenseRecords)` internally, then expose Expense-named aliases (`expensesByClientId`, `upsertExpense`, `markExpenseFailed`) for UI and tests. Sort `orderedClientIds` by `date` descending, then `serverId` descending, then `clientId`.

- [ ] **Step 4: Add selectors**

Export these selectors from `store.ts`:

```ts
selectExpenseSyncHydrated
selectExpenseByClientId(clientId)
selectOrderedExpenseClientIds
selectExpenseSyncStatus
```

Use selectors in future components instead of subscribing to the whole store.

- [ ] **Step 5: Verify store**

Run:

```bash
rtk bunx vitest run src/lib/sync/core/store-factory.test.ts src/lib/sync/expenses/store.test.ts
rtk bunx prettier --write src/lib/sync/core/store-factory.ts src/lib/sync/core/store-factory.test.ts src/lib/sync/expenses/store.ts src/lib/sync/expenses/store.test.ts
rtk bunx prettier --check src/lib/sync/core/store-factory.ts src/lib/sync/core/store-factory.test.ts src/lib/sync/expenses/store.ts src/lib/sync/expenses/store.test.ts
rtk bunx eslint src/lib/sync/core/store-factory.ts src/lib/sync/core/store-factory.test.ts src/lib/sync/expenses/store.ts src/lib/sync/expenses/store.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
rtk git add src/lib/sync/core/store-factory.ts src/lib/sync/core/store-factory.test.ts src/lib/sync/expenses/store.ts src/lib/sync/expenses/store.test.ts
rtk git commit -m "feat: add reusable sync store factory"
```

## Task 6: Add Local-First Expense Actions

**Files:**
- Create: `src/lib/sync/expenses/actions.ts`
- Create: `src/lib/sync/expenses/actions.test.ts`
- Modify: `src/lib/mutations/index.ts`

- [ ] **Step 1: Write failing action tests**

Create `src/lib/sync/expenses/actions.test.ts` with fake IndexedDB and a fresh store. Test that create, update, and delete write both store and outbox:

```ts
import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { createLocalExpense, deleteLocalExpense, updateLocalExpense } from "./actions";
import { clearSyncDb, listQueuedSyncOperations } from "@/lib/sync/core/repository";
import { createExpenseSyncStore } from "./store";

beforeEach(async () => {
  await clearSyncDb();
});

describe("local-first expense actions", () => {
  it("creates a pending local expense and outbox operation", async () => {
    const store = createExpenseSyncStore();

    const created = await createLocalExpense(store, {
      date: "23/05/2026",
      amount: 45000,
      note: "Coffee",
      category: "Food",
      paidBy: "Cubi",
      budgetId: null,
    });

    expect(store.getState().expensesByClientId[created.clientId]).toMatchObject({
      note: "Coffee",
      syncStatus: "pending",
      serverId: null,
    });
    await expect(listQueuedSyncOperations("expenses")).resolves.toMatchObject([
      { entity: "expenses", type: "create", clientId: created.clientId },
    ]);
  });
});
```

Run: `rtk bunx vitest run src/lib/sync/expenses/actions.test.ts`

Expected: FAIL because actions do not exist.

- [ ] **Step 2: Implement local actions**

Create `src/lib/sync/expenses/actions.ts` exporting:

```ts
createLocalExpense(store, input)
updateLocalExpense(store, clientId, input)
deleteLocalExpense(store, clientId)
```

Each action must:

- create an ISO `updatedAt`
- convert `LocalExpense` to a core `SyncRecord<ExpensePayload>`
- write the core sync record to IndexedDB through `putSyncRecord`
- enqueue an `ExpenseOutboxOperation` through `putSyncOperation`
- update the Zustand store
- return the local row

- [ ] **Step 3: Preserve existing mutation hook API**

Modify `src/lib/mutations/index.ts` so `useCreateExpenseMutation`, `useUpdateExpenseMutation`, and `useDeleteExpenseMutation` can continue to exist during migration. For V1, these hooks should call local-first actions and then invalidate the existing expense/dashboard/report/budget query families.

- [ ] **Step 4: Verify action and mutation tests**

Run:

```bash
rtk bunx vitest run src/lib/sync/expenses/actions.test.ts src/lib/mutations/index.test.tsx
rtk bunx prettier --write src/lib/sync/expenses/actions.ts src/lib/sync/expenses/actions.test.ts src/lib/mutations/index.ts
rtk bunx prettier --check src/lib/sync/expenses/actions.ts src/lib/sync/expenses/actions.test.ts src/lib/mutations/index.ts
rtk bunx eslint src/lib/sync/expenses/actions.ts src/lib/sync/expenses/actions.test.ts src/lib/mutations/index.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/lib/sync/expenses/actions.ts src/lib/sync/expenses/actions.test.ts src/lib/mutations/index.ts src/lib/mutations/index.test.tsx
rtk git commit -m "feat: add local-first expense actions"
```

## Task 7: Add Sync Coordinator and Reconciliation

**Files:**
- Create: `src/lib/sync/expenses/coordinator.ts`
- Create: `src/lib/sync/expenses/coordinator.test.ts`
- Create: `src/components/ExpenseSyncCoordinator.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Write failing coordinator tests**

Create tests for hydrate, pull, flush success, and flush failure:

```ts
import "fake-indexeddb/auto";

import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearSyncDb, listSyncRecords, putSyncOperation, putSyncRecord } from "@/lib/sync/core/repository";
import { flushExpenseOutbox } from "./coordinator";

it("reconciles a successful create result into a synced local row", async () => {
  await clearSyncDb();
  const queryClient = new QueryClient();
  await putSyncRecord({
    entity: "expenses",
    clientId: "client-1",
    serverId: null,
    syncStatus: "pending",
    lastError: null,
    updatedAt: "2026-05-24T09:00:00.000Z",
    serverUpdatedAt: null,
    payload: {
      date: "2026-05-23",
      amount: 45000,
      note: "Coffee",
      category: "Food",
      paidBy: "Cubi",
      budgetId: null,
      budgetName: null,
    },
  });
  await putSyncOperation({
    operationId: "op-1",
    entity: "expenses",
    type: "create",
    clientId: "client-1",
    serverId: null,
    payload: {
      clientId: "client-1",
      serverId: null,
      date: "2026-05-23",
      amount: 45000,
      note: "Coffee",
      category: "Food",
      paidBy: "Cubi",
      budgetId: null,
      budgetName: null,
      syncStatus: "pending",
      lastError: null,
      updatedAt: "2026-05-24T09:00:00.000Z",
      serverUpdatedAt: null,
    },
    createdAt: "2026-05-24T09:00:00.000Z",
    attemptCount: 0,
    lastAttemptAt: null,
    lastError: null,
  });
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        results: [
          {
            operationId: "op-1",
            ok: true,
            row: {
              id: 10,
              clientId: "client-1",
              date: "2026-05-23",
              amount: 45000,
              note: "Coffee",
              category: "Food",
              paidBy: "Cubi",
              budgetId: null,
              budgetName: null,
              updatedAt: "2026-05-24T10:00:00.000Z",
              deletedAt: null,
              isDeleted: false,
            },
          },
        ],
      })
    )
  );

  await flushExpenseOutbox(queryClient);

  await expect(listSyncRecords("expenses")).resolves.toMatchObject([
    {
      entity: "expenses",
      clientId: "client-1",
      serverId: 10,
      syncStatus: "synced",
      serverUpdatedAt: "2026-05-24T10:00:00.000Z",
    },
  ]);
});
```

Run: `rtk bunx vitest run src/lib/sync/expenses/coordinator.test.ts`

Expected: FAIL because coordinator does not exist.

- [ ] **Step 2: Implement coordinator helpers**

Create `src/lib/sync/expenses/coordinator.ts` exporting:

```ts
hydrateExpenseSync(queryClient)
pullExpenseChanges(queryClient)
flushExpenseOutbox(queryClient)
syncExpensesNow(queryClient)
invalidateExpenseDerivedQueries(queryClient)
```

`hydrateExpenseSync` reads core records for `entity: "expenses"`, maps them to `LocalExpense`, hydrates Zustand, and seeds currently active `queries.expenses.list` caches using `buildExpenseListResultFromLocalRows`.

`flushExpenseOutbox` reads core operations for `entity: "expenses"`, posts them to `/api/expenses/sync`, reconciles successful rows through core record writes, deletes successful outbox operations, and marks failed operations with the server error.

- [ ] **Step 3: Add mounted coordinator component**

Create `src/components/ExpenseSyncCoordinator.tsx`:

```tsx
"use client";

import { useEffect } from "react";

import { syncExpensesNow } from "@/lib/sync/expenses/coordinator";
import { useQueryClient } from "@tanstack/react-query";

export default function ExpenseSyncCoordinator() {
  const queryClient = useQueryClient();

  useEffect(() => {
    void syncExpensesNow(queryClient);

    const handleOnline = () => void syncExpensesNow(queryClient);
    const handleFocus = () => void syncExpensesNow(queryClient);

    window.addEventListener("online", handleOnline);
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("focus", handleFocus);
    };
  }, [queryClient]);

  return null;
}
```

Mount it in `src/app/layout.tsx` inside `ReactQueryProvider`.

- [ ] **Step 4: Verify coordinator**

Run:

```bash
rtk bunx vitest run src/lib/sync/expenses/coordinator.test.ts
rtk bunx prettier --write src/lib/sync/expenses/coordinator.ts src/lib/sync/expenses/coordinator.test.ts src/components/ExpenseSyncCoordinator.tsx src/app/layout.tsx
rtk bunx prettier --check src/lib/sync/expenses/coordinator.ts src/lib/sync/expenses/coordinator.test.ts src/components/ExpenseSyncCoordinator.tsx src/app/layout.tsx
rtk bunx eslint src/lib/sync/expenses/coordinator.ts src/lib/sync/expenses/coordinator.test.ts src/components/ExpenseSyncCoordinator.tsx src/app/layout.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/lib/sync/expenses/coordinator.ts src/lib/sync/expenses/coordinator.test.ts src/components/ExpenseSyncCoordinator.tsx src/app/layout.tsx
rtk git commit -m "feat: coordinate expense sync"
```

## Task 8: Bridge Expense Reads Through IndexedDB

**Files:**
- Modify: `src/lib/queries/expenses.ts`
- Modify: `src/lib/queries/read-fetchers.test.ts`
- Modify: `src/components/ExpenseList.test.tsx`

- [ ] **Step 1: Write failing browser fetcher test**

Add this test to `src/lib/queries/read-fetchers.test.ts`:

```ts
import "fake-indexeddb/auto";

import { fetchExpenseList } from "@/lib/queries/expenses";
import { clearSyncDb, putSyncRecord } from "@/lib/sync/core/repository";

it("returns local IndexedDB expenses before fetching the network", async () => {
  await clearSyncDb();
  const fetchMock = vi.spyOn(globalThis, "fetch");
  await putSyncRecord({
    entity: "expenses",
    clientId: "client-1",
    serverId: 1,
    syncStatus: "synced",
    lastError: null,
    updatedAt: "2026-05-24T09:00:00.000Z",
    serverUpdatedAt: "2026-05-24T09:00:00.000Z",
    payload: {
      date: "2026-05-23",
      amount: 45000,
      note: "Coffee",
      category: "Food",
      paidBy: "Cubi",
      budgetId: null,
      budgetName: null,
    },
  });

  const result = await fetchExpenseList({ month: "2026-05", limit: 30 });

  expect(result.rows).toHaveLength(1);
  expect(result.rows[0]).toMatchObject({ note: "Coffee", amount: 45000 });
  expect(fetchMock).not.toHaveBeenCalled();
});
```

Run: `rtk bunx vitest run src/lib/queries/read-fetchers.test.ts -t "local expense"`

Expected: FAIL because `fetchExpenseList` always fetches `/api/expenses`.

- [ ] **Step 2: Update expense fetcher**

Modify `fetchExpenseList` in `src/lib/queries/expenses.ts`:

- if running server-side, keep current route-fetching behavior unavailable and rely on server prefetch callers
- if browser IndexedDB has local rows, return `buildExpenseListResultFromLocalRows(rows, params)`
- if IndexedDB is empty, fetch `/api/expenses`, seed IndexedDB through the repository, and return the server result

- [ ] **Step 3: Verify read bridge**

Run:

```bash
rtk bunx vitest run src/lib/queries/read-fetchers.test.ts src/components/ExpenseList.test.tsx
rtk bunx prettier --write src/lib/queries/expenses.ts src/lib/queries/read-fetchers.test.ts src/components/ExpenseList.test.tsx
rtk bunx prettier --check src/lib/queries/expenses.ts src/lib/queries/read-fetchers.test.ts src/components/ExpenseList.test.tsx
rtk bunx eslint src/lib/queries/expenses.ts src/lib/queries/read-fetchers.test.ts src/components/ExpenseList.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
rtk git add src/lib/queries/expenses.ts src/lib/queries/read-fetchers.test.ts src/components/ExpenseList.test.tsx
rtk git commit -m "feat: read expenses from local sync cache"
```

## Task 9: Move Quick Expense Recovery Onto Failed Outbox Entries

**Files:**
- Modify: `src/stores/quick-expense-recovery-store.ts`
- Modify: `src/components/QuickExpenseMutationCoordinator.tsx`
- Modify: `src/components/QuickExpenseRecoverySheetHost.tsx`
- Modify: `src/components/QuickExpenseSheet.tsx`
- Modify: related tests in `src/stores` and `src/components`

- [ ] **Step 1: Write failing recovery tests**

Update existing recovery tests so failed create/edit recovery is backed by failed sync operations instead of session-only `running` mutation entries.

Run:

```bash
rtk bunx vitest run src/stores/quick-expense-recovery-store.test.ts src/components/QuickExpenseMutationCoordinator.test.tsx src/components/QuickExpenseRecoverySheetHost.test.tsx
```

Expected: FAIL until the recovery store reads failed outbox-backed entries.

- [ ] **Step 2: Keep draft capture in the sheet**

Keep `QuickExpenseSheet` cloning the submitted draft before close. Change its enqueue call to local-first expense actions instead of the session recovery store.

- [ ] **Step 3: Convert coordinator responsibility**

Replace `QuickExpenseMutationCoordinator` network mutation ownership with a thin adapter that observes failed outbox operations and triggers the existing toast/reopen UX. The sync coordinator owns network flush.

- [ ] **Step 4: Verify recovery behavior**

Run:

```bash
rtk bunx vitest run src/stores/quick-expense-recovery-store.test.ts src/components/QuickExpenseMutationCoordinator.test.tsx src/components/QuickExpenseRecoverySheetHost.test.tsx src/components/QuickExpenseSheet.test.tsx
rtk bunx prettier --write src/stores/quick-expense-recovery-store.ts src/components/QuickExpenseMutationCoordinator.tsx src/components/QuickExpenseRecoverySheetHost.tsx src/components/QuickExpenseSheet.tsx src/stores/quick-expense-recovery-store.test.ts src/components/QuickExpenseMutationCoordinator.test.tsx src/components/QuickExpenseRecoverySheetHost.test.tsx src/components/QuickExpenseSheet.test.tsx
rtk bunx prettier --check src/stores/quick-expense-recovery-store.ts src/components/QuickExpenseMutationCoordinator.tsx src/components/QuickExpenseRecoverySheetHost.tsx src/components/QuickExpenseSheet.tsx src/stores/quick-expense-recovery-store.test.ts src/components/QuickExpenseMutationCoordinator.test.tsx src/components/QuickExpenseRecoverySheetHost.test.tsx src/components/QuickExpenseSheet.test.tsx
rtk bunx eslint src/stores/quick-expense-recovery-store.ts src/components/QuickExpenseMutationCoordinator.tsx src/components/QuickExpenseRecoverySheetHost.tsx src/components/QuickExpenseSheet.tsx src/stores/quick-expense-recovery-store.test.ts src/components/QuickExpenseMutationCoordinator.test.tsx src/components/QuickExpenseRecoverySheetHost.test.tsx src/components/QuickExpenseSheet.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/stores/quick-expense-recovery-store.ts src/components/QuickExpenseMutationCoordinator.tsx src/components/QuickExpenseRecoverySheetHost.tsx src/components/QuickExpenseSheet.tsx src/stores/quick-expense-recovery-store.test.ts src/components/QuickExpenseMutationCoordinator.test.tsx src/components/QuickExpenseRecoverySheetHost.test.tsx src/components/QuickExpenseSheet.test.tsx
rtk git commit -m "feat: recover expenses from sync outbox"
```

## Task 10: Final Verification

**Files:**
- Verify all changed `.ts` and `.tsx` files.
- Verify docs: `docs/superpowers/specs/2026-05-24-expense-sync-engine-design.md`, `docs/superpowers/plans/2026-05-24-expense-sync-engine.md`

- [ ] **Step 1: Run targeted Expense sync suite**

Run:

```bash
rtk bunx vitest run \
  src/lib/sync/core/repository.test.ts \
  src/lib/sync/core/store-factory.test.ts \
  src/lib/sync/expenses/list.test.ts \
  src/lib/sync/expenses/store.test.ts \
  src/lib/sync/expenses/actions.test.ts \
  src/lib/sync/expenses/coordinator.test.ts \
  src/app/api/read-routes.test.ts \
  src/app/api/mutation-routes.test.ts \
  src/lib/queries/read-fetchers.test.ts \
  src/lib/mutations/index.test.tsx \
  src/components/ExpenseList.test.tsx \
  src/components/QuickExpenseMutationCoordinator.test.tsx \
  src/components/QuickExpenseRecoverySheetHost.test.tsx \
  src/components/QuickExpenseSheet.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run formatting and ESLint for modified TypeScript scope**

Run:

```bash
rtk git diff --name-only -- '*.ts' '*.tsx' | xargs rtk bunx prettier --check
rtk git diff --name-only -- '*.ts' '*.tsx' | xargs rtk bunx eslint
```

Expected: PASS.

- [ ] **Step 3: Inspect git diff**

Run:

```bash
rtk git status --short
rtk git diff --stat
```

Expected: only Expense sync implementation, tests, migration, package lock, and docs are changed.

- [ ] **Step 4: Final commit**

```bash
rtk git add docs/superpowers/specs/2026-05-24-expense-sync-engine-design.md docs/superpowers/plans/2026-05-24-expense-sync-engine.md
rtk git commit -m "docs: plan expense sync engine"
```
