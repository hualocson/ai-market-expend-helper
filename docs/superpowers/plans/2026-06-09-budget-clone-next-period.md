# Budget Clone Next Period Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first Budgets page action that clones the selected weekly budget list to the next week, or the selected monthly budget list to the next month.

**Architecture:** Add one focused clone service in the existing budget DB module, expose it through a REST mutation route, call it from a TanStack Query mutation hook, and wire the hook into `BudgetWeeklyBudgetsClient`. The clone copies budget definitions only, skips same-name conflicts in the target period, and returns created/skipped counts plus target period metadata so the client can switch views after success.

**Tech Stack:** Next.js App Router route handlers, Drizzle ORM, Zod validation, TanStack Query mutation hooks, React 19, Vitest, Testing Library, Sonner toasts, Dayjs.

---

## File Structure

- Modify `src/types/budget-weekly.ts`
  - Owns public budget-related TypeScript types shared by DB, routes, mutation hooks, and components.
  - Add `BudgetClonePeriod`, `BudgetCloneNextPeriodInput`, and `BudgetCloneNextPeriodResult`.

- Modify `src/lib/api/route-schemas.ts`
  - Owns route-level runtime validation.
  - Add a Zod schema for the clone payload that only accepts `week` or `month` and a strict ISO date.

- Modify `src/db/budget-queries.ts`
  - Owns budget DB reads/writes.
  - Add the clone service and small local date/name helpers near existing budget date normalization logic.

- Modify `src/db/budget-queries.test.ts`
  - Owns DB-level unit tests around budget query/service behavior.
  - Add tests for target date derivation, copied fields, conflict skipping, and no-source success.

- Create `src/app/api/budgets/clone-next-period/route.ts`
  - Owns the REST mutation endpoint for clone operations.

- Modify `src/app/api/mutation-routes.test.ts`
  - Owns route handler tests for mutation endpoints.
  - Add clone route tests with mocked service and response envelope assertions.

- Modify `src/lib/mutations/index.ts`
  - Owns app-owned mutation hooks and centralized query invalidation.
  - Add `useCloneBudgetsToNextPeriodMutation`.

- Modify `src/lib/mutations/index.test.tsx`
  - Owns mutation hook behavior tests.
  - Add endpoint, payload, invalidation, response unwrap, and error propagation coverage.

- Modify `src/components/BudgetWeeklyBudgetsClient.tsx`
  - Owns Budgets page client UI, grouping, drawers, toasts, and local period filters.
  - Add clone action UI and post-success target period switching.

- Modify `src/components/BudgetWeeklyBudgetsClient.test.tsx`
  - Owns lightweight client query tests for the Budgets page.
  - Add user-facing clone action behavior tests.

- Modify `src/components/BudgetWeeklyBudgetsClient.appearance.test.tsx` only if the existing stronger component mock setup is easier to extend for clone action UI assertions.

---

### Task 1: Shared Types And Route Schema

**Files:**
- Modify: `src/types/budget-weekly.ts`
- Modify: `src/lib/api/route-schemas.ts`
- Test: `src/lib/api/route-schemas.test.ts`

- [ ] **Step 1: Add route schema tests first**

Append these tests to `src/lib/api/route-schemas.test.ts`:

```ts
import { budgetCloneNextPeriodPayloadSchema } from "./route-schemas";

describe("budgetCloneNextPeriodPayloadSchema", () => {
  it("accepts weekly and monthly clone payloads", () => {
    expect(
      budgetCloneNextPeriodPayloadSchema.parse({
        period: "week",
        sourceStartDate: "2026-06-07",
      })
    ).toEqual({
      period: "week",
      sourceStartDate: "2026-06-07",
    });

    expect(
      budgetCloneNextPeriodPayloadSchema.parse({
        period: "month",
        sourceStartDate: "2026-06-01",
      })
    ).toEqual({
      period: "month",
      sourceStartDate: "2026-06-01",
    });
  });

  it("rejects custom periods and malformed dates", () => {
    expect(() =>
      budgetCloneNextPeriodPayloadSchema.parse({
        period: "custom",
        sourceStartDate: "2026-06-07",
      })
    ).toThrow();

    expect(() =>
      budgetCloneNextPeriodPayloadSchema.parse({
        period: "week",
        sourceStartDate: "07/06/2026",
      })
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run schema tests to verify they fail**

Run:

```bash
rtk bunx vitest run src/lib/api/route-schemas.test.ts
```

Expected: fail because `budgetCloneNextPeriodPayloadSchema` is not exported.

- [ ] **Step 3: Add shared clone types**

Add these exports to `src/types/budget-weekly.ts` after `BudgetUpdateInput`:

```ts
export type BudgetClonePeriod = Extract<BudgetPeriod, "week" | "month">;

export type BudgetCloneNextPeriodInput = {
  period: BudgetClonePeriod;
  sourceStartDate: string;
};

export type BudgetCloneNextPeriodResult = {
  period: BudgetClonePeriod;
  sourceStartDate: string;
  sourceEndDate: string;
  targetStartDate: string;
  targetEndDate: string;
  sourceCount: number;
  createdCount: number;
  skippedCount: number;
  createdBudgetIds: number[];
};
```

- [ ] **Step 4: Add clone payload schema**

Modify the type import in `src/lib/api/route-schemas.ts`:

```ts
import type {
  BudgetCloneNextPeriodInput,
  BudgetCreateInput,
  BudgetUpdateInput,
  ExpenseBudgetInput,
} from "@/types/budget-weekly";
```

Add this schema after `budgetCreatePayloadSchema`:

```ts
export const budgetCloneNextPeriodPayloadSchema: z.ZodType<BudgetCloneNextPeriodInput> =
  z.object({
    period: z.enum(["week", "month"]),
    sourceStartDate: isoDateSchema,
  });
