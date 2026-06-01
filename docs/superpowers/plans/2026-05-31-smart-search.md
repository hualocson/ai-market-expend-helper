# Smart Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add natural-language search that filters the home expense list, e.g. `"coffee this month without budget"`, by translating the query into an editable structured filter via the existing OpenRouter pipeline.

**Architecture:** A client wrapper (`ExpenseSearch`) owns a `SearchFilter` in local state. On submit it POSTs to a new `/api/ai/parse-search` route that runs `callOpenRouterJson` (reused engine) against a Zod DSL and returns a validated filter (with graceful text-search fallback). The filter renders as editable chips and is passed to `ExpenseList`. The list is filtered in **two** places that must mirror each other: the client local-IndexedDB-row builder (`buildExpenseListResultFromLocalRows`, what users see) and the server Drizzle `getExpenseList` (SSR prefetch only).

**Tech Stack:** Next.js 15 App Router, React 19, TanStack Query (infinite), Drizzle ORM, Zod v4, Vitest + Testing Library, OpenRouter (free-model chain), Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-05-31-smart-search-design.md`

**Conventions for every task:**
- Use `bun`/`bunx` for all commands (per `CLAUDE.md`). Run a single test file with: `rtk bunx vitest run <path>`.
- After editing any `.ts`/`.tsx`: `rtk bunx prettier --write <files>` then `rtk bunx eslint <files>` before committing.
- Do **not** run `npm run build` between tasks.
- Branch is already `dev-smart-search`.

---

## Phase A — List filter foundation (the bulk of the work)

### Task 1: Extend `ExpenseListQueryParams` with the new filter fields

**Files:**
- Modify: `src/lib/expenses/list-model.ts`
- Test: `src/lib/expenses/list-model.test.ts` (create if absent)

- [ ] **Step 1: Write the failing test**

Add to `src/lib/expenses/list-model.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { Category } from "@/enums";
import type { ExpenseListQueryParams } from "./list-model";

