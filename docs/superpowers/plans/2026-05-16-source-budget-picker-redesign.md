# Source Budget Picker Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the nested source-budget picker inside `BudgetTransferDrawer` with a mobile-first layout (sticky destination header, period-instance grouping, right-side cluster rows) and switch the candidate list to a lazy server-fetched query so the drawer no longer relies on the parent's full budget overview.

**Architecture:** A new `getTransferCandidates` server action backs a TanStack `useQuery` inside the drawer (enabled when open). A pure `groupTransferCandidates` helper bucket-sorts candidates into period-instance groups (this-week / last-week / this-month / last-month / earlier). The nested drawer body is rebuilt around that grouping with a sticky destination card, redesigned row visuals matching the recent transaction-picker style, and full skeleton / empty / error / all-disabled states. The outer drawer (header, amount input, after-transfer preview, footer button, error handling) is unchanged.

**Tech Stack:** Next.js 15 App Router, React 19, Drizzle ORM, TanStack Query, Vitest, Tailwind v4, shadcn/ui, vaul drawer, dayjs (`@/configs/date`).

**Project conventions to honor:**
- `.agents/rules/nextjs-code.md` — server-default; client only at leaves; server actions over route handlers; Zod-validate action input; `revalidatePath` after writes; `cn()` for class composition.
- `CLAUDE.md` — **do not** run `npm run build` per change. Use targeted `tsc --noEmit`, `vitest run <pattern>`, `eslint <files>`.

**Spec:** `docs/superpowers/specs/2026-05-16-source-budget-picker-redesign-design.md`

---

## Task 1: Add `getTransferCandidates` DB query

**Files:**
- Modify: `src/db/budget-queries.ts` (append after `getBudgetOverview` near line 290)

The picker needs a dedicated DB query that returns only candidates (excluding the destination, excluding budgets with `amount === 0`), with `spent` joined the same way `getBudgetOverview` does. We will return rows in the shape of `BudgetListItem`.

- [ ] **Step 1: Read existing `getBudgetOverview` to confirm join pattern**

Open `src/db/budget-queries.ts:216-290`. Notice the pattern: `select` from `budgets` left-joining `expenseBudgets` and `expenses` (with `isDeleted = false` and date bounds), `groupBy` budget columns, then mapping to a `BudgetListItem`-shaped result with `remaining = amount - spent`. Reuse this pattern exactly.

- [ ] **Step 2: Add the new query**

Append this function to `src/db/budget-queries.ts` (after `getBudgetOverview`, before `createBudget`). Match the existing import list — `ne` from `drizzle-orm` is needed; add it to the existing `drizzle-orm` import if not already present.

```ts
export const getTransferCandidates = async (
  destinationBudgetId: number,
  limit = 100
): Promise<BudgetListItem[]> => {
  const budgetRows = await db
    .select({
      id: budgets.id,
      name: budgets.name,
      amount: budgets.amount,
      period: budgets.period,
      periodStartDate: budgets.periodStartDate,
      periodEndDate: budgets.periodEndDate,
      spent:
        sql<number>`coalesce(sum(${expenses.amount}), 0)`.mapWith(Number),
    })
    .from(budgets)
    .leftJoin(expenseBudgets, eq(expenseBudgets.budgetId, budgets.id))
    .leftJoin(
      expenses,
      and(
        eq(expenses.id, expenseBudgets.expenseId),
        eq(expenses.isDeleted, false),
        gte(expenses.date, budgets.periodStartDate),
        lte(
          expenses.date,
          sql`coalesce(${budgets.periodEndDate}, ${budgets.periodStartDate})`
        )
      )
    )
    .where(
      and(
        ne(budgets.id, destinationBudgetId),
        sql`${budgets.amount} > 0`
      )
    )
    .groupBy(
      budgets.id,
      budgets.name,
      budgets.amount,
      budgets.period,
      budgets.periodStartDate,
      budgets.periodEndDate
    )
    .orderBy(desc(budgets.periodStartDate), asc(budgets.id))
    .limit(limit);

  return budgetRows.map((budget) => {
    const amount = Number(budget.amount ?? 0);
    const spent = Number(budget.spent ?? 0);
    return {
      id: budget.id,
      name: budget.name,
      amount,
      spent,
      remaining: amount - spent,
      period: budget.period,
      periodStartDate: dayjs(budget.periodStartDate).format("YYYY-MM-DD"),
      periodEndDate: budget.periodEndDate
        ? dayjs(budget.periodEndDate).format("YYYY-MM-DD")
        : null,
    };
  });
};
```

Then update the `drizzle-orm` import at the top of the file:

```ts
import { and, asc, desc, eq, gte, lte, ne, sql } from "drizzle-orm";
```

(`ne` is the only addition; the others are already imported in the existing file.)

Make sure `BudgetListItem` is imported from `@/types/budget-weekly` in this file — if it isn't yet, add it to the existing `@/types/budget-weekly` import.

- [ ] **Step 3: Verify the file typechecks**

Run: `npx tsc --noEmit -p tsconfig.json src/db/budget-queries.ts 2>&1 | head -40`

Project uses incremental TS — easier check is the whole project: `npx tsc --noEmit 2>&1 | grep "src/db/budget-queries" | head -20`
Expected: no errors mentioning `budget-queries.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/db/budget-queries.ts
git commit -m "feat(budgets): add getTransferCandidates db query"
```

---

## Task 2: Expose the action wrapper

**Files:**
- Modify: `src/app/actions/budget-weekly-actions.ts`

- [ ] **Step 1: Add the action**

Append this to `src/app/actions/budget-weekly-actions.ts` (after `transferBudgetAmount`, before any closing exports):

```ts
const getTransferCandidatesSchema = z.object({
  destinationBudgetId: z.number().int().positive(),
});

export type GetTransferCandidatesInput = z.infer<
  typeof getTransferCandidatesSchema
>;

export async function getTransferCandidates(
  input: GetTransferCandidatesInput
): Promise<BudgetListItem[]> {
  const { destinationBudgetId } = getTransferCandidatesSchema.parse(input);

  try {
    return await getTransferCandidatesQuery(destinationBudgetId);
  } catch (error) {
    console.error("Error loading transfer candidates:", error);
    throw new Error("Failed to load transfer candidates");
  }
}
```