```

- [ ] **Step 5: Run schema tests to verify they pass**

Run:

```bash
rtk bunx vitest run src/lib/api/route-schemas.test.ts
```

Expected: pass.

- [ ] **Step 6: Commit Task 1**

```bash
rtk git add src/types/budget-weekly.ts src/lib/api/route-schemas.ts src/lib/api/route-schemas.test.ts
rtk git commit -m "feat: add budget clone payload schema"
```

---

### Task 2: Clone Service

**Files:**
- Modify: `src/db/budget-queries.ts`
- Test: `src/db/budget-queries.test.ts`

- [ ] **Step 1: Add DB service tests first**

Update the import in `src/db/budget-queries.test.ts`:

```ts
import {
  cloneBudgetsToNextPeriod,
  createBudget,
  deleteBudget,
  getWeeklyBudgetReport,
  setExpenseBudget,
  updateBudget,
} from "./budget-queries";
```

Add `insertValues` and `insertReturning` to `dbMocks`:

```ts
const dbMocks = vi.hoisted(() => ({
  deleteReturning: vi.fn(),
  deleteWhere: vi.fn(),
  insertValues: vi.fn(),
  insertReturning: vi.fn(),
  select: vi.fn(),
  updateSet: vi.fn(),
}));
```

Update the mocked `db.insert` to use those insert mocks by default:

```ts
vi.mock("@/db", () => ({
  db: {
    delete: vi.fn(() => ({
      where: dbMocks.deleteWhere,
    })),
    insert: vi.fn(() => ({
      values: dbMocks.insertValues,
    })),
    select: dbMocks.select,
    update: vi.fn(() => ({
      set: dbMocks.updateSet,
    })),
  },
}));
```

Add this helper near `mockSelectRows`:

```ts
const mockSelectResultQueue = (results: unknown[][]) => {
  const queue = [...results];
  dbMocks.select.mockImplementation(() => {
    const rows = queue.shift() ?? [];
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => rows),
      limit: vi.fn(() => rows),
    };

    return chain;
  });
};
```

Add these tests near the `createBudget category` block:

```ts
describe("cloneBudgetsToNextPeriod", () => {
  beforeEach(() => {
    dbMocks.insertReturning.mockResolvedValue([]);
    dbMocks.insertValues.mockReturnValue({ returning: dbMocks.insertReturning });
  });

  it("clones weekly budget definitions to the next Sunday-starting week", async () => {
    mockSelectResultQueue([
      [
        {
          id: 1,
          name: "Coffee",
          icon: "☕",
          color: "lime",
          category: Category.FOOD,
          amount: 200000,
          period: "week",
          periodStartDate: "2026-06-07",
          periodEndDate: "2026-06-13",
        },
      ],
      [],
    ]);
    dbMocks.insertReturning.mockResolvedValue([{ id: 20 }]);

    const result = await cloneBudgetsToNextPeriod({
      period: "week",
      sourceStartDate: "2026-06-09",
    });

    expect(dbMocks.insertValues).toHaveBeenCalledWith([
      expect.objectContaining({
        name: "Coffee",
        icon: "☕",
        color: "lime",
        category: Category.FOOD,
        amount: 200000,
        period: "week",
        periodStartDate: "2026-06-14",
        periodEndDate: "2026-06-20",
      }),
    ]);
    expect(result).toEqual({
      period: "week",
      sourceStartDate: "2026-06-07",
      sourceEndDate: "2026-06-13",
      targetStartDate: "2026-06-14",
      targetEndDate: "2026-06-20",
      sourceCount: 1,
      createdCount: 1,
      skippedCount: 0,
      createdBudgetIds: [20],
    });
  });

  it("clones monthly budget definitions to the next month", async () => {
    mockSelectResultQueue([
      [
        {
          id: 2,
          name: "Rent",
          icon: "🏠",
          color: "sky",
          category: Category.HOME,
          amount: 8000000,
          period: "month",
          periodStartDate: "2026-06-01",
          periodEndDate: "2026-06-30",
        },
      ],
      [],
    ]);
    dbMocks.insertReturning.mockResolvedValue([{ id: 30 }]);

    const result = await cloneBudgetsToNextPeriod({
      period: "month",
      sourceStartDate: "2026-06-18",
    });

    expect(dbMocks.insertValues).toHaveBeenCalledWith([
      expect.objectContaining({
        name: "Rent",
        amount: 8000000,
        period: "month",
        periodStartDate: "2026-07-01",
        periodEndDate: "2026-07-31",
      }),
    ]);
    expect(result.targetStartDate).toBe("2026-07-01");
    expect(result.targetEndDate).toBe("2026-07-31");
  });

  it("skips target budgets with the same normalized name", async () => {
    mockSelectResultQueue([
      [
        {
          id: 1,
          name: " Coffee ",
          icon: "☕",
          color: "lime",
          category: Category.FOOD,
          amount: 200000,
          period: "week",
          periodStartDate: "2026-06-07",
          periodEndDate: "2026-06-13",
        },
      ],
      [{ id: 10, name: "coffee" }],
    ]);

    const result = await cloneBudgetsToNextPeriod({
      period: "week",
      sourceStartDate: "2026-06-07",
    });

    expect(dbMocks.insertValues).not.toHaveBeenCalled();
    expect(result.createdCount).toBe(0);
    expect(result.skippedCount).toBe(1);
  });

  it("returns zero counts when there are no source budgets", async () => {
    mockSelectResultQueue([[], []]);

    const result = await cloneBudgetsToNextPeriod({
      period: "week",
      sourceStartDate: "2026-06-07",
    });

    expect(dbMocks.insertValues).not.toHaveBeenCalled();
    expect(result).toEqual({
      period: "week",
      sourceStartDate: "2026-06-07",
      sourceEndDate: "2026-06-13",
      targetStartDate: "2026-06-14",
      targetEndDate: "2026-06-20",
      sourceCount: 0,
      createdCount: 0,
      skippedCount: 0,
      createdBudgetIds: [],
    });
  });
});
```

- [ ] **Step 2: Run DB tests to verify they fail**

Run:

```bash
rtk bunx vitest run src/db/budget-queries.test.ts
```

Expected: fail because `cloneBudgetsToNextPeriod` is not exported.

- [ ] **Step 3: Add clone service implementation**

Modify imports in `src/db/budget-queries.ts`:

```ts
import {
  BudgetCloneNextPeriodInput,
  BudgetCloneNextPeriodResult,
  BudgetCreateInput,
  BudgetListItem,
  BudgetOverviewReport,
  BudgetPeriod,
  BudgetReport,
  BudgetTransactionsResponse,
  BudgetUpdateInput,
  ExpenseBudgetInput,
} from "@/types/budget-weekly";
```

Add helpers near `normalizeBudgetDates`:

```ts
const normalizeCloneName = (name: string) => name.trim().toLowerCase();