describe("ExpenseListQueryParams", () => {
  it("accepts the new filter fields", () => {
    const params: ExpenseListQueryParams = {
      dateFrom: "2026-05-01",
      dateTo: "2026-05-31",
      categories: [Category.FOOD, Category.ENTERTAINMENT],
      budgetIds: [1, 2],
      hasBudget: false,
      amountMin: 50000,
      amountMax: 100000,
    };
    expect(params.categories).toHaveLength(2);
    expect(params.hasBudget).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk bunx vitest run src/lib/expenses/list-model.test.ts`
Expected: FAIL — TS error "Object literal may only specify known properties" / type errors on `dateFrom`, `categories`, etc.

- [ ] **Step 3: Implement the type extension**

In `src/lib/expenses/list-model.ts`, add the import at the top (alongside existing imports):

```ts
import { Category } from "@/enums";
```

Replace the `ExpenseListQueryParams` type with:

```ts
export type ExpenseListQueryParams = {
  month?: string;
  q?: string;
  mode?: "full" | "recent";
  recentDays?: number;
  limit?: number;
  offset?: number;
  dateFrom?: string; // YYYY-MM-DD (inclusive)
  dateTo?: string; // YYYY-MM-DD (inclusive)
  categories?: Category[];
  budgetIds?: number[];
  hasBudget?: boolean;
  amountMin?: number;
  amountMax?: number;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk bunx vitest run src/lib/expenses/list-model.test.ts`
Expected: PASS

- [ ] **Step 5: Format, lint, commit**

```bash
rtk bunx prettier --write src/lib/expenses/list-model.ts src/lib/expenses/list-model.test.ts
rtk bunx eslint src/lib/expenses/list-model.ts src/lib/expenses/list-model.test.ts
git add src/lib/expenses/list-model.ts src/lib/expenses/list-model.test.ts
git commit -m "feat(smart-search): extend ExpenseListQueryParams with filter fields"
```

---

### Task 2: Shared pure filter predicate `expenseRowMatchesFilters`

A single source of truth for the JS predicates, reused by the client list builder (Task 3). The Drizzle path (Task 4) mirrors the same logic as SQL.

**Files:**
- Create: `src/lib/expenses/filter-predicates.ts`
- Test: `src/lib/expenses/filter-predicates.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";

import { Category } from "@/enums";
import { expenseRowMatchesFilters } from "./filter-predicates";

const row = {
  date: "2026-05-15",
  amount: 60000,
  category: Category.FOOD as string,
  budgetId: null as number | null,
};

describe("expenseRowMatchesFilters", () => {
  it("returns true with no filters", () => {
    expect(expenseRowMatchesFilters(row, {})).toBe(true);
  });

  it("filters by inclusive date range", () => {
    expect(
      expenseRowMatchesFilters(row, { dateFrom: "2026-05-01", dateTo: "2026-05-31" })
    ).toBe(true);
    expect(
      expenseRowMatchesFilters(row, { dateFrom: "2026-06-01" })
    ).toBe(false);
  });

  it("filters by categories", () => {
    expect(expenseRowMatchesFilters(row, { categories: [Category.FOOD] })).toBe(true);
    expect(expenseRowMatchesFilters(row, { categories: [Category.HOUSING] })).toBe(false);
  });

  it("filters hasBudget=false to rows without a budget", () => {
    expect(expenseRowMatchesFilters(row, { hasBudget: false })).toBe(true);
    expect(expenseRowMatchesFilters({ ...row, budgetId: 3 }, { hasBudget: false })).toBe(false);
  });

  it("budgetIds wins over hasBudget", () => {
    const withBudget = { ...row, budgetId: 3 };
    expect(
      expenseRowMatchesFilters(withBudget, { budgetIds: [3], hasBudget: false })
    ).toBe(true);
    expect(
      expenseRowMatchesFilters(withBudget, { budgetIds: [9], hasBudget: false })
    ).toBe(false);
  });

  it("filters by amount bounds", () => {
    expect(expenseRowMatchesFilters(row, { amountMin: 50000, amountMax: 70000 })).toBe(true);
    expect(expenseRowMatchesFilters(row, { amountMin: 70000 })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk bunx vitest run src/lib/expenses/filter-predicates.test.ts`
Expected: FAIL — "Cannot find module './filter-predicates'".

- [ ] **Step 3: Implement the predicate**

Create `src/lib/expenses/filter-predicates.ts`:

```ts
import type { ExpenseListQueryParams } from "./list-model";

type FilterableRow = {
  date: string;
  amount: number;
  category: string;
  budgetId: number | null;
};

type ExpenseFilterFields = Pick<
  ExpenseListQueryParams,
  "dateFrom" | "dateTo" | "categories" | "budgetIds" | "hasBudget" | "amountMin" | "amountMax"
>;

const matchesBudget = (budgetId: number | null, params: ExpenseFilterFields) => {
  if (params.budgetIds && params.budgetIds.length > 0) {
    return budgetId !== null && params.budgetIds.includes(budgetId);
  }
  if (params.hasBudget === true) {
    return budgetId !== null;
  }
  if (params.hasBudget === false) {
    return budgetId === null;
  }
  return true;
};

export const expenseRowMatchesFilters = (
  row: FilterableRow,
  params: ExpenseFilterFields
): boolean => {
  if (params.dateFrom && row.date < params.dateFrom) {
    return false;
  }
  if (params.dateTo && row.date > params.dateTo) {
    return false;
  }
  if (
    params.categories &&
    params.categories.length > 0 &&
    !params.categories.some((category) => category === row.category)
  ) {
    return false;
  }
  if (!matchesBudget(row.budgetId, params)) {
    return false;
  }
  if (params.amountMin !== undefined && row.amount < params.amountMin) {
    return false;
  }
  if (params.amountMax !== undefined && row.amount > params.amountMax) {
    return false;
  }
  return true;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk bunx vitest run src/lib/expenses/filter-predicates.test.ts`
Expected: PASS (6 assertions green)

- [ ] **Step 5: Format, lint, commit**

```bash
rtk bunx prettier --write src/lib/expenses/filter-predicates.ts src/lib/expenses/filter-predicates.test.ts
rtk bunx eslint src/lib/expenses/filter-predicates.ts src/lib/expenses/filter-predicates.test.ts
git add src/lib/expenses/filter-predicates.ts src/lib/expenses/filter-predicates.test.ts
git commit -m "feat(smart-search): add shared expenseRowMatchesFilters predicate"
```

---

### Task 3: Apply the filter in the client local-row builder (PRIMARY path)

**Files:**
- Modify: `src/lib/sync/expenses/list.ts`
- Test: `src/lib/sync/expenses/list.test.ts` (create if absent)

- [ ] **Step 1: Write the failing test**

Create/append `src/lib/sync/expenses/list.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { Category } from "@/enums";
import { buildExpenseListResultFromLocalRows } from "./list";
import type { LocalExpense } from "./types";

const makeRow = (over: Partial<LocalExpense>): LocalExpense => ({
  entity: "expenses",
  clientId: over.clientId ?? "c1",
  serverId: over.serverId ?? 1,
  syncStatus: "synced",
  lastError: null,
  updatedAt: "2026-05-15T00:00:00.000Z",
  serverUpdatedAt: "2026-05-15T00:00:00.000Z",
  date: over.date ?? "2026-05-15",
  amount: over.amount ?? 60000,
  note: over.note ?? "ca phe",
  category: over.category ?? Category.FOOD,
  paidBy: over.paidBy ?? "Cubi",
  budgetId: over.budgetId ?? null,
  budgetName: over.budgetName ?? null,
  budgetIcon: null,
  budgetColor: null,
  ...over,
});

describe("buildExpenseListResultFromLocalRows filters", () => {
  it("keeps only rows without a budget when hasBudget=false", () => {
    const rows = [
      makeRow({ clientId: "a", serverId: 1, budgetId: null }),
      makeRow({ clientId: "b", serverId: 2, budgetId: 7 }),
    ];
    const result = buildExpenseListResultFromLocalRows(rows, { hasBudget: false });
    expect(result.rows.map((r) => r.budgetId)).toEqual([null]);
  });

  it("filters by category and amount together", () => {
    const rows = [
      makeRow({ clientId: "a", serverId: 1, category: Category.FOOD, amount: 60000 }),
      makeRow({ clientId: "b", serverId: 2, category: Category.HOUSING, amount: 60000 }),
      makeRow({ clientId: "c", serverId: 3, category: Category.FOOD, amount: 10000 }),
    ];
    const result = buildExpenseListResultFromLocalRows(rows, {
      categories: [Category.FOOD],
      amountMin: 50000,
    });
    expect(result.rows.map((r) => r.id)).toEqual([1]);
  });

  it("filters by inclusive date range", () => {
    const rows = [
      makeRow({ clientId: "a", serverId: 1, date: "2026-05-10" }),
      makeRow({ clientId: "b", serverId: 2, date: "2026-06-10" }),
    ];
    const result = buildExpenseListResultFromLocalRows(rows, {
      dateFrom: "2026-05-01",
      dateTo: "2026-05-31",
    });
    expect(result.rows.map((r) => r.id)).toEqual([1]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk bunx vitest run src/lib/sync/expenses/list.test.ts`
Expected: FAIL — the new filters are ignored, so all rows pass (e.g. first test returns 2 rows, not 1).

- [ ] **Step 3: Implement the filter in the builder**

In `src/lib/sync/expenses/list.ts`, add the import near the other `@/lib/expenses/list-model` import:

```ts
import { expenseRowMatchesFilters } from "@/lib/expenses/filter-predicates";
```

In `buildExpenseListResultFromLocalRows`, find the existing `.filter((row) => { ... matchesLocalExpenseSearch ... })` block. Append the new predicate to that returned boolean. Change the final `return inRange && matchesLocalExpenseSearch(row, trimmedSearch ?? "");` to:

```ts
        return (
          inRange &&
          matchesLocalExpenseSearch(row, trimmedSearch ?? "") &&
          expenseRowMatchesFilters(row, params)
        );
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk bunx vitest run src/lib/sync/expenses/list.test.ts`
Expected: PASS (3 tests green)

- [ ] **Step 5: Run the existing list test to confirm no regression**

Run: `rtk bunx vitest run src/lib/sync/expenses`
Expected: PASS (existing tests still green)

- [ ] **Step 6: Format, lint, commit**

```bash
rtk bunx prettier --write src/lib/sync/expenses/list.ts src/lib/sync/expenses/list.test.ts
rtk bunx eslint src/lib/sync/expenses/list.ts src/lib/sync/expenses/list.test.ts
git add src/lib/sync/expenses/list.ts src/lib/sync/expenses/list.test.ts
git commit -m "feat(smart-search): apply filter fields in local-row list builder"
```

---

### Task 4: Apply the filter in the server Drizzle `getExpenseList` (SSR path)

**Files:**
- Modify: `src/lib/services/expenses.ts`
- Test: `src/lib/services/expenses.test.ts`

- [ ] **Step 1: Read the existing test file to match its mocking style**

Run: `rtk bunx vitest run src/lib/services/expenses.test.ts`
Expected: PASS (baseline). Open the file and note how `db.select(...).where(...)` is mocked so the new test follows the same pattern. Capture the `where` argument and assert predicates were added.

- [ ] **Step 2: Write the failing test**

Append a test that drives a filtered call and asserts the captured SQL contains the new predicates. Using the file's existing mock harness (mirror its setup — repeat its `vi.mock("@/db", ...)` and the select-chain capture exactly as the file already does), add:

```ts
it("adds category, budget, amount, and date predicates to the where clause", async () => {
  // (reuse the file's existing select-chain mock; capture the where() arg)
  await getExpenseList({
    dateFrom: "2026-05-01",
    dateTo: "2026-05-31",
    categories: [Category.FOOD],
    budgetIds: [7],
    amountMin: 50000,
    amountMax: 100000,
  });

  const sql = capturedWhere.queryChunks
    ? JSON.stringify(capturedWhere)
    : String(capturedWhere);
  expect(sql).toContain("category");
  expect(sql).toContain("budget_id");
  expect(sql).toContain("amount");
  expect(sql).toContain("date");
});
```

> If the existing test asserts on a simpler shape (e.g. it spies on `inArray`/`gte` from `drizzle-orm`), follow THAT style instead: `vi.mock("drizzle-orm", ...)` and assert each helper was called with the expected column. Match whatever the file already does — do not introduce a second mocking style.

- [ ] **Step 3: Run test to verify it fails**

Run: `rtk bunx vitest run src/lib/services/expenses.test.ts`
Expected: FAIL — predicates not present (the new params are ignored).

- [ ] **Step 4: Implement the predicates**

In `src/lib/services/expenses.ts`, extend the drizzle import:

```ts
import { and, desc, eq, gte, inArray, isNull, isNotNull, lt, lte, sql } from "drizzle-orm";
```

Destructure the new params in the function signature:

```ts
export const getExpenseList = async ({
  month,
  q,
  mode = "full",
  recentDays = 7,
  limit = 30,
  offset = 0,
  dateFrom,
  dateTo,
  categories,
  budgetIds,
  hasBudget,
  amountMin,
  amountMax,
}: ExpenseListQueryParams = {}): Promise<ExpenseListResult> => {
```

After the existing `whereParts` block that pushes the month/recent range, append:

```ts
  if (dateFrom) {
    whereParts.push(gte(expenses.date, dateFrom));
  }
  if (dateTo) {
    whereParts.push(lte(expenses.date, dateTo));
  }
  if (categories && categories.length > 0) {
    whereParts.push(inArray(expenses.category, categories));
  }
  if (budgetIds && budgetIds.length > 0) {
    whereParts.push(inArray(expenseBudgets.budgetId, budgetIds));
  } else if (hasBudget === true) {
    whereParts.push(isNotNull(expenseBudgets.budgetId));
  } else if (hasBudget === false) {
    whereParts.push(isNull(expenseBudgets.budgetId));
  }
  if (amountMin !== undefined) {
    whereParts.push(gte(expenses.amount, amountMin));
  }
  if (amountMax !== undefined) {
    whereParts.push(lte(expenses.amount, amountMax));
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `rtk bunx vitest run src/lib/services/expenses.test.ts`
Expected: PASS (new test green, existing tests still green)

- [ ] **Step 6: Format, lint, commit**

```bash
rtk bunx prettier --write src/lib/services/expenses.ts src/lib/services/expenses.test.ts
rtk bunx eslint src/lib/services/expenses.ts src/lib/services/expenses.test.ts
git add src/lib/services/expenses.ts src/lib/services/expenses.test.ts
git commit -m "feat(smart-search): apply filter fields in getExpenseList where clause"
```

---

### Task 5: Add the new fields to the list query key

**Files:**
- Modify: `src/lib/queries/expenses.ts`
- Test: `src/lib/queries/expenses.test.ts` (create if absent)

- [ ] **Step 1: Write the failing test**

Create/append `src/lib/queries/expenses.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { Category } from "@/enums";
import { expenseQueries } from "./expenses";

describe("expenseQueries.list query key", () => {
  it("produces distinct keys for distinct filters", () => {
    const a = JSON.stringify(expenseQueries.list({ categories: [Category.FOOD] }).queryKey);
    const b = JSON.stringify(expenseQueries.list({ categories: [Category.HOUSING] }).queryKey);
    expect(a).not.toBe(b);
  });

  it("normalizes absent filter fields to null", () => {
    const key = expenseQueries.list({}).queryKey;
    const entry = key[key.length - 1] as Record<string, unknown>;
    expect(entry.hasBudget).toBeNull();
    expect(entry.dateFrom).toBeNull();
    expect(entry.categories).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk bunx vitest run src/lib/queries/expenses.test.ts`
Expected: FAIL — `entry.hasBudget` is `undefined` (key lacks the field), and both filter keys serialize identically.

- [ ] **Step 3: Extend the query key**

In `src/lib/queries/expenses.ts`, replace the `queryKey` array inside `expenseQueries.list` with:

```ts
    queryKey: [
      {
        month: params.month ?? null,
        q: params.q ?? null,
        mode: params.mode ?? null,
        recentDays: params.recentDays ?? null,
        limit: params.limit ?? null,
        dateFrom: params.dateFrom ?? null,
        dateTo: params.dateTo ?? null,
        categories: params.categories ?? null,
        budgetIds: params.budgetIds ?? null,
        hasBudget: params.hasBudget ?? null,
        amountMin: params.amountMin ?? null,
        amountMax: params.amountMax ?? null,
      },
    ],
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk bunx vitest run src/lib/queries/expenses.test.ts`
Expected: PASS

- [ ] **Step 5: Format, lint, commit**

```bash
rtk bunx prettier --write src/lib/queries/expenses.ts src/lib/queries/expenses.test.ts
rtk bunx eslint src/lib/queries/expenses.ts src/lib/queries/expenses.test.ts
git add src/lib/queries/expenses.ts src/lib/queries/expenses.test.ts
git commit -m "feat(smart-search): include filter fields in list query key"
```

---

### Task 6: Parse the new fields in `parseExpenseListParams` (REST/SSR route)

**Files:**
- Modify: `src/lib/api/read-route-params.ts`
- Test: `src/lib/api/read-route-params.test.ts` (create if absent)

- [ ] **Step 1: Write the failing test**

Create/append `src/lib/api/read-route-params.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { Category } from "@/enums";
import { parseExpenseListParams } from "./read-route-params";

const parse = (qs: string) => parseExpenseListParams(new URLSearchParams(qs));

describe("parseExpenseListParams new filter fields", () => {
  it("parses categories, budgetIds, hasBudget, amount and date range", () => {
    const result = parse(
      "dateFrom=2026-05-01&dateTo=2026-05-31&categories=Food,Entertainment&budgetIds=1,2&hasBudget=false&amountMin=50000&amountMax=100000"
    );
    expect("value" in result).toBe(true);
    if ("value" in result) {
      expect(result.value.categories).toEqual([Category.FOOD, Category.ENTERTAINMENT]);
      expect(result.value.budgetIds).toEqual([1, 2]);
      expect(result.value.hasBudget).toBe(false);
      expect(result.value.amountMin).toBe(50000);
      expect(result.value.dateFrom).toBe("2026-05-01");
    }
  });

  it("rejects an unknown category", () => {
    const result = parse("categories=Food,NotACategory");
    expect("error" in result).toBe(true);
  });

  it("rejects a non-integer budgetId", () => {
    expect("error" in parse("budgetIds=1,abc")).toBe(true);
  });

  it("rejects a bad dateFrom", () => {
    expect("error" in parse("dateFrom=2026-13-99")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk bunx vitest run src/lib/api/read-route-params.test.ts`
Expected: FAIL — fields are `undefined`; bad inputs are not rejected.

- [ ] **Step 3: Implement the parsing helpers**

In `src/lib/api/read-route-params.ts`, add the import:

```ts
import { Category } from "@/enums";
```

Add these helpers above `parseExpenseListParams`:

```ts
const CATEGORY_VALUES = new Set<string>(Object.values(Category));

const parseCategoriesParam = (
  searchParams: URLSearchParams
): ParamResult<Category[] | undefined> => {
  const raw = searchParams.get("categories");
  if (!raw) {
    return { value: undefined };
  }
  const parts = raw.split(",").map((part) => part.trim()).filter(Boolean);
  for (const part of parts) {
    if (!CATEGORY_VALUES.has(part)) {
      return { error: "Invalid category" };
    }
  }
  return { value: parts.length ? (parts as Category[]) : undefined };
};

const parseIntListParam = (
  searchParams: URLSearchParams,
  name: string,
  error: string
): ParamResult<number[] | undefined> => {
  const raw = searchParams.get(name);
  if (!raw) {
    return { value: undefined };
  }
  const parts = raw.split(",").map((part) => part.trim()).filter(Boolean);
  const numbers: number[] = [];
  for (const part of parts) {
    const value = Number(part);
    if (!Number.isInteger(value) || value <= 0) {
      return { error };
    }
    numbers.push(value);
  }
  return { value: numbers.length ? numbers : undefined };
};

const parseOptionalAmountParam = (
  searchParams: URLSearchParams,
  name: string,
  error: string
): ParamResult<number | undefined> => {
  const raw = searchParams.get(name);
  if (!raw) {
    return { value: undefined };
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    return { error };
  }
  return { value };
};

const parseOptionalBooleanParam = (
  searchParams: URLSearchParams,
  name: string,
  error: string
): ParamResult<boolean | undefined> => {
  const raw = searchParams.get(name);
  if (raw === null) {
    return { value: undefined };
  }
  if (raw === "true") {
    return { value: true };
  }
  if (raw === "false") {
    return { value: false };
  }
  return { error };
};
```

In `parseExpenseListParams`, after the existing pagination block and before the final `return`, add:

```ts
  const dateFrom = parseOptionalDateParam(searchParams, "dateFrom", "YYYY-MM-DD", "Invalid dateFrom");
  if ("error" in dateFrom) {
    return dateFrom;
  }
  const dateTo = parseOptionalDateParam(searchParams, "dateTo", "YYYY-MM-DD", "Invalid dateTo");
  if ("error" in dateTo) {
    return dateTo;
  }
  const categories = parseCategoriesParam(searchParams);
  if ("error" in categories) {
    return categories;
  }
  const budgetIds = parseIntListParam(searchParams, "budgetIds", "Invalid budgetIds");
  if ("error" in budgetIds) {
    return budgetIds;
  }
  const hasBudget = parseOptionalBooleanParam(searchParams, "hasBudget", "Invalid hasBudget");
  if ("error" in hasBudget) {
    return hasBudget;
  }
  const amountMin = parseOptionalAmountParam(searchParams, "amountMin", "Invalid amountMin");
  if ("error" in amountMin) {
    return amountMin;
  }
  const amountMax = parseOptionalAmountParam(searchParams, "amountMax", "Invalid amountMax");
  if ("error" in amountMax) {
    return amountMax;
  }
```

Then extend the returned `value` object with:

```ts
      dateFrom: dateFrom.value,
      dateTo: dateTo.value,
      categories: categories.value,
      budgetIds: budgetIds.value,
      hasBudget: hasBudget.value,
      amountMin: amountMin.value,
      amountMax: amountMax.value,
```

> Note: `parseOptionalDateParam` already exists in this file and returns `ParamResult<string | undefined>`. Reuse it directly.

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk bunx vitest run src/lib/api/read-route-params.test.ts`
Expected: PASS

- [ ] **Step 5: Format, lint, commit**

```bash
rtk bunx prettier --write src/lib/api/read-route-params.ts src/lib/api/read-route-params.test.ts
rtk bunx eslint src/lib/api/read-route-params.ts src/lib/api/read-route-params.test.ts
git add src/lib/api/read-route-params.ts src/lib/api/read-route-params.test.ts
git commit -m "feat(smart-search): parse new filter query params in expense list route"
```

---

## Phase B — AI parse layer

### Task 7: The Filter DSL contract

**Files:**
- Create: `src/lib/ai/search-contract.ts`
- Test: `src/lib/ai/search-contract.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";

import { Category } from "@/enums";
import {
  parseSearchRequestSchema,
  searchFilterSchema,
} from "./search-contract";

describe("searchFilterSchema", () => {
  it("accepts a full filter", () => {
    const parsed = searchFilterSchema.safeParse({
      dateFrom: "2026-05-01",
      dateTo: "2026-05-31",
      categories: [Category.FOOD],
      budgetIds: [1, 2],
      hasBudget: false,
      amountMin: 50000,
      amountMax: 100000,
      q: "coffee",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts an empty filter", () => {
    expect(searchFilterSchema.safeParse({}).success).toBe(true);
  });

  it("rejects a bad date format", () => {
    expect(searchFilterSchema.safeParse({ dateFrom: "05/2026" }).success).toBe(false);
  });
});

describe("parseSearchRequestSchema", () => {
  it("requires input and todayMonth and defaults budgets to []", () => {
    const parsed = parseSearchRequestSchema.safeParse({
      input: "coffee no budget",
      todayMonth: "2026-05",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.budgets).toEqual([]);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk bunx vitest run src/lib/ai/search-contract.test.ts`
Expected: FAIL — "Cannot find module './search-contract'".

- [ ] **Step 3: Implement the contract**

Create `src/lib/ai/search-contract.ts`:

```ts
import { Category } from "@/enums";
import type { OpenRouterJsonSchema } from "@/lib/ai/core/openrouter";
import { z } from "zod";

export const SEARCH_INPUT_MAX_LENGTH = 500;
export const SEARCH_MONTH_PATTERN = /^\d{4}-\d{2}$/;
export const SEARCH_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const SEARCH_MAX_BUDGETS = 100;
export const SEARCH_BUDGET_NAME_MAX_LENGTH = 120;

export const searchBudgetSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1).max(SEARCH_BUDGET_NAME_MAX_LENGTH),
  category: z.nativeEnum(Category),
});

export type SearchBudget = z.infer<typeof searchBudgetSchema>;

export const parseSearchRequestSchema = z.object({
  input: z.string().trim().min(1).max(SEARCH_INPUT_MAX_LENGTH),
  todayMonth: z.string().regex(SEARCH_MONTH_PATTERN),
  budgets: z.array(searchBudgetSchema).max(SEARCH_MAX_BUDGETS).default([]),
});

export type ParseSearchRequest = z.infer<typeof parseSearchRequestSchema>;

export const searchFilterSchema = z.object({
  dateFrom: z.string().regex(SEARCH_DATE_PATTERN).optional(),
  dateTo: z.string().regex(SEARCH_DATE_PATTERN).optional(),
  categories: z.array(z.nativeEnum(Category)).optional(),
  budgetIds: z.array(z.number().int().positive()).optional(),
  hasBudget: z.boolean().optional(),
  amountMin: z.number().int().nonnegative().optional(),
  amountMax: z.number().int().nonnegative().optional(),
  q: z.string().trim().min(1).optional(),
});

export type SearchFilter = z.infer<typeof searchFilterSchema>;

export type ParseSearchFallbackReason =
  | "invalid_response"
  | "schema_mismatch"
  | "request_failed"
  | "empty_response";

export type ParseSearchResponse =
  | { status: "success"; originalInput: string; filter: SearchFilter }
  | {
      status: "fallback";
      originalInput: string;
      reason: ParseSearchFallbackReason;
      prefill: { q?: string };
    };

// JSON schema handed to OpenRouter response_format. Validation is enforced by
// searchFilterSchema after parse; this only steers the model.
export const SEARCH_FILTER_JSON_SCHEMA: OpenRouterJsonSchema = {
  name: "expense_search_filter",
  strict: false,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      dateFrom: { type: "string", description: "YYYY-MM-DD inclusive start" },
      dateTo: { type: "string", description: "YYYY-MM-DD inclusive end" },
      categories: {
        type: "array",
        items: { type: "string", enum: Object.values(Category) },
      },
      budgetIds: { type: "array", items: { type: "integer" } },
      hasBudget: { type: "boolean" },
      amountMin: { type: "integer" },
      amountMax: { type: "integer" },
      q: { type: "string" },
    },
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk bunx vitest run src/lib/ai/search-contract.test.ts`
Expected: PASS

- [ ] **Step 5: Format, lint, commit**

```bash
rtk bunx prettier --write src/lib/ai/search-contract.ts src/lib/ai/search-contract.test.ts
rtk bunx eslint src/lib/ai/search-contract.ts src/lib/ai/search-contract.test.ts
git add src/lib/ai/search-contract.ts src/lib/ai/search-contract.test.ts
git commit -m "feat(smart-search): add search filter DSL contract"
```

---

### Task 8: `parseSearchWithOpenRouter` (prompt + engine + guards)

**Files:**
- Create: `src/lib/ai/parse-search.ts`
- Test: `src/lib/ai/parse-search.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from "vitest";

import { Category } from "@/enums";
import { parseSearchWithOpenRouter } from "./parse-search";

const okResponse = (content: unknown) =>
  new Response(
    JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }),
    { status: 200 }
  );

const budgets = [{ id: 7, name: "Coffee", category: Category.FOOD }];

describe("parseSearchWithOpenRouter", () => {
  it("returns a validated filter on success", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      okResponse({ categories: [Category.FOOD], hasBudget: false })
    );
    const result = await parseSearchWithOpenRouter({
      input: "coffee no budget",
      todayMonth: "2026-05",
      budgets,
      apiKey: "k",
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.filter.categories).toEqual([Category.FOOD]);
      expect(result.filter.hasBudget).toBe(false);
    }
  });

  it("drops budgetIds that are not in the provided budget list", async () => {
    const fetchFn = vi.fn().mockResolvedValue(okResponse({ budgetIds: [7, 999] }));
    const result = await parseSearchWithOpenRouter({
      input: "coffee budget",
      todayMonth: "2026-05",
      budgets,
      apiKey: "k",
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.filter.budgetIds).toEqual([7]);
    }
  });

  it("drops hasBudget when budgetIds is present (collision rule)", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      okResponse({ budgetIds: [7], hasBudget: false })
    );
    const result = await parseSearchWithOpenRouter({
      input: "coffee budget without budget",
      todayMonth: "2026-05",
      budgets,
      apiKey: "k",
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.filter.budgetIds).toEqual([7]);
      expect(result.filter.hasBudget).toBeUndefined();
    }
  });

  it("falls back to text search when the request fails", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("network"));
    const result = await parseSearchWithOpenRouter({
      input: "weird query",
      todayMonth: "2026-05",
      budgets,
      apiKey: "k",
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(result.status).toBe("fallback");
    if (result.status === "fallback") {
      expect(result.prefill.q).toBe("weird query");
      expect(result.reason).toBe("request_failed");
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk bunx vitest run src/lib/ai/parse-search.test.ts`
Expected: FAIL — "Cannot find module './parse-search'".

- [ ] **Step 3: Implement the parser**

Create `src/lib/ai/parse-search.ts`:

```ts
import { callOpenRouterJson } from "./core/openrouter";
import type { OpenRouterJsonFailureReason } from "./core/openrouter";
import {
  SEARCH_FILTER_JSON_SCHEMA,
  searchFilterSchema,
} from "./search-contract";
import type {
  ParseSearchFallbackReason,
  ParseSearchResponse,
  SearchBudget,
  SearchFilter,
} from "./search-contract";

const MODEL = "google/gemma-4-31b-it:free";

const SYSTEM_PROMPT = `
You translate a short natural-language expense search into a JSON filter.

Return ONLY one JSON object with any of these optional fields:
- dateFrom, dateTo: YYYY-MM-DD inclusive bounds. Resolve relative time
  ("this month", "April", "last month", "yesterday", "15-20 May") to a concrete
  range using the provided current month. Omit when no time is mentioned.
- categories: array of allowed category values only.
- budgetIds: array of ids chosen ONLY from the provided budget list. Match a
  noun to a BUDGET by name first (with or without Vietnamese diacritics, and
  common shorthand: cf = coffee, xang = fuel, grab = transport/food). Use a
  category only when no budget matches. Never invent an id.
- hasBudget: true for "has budget", false for "without budget" / "no budget".
  Do NOT set hasBudget if you set budgetIds.
- amountMin, amountMax: whole VND. Expand shorthand: "50k" = 50000, "1.2tr" = 1200000.
- q: leftover free text that no other field captured. Do not duplicate text
  already represented by another field.

Omit any field you are unsure about. Return {} if nothing is clear.
`.trim();

const buildUserContent = (
  input: string,
  budgets: SearchBudget[],
  todayMonth: string
) => {
  const budgetLines = budgets.length
    ? budgets
        .map((budget) => `- id ${budget.id}: ${budget.name} (category: ${budget.category})`)
        .join("\n")
    : "(no budgets available)";
  return `Current month is ${todayMonth}.\n\nQuery: ${input}\n\nBudgets:\n${budgetLines}`;
};

const mapFailureReason = (
  reason: OpenRouterJsonFailureReason
): ParseSearchFallbackReason =>
  reason === "request_failed"
    ? "request_failed"
    : reason === "schema_mismatch"
      ? "schema_mismatch"
      : "invalid_response";

const normalizeFilter = (
  filter: SearchFilter,
  budgets: SearchBudget[]
): SearchFilter => {
  const allowedIds = new Set(budgets.map((budget) => budget.id));
  const budgetIds = filter.budgetIds?.filter((id) => allowedIds.has(id));
  const normalized: SearchFilter = { ...filter };

  if (budgetIds && budgetIds.length > 0) {
    normalized.budgetIds = budgetIds;
    delete normalized.hasBudget; // collision rule: budgetIds wins
  } else {
    delete normalized.budgetIds;
  }
  return normalized;
};

type ParseSearchArgs = {
  input: string;
  todayMonth: string;
  budgets: SearchBudget[];
  apiKey: string;
  fetchFn?: typeof fetch;
};

export const parseSearchWithOpenRouter = async ({
  input,
  todayMonth,
  budgets,
  apiKey,
  fetchFn,
}: ParseSearchArgs): Promise<ParseSearchResponse> => {
  const result = await callOpenRouterJson({
    apiKey,
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserContent(input, budgets, todayMonth) },
    ],
    jsonSchema: SEARCH_FILTER_JSON_SCHEMA,
    schema: searchFilterSchema,
    fetchFn,
  });

  if (!result.ok) {
    return {
      status: "fallback",
      originalInput: input,
      reason: mapFailureReason(result.reason),
      prefill: { q: input },
    };
  }

  return {
    status: "success",
    originalInput: input,
    filter: normalizeFilter(result.value, budgets),
  };
};
```

> `callOpenRouterJson`'s `fetchFn` defaults to `fetch` when undefined, so passing `fetchFn` straight through is fine.

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk bunx vitest run src/lib/ai/parse-search.test.ts`
Expected: PASS (4 tests green)

- [ ] **Step 5: Format, lint, commit**

```bash
rtk bunx prettier --write src/lib/ai/parse-search.ts src/lib/ai/parse-search.test.ts
rtk bunx eslint src/lib/ai/parse-search.ts src/lib/ai/parse-search.test.ts
git add src/lib/ai/parse-search.ts src/lib/ai/parse-search.test.ts
git commit -m "feat(smart-search): add parseSearchWithOpenRouter with id guard and collision rule"
```

---

### Task 9: The `/api/ai/parse-search` route

**Files:**
- Create: `src/app/api/ai/parse-search/route.ts`
- Test: `src/app/api/ai/parse-search/route.test.ts`

- [ ] **Step 1: Write the failing test**

Mirror `src/app/api/ai/parse-expense/route.test.ts`. Mock `parseSearchWithOpenRouter`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/parse-search", () => ({
  parseSearchWithOpenRouter: vi.fn(),
}));

import { parseSearchWithOpenRouter } from "@/lib/ai/parse-search";
import { POST } from "./route";

const callRoute = (body: unknown) =>
  POST(new Request("http://test/api/ai/parse-search", {
    method: "POST",
    body: JSON.stringify(body),
  }));

describe("POST /api/ai/parse-search", () => {
  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = "test-key";
  });
  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.OPENROUTER_API_KEY;
  });

  it("returns the parsed filter on success", async () => {
    vi.mocked(parseSearchWithOpenRouter).mockResolvedValue({
      status: "success",
      originalInput: "coffee no budget",
      filter: { hasBudget: false },
    });
    const response = await callRoute({ input: "coffee no budget", todayMonth: "2026-05" });
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.status).toBe("success");
    expect(json.data.filter.hasBudget).toBe(false);
  });

  it("rejects an invalid payload with 400", async () => {
    const response = await callRoute({ todayMonth: "2026-05" });
    expect(response.status).toBe(400);
  });

  it("returns 500 when the API key is missing", async () => {
    delete process.env.OPENROUTER_API_KEY;
    const response = await callRoute({ input: "x", todayMonth: "2026-05" });
    expect(response.status).toBe(500);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk bunx vitest run src/app/api/ai/parse-search/route.test.ts`
Expected: FAIL — "Cannot find module './route'".

- [ ] **Step 3: Implement the route**

Create `src/app/api/ai/parse-search/route.ts`:

```ts
import { parseSearchWithOpenRouter } from "@/lib/ai/parse-search";
import { parseSearchRequestSchema } from "@/lib/ai/search-contract";
import { apiError, apiSuccess } from "@/lib/api/route-response";

const invalidPayloadResponse = () =>
  apiError("INVALID_PAYLOAD", "Invalid payload", 400);

export const POST = async (request: Request) => {
  try {
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return invalidPayloadResponse();
    }

    const parsedRequest = parseSearchRequestSchema.safeParse(payload);
    if (!parsedRequest.success) {
      return invalidPayloadResponse();
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return apiError("PARSE_SEARCH_FAILED", "Missing OPENROUTER_API_KEY", 500);
    }

    const result = await parseSearchWithOpenRouter({
      input: parsedRequest.data.input,
      todayMonth: parsedRequest.data.todayMonth,
      budgets: parsedRequest.data.budgets,
      apiKey,
    });

    return apiSuccess(result);
  } catch (error) {
    console.error("Failed to parse search with OpenRouter:", error);
    return apiError("PARSE_SEARCH_FAILED", "Failed to parse search", 500);
  }
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk bunx vitest run src/app/api/ai/parse-search/route.test.ts`
Expected: PASS

- [ ] **Step 5: Format, lint, commit**

```bash
rtk bunx prettier --write src/app/api/ai/parse-search/route.ts src/app/api/ai/parse-search/route.test.ts
rtk bunx eslint src/app/api/ai/parse-search/route.ts src/app/api/ai/parse-search/route.test.ts
git add src/app/api/ai/parse-search/route.ts src/app/api/ai/parse-search/route.test.ts
git commit -m "feat(smart-search): add /api/ai/parse-search route"
```

---

### Task 10: Browser fetcher `parseSearchRequest`

**Files:**
- Create: `src/lib/queries/parse-search.ts`
- Test: `src/lib/queries/parse-search.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from "vitest";

import { parseSearchRequest } from "./parse-search";

describe("parseSearchRequest", () => {
  it("POSTs to /api/ai/parse-search and unwraps the response", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: { status: "success", originalInput: "x", filter: { hasBudget: false } },
        }),
        { status: 200 }
      )
    );

    const result = await parseSearchRequest({
      input: "coffee no budget",
      todayMonth: "2026-05",
      budgets: [],
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/ai/parse-search",
      expect.objectContaining({ method: "POST" })
    );
    expect(result.status).toBe("success");
    fetchSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk bunx vitest run src/lib/queries/parse-search.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the fetcher**

Create `src/lib/queries/parse-search.ts`:

```ts
import type { ParseSearchResponse, SearchBudget } from "@/lib/ai/search-contract";

import { fetchJson } from "./http";

type ParseSearchInput = {
  input: string;
  todayMonth: string;
  budgets: SearchBudget[];
};

export const parseSearchRequest = (
  body: ParseSearchInput
): Promise<ParseSearchResponse> =>
  fetchJson<ParseSearchResponse>("/api/ai/parse-search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk bunx vitest run src/lib/queries/parse-search.test.ts`
Expected: PASS

- [ ] **Step 5: Format, lint, commit**

```bash
rtk bunx prettier --write src/lib/queries/parse-search.ts src/lib/queries/parse-search.test.ts
rtk bunx eslint src/lib/queries/parse-search.ts src/lib/queries/parse-search.test.ts
git add src/lib/queries/parse-search.ts src/lib/queries/parse-search.test.ts
git commit -m "feat(smart-search): add parseSearchRequest browser fetcher"
```

---

## Phase C — UI

### Task 11: Forward the new filter props through `ExpenseList`

**Files:**
- Modify: `src/components/ExpenseList.tsx`
- Test: `src/components/ExpenseList.filter-props.test.tsx`

- [ ] **Step 1: Write the failing test**

Seed the local-row query path is heavy; instead assert the params object the component builds is forwarded into the query key. The simplest behavioral check: render with filter props inside a real `QueryClientProvider` and assert the query cache contains a key carrying those filters.

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Category } from "@/enums";
import ExpenseList from "./ExpenseList";

describe("ExpenseList filter props", () => {
  it("includes filter props in the query key", () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ExpenseList categories={[Category.FOOD]} hasBudget={false} />
      </QueryClientProvider>
    );
    const keys = queryClient
      .getQueryCache()
      .getAll()
      .map((entry) => JSON.stringify(entry.queryKey));
    expect(keys.some((key) => key.includes("\"hasBudget\":false"))).toBe(true);
    expect(keys.some((key) => key.includes("Food"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk bunx vitest run src/components/ExpenseList.filter-props.test.tsx`
Expected: FAIL — `ExpenseList` has no `categories`/`hasBudget` props; key lacks them.

- [ ] **Step 3: Extend the component props and params**

In `src/components/ExpenseList.tsx`, add the import:

```ts
import { Category } from "@/enums";
```

Extend `ExpenseListProps`:

```ts
type ExpenseListProps = {
  selectedMonth?: string;
  searchQuery?: string;
  mode?: "full" | "recent";
  recentDays?: number;
  pageSize?: number;
  dateFrom?: string;
  dateTo?: string;
  categories?: Category[];
  budgetIds?: number[];
  hasBudget?: boolean;
  amountMin?: number;
  amountMax?: number;
};
```

Destructure them in the component signature and add them to the `params` object:

```ts
  const params: ExpenseListQueryParams = {
    month: selectedMonth,
    q: searchQuery,
    mode,
    recentDays,
    limit: pageSize,
    dateFrom,
    dateTo,
    categories,
    budgetIds,
    hasBudget,
    amountMin,
    amountMax,
  };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk bunx vitest run src/components/ExpenseList.filter-props.test.tsx`
Expected: PASS

- [ ] **Step 5: Format, lint, commit**

```bash
rtk bunx prettier --write src/components/ExpenseList.tsx src/components/ExpenseList.filter-props.test.tsx
rtk bunx eslint src/components/ExpenseList.tsx src/components/ExpenseList.filter-props.test.tsx
git add src/components/ExpenseList.tsx src/components/ExpenseList.filter-props.test.tsx
git commit -m "feat(smart-search): forward filter props through ExpenseList"
```

---

### Task 12: `SearchFilterChips` — render & remove active filter chips

**Files:**
- Create: `src/components/search/SearchFilterChips.tsx`
- Create: `src/components/search/filter-chips.ts` (pure chip-model builder)
- Test: `src/components/search/filter-chips.test.ts`
- Test: `src/components/search/SearchFilterChips.test.tsx`

- [ ] **Step 1: Write the failing test for the chip model**

`src/components/search/filter-chips.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { Category } from "@/enums";
import { buildFilterChips } from "./filter-chips";

describe("buildFilterChips", () => {
  it("creates a labelled chip per active field", () => {
    const chips = buildFilterChips({
      dateFrom: "2026-05-01",
      dateTo: "2026-05-31",
      categories: [Category.FOOD, Category.ENTERTAINMENT],
      hasBudget: false,
      amountMin: 50000,
    });
    const fields = chips.map((chip) => chip.field);
    expect(fields).toContain("dateRange");
    expect(fields).toContain("categories");
    expect(fields).toContain("hasBudget");
    expect(fields).toContain("amountMin");
    const hasBudgetChip = chips.find((chip) => chip.field === "hasBudget");
    expect(hasBudgetChip?.label.toLowerCase()).toContain("no budget");
  });

  it("returns no chips for an empty filter", () => {
    expect(buildFilterChips({})).toHaveLength(0);
  });

  it("labels a raw-text fallback chip", () => {
    const chips = buildFilterChips({ q: "weird query" });
    expect(chips[0].field).toBe("q");
    expect(chips[0].label).toContain("weird query");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk bunx vitest run src/components/search/filter-chips.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the chip model**

Create `src/components/search/filter-chips.ts`:

```ts
import type { SearchFilter } from "@/lib/ai/search-contract";
import { formatVnd } from "@/lib/utils";

export type FilterChipField =
  | "dateRange"
  | "categories"
  | "budgetIds"
  | "hasBudget"
  | "amountMin"
  | "amountMax"
  | "q";

export type FilterChip = {
  field: FilterChipField;
  label: string;
};

export const buildFilterChips = (filter: SearchFilter): FilterChip[] => {
  const chips: FilterChip[] = [];

  if (filter.dateFrom || filter.dateTo) {
    const from = filter.dateFrom ?? "…";
    const to = filter.dateTo ?? "…";
    chips.push({ field: "dateRange", label: `${from} → ${to}` });
  }
  if (filter.categories && filter.categories.length > 0) {
    chips.push({ field: "categories", label: filter.categories.join(", ") });
  }
  if (filter.budgetIds && filter.budgetIds.length > 0) {
    chips.push({
      field: "budgetIds",
      label: `${filter.budgetIds.length} budget${filter.budgetIds.length > 1 ? "s" : ""}`,
    });
  }
  if (filter.hasBudget === true) {
    chips.push({ field: "hasBudget", label: "Has budget" });
  }
  if (filter.hasBudget === false) {
    chips.push({ field: "hasBudget", label: "No budget" });
  }
  if (filter.amountMin !== undefined) {
    chips.push({ field: "amountMin", label: `≥ ${formatVnd(filter.amountMin)}` });
  }
  if (filter.amountMax !== undefined) {
    chips.push({ field: "amountMax", label: `≤ ${formatVnd(filter.amountMax)}` });
  }
  if (filter.q) {
    chips.push({ field: "q", label: `text: ${filter.q}` });
  }
  return chips;
};

export const removeFilterField = (
  filter: SearchFilter,
  field: FilterChipField
): SearchFilter => {
  const next: SearchFilter = { ...filter };
  if (field === "dateRange") {
    delete next.dateFrom;
    delete next.dateTo;
    return next;
  }
  delete next[field];
  return next;
};
```

> Verify `formatVnd` is exported from `src/lib/utils` (it is used by `ExpenseList.tsx`). If its signature differs, adjust the call.

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk bunx vitest run src/components/search/filter-chips.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing component test**

`src/components/search/SearchFilterChips.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Category } from "@/enums";
import SearchFilterChips from "./SearchFilterChips";

describe("SearchFilterChips", () => {
  it("renders a chip per active field and removes on click", () => {
    const onRemove = vi.fn();
    render(
      <SearchFilterChips
        filter={{ categories: [Category.FOOD], hasBudget: false }}
        onRemove={onRemove}
      />
    );
    expect(screen.getByText("No budget")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /remove No budget/i }));
    expect(onRemove).toHaveBeenCalledWith("hasBudget");
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `rtk bunx vitest run src/components/search/SearchFilterChips.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 7: Implement the component**

Create `src/components/search/SearchFilterChips.tsx`:

```tsx
"use client";

import type { SearchFilter } from "@/lib/ai/search-contract";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

import type { FilterChipField } from "./filter-chips";
import { buildFilterChips } from "./filter-chips";

type SearchFilterChipsProps = {
  filter: SearchFilter;
  onRemove: (field: FilterChipField) => void;
  className?: string;
};

const SearchFilterChips = ({ filter, onRemove, className }: SearchFilterChipsProps) => {
  const chips = buildFilterChips(filter);
  if (chips.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {chips.map((chip) => (
        <span
          key={chip.field}
          className="bg-card text-foreground border-border inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium"
        >
          {chip.label}
          <button
            type="button"
            aria-label={`remove ${chip.label}`}
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => onRemove(chip.field)}
            className="text-muted-foreground hover:text-foreground transition"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  );
};

export default SearchFilterChips;
```

> The `onPointerDown` preventDefault follows `.agents/rules/ios-input-focus.md` so removing a chip does not blur/dismiss the search input on iOS.

- [ ] **Step 8: Run test to verify it passes**

Run: `rtk bunx vitest run src/components/search/SearchFilterChips.test.tsx`
Expected: PASS

- [ ] **Step 9: Format, lint, commit**

```bash
rtk bunx prettier --write src/components/search/filter-chips.ts src/components/search/filter-chips.test.ts src/components/search/SearchFilterChips.tsx src/components/search/SearchFilterChips.test.tsx
rtk bunx eslint src/components/search/filter-chips.ts src/components/search/filter-chips.test.ts src/components/search/SearchFilterChips.tsx src/components/search/SearchFilterChips.test.tsx
git add src/components/search/
git commit -m "feat(smart-search): add filter chip model and SearchFilterChips"
```

---

### Task 13: `SearchInput` — text field, submit, offline-disabled, loading

**Files:**
- Create: `src/components/search/SearchInput.tsx`
- Test: `src/components/search/SearchInput.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SearchInput from "./SearchInput";

describe("SearchInput", () => {
  it("submits the typed query", () => {
    const onSubmit = vi.fn();
    render(<SearchInput onSubmit={onSubmit} isLoading={false} disabled={false} />);
    const input = screen.getByPlaceholderText(/search expenses/i);
    fireEvent.change(input, { target: { value: "coffee no budget" } });
    fireEvent.submit(input.closest("form")!);
    expect(onSubmit).toHaveBeenCalledWith("coffee no budget");
  });

  it("does not submit empty input", () => {
    const onSubmit = vi.fn();
    render(<SearchInput onSubmit={onSubmit} isLoading={false} disabled={false} />);
    fireEvent.submit(screen.getByPlaceholderText(/search expenses/i).closest("form")!);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("is disabled and shows a hint when disabled (offline)", () => {
    render(<SearchInput onSubmit={vi.fn()} isLoading={false} disabled />);
    expect(screen.getByPlaceholderText(/needs a connection/i)).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk bunx vitest run src/components/search/SearchInput.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

Create `src/components/search/SearchInput.tsx`:

```tsx
"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import { Loader2, Search } from "lucide-react";

type SearchInputProps = {
  onSubmit: (value: string) => void;
  isLoading: boolean;
  disabled: boolean;
  className?: string;
};

const SearchInput = ({ onSubmit, isLoading, disabled, className }: SearchInputProps) => {
  const [value, setValue] = useState("");

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled || isLoading) {
      return;
    }
    onSubmit(trimmed);
  };

  return (
    <form onSubmit={handleSubmit} className={cn("relative flex items-center", className)}>
      <Search className="text-muted-foreground pointer-events-none absolute left-3 h-4 w-4" />
      <input
        type="search"
        inputMode="search"
        enterKeyHint="search"
        value={value}
        disabled={disabled}
        onChange={(event) => setValue(event.target.value)}
        placeholder={disabled ? "Search needs a connection" : "Search expenses…"}
        className="bg-card border-border focus:border-primary w-full rounded-2xl border py-2.5 pr-10 pl-9 text-sm outline-none transition disabled:opacity-60"
      />
      {isLoading ? (
        <Loader2 className="text-muted-foreground absolute right-3 h-4 w-4 animate-spin" />
      ) : null}
    </form>
  );
};

export default SearchInput;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk bunx vitest run src/components/search/SearchInput.test.tsx`
Expected: PASS

- [ ] **Step 5: Format, lint, commit**

```bash
rtk bunx prettier --write src/components/search/SearchInput.tsx src/components/search/SearchInput.test.tsx
rtk bunx eslint src/components/search/SearchInput.tsx src/components/search/SearchInput.test.tsx
git add src/components/search/SearchInput.tsx src/components/search/SearchInput.test.tsx
git commit -m "feat(smart-search): add SearchInput component"
```

---

### Task 14: `ExpenseSearch` — owns state, wires parse + chips + list + offline

**Files:**
- Create: `src/components/search/ExpenseSearch.tsx`
- Create: `src/hooks/use-online-status.ts`
- Test: `src/hooks/use-online-status.test.ts`
- Test: `src/components/search/ExpenseSearch.test.tsx`

- [ ] **Step 1: Write the failing test for the online hook**

`src/hooks/use-online-status.test.ts`:

```ts
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useOnlineStatus } from "./use-online-status";

describe("useOnlineStatus", () => {
  it("tracks offline/online events", () => {
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);
    act(() => {
      Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
      window.dispatchEvent(new Event("offline"));
    });
    expect(result.current).toBe(false);
    act(() => {
      Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
      window.dispatchEvent(new Event("online"));
    });
    expect(result.current).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk bunx vitest run src/hooks/use-online-status.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the hook**

Create `src/hooks/use-online-status.ts`:

```ts
"use client";

import { useEffect, useState } from "react";

export const useOnlineStatus = (): boolean => {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return online;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk bunx vitest run src/hooks/use-online-status.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing test for `ExpenseSearch`**

`src/components/search/ExpenseSearch.test.tsx` — mock the fetcher and the budgets query, assert that a submitted query produces chips and passes filters to the list. Mock `ExpenseList` to capture props:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Category } from "@/enums";

vi.mock("@/lib/queries/parse-search", () => ({
  parseSearchRequest: vi.fn().mockResolvedValue({
    status: "success",
    originalInput: "coffee no budget",
    filter: { categories: [Category.FOOD], hasBudget: false },
  }),
}));

const listProps = vi.fn();
vi.mock("@/components/ExpenseList", () => ({
  default: (props: unknown) => {
    listProps(props);
    return <div data-testid="expense-list" />;
  },
}));

import ExpenseSearch from "./ExpenseSearch";

const renderWithClient = (ui: React.ReactNode) => {
  const queryClient = new QueryClient();
  // Seed the budgets overview so ExpenseSearch can read the budget list.
  queryClient.setQueryData(["budgets", "overview"], { budgets: [] });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

describe("ExpenseSearch", () => {
  it("parses a query into chips and passes filters to ExpenseList", async () => {
    renderWithClient(<ExpenseSearch />);
    const input = screen.getByPlaceholderText(/search expenses/i);
    fireEvent.change(input, { target: { value: "coffee no budget" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => expect(screen.getByText("No budget")).toBeInTheDocument());
    await waitFor(() =>
      expect(listProps).toHaveBeenCalledWith(
        expect.objectContaining({ hasBudget: false, categories: [Category.FOOD] })
      )
    );
  });
});
```

> Match the real budgets-overview query key. Confirm it by logging `queries.budgets.overview.queryKey` — if it differs from `["budgets","overview"]`, seed with the exact value.

- [ ] **Step 6: Run test to verify it fails**

Run: `rtk bunx vitest run src/components/search/ExpenseSearch.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 7: Implement `ExpenseSearch`**

Create `src/components/search/ExpenseSearch.tsx`:

```tsx
"use client";

import { useState } from "react";

import dayjs from "@/configs/date";
import type { SearchBudget, SearchFilter } from "@/lib/ai/search-contract";
import { queries } from "@/lib/queries";
import { parseSearchRequest } from "@/lib/queries/parse-search";
import { useMutation, useQuery } from "@tanstack/react-query";

import ExpenseList from "@/components/ExpenseList";

import SearchFilterChips from "./SearchFilterChips";
import type { FilterChipField } from "./filter-chips";
import { removeFilterField } from "./filter-chips";
import SearchInput from "./SearchInput";
import { useOnlineStatus } from "@/hooks/use-online-status";

const EMPTY_FILTER: SearchFilter = {};

const ExpenseSearch = () => {
  const online = useOnlineStatus();
  const [filter, setFilter] = useState<SearchFilter>(EMPTY_FILTER);

  const budgetsQuery = useQuery(queries.budgets.overview);
  const budgets: SearchBudget[] = (budgetsQuery.data?.budgets ?? []).map((budget) => ({
    id: budget.id,
    name: budget.name,
    category: budget.category,
  }));

  const parseMutation = useMutation({
    mutationFn: (input: string) =>
      parseSearchRequest({
        input,
        todayMonth: dayjs().format("YYYY-MM"),
        budgets,
      }),
    onSuccess: (response) => {
      setFilter(
        response.status === "success"
          ? response.filter
          : { q: response.prefill.q }
      );
    },
  });

  const handleRemove = (field: FilterChipField) => {
    setFilter((current) => removeFilterField(current, field));
  };

  return (
    <div className="flex flex-col gap-3">
      <SearchInput
        onSubmit={(value) => parseMutation.mutate(value)}
        isLoading={parseMutation.isPending}
        disabled={!online}
      />
      <SearchFilterChips filter={filter} onRemove={handleRemove} />
      <ExpenseList
        dateFrom={filter.dateFrom}
        dateTo={filter.dateTo}
        categories={filter.categories}
        budgetIds={filter.budgetIds}
        hasBudget={filter.hasBudget}
        amountMin={filter.amountMin}
        amountMax={filter.amountMax}
        searchQuery={filter.q}
      />
    </div>
  );
};

export default ExpenseSearch;
```

> `queries.budgets.overview` is an object entry (queryKey `null`), so `useQuery(queries.budgets.overview)` is valid. Confirm `budget.category` is already a `Category` (it is, per `BudgetListItem`).

- [ ] **Step 8: Run test to verify it passes**

Run: `rtk bunx vitest run src/components/search/ExpenseSearch.test.tsx`
Expected: PASS

- [ ] **Step 9: Format, lint, commit**

```bash
rtk bunx prettier --write src/hooks/use-online-status.ts src/hooks/use-online-status.test.ts src/components/search/ExpenseSearch.tsx src/components/search/ExpenseSearch.test.tsx
rtk bunx eslint src/hooks/use-online-status.ts src/hooks/use-online-status.test.ts src/components/search/ExpenseSearch.tsx src/components/search/ExpenseSearch.test.tsx
git add src/hooks/use-online-status.ts src/hooks/use-online-status.test.ts src/components/search/ExpenseSearch.tsx src/components/search/ExpenseSearch.test.tsx
git commit -m "feat(smart-search): add ExpenseSearch wrapper and useOnlineStatus"
```

---

### Task 15: Mount `ExpenseSearch` on the home page

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace the bare `ExpenseList` with `ExpenseSearch`**

In `src/app/page.tsx`, change the import:

```tsx
import ExpenseSearch from "@/components/search/ExpenseSearch";
```

Replace `<ExpenseList />` in the JSX with `<ExpenseSearch />`. Remove the now-unused `import ExpenseList from "@/components/ExpenseList";`. The existing `prefetchInfiniteQuery` for the unfiltered list stays — it seeds the default (empty-filter) view.

- [ ] **Step 2: Verify the home page renders in the dev server**

Run: `rtk bunx next lint --file src/app/page.tsx` (or rely on the eslint step). Then manually: `bun run dev`, open the home page, confirm the search bar renders above the list and the list still loads.

- [ ] **Step 3: Format, lint, commit**

```bash
rtk bunx prettier --write src/app/page.tsx
rtk bunx eslint src/app/page.tsx
git add src/app/page.tsx
git commit -m "feat(smart-search): mount ExpenseSearch on the home page"
```

---

### Task 16: Full suite + build gate before opening a PR

- [ ] **Step 1: Run the full test suite**

Run: `rtk bunx vitest run`
Expected: PASS (all green). Fix any cross-file regressions before continuing.

- [ ] **Step 2: Typecheck**

Run: `rtk bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Production build (the one place `npm run build` is allowed, per `CLAUDE.md`)**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual smoke test (`bun run dev`)**

Verify on an iPhone 13/14 viewport:
- Type `"coffee this month without budget"` → chips appear, list filters.
- Remove a chip → list updates.
- Type gibberish → a single `text: …` chip appears (fallback), list does a plain text search.
- Toggle offline (DevTools) → input shows "Search needs a connection" and is disabled.

- [ ] **Step 5: Push and open the PR**

```bash
git push -u origin dev-smart-search
```
Then open a PR to `main` using the `create-pr` skill or `gh pr create`.

---

## Self-Review Notes (for the implementer)

- **Two filter paths stay in sync:** Task 3 (client local rows) and Task 4 (server Drizzle) must implement identical semantics. The shared `expenseRowMatchesFilters` (Task 2) is the source of truth for the JS side; the Drizzle side mirrors it. If you change one, change both and re-run both tests.
- **`budgetIds` beats `hasBudget`** is enforced in three places: `parseSearchWithOpenRouter.normalizeFilter` (Task 8), `expenseRowMatchesFilters` (Task 2), and the Drizzle `else if` chain (Task 4). All three must agree.
- **Query key (Task 5)** must list every new field, or filtered views collide in cache and show stale rows.
- **Names→ids:** the model only ever emits `budgetIds` chosen from the passed budget list; unknown ids are dropped in Task 8. Budgets are sourced client-side from `queries.budgets.overview` in Task 14.
- **Offline (Task 14)** disables the input entirely; there is no offline text-search path by design (spec §7).