Update the imports at the top of the file:

```ts
import {
  createBudget,
  deleteBudget,
  getTransferCandidates as getTransferCandidatesQuery,
  setExpenseBudget,
  updateBudget,
} from "@/db/budget-queries";
```

And add `BudgetListItem` to the type import already importing other budget types:

```ts
import {
  BudgetCreateInput,
  BudgetListItem,
  BudgetUpdateInput,
  ExpenseBudgetInput,
} from "@/types/budget-weekly";
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "budget-weekly-actions|budget-queries" | head -20`
Expected: no errors.

- [ ] **Step 3: Lint the file**

Run: `npx eslint src/app/actions/budget-weekly-actions.ts`
Expected: passes (no errors).

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/budget-weekly-actions.ts
git commit -m "feat(budgets): expose getTransferCandidates server action"
```

---

## Task 3: Add the new query key

**Files:**
- Modify: `src/lib/queries/budgets.ts`

- [ ] **Step 1: Add the key**

Insert this line after `budgetTransactionsQueryKey` at `src/lib/queries/budgets.ts:8`:

```ts
export const budgetTransferCandidatesQueryKey = (destinationId: number) =>
  ["budgets", "transfer-candidates", destinationId] as const;
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep "queries/budgets" | head`
Expected: empty.

- [ ] **Step 3: Commit**

```bash
git add src/lib/queries/budgets.ts
git commit -m "feat(budgets): add budgetTransferCandidatesQueryKey"
```

---

## Task 4: Period-instance grouping helper — failing tests

**Files:**
- Create: `src/lib/budget-transfer-groups.test.ts`

This helper is pure and benefits from isolated unit tests. Write the tests first.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/budget-transfer-groups.test.ts` with this exact content:

```ts
import { describe, expect, it } from "vitest";

import {
  groupTransferCandidates,
  type CandidateGroup,
} from "./budget-transfer-groups";
import type { BudgetListItem } from "@/types/budget-weekly";

const makeBudget = (overrides: Partial<BudgetListItem>): BudgetListItem => ({
  id: 1,
  name: "Coffee",
  amount: 500_000,
  spent: 180_000,
  remaining: 320_000,
  period: "week",
  periodStartDate: "2026-05-13",
  periodEndDate: "2026-05-19",
  ...overrides,
});

// Reference "now": Saturday 2026-05-16. ISO week (Sun-start) covers 2026-05-10..2026-05-16.
// Last week covers 2026-05-03..2026-05-09. This month: May 2026. Last month: April 2026.
const NOW = new Date(2026, 4, 16);

describe("groupTransferCandidates", () => {
  it("returns an empty array for no candidates", () => {
    expect(groupTransferCandidates([], NOW)).toEqual([]);
  });

  it("buckets a current-week budget into this-week", () => {
    const groups = groupTransferCandidates(
      [makeBudget({ id: 1, periodStartDate: "2026-05-10", periodEndDate: "2026-05-16" })],
      NOW
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].key.kind).toBe("this-week");
    expect(groups[0].label).toMatch(/this week/i);
    expect(groups[0].candidates.map((c) => c.id)).toEqual([1]);
  });

  it("buckets a previous-week budget into last-week", () => {
    const groups = groupTransferCandidates(
      [makeBudget({ id: 2, periodStartDate: "2026-05-03", periodEndDate: "2026-05-09" })],
      NOW
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].key.kind).toBe("last-week");
    expect(groups[0].label).toMatch(/last week/i);
  });

  it("buckets a current-month budget into this-month", () => {
    const groups = groupTransferCandidates(
      [
        makeBudget({
          id: 3,
          period: "month",
          periodStartDate: "2026-05-01",
          periodEndDate: "2026-05-31",
        }),
      ],
      NOW
    );
    expect(groups[0].key.kind).toBe("this-month");
    expect(groups[0].label).toMatch(/this month/i);
  });

  it("buckets a previous-month budget into last-month", () => {
    const groups = groupTransferCandidates(
      [
        makeBudget({
          id: 4,
          period: "month",
          periodStartDate: "2026-04-01",
          periodEndDate: "2026-04-30",
        }),
      ],
      NOW
    );
    expect(groups[0].key.kind).toBe("last-month");
    expect(groups[0].label).toMatch(/last month/i);
  });

  it("buckets older weeks, older months, and custom periods into earlier", () => {
    const groups = groupTransferCandidates(
      [
        makeBudget({ id: 5, periodStartDate: "2026-03-01", periodEndDate: "2026-03-07" }),
        makeBudget({
          id: 6,
          period: "month",
          periodStartDate: "2026-01-01",
          periodEndDate: "2026-01-31",
        }),
        makeBudget({
          id: 7,
          period: "custom",
          periodStartDate: "2026-02-10",
          periodEndDate: "2026-02-25",
        }),
      ],
      NOW
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].key.kind).toBe("earlier");
    expect(groups[0].candidates.map((c) => c.id).sort()).toEqual([5, 6, 7]);
  });

  it("omits empty groups", () => {
    const groups = groupTransferCandidates(
      [
        makeBudget({ id: 1, periodStartDate: "2026-05-10", periodEndDate: "2026-05-16" }),
        makeBudget({
          id: 3,
          period: "month",
          periodStartDate: "2026-05-01",
          periodEndDate: "2026-05-31",
        }),
      ],
      NOW
    );
    const kinds = groups.map((g) => g.key.kind);
    expect(kinds).toEqual(["this-week", "this-month"]);
  });

  it("orders groups: this-week, last-week, this-month, last-month, earlier", () => {
    const groups = groupTransferCandidates(
      [
        makeBudget({ id: 99, periodStartDate: "2026-03-01", periodEndDate: "2026-03-07" }), // earlier
        makeBudget({
          id: 4,
          period: "month",
          periodStartDate: "2026-04-01",
          periodEndDate: "2026-04-30",
        }), // last-month
        makeBudget({ id: 2, periodStartDate: "2026-05-03", periodEndDate: "2026-05-09" }), // last-week
        makeBudget({
          id: 3,
          period: "month",
          periodStartDate: "2026-05-01",
          periodEndDate: "2026-05-31",
        }), // this-month
        makeBudget({ id: 1, periodStartDate: "2026-05-10", periodEndDate: "2026-05-16" }), // this-week
      ],
      NOW
    );
    expect(groups.map((g) => g.key.kind)).toEqual([
      "this-week",
      "last-week",
      "this-month",
      "last-month",
      "earlier",
    ]);
  });

  it("sorts within a group by remaining desc; non-positive remaining falls to bottom", () => {
    const groups: CandidateGroup[] = groupTransferCandidates(
      [
        makeBudget({ id: 1, periodStartDate: "2026-05-10", periodEndDate: "2026-05-16", remaining: 50_000 }),
        makeBudget({ id: 2, periodStartDate: "2026-05-10", periodEndDate: "2026-05-16", remaining: 0 }),
        makeBudget({ id: 3, periodStartDate: "2026-05-10", periodEndDate: "2026-05-16", remaining: 200_000 }),
        makeBudget({ id: 4, periodStartDate: "2026-05-10", periodEndDate: "2026-05-16", remaining: -10_000 }),
      ],
      NOW
    );
    expect(groups[0].candidates.map((c) => c.id)).toEqual([3, 1, 2, 4]);
  });
});
```