const normalizeClonePeriodBounds = (
  period: BudgetCloneNextPeriodInput["period"],
  sourceStartDate: string
) => {
  const source = normalizeBudgetDates(period, sourceStartDate, null);
  const targetBase =
    period === "week"
      ? dayjs(source.periodStartDate).add(7, "day")
      : dayjs(source.periodStartDate).add(1, "month");
  const target = normalizeBudgetDates(
    period,
    targetBase.format("YYYY-MM-DD"),
    null
  );

  return {
    sourceStartDate: source.periodStartDate,
    sourceEndDate: source.periodEndDate,
    targetStartDate: target.periodStartDate,
    targetEndDate: target.periodEndDate,
  };
};
```

Add the service after `getTransferCandidates` and before `createBudget`:

```ts
export const cloneBudgetsToNextPeriod = async (
  input: BudgetCloneNextPeriodInput
): Promise<BudgetCloneNextPeriodResult> => {
  const bounds = normalizeClonePeriodBounds(input.period, input.sourceStartDate);

  const sourceRows = await db
    .select({
      name: budgets.name,
      icon: budgets.icon,
      color: budgets.color,
      category: budgets.category,
      amount: budgets.amount,
      period: budgets.period,
      periodStartDate: budgets.periodStartDate,
      periodEndDate: budgets.periodEndDate,
    })
    .from(budgets)
    .where(
      and(
        eq(budgets.period, input.period),
        eq(budgets.periodStartDate, bounds.sourceStartDate),
        eq(budgets.periodEndDate, bounds.sourceEndDate)
      )
    )
    .orderBy(asc(budgets.name), asc(budgets.id));

  const targetRows = await db
    .select({
      name: budgets.name,
    })
    .from(budgets)
    .where(
      and(
        eq(budgets.period, input.period),
        eq(budgets.periodStartDate, bounds.targetStartDate),
        eq(budgets.periodEndDate, bounds.targetEndDate)
      )
    )
    .orderBy(asc(budgets.name), asc(budgets.id));

  const targetNames = new Set(
    targetRows.map((budget) => normalizeCloneName(budget.name))
  );
  const cloneValues = sourceRows
    .filter((budget) => !targetNames.has(normalizeCloneName(budget.name)))
    .map((budget) => ({
      name: budget.name.trim(),
      icon: normalizeBudgetIcon(budget.icon),
      color: normalizeBudgetColor(budget.color),
      category: budget.category,
      amount: Number(budget.amount ?? 0),
      period: input.period,
      periodStartDate: bounds.targetStartDate,
      periodEndDate: bounds.targetEndDate,
    }));

  const created = cloneValues.length
    ? await db.insert(budgets).values(cloneValues).returning({ id: budgets.id })
    : [];

  return {
    period: input.period,
    sourceStartDate: bounds.sourceStartDate,
    sourceEndDate: bounds.sourceEndDate,
    targetStartDate: bounds.targetStartDate,
    targetEndDate: bounds.targetEndDate,
    sourceCount: sourceRows.length,
    createdCount: created.length,
    skippedCount: sourceRows.length - cloneValues.length,
    createdBudgetIds: created.map((budget) => Number(budget.id)),
  };
};
```

- [ ] **Step 4: Run DB tests to verify they pass**

Run:

```bash
rtk bunx vitest run src/db/budget-queries.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit Task 2**

```bash
rtk git add src/db/budget-queries.ts src/db/budget-queries.test.ts
rtk git commit -m "feat: clone budgets to next period"
```

---

### Task 3: REST Clone Route

**Files:**
- Create: `src/app/api/budgets/clone-next-period/route.ts`
- Modify: `src/app/api/mutation-routes.test.ts`

- [ ] **Step 1: Add route tests first**

Update imports in `src/app/api/mutation-routes.test.ts`:

```ts
import { POST as postBudgetCloneNextPeriod } from "./budgets/clone-next-period/route";
```

Add `cloneBudgetsToNextPeriod` to the hoisted mocks:

```ts
const mocks = vi.hoisted(() => ({
  cloneBudgetsToNextPeriod: vi.fn(),
  createBudget: vi.fn(),
  createExpense: vi.fn(),
  deleteBudget: vi.fn(),
  getExpenseChangesSince: vi.fn(),
  revalidatePath: vi.fn(),
  pushExpenseOperations: vi.fn(),
  setExpenseBudget: vi.fn(),
  softDeleteExpense: vi.fn(),
  transferBudgetAmount: vi.fn(),
  updateBudget: vi.fn(),
  updateExpense: vi.fn(),
}));
```

Update the `@/db/budget-queries` mock:

```ts
vi.mock("@/db/budget-queries", () => ({
  cloneBudgetsToNextPeriod: mocks.cloneBudgetsToNextPeriod,
  createBudget: mocks.createBudget,
  deleteBudget: mocks.deleteBudget,
  setExpenseBudget: mocks.setExpenseBudget,
  updateBudget: mocks.updateBudget,
}));
```

Add tests inside `describe("REST mutation routes", () => { ... })` near the existing budget route tests:

```ts
  it("clones budgets to the next period with a validated payload", async () => {
    const payload = {
      period: "week",
      sourceStartDate: "2026-06-07",
    };
    const result = {
      period: "week",
      sourceStartDate: "2026-06-07",
      sourceEndDate: "2026-06-13",
      targetStartDate: "2026-06-14",
      targetEndDate: "2026-06-20",
      sourceCount: 2,
      createdCount: 2,
      skippedCount: 0,
      createdBudgetIds: [20, 21],
    };
    mocks.cloneBudgetsToNextPeriod.mockResolvedValue(result);

    const response = await postBudgetCloneNextPeriod(
      jsonRequest("http://localhost/api/budgets/clone-next-period", payload)
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: result,
    });
    expect(mocks.cloneBudgetsToNextPeriod).toHaveBeenCalledWith(payload);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/budgets");
  });

  it("returns 200 when clone succeeds without creating rows", async () => {
    const result = {
      period: "month",
      sourceStartDate: "2026-06-01",
      sourceEndDate: "2026-06-30",
      targetStartDate: "2026-07-01",
      targetEndDate: "2026-07-31",
      sourceCount: 1,
      createdCount: 0,
      skippedCount: 1,
      createdBudgetIds: [],
    };
    mocks.cloneBudgetsToNextPeriod.mockResolvedValue(result);

    const response = await postBudgetCloneNextPeriod(
      jsonRequest("http://localhost/api/budgets/clone-next-period", {
        period: "month",
        sourceStartDate: "2026-06-01",
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: result,
    });
  });

  it("returns 400 for an invalid clone payload", async () => {
    const response = await postBudgetCloneNextPeriod(
      jsonRequest("http://localhost/api/budgets/clone-next-period", {
        period: "custom",
        sourceStartDate: "2026-06-07",
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: "INVALID_PAYLOAD",
        message: "Invalid payload",
      },
    });
    expect(mocks.cloneBudgetsToNextPeriod).not.toHaveBeenCalled();
  });

  it("returns 500 when budget clone fails unexpectedly", async () => {
    mocks.cloneBudgetsToNextPeriod.mockRejectedValue(new Error("db failed"));

    const response = await postBudgetCloneNextPeriod(
      jsonRequest("http://localhost/api/budgets/clone-next-period", {
        period: "week",
        sourceStartDate: "2026-06-07",
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: "CLONE_BUDGETS_FAILED",
        message: "Failed to clone budgets",
      },
    });
  });
```

- [ ] **Step 2: Run route tests to verify they fail**

Run:

```bash
rtk bunx vitest run src/app/api/mutation-routes.test.ts
```

Expected: fail because `src/app/api/budgets/clone-next-period/route.ts` does not exist.

- [ ] **Step 3: Create the route**

Create `src/app/api/budgets/clone-next-period/route.ts`:

```ts
import { revalidatePath } from "next/cache";

import { cloneBudgetsToNextPeriod } from "@/db/budget-queries";
import { apiError, apiSuccess } from "@/lib/api/route-response";
import {
  budgetCloneNextPeriodPayloadSchema,
  parseJsonPayload,
} from "@/lib/api/route-schemas";

export const POST = async (request: Request) => {
  try {
    const payload = await parseJsonPayload(
      request,
      budgetCloneNextPeriodPayloadSchema
    );
    if ("error" in payload) {
      return apiError("INVALID_PAYLOAD", payload.error, 400);
    }

    const result = await cloneBudgetsToNextPeriod(payload.value);
    revalidatePath("/budgets");

    return apiSuccess(result, { status: result.createdCount > 0 ? 201 : 200 });
  } catch (error) {
    console.error("Failed to clone budgets:", error);
    return apiError(
      "CLONE_BUDGETS_FAILED",
      "Failed to clone budgets",
      500
    );
  }
};
```

- [ ] **Step 4: Run route tests to verify they pass**

Run:

```bash
rtk bunx vitest run src/app/api/mutation-routes.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit Task 3**

```bash
rtk git add src/app/api/budgets/clone-next-period/route.ts src/app/api/mutation-routes.test.ts
rtk git commit -m "feat: add budget clone route"
```

---

### Task 4: Mutation Hook

**Files:**
- Modify: `src/lib/mutations/index.ts`
- Modify: `src/lib/mutations/index.test.tsx`

- [ ] **Step 1: Add mutation hook tests first**

Update the import in `src/lib/mutations/index.test.tsx`:

```ts
import {
  useAssignTransactionBudgetMutation,
  useCloneBudgetsToNextPeriodMutation,
  useCreateBudgetMutation,
  useCreateExpenseMutation,
  useDeleteBudgetMutation,
  useDeleteExpenseMutation,
  useSuggestBudgetMutation,
  useTransferBudgetMutation,
  useUpdateBudgetMutation,
  useUpdateExpenseMutation,
} from "@/lib/mutations";
```

Add this test near the existing create budget mutation test:

```ts
  it("clones budgets through the clone route and invalidates budget query roots", async () => {
    const responsePayload = {
      period: "week" as const,
      sourceStartDate: "2026-06-07",
      sourceEndDate: "2026-06-13",
      targetStartDate: "2026-06-14",
      targetEndDate: "2026-06-20",
      sourceCount: 2,
      createdCount: 2,
      skippedCount: 0,
      createdBudgetIds: [20, 21],
    };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse(successEnvelope(responsePayload), { status: 201 }));
    const { result, queryClient } = renderMutationHook(() =>
      useCloneBudgetsToNextPeriodMutation()
    );
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          period: "week",
          sourceStartDate: "2026-06-07",
        })
      ).resolves.toEqual(responsePayload);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/budgets/clone-next-period",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          period: "week",
          sourceStartDate: "2026-06-07",
        }),
      })
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queries.budgets._def,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queries.budgetWeekly._def,
    });
  });

  it("throws the API error message when budget clone fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(
        {
          success: false,
          error: {
            code: "CLONE_BUDGETS_FAILED",
            message: "Failed to clone budgets",
          },
        },
        { status: 500 }
      )
    );
    const { result } = renderMutationHook(() =>
      useCloneBudgetsToNextPeriodMutation()
    );

    await expect(
      result.current.mutateAsync({
        period: "week",
        sourceStartDate: "2026-06-07",
      })
    ).rejects.toThrow("Failed to clone budgets");
  });