- [ ] **Step 2: Run the tests — expect failure**

Run: `npx vitest run src/lib/budget-transfer-groups.test.ts`
Expected: all tests fail with "Cannot find module './budget-transfer-groups'" or similar.

---

## Task 5: Implement the grouping helper

**Files:**
- Create: `src/lib/budget-transfer-groups.ts`

- [ ] **Step 1: Implement**

Create `src/lib/budget-transfer-groups.ts`:

```ts
import dayjs from "@/configs/date";
import { getWeekRange } from "@/lib/week";
import type { BudgetListItem } from "@/types/budget-weekly";

export type GroupKey =
  | { kind: "this-week" }
  | { kind: "last-week" }
  | { kind: "this-month" }
  | { kind: "last-month" }
  | { kind: "earlier" };

export type CandidateGroup = {
  key: GroupKey;
  label: string;
  candidates: BudgetListItem[];
};

const GROUP_ORDER: GroupKey["kind"][] = [
  "this-week",
  "last-week",
  "this-month",
  "last-month",
  "earlier",
];

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
});
const DAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const formatWeekRange = (
  prefix: "This week" | "Last week",
  weekStart: Date,
  weekEnd: Date
) => `${prefix} · ${DAY_FORMATTER.format(weekStart)} – ${DAY_FORMATTER.format(weekEnd)}`;

const formatMonthLabel = (prefix: "This month" | "Last month", month: Date) =>
  `${prefix} · ${MONTH_FORMATTER.format(month)} ${month.getFullYear()}`;

const classify = (
  candidate: BudgetListItem,
  ranges: {
    thisWeekStart: dayjs.Dayjs;
    thisWeekEnd: dayjs.Dayjs;
    lastWeekStart: dayjs.Dayjs;
    lastWeekEnd: dayjs.Dayjs;
    thisMonthStart: dayjs.Dayjs;
    thisMonthEnd: dayjs.Dayjs;
    lastMonthStart: dayjs.Dayjs;
    lastMonthEnd: dayjs.Dayjs;
  }
): GroupKey["kind"] => {
  const start = dayjs(candidate.periodStartDate);

  if (candidate.period === "week") {
    if (
      !start.isBefore(ranges.thisWeekStart) &&
      !start.isAfter(ranges.thisWeekEnd)
    ) {
      return "this-week";
    }
    if (
      !start.isBefore(ranges.lastWeekStart) &&
      !start.isAfter(ranges.lastWeekEnd)
    ) {
      return "last-week";
    }
    return "earlier";
  }

  if (candidate.period === "month") {
    if (
      !start.isBefore(ranges.thisMonthStart) &&
      !start.isAfter(ranges.thisMonthEnd)
    ) {
      return "this-month";
    }
    if (
      !start.isBefore(ranges.lastMonthStart) &&
      !start.isAfter(ranges.lastMonthEnd)
    ) {
      return "last-month";
    }
    return "earlier";
  }

  return "earlier";
};

const labelFor = (
  kind: GroupKey["kind"],
  ranges: {
    thisWeekStart: dayjs.Dayjs;
    thisWeekEnd: dayjs.Dayjs;
    lastWeekStart: dayjs.Dayjs;
    lastWeekEnd: dayjs.Dayjs;
    thisMonthStart: dayjs.Dayjs;
    lastMonthStart: dayjs.Dayjs;
  }
): string => {
  switch (kind) {
    case "this-week":
      return formatWeekRange(
        "This week",
        ranges.thisWeekStart.toDate(),
        ranges.thisWeekEnd.toDate()
      );
    case "last-week":
      return formatWeekRange(
        "Last week",
        ranges.lastWeekStart.toDate(),
        ranges.lastWeekEnd.toDate()
      );
    case "this-month":
      return formatMonthLabel("This month", ranges.thisMonthStart.toDate());
    case "last-month":
      return formatMonthLabel("Last month", ranges.lastMonthStart.toDate());
    case "earlier":
      return "Earlier";
  }
};

const sortWithinGroup = (a: BudgetListItem, b: BudgetListItem) => {
  const aPositive = a.remaining > 0;
  const bPositive = b.remaining > 0;
  if (aPositive !== bPositive) {
    return aPositive ? -1 : 1;
  }
  return b.remaining - a.remaining;
};

export const groupTransferCandidates = (
  candidates: BudgetListItem[],
  now: Date
): CandidateGroup[] => {
  const { weekStartDate, weekEndDate } = getWeekRange(now);
  const lastWeekStart = weekStartDate.subtract(7, "day");
  const lastWeekEnd = weekEndDate.subtract(7, "day");
  const thisMonthStart = dayjs(now).startOf("month");
  const thisMonthEnd = dayjs(now).endOf("month").startOf("day");
  const lastMonthStart = thisMonthStart.subtract(1, "month");
  const lastMonthEnd = thisMonthStart.subtract(1, "day").startOf("day");

  const ranges = {
    thisWeekStart: weekStartDate,
    thisWeekEnd: weekEndDate,
    lastWeekStart,
    lastWeekEnd,
    thisMonthStart,
    thisMonthEnd,
    lastMonthStart,
    lastMonthEnd,
  };

  const buckets = new Map<GroupKey["kind"], BudgetListItem[]>();
  for (const candidate of candidates) {
    const kind = classify(candidate, ranges);
    const bucket = buckets.get(kind) ?? [];
    bucket.push(candidate);
    buckets.set(kind, bucket);
  }

  return GROUP_ORDER.filter((kind) => buckets.has(kind)).map((kind) => ({
    key: { kind } as GroupKey,
    label: labelFor(kind, ranges),
    candidates: (buckets.get(kind) ?? []).slice().sort(sortWithinGroup),
  }));
};
```