```

- [ ] **Step 2: Run mutation tests to verify they fail**

Run:

```bash
rtk bunx vitest run src/lib/mutations/index.test.tsx
```

Expected: fail because `useCloneBudgetsToNextPeriodMutation` is not exported.

- [ ] **Step 3: Add mutation hook implementation**

Update the type import in `src/lib/mutations/index.ts`:

```ts
import type {
  BudgetCloneNextPeriodInput,
  BudgetCloneNextPeriodResult,
  BudgetCreateInput,
  BudgetUpdateInput,
  ExpenseBudgetInput,
} from "@/types/budget-weekly";
```

Add the hook after `useCreateBudgetMutation`:

```ts
export const useCloneBudgetsToNextPeriodMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: BudgetCloneNextPeriodInput) =>
      fetchJsonMutation<
        BudgetCloneNextPeriodResult,
        BudgetCloneNextPeriodInput
      >("/api/budgets/clone-next-period", {
        method: "POST",
        body: input,
        fallbackError: "Failed to clone budgets",
      }),
    onSuccess: () => invalidateBudgetMutationQueries(queryClient),
  });
};
```

- [ ] **Step 4: Run mutation tests to verify they pass**

Run:

```bash
rtk bunx vitest run src/lib/mutations/index.test.tsx
```

Expected: pass.

- [ ] **Step 5: Commit Task 4**

```bash
rtk git add src/lib/mutations/index.ts src/lib/mutations/index.test.tsx
rtk git commit -m "feat: add budget clone mutation hook"
```

---

### Task 5: Budgets Page UI Integration

**Files:**
- Modify: `src/components/BudgetWeeklyBudgetsClient.tsx`
- Modify: `src/components/BudgetWeeklyBudgetsClient.test.tsx`

- [ ] **Step 1: Strengthen component test mocks**

In `src/components/BudgetWeeklyBudgetsClient.test.tsx`, replace the mutation mock block with hoisted mutation mocks:

```ts
const mutationMocks = vi.hoisted(() => ({
  cloneBudgetMutateAsync: vi.fn(),
  createBudgetMutateAsync: vi.fn(),
  deleteBudgetMutateAsync: vi.fn(),
  updateBudgetMutateAsync: vi.fn(),
}));

vi.mock("@/lib/mutations", () => ({
  useCloneBudgetsToNextPeriodMutation: () => ({
    isPending: false,
    mutateAsync: mutationMocks.cloneBudgetMutateAsync,
  }),
  useCreateBudgetMutation: () => ({
    mutateAsync: mutationMocks.createBudgetMutateAsync,
  }),
  useDeleteBudgetMutation: () => ({
    mutateAsync: mutationMocks.deleteBudgetMutateAsync,
  }),
  useUpdateBudgetMutation: () => ({
    mutateAsync: mutationMocks.updateBudgetMutateAsync,
  }),
}));
```

Reset the mutation mocks in `beforeEach`:

```ts
  mutationMocks.cloneBudgetMutateAsync.mockReset();
  mutationMocks.createBudgetMutateAsync.mockReset();
  mutationMocks.deleteBudgetMutateAsync.mockReset();
  mutationMocks.updateBudgetMutateAsync.mockReset();
```

Add a Sonner toast mock:

```ts
const toastMocks = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: toastMocks,
}));
```

Reset toast mocks in `beforeEach`:

```ts
  toastMocks.error.mockReset();
  toastMocks.success.mockReset();