- [ ] **Step 2: Run the tests — expect all pass**

Run: `npx vitest run src/lib/budget-transfer-groups.test.ts`
Expected: all 9 tests pass.

If any tests fail, fix the helper (not the tests) until they pass.

- [ ] **Step 3: Lint**

Run: `npx eslint src/lib/budget-transfer-groups.ts src/lib/budget-transfer-groups.test.ts`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add src/lib/budget-transfer-groups.ts src/lib/budget-transfer-groups.test.ts
git commit -m "feat(budgets): add period-instance grouping helper for transfer picker"
```

---

## Task 6: Rebuild the drawer — failing tests first

**Files:**
- Modify: `src/components/BudgetTransferDrawer.test.tsx`

We rewrite the test file to (a) drop the `budgets` prop everywhere, (b) extend the `@tanstack/react-query` mock to also stub `useQuery`, (c) add tests for the new behaviors.

- [ ] **Step 1: Replace the test file**

Overwrite `src/components/BudgetTransferDrawer.test.tsx` with this content:

```tsx
import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import BudgetTransferDrawer from "./BudgetTransferDrawer";
import type { BudgetListItem } from "@/types/budget-weekly";

const transferMock = vi.fn();
const getCandidatesMock = vi.fn();

vi.mock("@/app/actions/budget-weekly-actions", () => ({
  transferBudgetAmount: (...args: unknown[]) => transferMock(...args),
  getTransferCandidates: (...args: unknown[]) => getCandidatesMock(...args),
}));

const invalidateQueriesMock = vi.fn();
const useQueryMock = vi.fn();
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: (...args: unknown[]) => invalidateQueriesMock(...args),
  }),
  useQuery: (opts: { queryFn: () => Promise<unknown>; enabled?: boolean }) =>
    useQueryMock(opts),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

const makeBudget = (overrides: Partial<BudgetListItem>): BudgetListItem => ({
  id: 1,
  name: "Groceries",
  amount: 500_000,
  spent: 100_000,
  remaining: 400_000,
  period: "week",
  periodStartDate: "2026-05-10",
  periodEndDate: "2026-05-16",
  ...overrides,
});

const useQueryReturn = (overrides: {
  data?: BudgetListItem[];
  isLoading?: boolean;
  isError?: boolean;
  refetch?: () => void;
}) => ({
  data: overrides.data,
  isLoading: overrides.isLoading ?? false,
  isError: overrides.isError ?? false,
  refetch: overrides.refetch ?? vi.fn(),
});

beforeEach(() => {
  transferMock.mockReset();
  getCandidatesMock.mockReset();
  invalidateQueriesMock.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  useQueryMock.mockReset();
});

describe("BudgetTransferDrawer", () => {
  it("renders skeleton while candidates are loading", () => {
    useQueryMock.mockReturnValue(useQueryReturn({ isLoading: true }));
    const destination = makeBudget({ id: 1, name: "Groceries" });

    render(
      <BudgetTransferDrawer open onOpenChange={() => {}} destination={destination} />
    );

    fireEvent.click(screen.getByRole("button", { name: /select source budget/i }));
    expect(
      screen.getByTestId("budget-transfer-candidates-skeleton")
    ).toBeInTheDocument();
  });

  it("disables submit until a source is picked and amount is valid", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const destination = makeBudget({ id: 1, name: "Groceries", amount: 100_000 });
    const source = makeBudget({ id: 2, name: "Dining", amount: 200_000, remaining: 150_000 });
    useQueryMock.mockReturnValue(useQueryReturn({ data: [source] }));

    render(
      <BudgetTransferDrawer open onOpenChange={() => {}} destination={destination} />
    );

    expect(screen.getByRole("button", { name: /move funds/i })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /select source budget/i }));
    fireEvent.click(screen.getByRole("button", { name: /Dining/i }));

    expect(screen.getByRole("button", { name: /move funds/i, hidden: true })).toBeDisabled();

    await user.type(screen.getByLabelText(/amount/i), "30000");

    expect(screen.getByRole("button", { name: /move funds/i, hidden: true })).not.toBeDisabled();
  });

  it("renders candidates inside period-instance groups in fixed order", () => {
    const thisWeek = makeBudget({
      id: 10,
      name: "Coffee this week",
      periodStartDate: "2026-05-10",
      periodEndDate: "2026-05-16",
    });
    const lastWeek = makeBudget({
      id: 20,
      name: "Coffee last week",
      periodStartDate: "2026-05-03",
      periodEndDate: "2026-05-09",
    });
    const thisMonth = makeBudget({
      id: 30,
      name: "Utilities",
      period: "month",
      periodStartDate: "2026-05-01",
      periodEndDate: "2026-05-31",
    });
    useQueryMock.mockReturnValue(useQueryReturn({ data: [thisMonth, lastWeek, thisWeek] }));

    render(
      <BudgetTransferDrawer
        open
        onOpenChange={() => {}}
        destination={makeBudget({ id: 1, name: "Groceries" })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /select source budget/i }));

    const headings = screen
      .getAllByTestId("budget-transfer-group-label")
      .map((el) => el.textContent ?? "");
    expect(headings.length).toBe(3);
    expect(headings[0]).toMatch(/this week/i);
    expect(headings[1]).toMatch(/last week/i);
    expect(headings[2]).toMatch(/this month/i);
  });

  it("renders a disabled row for remaining <= 0 candidates", () => {
    const overspent = makeBudget({
      id: 99,
      name: "Travel",
      amount: 100_000,
      spent: 100_000,
      remaining: 0,
    });
    useQueryMock.mockReturnValue(useQueryReturn({ data: [overspent] }));

    render(
      <BudgetTransferDrawer
        open
        onOpenChange={() => {}}
        destination={makeBudget({ id: 1, name: "Groceries" })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /select source budget/i }));
    expect(screen.getByRole("button", { name: /Travel/i })).toBeDisabled();
    expect(screen.getByText(/no cap to pull/i)).toBeInTheDocument();
  });

  it("shows the 'no cap to spare' card when every candidate has remaining <= 0", () => {
    const drained = makeBudget({ id: 99, name: "Travel", amount: 100_000, spent: 100_000, remaining: 0 });
    useQueryMock.mockReturnValue(useQueryReturn({ data: [drained] }));

    render(
      <BudgetTransferDrawer
        open
        onOpenChange={() => {}}
        destination={makeBudget({ id: 1, name: "Groceries" })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /select source budget/i }));
    expect(screen.getByText(/no budget has cap to spare/i)).toBeInTheDocument();
  });

  it("shows empty card when candidates payload is empty", () => {
    useQueryMock.mockReturnValue(useQueryReturn({ data: [] }));

    render(
      <BudgetTransferDrawer
        open
        onOpenChange={() => {}}
        destination={makeBudget({ id: 1, name: "Groceries" })}
      />
    );

    expect(screen.getByText(/no other budgets to pull from/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /move funds/i })).toBeNull();
  });

  it("shows an error state with a retry button when the candidate fetch errors", async () => {
    const refetch = vi.fn();
    useQueryMock.mockReturnValue(useQueryReturn({ isError: true, refetch }));

    render(
      <BudgetTransferDrawer
        open
        onOpenChange={() => {}}
        destination={makeBudget({ id: 1, name: "Groceries" })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /select source budget/i }));
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it("shows warning banner and flips submit label when source goes below spent", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const destination = makeBudget({ id: 1, name: "Groceries" });
    const source = makeBudget({
      id: 2,
      name: "Travel",
      amount: 100_000,
      spent: 80_000,
      remaining: 20_000,
    });
    useQueryMock.mockReturnValue(useQueryReturn({ data: [source] }));

    render(
      <BudgetTransferDrawer open onOpenChange={() => {}} destination={destination} />
    );

    fireEvent.click(screen.getByRole("button", { name: /select source budget/i }));
    fireEvent.click(screen.getByRole("button", { name: /Travel/i }));
    await user.type(screen.getByLabelText(/amount/i), "50000");

    expect(screen.getByText(/will go .* over budget/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /move funds anyway/i, hidden: true })
    ).toBeInTheDocument();
  });

  it("disables submit when amount exceeds source.amount", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const destination = makeBudget({ id: 1, name: "Groceries" });
    const source = makeBudget({
      id: 2,
      name: "Snacks",
      amount: 20_000,
      spent: 0,
      remaining: 20_000,
    });
    useQueryMock.mockReturnValue(useQueryReturn({ data: [source] }));

    render(
      <BudgetTransferDrawer open onOpenChange={() => {}} destination={destination} />
    );

    fireEvent.click(screen.getByRole("button", { name: /select source budget/i }));
    fireEvent.click(screen.getByRole("button", { name: /Snacks/i }));
    await user.type(screen.getByLabelText(/amount/i), "30000");

    expect(
      screen.getByRole("button", { name: /move funds/i, hidden: true })
    ).toBeDisabled();
    expect(screen.getByText(/cannot move more than/i)).toBeInTheDocument();
  });

  it("on success: invalidates overview + transactions + transfer-candidates, toasts, closes drawer", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    transferMock.mockResolvedValue({ ok: true });
    const onOpenChange = vi.fn();
    const destination = makeBudget({ id: 1, name: "Groceries" });
    const source = makeBudget({
      id: 2,
      name: "Dining",
      amount: 200_000,
      spent: 0,
      remaining: 200_000,
    });
    useQueryMock.mockReturnValue(useQueryReturn({ data: [source] }));

    render(
      <BudgetTransferDrawer open onOpenChange={onOpenChange} destination={destination} />
    );

    fireEvent.click(screen.getByRole("button", { name: /select source budget/i }));
    fireEvent.click(screen.getByRole("button", { name: /Dining/i }));
    await user.type(screen.getByLabelText(/amount/i), "30000");
    await user.click(screen.getByRole("button", { name: /^move funds$/i, hidden: true }));

    expect(transferMock).toHaveBeenCalledWith({
      fromBudgetId: 2,
      toBudgetId: 1,
      amount: 30_000,
    });
    expect(toastSuccess).toHaveBeenCalledWith("Funds moved.");
    expect(invalidateQueriesMock).toHaveBeenCalledTimes(4);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("on INSUFFICIENT_CAP: shows specific toast and keeps drawer open", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    transferMock.mockResolvedValue({ ok: false, code: "INSUFFICIENT_CAP" });
    const onOpenChange = vi.fn();
    const destination = makeBudget({ id: 1, name: "Groceries" });
    const source = makeBudget({
      id: 2,
      name: "Dining",
      amount: 200_000,
      spent: 0,
      remaining: 200_000,
    });
    useQueryMock.mockReturnValue(useQueryReturn({ data: [source] }));

    render(
      <BudgetTransferDrawer open onOpenChange={onOpenChange} destination={destination} />
    );

    fireEvent.click(screen.getByRole("button", { name: /select source budget/i }));
    fireEvent.click(screen.getByRole("button", { name: /Dining/i }));
    await user.type(screen.getByLabelText(/amount/i), "30000");
    await user.click(screen.getByRole("button", { name: /^move funds$/i, hidden: true }));

    expect(toastError).toHaveBeenCalledWith(
      "That budget no longer has enough to move. Try a smaller amount."
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("on NOT_FOUND: shows specific toast and keeps drawer open", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    transferMock.mockResolvedValue({ ok: false, code: "NOT_FOUND" });
    const onOpenChange = vi.fn();
    const destination = makeBudget({ id: 1, name: "Groceries" });
    const source = makeBudget({
      id: 2,
      name: "Dining",
      amount: 200_000,
      spent: 0,
      remaining: 200_000,
    });
    useQueryMock.mockReturnValue(useQueryReturn({ data: [source] }));

    render(
      <BudgetTransferDrawer open onOpenChange={onOpenChange} destination={destination} />
    );

    fireEvent.click(screen.getByRole("button", { name: /select source budget/i }));
    fireEvent.click(screen.getByRole("button", { name: /Dining/i }));
    await user.type(screen.getByLabelText(/amount/i), "30000");
    await user.click(screen.getByRole("button", { name: /^move funds$/i, hidden: true }));

    expect(toastError).toHaveBeenCalledWith("Source budget no longer exists.");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("renders sticky destination header inside the nested drawer", () => {
    useQueryMock.mockReturnValue(useQueryReturn({ data: [makeBudget({ id: 2, name: "Coffee" })] }));

    render(
      <BudgetTransferDrawer
        open
        onOpenChange={() => {}}
        destination={makeBudget({ id: 1, name: "Groceries", amount: 540_000 })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /select source budget/i }));
    const header = screen.getByTestId("budget-transfer-nested-destination");
    expect(within(header).getByText("Groceries")).toBeInTheDocument();
    expect(within(header).getByText(/filling/i)).toBeInTheDocument();
    expect(header.className).toMatch(/sticky/);
  });
});
```

- [ ] **Step 2: Run the tests — expect failures**

Run: `npx vitest run src/components/BudgetTransferDrawer.test.tsx`
Expected: most tests fail (drawer still has `budgets` prop, no `useQuery`, no test-ids). Output should mention TypeScript errors about the `budgets` prop being required, or missing test-ids. This is correct — we'll fix in Task 7.

---

## Task 7: Rebuild the drawer component

**Files:**
- Modify: `src/components/BudgetTransferDrawer.tsx`

Full rewrite. The outer drawer structure (header, amount input, after-transfer preview, footer) is preserved; the nested drawer body and its data source change.

- [ ] **Step 1: Replace the file**

Overwrite `src/components/BudgetTransferDrawer.tsx`:

```tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowDown, Check, Loader2, RefreshCcw } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  getTransferCandidates,
  transferBudgetAmount,
} from "@/app/actions/budget-weekly-actions";
import {
  budgetOverviewQueryKey,
  budgetTransactionsQueryKey,
  budgetTransferCandidatesQueryKey,
} from "@/lib/queries/budgets";
import { groupTransferCandidates } from "@/lib/budget-transfer-groups";
import { cn, formatVnd, formatVndSigned, parseVndInput } from "@/lib/utils";
import type { BudgetListItem } from "@/types/budget-weekly";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerNested,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destination: BudgetListItem;
};