```

- [ ] **Step 2: Add component tests first**

Add a reusable budget fixture in `src/components/BudgetWeeklyBudgetsClient.test.tsx`:

```ts
const overviewWithBudgets = {
  summary: {
    totalBudget: 3_200_000,
    totalSpent: 0,
    totalRemaining: 3_200_000,
    budgetCount: 3,
  },
  budgets: [
    {
      id: 1,
      name: "Coffee",
      icon: "☕",
      color: "lime",
      category: "Food",
      amount: 200_000,
      spent: 0,
      remaining: 200_000,
      period: "week",
      periodStartDate: "2026-06-07",
      periodEndDate: "2026-06-13",
    },
    {
      id: 2,
      name: "Groceries",
      icon: "🛒",
      color: "emerald",
      category: "Food",
      amount: 1_000_000,
      spent: 0,
      remaining: 1_000_000,
      period: "week",
      periodStartDate: "2026-06-07",
      periodEndDate: "2026-06-13",
    },
    {
      id: 3,
      name: "Rent",
      icon: "🏠",
      color: "sky",
      category: "Home",
      amount: 2_000_000,
      spent: 0,
      remaining: 2_000_000,
      period: "month",
      periodStartDate: "2026-06-01",
      periodEndDate: "2026-06-30",
    },
  ],
};
```

Add these tests:

```ts
  it("clones the selected weekly group and switches to the target week", async () => {
    const user = userEvent.setup();
    queryMocks.useSuspenseQuery.mockReturnValue({
      data: overviewWithBudgets,
      error: null,
      isError: false,
      refetch: queryMocks.refetchOverview,
    });
    mutationMocks.cloneBudgetMutateAsync.mockResolvedValue({
      period: "week",
      sourceStartDate: "2026-06-07",
      sourceEndDate: "2026-06-13",
      targetStartDate: "2026-06-14",
      targetEndDate: "2026-06-20",
      sourceCount: 2,
      createdCount: 2,
      skippedCount: 0,
      createdBudgetIds: [10, 11],
    });

    render(<BudgetWeeklyBudgetsClient weekStartDate="2026-06-07" />);

    await user.click(
      screen.getByRole("button", { name: "Clone to next week" })
    );

    expect(mutationMocks.cloneBudgetMutateAsync).toHaveBeenCalledWith({
      period: "week",
      sourceStartDate: "2026-06-07",
    });
    expect(toastMocks.success).toHaveBeenCalledWith(
      "2 budgets cloned to next week."
    );
    expect(screen.getByText("14 Jun - 20 Jun")).toBeInTheDocument();
  });

  it("shows skipped count after weekly clone conflicts", async () => {
    const user = userEvent.setup();
    queryMocks.useSuspenseQuery.mockReturnValue({
      data: overviewWithBudgets,
      error: null,
      isError: false,
      refetch: queryMocks.refetchOverview,
    });
    mutationMocks.cloneBudgetMutateAsync.mockResolvedValue({
      period: "week",
      sourceStartDate: "2026-06-07",
      sourceEndDate: "2026-06-13",
      targetStartDate: "2026-06-14",
      targetEndDate: "2026-06-20",
      sourceCount: 2,
      createdCount: 1,
      skippedCount: 1,
      createdBudgetIds: [10],
    });

    render(<BudgetWeeklyBudgetsClient weekStartDate="2026-06-07" />);
    await user.click(
      screen.getByRole("button", { name: "Clone to next week" })
    );

    expect(toastMocks.success).toHaveBeenCalledWith(
      "1 budget cloned to next week. 1 already existed."
    );
  });

  it("clones a selected monthly group and switches to the target month", async () => {
    const user = userEvent.setup();
    queryMocks.useSuspenseQuery.mockReturnValue({
      data: overviewWithBudgets,
      error: null,
      isError: false,
      refetch: queryMocks.refetchOverview,
    });
    mutationMocks.cloneBudgetMutateAsync.mockResolvedValue({
      period: "month",
      sourceStartDate: "2026-06-01",
      sourceEndDate: "2026-06-30",
      targetStartDate: "2026-07-01",
      targetEndDate: "2026-07-31",
      sourceCount: 1,
      createdCount: 1,
      skippedCount: 0,
      createdBudgetIds: [30],
    });

    render(<BudgetWeeklyBudgetsClient weekStartDate="2026-06-07" />);
    await user.click(screen.getByRole("combobox", { name: "Budget dashboard view" }));
    await user.click(screen.getByRole("option", { name: "Monthly" }));
    await user.click(
      screen.getByRole("button", { name: "Clone to next month" })
    );

    expect(mutationMocks.cloneBudgetMutateAsync).toHaveBeenCalledWith({
      period: "month",
      sourceStartDate: "2026-06-01",
    });
    expect(toastMocks.success).toHaveBeenCalledWith(
      "1 budget cloned to next month."
    );
    expect(screen.getByText("July 2026")).toBeInTheDocument();
  });

  it("does not show clone action on custom tab", async () => {
    const user = userEvent.setup();
    queryMocks.useSuspenseQuery.mockReturnValue({
      data: overviewWithBudgets,
      error: null,
      isError: false,
      refetch: queryMocks.refetchOverview,
    });

    render(<BudgetWeeklyBudgetsClient weekStartDate="2026-06-07" />);
    await user.click(screen.getByRole("combobox", { name: "Budget dashboard view" }));
    await user.click(screen.getByRole("option", { name: "Custom" }));

    expect(
      screen.queryByRole("button", { name: /clone to next/i })
    ).not.toBeInTheDocument();
  });

  it("leaves period unchanged and shows an error toast when clone fails", async () => {
    const user = userEvent.setup();
    queryMocks.useSuspenseQuery.mockReturnValue({
      data: overviewWithBudgets,
      error: null,
      isError: false,
      refetch: queryMocks.refetchOverview,
    });
    mutationMocks.cloneBudgetMutateAsync.mockRejectedValue(
      new Error("Failed to clone budgets")
    );

    render(<BudgetWeeklyBudgetsClient weekStartDate="2026-06-07" />);
    await user.click(
      screen.getByRole("button", { name: "Clone to next week" })
    );

    expect(toastMocks.error).toHaveBeenCalledWith("Failed to clone budgets.");
    expect(screen.getByText("07 Jun - 13 Jun")).toBeInTheDocument();
  });
```

If the local Select test utilities make option clicks difficult in `BudgetWeeklyBudgetsClient.test.tsx`, move the monthly/custom tests into `src/components/BudgetWeeklyBudgetsClient.appearance.test.tsx`, which already has richer mocks for the full component.

- [ ] **Step 3: Run component tests to verify they fail**

Run:

```bash
rtk bunx vitest run src/components/BudgetWeeklyBudgetsClient.test.tsx
```

Expected: fail because the clone action and hook usage are not implemented.

- [ ] **Step 4: Add client imports and helpers**

Modify imports in `src/components/BudgetWeeklyBudgetsClient.tsx`:

```ts
import {
  useCloneBudgetsToNextPeriodMutation,
  useDeleteBudgetMutation,
} from "@/lib/mutations";
import type {
  BudgetAssignedTransaction,
  BudgetCloneNextPeriodResult,
  BudgetListItem,
  BudgetTransactionsResponse,
} from "@/types/budget-weekly";
import {
  ArrowDown,
  CopyPlus,
  Loader2,
  Plus,
  SaveIcon,
  Trash2,
  Wallet,
} from "lucide-react";
```

Add helper functions near `formatWeekPillLabel`:

```ts
const getNextWeekKey = (weekKey: string) =>
  dayjs(weekKey, "YYYY-MM-DD", true).add(7, "day").format("YYYY-MM-DD");

const getNextMonthKey = (monthKey: string) =>
  monthKeyToDate(monthKey).add(1, "month").format("YYYY-MM");

const formatCloneToast = (
  result: BudgetCloneNextPeriodResult,
  targetLabel: "next week" | "next month"
) => {
  if (result.sourceCount === 0) {
    return `No budgets to clone from this ${result.period}.`;
  }

  if (result.createdCount === 0) {
    return `All ${result.sourceCount} budgets already existed ${targetLabel}.`;
  }

  const clonedLabel =
    result.createdCount === 1 ? "1 budget cloned" : `${result.createdCount} budgets cloned`;
  const skippedLabel =
    result.skippedCount > 0
      ? ` ${result.skippedCount} already existed.`
      : "";

  return `${clonedLabel} to ${targetLabel}.${skippedLabel}`;
};
```

- [ ] **Step 5: Track pending clone target options**

Inside the component, after month/week state declarations, add:

```ts
  const [pendingMonthKeys, setPendingMonthKeys] = useState<string[]>([]);
  const [pendingWeekKeys, setPendingWeekKeys] = useState<string[]>([]);
  const cloneBudgetMutation = useCloneBudgetsToNextPeriodMutation();
```

Update `monthKeys` to include `pendingMonthKeys`:

```ts
  const monthKeys = useMemo(() => {
    const keys = new Set<string>();
    budgets.forEach((budget) => {
      if (budget.period === "week" || budget.period === "month") {
        const key = getMonthKey(budget.periodStartDate);
        if (key) {
          keys.add(key);
        }
      }
    });
    pendingMonthKeys.forEach((key) => keys.add(key));
    keys.add(currentMonthKey);
    return Array.from(keys).sort(
      (a, b) => monthKeyToDate(b).valueOf() - monthKeyToDate(a).valueOf()
    );
  }, [budgets, currentMonthKey, pendingMonthKeys]);
```

Update `weeklyGroups` after the existing groups are built:

```ts
  const weeklyGroups = useMemo<WeeklyGroup[]>(() => {
    const grouped = new Map<string, BudgetListItem[]>();
    weeklyBudgets.forEach((budget) => {
      const key = getWeekKey(budget.periodStartDate);
      if (!key) {
        return;
      }
      const list = grouped.get(key) ?? [];
      list.push(budget);
      grouped.set(key, list);
    });

    pendingWeekKeys.forEach((key) => {
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
    });

    return Array.from(grouped.entries())
      .sort(([a], [b]) => dayjs(b).valueOf() - dayjs(a).valueOf())
      .slice(0, WEEKLY_FILTER_LIMIT)
      .map(([key, items]) => {
        const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name));
        return {
          key,
          label: formatWeekLabel(key),
          shortLabel: formatWeekPillLabel(key),
          budgets: sorted,
          summary: summarizeBudgets(sorted),
        };
      });
  }, [pendingWeekKeys, weeklyBudgets]);
```

- [ ] **Step 6: Add clone action handlers**

Add these handlers near `openEdit`:

```ts
  const handleCloneWeekly = async () => {
    if (!activeWeekGroup || cloneBudgetMutation.isPending) {
      return;
    }

    const targetWeekKey = getNextWeekKey(activeWeekGroup.key);

    try {
      const result = await cloneBudgetMutation.mutateAsync({
        period: "week",
        sourceStartDate: activeWeekGroup.key,
      });
      setPendingWeekKeys((keys) =>
        keys.includes(targetWeekKey) ? keys : [...keys, targetWeekKey]
      );
      setActiveTab("week");
      setActiveWeekKey(targetWeekKey);
      toast.success(formatCloneToast(result, "next week"));
    } catch (cloneError) {
      console.error(cloneError);
      toast.error("Failed to clone budgets.");
    }
  };

  const handleCloneMonthly = async () => {
    if (!activeMonthKey || cloneBudgetMutation.isPending) {
      return;
    }

    const targetMonthKey = getNextMonthKey(activeMonthKey);

    try {
      const result = await cloneBudgetMutation.mutateAsync({
        period: "month",
        sourceStartDate: monthKeyToDate(activeMonthKey).format("YYYY-MM-DD"),
      });
      setPendingMonthKeys((keys) =>
        keys.includes(targetMonthKey) ? keys : [...keys, targetMonthKey]
      );
      setActiveTab("month");
      setMonthFilter(targetMonthKey);
      toast.success(formatCloneToast(result, "next month"));
    } catch (cloneError) {
      console.error(cloneError);
      toast.error("Failed to clone budgets.");
    }
  };
```

- [ ] **Step 7: Add clone action UI**

Add this render helper near `renderEmptyState`:

```tsx
  const renderCloneAction = ({
    label,
    onClick,
    disabled,
  }: {
    label: string;
    onClick: () => void;
    disabled: boolean;
  }) => (
    <Button
      type="button"
      variant="secondary"
      onClick={onClick}
      disabled={disabled}
      className="bg-muted/45 hover:bg-muted/65 h-11 w-full rounded-2xl text-sm font-semibold"
    >
      {cloneBudgetMutation.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <CopyPlus className="h-4 w-4" />
      )}
      {label}
    </Button>
  );