const BudgetTransferDrawer = ({ open, onOpenChange, destination }: Props) => {
  const queryClient = useQueryClient();
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [amount, setAmount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const candidatesQuery = useQuery({
    queryKey: budgetTransferCandidatesQueryKey(destination.id),
    queryFn: () => getTransferCandidates({ destinationBudgetId: destination.id }),
    enabled: open,
  });

  const candidates = candidatesQuery.data ?? [];

  useEffect(() => {
    if (open) {
      setSourceId(null);
      setAmount(0);
      setIsSaving(false);
    }
  }, [open]);

  const groups = useMemo(
    () => groupTransferCandidates(candidates, new Date()),
    [candidates]
  );

  const allDisabled =
    candidates.length > 0 && candidates.every((b) => b.remaining <= 0);

  const source = useMemo(
    () => candidates.find((b) => b.id === sourceId) ?? null,
    [candidates, sourceId]
  );

  const exceedsCap = source !== null && amount > source.amount;
  const goesOverSpent =
    source !== null &&
    amount > 0 &&
    !exceedsCap &&
    source.amount - amount < source.spent;
  const overBy =
    goesOverSpent && source ? source.spent - (source.amount - amount) : 0;

  const canSubmit = source !== null && amount > 0 && !exceedsCap && !isSaving;
  const submitLabel = goesOverSpent ? "Move funds anyway" : "Move funds";

  const handleSubmit = async () => {
    if (!canSubmit || !source) {
      return;
    }
    try {
      setIsSaving(true);
      const result = await transferBudgetAmount({
        fromBudgetId: source.id,
        toBudgetId: destination.id,
        amount,
      });

      if (result.ok) {
        toast.success("Funds moved.");
        await queryClient.invalidateQueries({ queryKey: budgetOverviewQueryKey });
        await queryClient.invalidateQueries({
          queryKey: budgetTransactionsQueryKey(destination.id),
        });
        await queryClient.invalidateQueries({
          queryKey: budgetTransactionsQueryKey(source.id),
        });
        await queryClient.invalidateQueries({
          queryKey: budgetTransferCandidatesQueryKey(destination.id),
        });
        onOpenChange(false);
        return;
      }

      switch (result.code) {
        case "INSUFFICIENT_CAP":
          toast.error(
            "That budget no longer has enough to move. Try a smaller amount."
          );
          break;
        case "NOT_FOUND":
          toast.error("Source budget no longer exists.");
          break;
        default: {
          const _exhaustive: never = result.code;
          void _exhaustive;
          toast.error("Failed to move funds.");
        }
      }
      await queryClient.invalidateQueries({ queryKey: budgetOverviewQueryKey });
    } catch (error) {
      console.error(error);
      toast.error("Failed to move funds.");
    } finally {
      setIsSaving(false);
    }
  };

  const hasNoCandidates = !candidatesQuery.isLoading && candidates.length === 0;

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent className="rounded-t-3xl! border-t-0!">
        <DrawerHeader className="gap-1 pb-2">
          <DrawerTitle>Move funds to &quot;{destination.name}&quot;</DrawerTitle>
          <DrawerDescription>
            Pull cap from another budget into this one
          </DrawerDescription>
        </DrawerHeader>

        <div className="no-scrollbar flex max-h-[65svh] flex-col gap-4 overflow-x-hidden overflow-y-auto px-4 pb-4">
          {hasNoCandidates ? (
            <div className="border-border/55 bg-card/40 rounded-2xl border border-dashed px-4 py-5 text-center">
              <p className="text-foreground text-sm font-semibold">
                No other budgets to pull from yet.
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                Create another budget first, then come back to move funds.
              </p>
            </div>
          ) : (
            <>
              <div className="border-border/45 bg-card/70 rounded-2xl border px-4 py-3">
                <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
                  Destination
                </p>
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-foreground text-sm font-semibold">
                    {destination.name}
                  </p>
                  <p className="text-foreground text-sm font-semibold tabular-nums">
                    {formatVnd(destination.amount)}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-foreground text-sm font-medium">From</label>
                <DrawerNested>
                  <DrawerTrigger asChild>
                    <Button
                      type="button"
                      variant="secondary"
                      aria-label="Select source budget"
                      className="mt-2 h-11 w-full justify-between rounded-xl"
                    >
                      <span className="truncate">
                        {source ? source.name : "Select source budget"}
                      </span>
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {source ? formatVnd(source.amount) : ""}
                      </span>
                    </Button>
                  </DrawerTrigger>
                  <DrawerContent className="rounded-t-3xl! border-t-0!">
                    <DrawerHeader className="gap-1 pb-2">
                      <DrawerTitle>Select source budget</DrawerTitle>
                      <DrawerDescription>
                        Pull cap from one of these into &quot;{destination.name}&quot;.
                      </DrawerDescription>
                    </DrawerHeader>

                    <div className="no-scrollbar relative max-h-[60svh] overflow-y-auto px-4 pb-4">
                      <div
                        data-testid="budget-transfer-nested-destination"
                        className="sticky top-0 z-10 -mx-1 mb-2 rounded-2xl border border-border/45 bg-card/95 px-4 py-3 backdrop-blur"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground text-[10px] tracking-wide uppercase">
                            Filling
                          </span>
                          <span className="text-foreground text-sm font-semibold tabular-nums">
                            {formatVnd(destination.amount)}
                          </span>
                        </div>
                        <p className="text-foreground mt-1 text-sm font-semibold truncate">
                          {destination.name}
                        </p>
                      </div>

                      {candidatesQuery.isLoading ? (
                        <div
                          data-testid="budget-transfer-candidates-skeleton"
                          className="space-y-2 pt-1"
                        >
                          {Array.from({ length: 4 }).map((_, idx) => (
                            <div
                              key={idx}
                              className="bg-muted/40 h-13 rounded-lg animate-pulse"
                            />
                          ))}
                        </div>
                      ) : candidatesQuery.isError ? (
                        <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2.5">
                          <p className="text-destructive text-xs font-medium">
                            Failed to load budgets.
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => candidatesQuery.refetch()}
                          >
                            <RefreshCcw className="h-3.5 w-3.5" />
                            Retry
                          </Button>
                        </div>
                      ) : allDisabled ? (
                        <div className="border-border/55 bg-card/40 rounded-2xl border border-dashed px-4 py-5 text-center">
                          <p className="text-foreground text-sm font-semibold">
                            No budget has cap to spare right now.
                          </p>
                          <p className="text-muted-foreground mt-1 text-xs">
                            Try again after another budget recovers some headroom.
                          </p>
                        </div>
                      ) : (
                        <ul aria-label="Source budgets" className="space-y-3">
                          {groups.map((group) => (
                            <li key={group.key.kind}>
                              <p
                                data-testid="budget-transfer-group-label"
                                className="text-muted-foreground mt-3 mb-1 px-1 text-[10px] tracking-wide uppercase"
                              >
                                {group.label}
                              </p>
                              <ul className="space-y-1">
                                {group.candidates.map((b) => {
                                  const disabled = b.remaining <= 0;
                                  const selected = b.id === sourceId;
                                  return (
                                    <li key={b.id}>
                                      <DrawerClose asChild>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          disabled={disabled}
                                          aria-disabled={disabled}
                                          onClick={() => setSourceId(b.id)}
                                          className={cn(
                                            "h-auto min-h-13 w-full justify-between rounded-lg px-3 text-left",
                                            selected && "bg-muted/60",
                                            disabled && "opacity-60"
                                          )}
                                        >
                                          <span className="min-w-0 truncate text-sm font-medium">
                                            {b.name}
                                          </span>
                                          <span className="ml-2 flex shrink-0 items-center gap-2">
                                            <span className="flex flex-col items-end">
                                              {disabled ? (
                                                <span className="text-muted-foreground text-[10px]">
                                                  no cap to pull
                                                </span>
                                              ) : (
                                                <span
                                                  className={cn(
                                                    "text-xs font-semibold tabular-nums",
                                                    b.remaining < 0
                                                      ? "text-destructive"
                                                      : "text-success"
                                                  )}
                                                >
                                                  {formatVndSigned(b.remaining)}
                                                </span>
                                              )}
                                              <span className="text-muted-foreground text-[10px] tabular-nums">
                                                {formatVnd(b.amount)}
                                              </span>
                                            </span>
                                            {selected ? (
                                              <Check className="text-success h-4 w-4 shrink-0" />
                                            ) : null}
                                          </span>
                                        </Button>
                                      </DrawerClose>
                                    </li>
                                  );
                                })}
                              </ul>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </DrawerContent>
                </DrawerNested>
              </div>

              <div>
                <label
                  htmlFor="transfer-amount-input"
                  className="text-foreground text-sm font-medium"
                >
                  Amount
                </label>
                <div className="relative mt-2">
                  <Input
                    id="transfer-amount-input"
                    type="text"
                    inputMode="numeric"
                    value={amount ? formatVnd(amount) : ""}
                    onChange={(e) => setAmount(parseVndInput(e.target.value))}
                    placeholder="0"
                    className="h-11 pr-14 text-right text-lg font-semibold tabular-nums"
                  />
                  <span className="text-muted-foreground absolute top-1/2 right-4 -translate-y-1/2 text-xs font-medium">
                    VND
                  </span>
                </div>
                {exceedsCap && source ? (
                  <p className="text-destructive mt-2 text-[11px]">
                    Cannot move more than {formatVnd(source.amount)} from {source.name}.
                  </p>
                ) : null}
              </div>

              {source && amount > 0 && !exceedsCap ? (
                <div className="border-border/45 bg-card/70 rounded-2xl border px-4 py-3">
                  <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
                    After transfer
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">{source.name}</p>
                      <p
                        className={cn(
                          "mt-1 text-sm font-semibold tabular-nums",
                          source.amount - amount < source.spent
                            ? "text-destructive"
                            : "text-foreground"
                        )}
                      >
                        {formatVnd(source.amount - amount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{destination.name}</p>
                      <p className="text-foreground mt-1 text-sm font-semibold tabular-nums">
                        {formatVnd(destination.amount + amount)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {goesOverSpent && source ? (
                <div className="border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs font-medium">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <p>
                    {source.name} will go {formatVnd(overBy)} over budget.
                  </p>
                </div>
              ) : null}
            </>
          )}
        </div>

        {!hasNoCandidates ? (
          <DrawerFooter className="border-border/45 gap-2 border-t">
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="h-11 rounded-2xl"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowDown className="h-4 w-4" />
              )}
              {isSaving ? "Moving..." : submitLabel}
            </Button>
          </DrawerFooter>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
};

export default BudgetTransferDrawer;
```

- [ ] **Step 2: Run the drawer tests — expect all pass**

Run: `npx vitest run src/components/BudgetTransferDrawer.test.tsx`
Expected: all tests pass.

If a test fails because the markup tree changed (e.g. `getByRole("button", { name: /Dining/i })` matches multiple buttons now that rows have additional inner text), tighten the selector in the test (not the component) to `getByRole("button", { name: /^Dining/i })` or use `within(list)`. The component is the contract; tests adapt to find the right element.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep "BudgetTransferDrawer" | head -20`
Expected: empty.

- [ ] **Step 4: Lint**

Run: `npx eslint src/components/BudgetTransferDrawer.tsx src/components/BudgetTransferDrawer.test.tsx`
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add src/components/BudgetTransferDrawer.tsx src/components/BudgetTransferDrawer.test.tsx
git commit -m "feat(budgets): redesign source budget picker with period groups + lazy fetch"
```

---

## Task 8: Drop the `budgets` prop at the call site

**Files:**
- Modify: `src/components/BudgetWeeklyBudgetsClient.tsx`

- [ ] **Step 1: Remove the prop**

Open `src/components/BudgetWeeklyBudgetsClient.tsx`. Find the `BudgetTransferDrawer` render block (around line 1520-1527) and remove the `budgets={budgets}` line:

Old:
```tsx
<BudgetTransferDrawer
  open={transferOpen}
  onOpenChange={setTransferOpen}
  destination={transferDestination}
  budgets={budgets}
/>
```

New:
```tsx
<BudgetTransferDrawer
  open={transferOpen}
  onOpenChange={setTransferOpen}
  destination={transferDestination}
/>
```

Do **not** remove the `budgets` variable elsewhere — it is still used to render the budget grid. The only change is dropping the unused prop.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep "BudgetWeeklyBudgetsClient" | head -20`
Expected: empty.

- [ ] **Step 3: Lint**

Run: `npx eslint src/components/BudgetWeeklyBudgetsClient.tsx`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add src/components/BudgetWeeklyBudgetsClient.tsx
git commit -m "refactor(budgets): drop budgets prop from BudgetTransferDrawer call site"
```

---

## Task 9: Final targeted validation

The repo convention forbids `npm run build` per change. Validate the touched scope only.

- [ ] **Step 1: Run the new + adjacent test files**

Run: `npx vitest run src/lib/budget-transfer-groups.test.ts src/components/BudgetTransferDrawer.test.tsx`
Expected: all tests pass.

- [ ] **Step 2: Typecheck the whole project (cheap, no emit)**

Run: `npx tsc --noEmit 2>&1 | tail -30`
Expected: no errors.

- [ ] **Step 3: Lint touched files**

Run:
```bash
npx eslint \
  src/db/budget-queries.ts \
  src/app/actions/budget-weekly-actions.ts \
  src/lib/queries/budgets.ts \
  src/lib/budget-transfer-groups.ts \
  src/lib/budget-transfer-groups.test.ts \
  src/components/BudgetTransferDrawer.tsx \
  src/components/BudgetTransferDrawer.test.tsx \
  src/components/BudgetWeeklyBudgetsClient.tsx
```
Expected: passes.

- [ ] **Step 4: Visual sanity check on mobile viewport**

Run: `bun run dev` (or `npm run dev`). Open the budgets page in a mobile-sized browser window (or use Chrome DevTools device emulation at iPhone 14 width). Open the move-funds drawer on any budget, tap "Select source budget", verify:

- Sticky destination card stays visible at top while scrolling.
- Group headers appear in correct order (this-week → last-week → this-month → last-month → earlier) for whatever data exists.
- Rows show colored `+remaining` on the right with the muted `amount` beneath.
- Disabled rows (any with `remaining <= 0`) are dimmed and show "no cap to pull".
- Selecting a row closes the nested drawer with the choice reflected on the parent trigger.
- Submitting a transfer still works end-to-end (server action runs, toast appears, drawer closes, budget grid updates).

If anything looks off, file targeted fixes — do **not** modify the spec.

- [ ] **Step 5: (Optional) Inspect the action-level call once more**

Open `src/app/actions/budget-weekly-actions.ts` and confirm:
- `getTransferCandidates` is exported (so the client can `vi.mock` it).
- It's a `"use server"` module (first line).
- It calls the DB helper, not the DB directly.

No commit unless changes are needed.

---

## Files changed summary

| File | Change |
|---|---|
| `src/db/budget-queries.ts` | + `getTransferCandidates` query |
| `src/app/actions/budget-weekly-actions.ts` | + `getTransferCandidates` action + Zod schema |
| `src/lib/queries/budgets.ts` | + `budgetTransferCandidatesQueryKey` |
| `src/lib/budget-transfer-groups.ts` | NEW — grouping helper |
| `src/lib/budget-transfer-groups.test.ts` | NEW — helper unit tests |
| `src/components/BudgetTransferDrawer.tsx` | drop `budgets` prop; `useQuery`; sticky header; period groups; redesigned rows; skeleton/empty/error/all-disabled states; extra invalidation |
| `src/components/BudgetTransferDrawer.test.tsx` | mock `useQuery` + `getTransferCandidates`; new tests for loading / groups / disabled / sticky header / error retry / all-disabled / empty |
| `src/components/BudgetWeeklyBudgetsClient.tsx` | drop `budgets={budgets}` prop at the drawer call site |

No schema migrations. No new dependencies.