```

In the monthly tab branch, render it after the summary and before the list:

```tsx
                {activeMonthKey
                  ? renderCloneAction({
                      label: "Clone to next month",
                      onClick: handleCloneMonthly,
                      disabled:
                        cloneBudgetMutation.isPending ||
                        filteredMonthlyBudgets.length === 0,
                    })
                  : null}
```

In the weekly tab branch, render it after the summary and before the list:

```tsx
                    {activeWeekGroup
                      ? renderCloneAction({
                          label: "Clone to next week",
                          onClick: handleCloneWeekly,
                          disabled:
                            cloneBudgetMutation.isPending ||
                            activeWeekGroup.budgets.length === 0,
                        })
                      : null}
```

- [ ] **Step 8: Run component tests to verify they pass**

Run:

```bash
rtk bunx vitest run src/components/BudgetWeeklyBudgetsClient.test.tsx
```

Expected: pass. If Select interaction tests are moved to the appearance test file, also run:

```bash
rtk bunx vitest run src/components/BudgetWeeklyBudgetsClient.appearance.test.tsx
```

- [ ] **Step 9: Commit Task 5**

```bash
rtk git add src/components/BudgetWeeklyBudgetsClient.tsx src/components/BudgetWeeklyBudgetsClient.test.tsx
rtk git commit -m "feat: add budget clone action"
```

---

### Task 6: Formatting, Lint, And Focused Verification

**Files:**
- Verify every modified `.ts` and `.tsx` file from Tasks 1-5.

- [ ] **Step 1: Format modified TypeScript files**

Run:

```bash
rtk bunx prettier --write \
  src/types/budget-weekly.ts \
  src/lib/api/route-schemas.ts \
  src/lib/api/route-schemas.test.ts \
  src/db/budget-queries.ts \
  src/db/budget-queries.test.ts \
  src/app/api/budgets/clone-next-period/route.ts \
  src/app/api/mutation-routes.test.ts \
  src/lib/mutations/index.ts \
  src/lib/mutations/index.test.tsx \
  src/components/BudgetWeeklyBudgetsClient.tsx \
  src/components/BudgetWeeklyBudgetsClient.test.tsx
```

Expected: Prettier writes or confirms all listed files.

- [ ] **Step 2: Check formatting**

Run:

```bash
rtk bunx prettier --check \
  src/types/budget-weekly.ts \
  src/lib/api/route-schemas.ts \
  src/lib/api/route-schemas.test.ts \
  src/db/budget-queries.ts \
  src/db/budget-queries.test.ts \
  src/app/api/budgets/clone-next-period/route.ts \
  src/app/api/mutation-routes.test.ts \
  src/lib/mutations/index.ts \
  src/lib/mutations/index.test.tsx \
  src/components/BudgetWeeklyBudgetsClient.tsx \
  src/components/BudgetWeeklyBudgetsClient.test.tsx
```

Expected: pass.

- [ ] **Step 3: Run ESLint for modified TypeScript files**

Run:

```bash
rtk bunx eslint \
  src/types/budget-weekly.ts \
  src/lib/api/route-schemas.ts \
  src/lib/api/route-schemas.test.ts \
  src/db/budget-queries.ts \
  src/db/budget-queries.test.ts \
  src/app/api/budgets/clone-next-period/route.ts \
  src/app/api/mutation-routes.test.ts \
  src/lib/mutations/index.ts \
  src/lib/mutations/index.test.tsx \
  src/components/BudgetWeeklyBudgetsClient.tsx \
  src/components/BudgetWeeklyBudgetsClient.test.tsx
```

Expected: pass.

- [ ] **Step 4: Run focused tests together**

Run:

```bash
rtk bunx vitest run \
  src/lib/api/route-schemas.test.ts \
  src/db/budget-queries.test.ts \
  src/app/api/mutation-routes.test.ts \
  src/lib/mutations/index.test.tsx \
  src/components/BudgetWeeklyBudgetsClient.test.tsx
```

Expected: pass.

- [ ] **Step 5: Commit formatting or test adjustments**

If formatting or test adjustments changed files, commit them:

```bash
rtk git add \
  src/types/budget-weekly.ts \
  src/lib/api/route-schemas.ts \
  src/lib/api/route-schemas.test.ts \
  src/db/budget-queries.ts \
  src/db/budget-queries.test.ts \
  src/app/api/budgets/clone-next-period/route.ts \
  src/app/api/mutation-routes.test.ts \
  src/lib/mutations/index.ts \
  src/lib/mutations/index.test.tsx \
  src/components/BudgetWeeklyBudgetsClient.tsx \
  src/components/BudgetWeeklyBudgetsClient.test.tsx
rtk git commit -m "test: verify budget clone flow"
```

If there were no changes after verification, skip the commit.

---

## Self-Review

Spec coverage:

- Period-level Weekly/Monthly clone action: Task 5.
- Custom budgets out of scope: Task 5 hides action on Custom.
- Immediate next week/month: Task 2 service and Task 5 target switching.
- Copy definitions only: Task 2 service.
- Skip same-name conflicts: Task 2 service.
- REST route and Zod validation: Tasks 1 and 3.
- TanStack mutation hook and invalidation: Task 4.
- Success/error toasts and unchanged period on failure: Task 5.
- Targeted checks and project formatter/lint rules: Task 6.

Placeholder scan:

- No deferred requirements are left for implementers.
- Every code-changing task includes concrete snippets and exact commands.

Type consistency:

- `BudgetCloneNextPeriodInput`, `BudgetCloneNextPeriodResult`, and `BudgetClonePeriod` are defined in Task 1 and reused consistently in Tasks 2-5.
- Route status behavior matches the design spec: `201` for created rows, `200` for successful zero-create clone, `400` invalid payload, `500` `CLONE_BUDGETS_FAILED`.
