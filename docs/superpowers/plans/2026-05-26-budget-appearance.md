# Budget Appearance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add emoji icon and fixed palette color support to budgets, budget pickers, expense rows, and local pending expense snapshots.

**Architecture:** Store canonical appearance on `budgets`, join latest appearance for server-loaded expense rows, and copy selected budget appearance into local expense payloads for pending/offline rows. Centralize palette validation and rendering so schema, routes, fetchers, local sync, and UI share one contract.

**Tech Stack:** Next.js 15 App Router, React 19, Drizzle ORM, PostgreSQL migrations, TanStack Query, Zustand recovery store, Tailwind v4, Vitest, Testing Library.

---

## File Structure

Create:

- `src/lib/budget-appearance.ts`: palette constants, type guard, normalization helpers, and default values.
- `src/components/BudgetBadge.tsx`: compact reusable budget badge for cards, pickers, transfer rows, and expense rows.
- `src/components/BudgetBadge.test.tsx`: behavior tests for badge fallback and palette rendering.
- `migrations/0008_budget_appearance.sql`: adds `budgets.icon` and `budgets.color`.

Modify:

- `migrations/meta/_journal.json`: adds migration entry for `0008_budget_appearance`.
- `src/db/schema.ts`: adds budget columns and imports helper constants.
- `src/types/budget-weekly.ts`: carries budget `icon` and `color` through budget contracts.
- `src/lib/api/route-schemas.ts`: validates budget appearance in create/update payloads.
- `src/db/budget-queries.ts`: selects, returns, creates, and updates budget appearance.
- `src/lib/queries/budget-weekly.ts`: maps budget option appearance.
- `src/lib/queries/budget-weekly.test.ts`: verifies fetcher mapping.
- `src/app/api/mutation-routes.test.ts`: verifies route payload validation and forwarding.
- `src/lib/services/expenses.ts`: joins latest budget appearance into expense rows.
- `src/lib/services/expenses.test.ts`: verifies server expense rows include appearance.
- `src/lib/services/reports.ts`: includes appearance in report transaction rows when budget metadata is returned.
- `src/lib/services/expense-sync.ts`: includes latest appearance in pull/push returned rows.
- `src/lib/services/expense-sync.test.ts`: verifies sync rows include latest appearance.
- `src/lib/expenses/list-model.ts`: adds nullable expense row appearance fields.
- `src/lib/sync/expenses/types.ts`: adds optional local snapshot fields.
- `src/lib/queries/expenses.ts`: accepts old records and normalizes missing appearance to `null`.
- `src/lib/sync/expenses/list.ts`: maps local snapshots into list rows.
- `src/lib/sync/expenses/actions.ts`: persists snapshot fields from mutation payloads.
- `src/lib/sync/expenses/actions.test.ts`: verifies snapshot persistence.
- `src/lib/sync/expenses/list.test.ts`: verifies snapshot row mapping.
- `src/lib/sync/expenses/coordinator.ts`: normalizes server sync rows with appearance.
- `src/lib/sync/expenses/coordinator.test.ts`: verifies older records and server rows.
- `src/stores/quick-expense-recovery-store.ts`: carries snapshots through failed draft recovery.
- `src/stores/quick-expense-recovery-store.test.ts`: verifies older and new recovery payloads.
- `src/components/BudgetWeeklyBudgetsClient.tsx`: adds appearance form controls and renders badges.
- `src/components/BudgetWeeklyBudgetsClient.mascot.test.tsx`: extends budget fixtures with appearance.
- `src/components/BudgetPickerSheet.tsx`: renders badges in budget option rows.
- `src/components/BudgetPickerSheet.test.tsx`: verifies option badge rendering.
- `src/components/BudgetTransferDrawer.tsx`: renders badges for destination and candidates.
- `src/components/BudgetTransferDrawer.test.tsx`: extends fixtures and verifies badges.
- `src/components/ExpenseListItem.tsx`: renders budget badge in expense rows.
- `src/components/ExpenseListItem.mascot.test.tsx`: extends fixtures with nullable appearance.
- `src/components/ExpenseList.test.tsx`: extends fixtures with nullable appearance.
- `src/components/QuickExpenseSheet.tsx`: carries selected budget snapshots through draft and payload.
- `src/components/QuickExpenseSheet.test.tsx`: verifies snapshot copy on submit and edit recovery.
- `src/components/ManualExpenseForm.tsx`: carries selected budget snapshots for advanced/manual submit payloads.
- `src/components/ExpenseEditSheetHost.tsx`: includes snapshot fields in initial edit data.
- `src/components/ExpenseEditSheetHost.test.tsx`: extends fixtures with appearance.
- `src/lib/mutations/index.ts`: carries snapshot fields into local expense writes.
- `src/lib/mutations/index.test.tsx`: verifies mutation payloads preserve snapshots.
- `src/lib/mutations/expense-optimistic.ts`: preserves appearance fields in optimistic expense rows.
- `src/lib/mutations/expense-optimistic.test.ts`: verifies optimistic rows include snapshots.

Read before editing:

- `.agents/rules/nextjs-code.md`
- `.agents/rules/tanstack-query.md`
- `.agents/rules/ios-input-focus.md`
- `LEARNINGS.md`
- `docs/superpowers/specs/2026-05-26-budget-appearance-design.md`

---

### Task 1: Budget Appearance Contract

**Files:**

- Create: `src/lib/budget-appearance.ts`
- Create: `migrations/0008_budget_appearance.sql`
- Modify: `migrations/meta/_journal.json`
- Modify: `src/db/schema.ts`
- Modify: `src/types/budget-weekly.ts`
- Test: `src/lib/budget-appearance.test.ts`

- [ ] **Step 1: Write the failing appearance helper tests**

Create `src/lib/budget-appearance.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  BUDGET_COLOR_OPTIONS,
  DEFAULT_BUDGET_COLOR,
  DEFAULT_BUDGET_ICON,
  isBudgetColorId,
  normalizeBudgetColor,
  normalizeBudgetIcon,
} from "./budget-appearance";

describe("budget appearance helpers", () => {
  it("defines exactly 12 unique palette options", () => {
    expect(BUDGET_COLOR_OPTIONS).toHaveLength(12);
    expect(new Set(BUDGET_COLOR_OPTIONS.map((option) => option.id)).size).toBe(
      12
    );
  });

  it("recognizes palette ids and rejects arbitrary colors", () => {
    expect(isBudgetColorId(DEFAULT_BUDGET_COLOR)).toBe(true);
    expect(isBudgetColorId("#ff00aa")).toBe(false);
    expect(isBudgetColorId("")).toBe(false);
  });

  it("normalizes icon and color fallback values", () => {
    expect(normalizeBudgetIcon(" 🍜 ")).toBe("🍜");
    expect(normalizeBudgetIcon("")).toBe(DEFAULT_BUDGET_ICON);
    expect(normalizeBudgetIcon("long-label")).toBe(DEFAULT_BUDGET_ICON);
    expect(normalizeBudgetColor("sky")).toBe("sky");
    expect(normalizeBudgetColor("custom")).toBe(DEFAULT_BUDGET_COLOR);
  });
});
```

- [ ] **Step 2: Run helper tests to verify they fail**

Run:

```bash
rtk bun run test src/lib/budget-appearance.test.ts
```

Expected: FAIL with a module resolution error for `./budget-appearance`.

- [ ] **Step 3: Implement `src/lib/budget-appearance.ts`**

Create `src/lib/budget-appearance.ts`:

```ts
export const DEFAULT_BUDGET_ICON = "💰";
export const DEFAULT_BUDGET_COLOR = "lime";

export const BUDGET_COLOR_OPTIONS = [
  {
    id: "lime",
    label: "Lime",
    chipClassName: "bg-primary/14 text-primary border-primary/30",
    swatchClassName: "bg-primary",
  },
  {
    id: "sky",
    label: "Sky",
    chipClassName: "bg-sky-400/14 text-sky-300 border-sky-300/30",
    swatchClassName: "bg-sky-400",
  },
  {
    id: "violet",
    label: "Violet",
    chipClassName: "bg-violet-400/14 text-violet-300 border-violet-300/30",
    swatchClassName: "bg-violet-400",
  },
  {
    id: "rose",
    label: "Rose",
    chipClassName: "bg-rose-400/14 text-rose-300 border-rose-300/30",
    swatchClassName: "bg-rose-400",
  },
  {
    id: "amber",
    label: "Amber",
    chipClassName: "bg-amber-400/14 text-amber-300 border-amber-300/30",
    swatchClassName: "bg-amber-400",
  },
  {
    id: "emerald",
    label: "Emerald",
    chipClassName: "bg-emerald-400/14 text-emerald-300 border-emerald-300/30",
    swatchClassName: "bg-emerald-400",
  },
  {
    id: "cyan",
    label: "Cyan",
    chipClassName: "bg-cyan-400/14 text-cyan-300 border-cyan-300/30",
    swatchClassName: "bg-cyan-400",
  },
  {
    id: "fuchsia",
    label: "Fuchsia",
    chipClassName: "bg-fuchsia-400/14 text-fuchsia-300 border-fuchsia-300/30",
    swatchClassName: "bg-fuchsia-400",
  },
  {
    id: "orange",
    label: "Orange",
    chipClassName: "bg-orange-400/14 text-orange-300 border-orange-300/30",
    swatchClassName: "bg-orange-400",
  },
  {
    id: "teal",
    label: "Teal",
    chipClassName: "bg-teal-400/14 text-teal-300 border-teal-300/30",
    swatchClassName: "bg-teal-400",
  },
  {
    id: "indigo",
    label: "Indigo",
    chipClassName: "bg-indigo-400/14 text-indigo-300 border-indigo-300/30",
    swatchClassName: "bg-indigo-400",
  },
  {
    id: "slate",
    label: "Slate",
    chipClassName: "bg-slate-400/14 text-slate-200 border-slate-300/30",
    swatchClassName: "bg-slate-400",
  },
] as const;

export type BudgetColorId = (typeof BUDGET_COLOR_OPTIONS)[number]["id"];

export const BUDGET_COLOR_IDS = BUDGET_COLOR_OPTIONS.map(
  (option) => option.id
) as [BudgetColorId, ...BudgetColorId[]];

export const isBudgetColorId = (value: unknown): value is BudgetColorId =>
  typeof value === "string" &&
  BUDGET_COLOR_OPTIONS.some((option) => option.id === value);

export const getBudgetColorOption = (value: unknown) =>
  BUDGET_COLOR_OPTIONS.find((option) => option.id === value) ??
  BUDGET_COLOR_OPTIONS[0];

export const normalizeBudgetColor = (value: unknown): BudgetColorId =>
  isBudgetColorId(value) ? value : DEFAULT_BUDGET_COLOR;

export const normalizeBudgetIcon = (value: unknown): string => {
  if (typeof value !== "string") {
    return DEFAULT_BUDGET_ICON;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 8) {
    return DEFAULT_BUDGET_ICON;
  }

  return trimmed;
};
```

- [ ] **Step 4: Add schema columns and migration**

Modify `src/db/schema.ts`:

```ts
import {
  type BudgetColorId,
  DEFAULT_BUDGET_COLOR,
  DEFAULT_BUDGET_ICON,
} from "@/lib/budget-appearance";
```

Inside `budgets` table after `amount`:

```ts
    icon: text("icon").notNull().default(DEFAULT_BUDGET_ICON),
    color: text("color")
      .$type<BudgetColorId>()
      .notNull()
      .default(DEFAULT_BUDGET_COLOR),
```

Create `migrations/0008_budget_appearance.sql`:

```sql
ALTER TABLE "budgets" ADD COLUMN "icon" text DEFAULT '💰' NOT NULL;--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "color" text DEFAULT 'lime' NOT NULL;
```

Add this object to `migrations/meta/_journal.json` after the `idx: 7` entry:

```json
{
  "idx": 8,
  "version": "7",
  "when": 1779790000000,
  "tag": "0008_budget_appearance",
  "breakpoints": true
}
```

- [ ] **Step 5: Extend shared budget types**

Modify `src/types/budget-weekly.ts`:

```ts
import type { BudgetColorId } from "@/lib/budget-appearance";
```

Add to `BudgetListItem` after `name`:

```ts
icon: string;
color: BudgetColorId;
```

Add to `BudgetCreateInput` after `name`:

```ts
icon: string;
color: BudgetColorId;
```

Add to `BudgetUpdateInput` after `name?: string;`:

```ts
  icon?: string;
  color?: BudgetColorId;
```

- [ ] **Step 6: Run helper tests**

Run:

```bash
rtk bun run test src/lib/budget-appearance.test.ts
```

Expected: PASS.

- [ ] **Step 7: Format, lint, and commit**

Run:

```bash
rtk bunx prettier --write src/lib/budget-appearance.ts src/lib/budget-appearance.test.ts src/db/schema.ts src/types/budget-weekly.ts
rtk bunx prettier --check src/lib/budget-appearance.ts src/lib/budget-appearance.test.ts src/db/schema.ts src/types/budget-weekly.ts
rtk bunx eslint src/lib/budget-appearance.ts src/lib/budget-appearance.test.ts src/db/schema.ts src/types/budget-weekly.ts
rtk git add src/lib/budget-appearance.ts src/lib/budget-appearance.test.ts src/db/schema.ts src/types/budget-weekly.ts migrations/0008_budget_appearance.sql migrations/meta/_journal.json
rtk git commit -m "feat(budget): add appearance contract"
```

Expected: Prettier check passes, ESLint exits 0, commit succeeds.

---

### Task 2: Budget API Validation And Query Mapping

**Files:**

- Modify: `src/lib/api/route-schemas.ts`
- Modify: `src/db/budget-queries.ts`
- Modify: `src/app/api/mutation-routes.test.ts`
- Modify: `src/lib/queries/budget-weekly.ts`
- Modify: `src/lib/queries/budget-weekly.test.ts`

- [ ] **Step 1: Add failing route tests for budget appearance payloads**

In `src/app/api/mutation-routes.test.ts`, update the "creates a weekly budget with a validated payload" payload:

```ts
const payload = {
  name: "Groceries",
  icon: "🛒",
  color: "emerald",
  amount: 1000000,
  period: "week",
  periodStartDate: "2026-05-18",
  periodEndDate: null,
};
```

Update the "updates a weekly budget with a validated payload" payload:

```ts
const payload = { icon: "🍜", color: "rose", amount: 900000 };
```

Add this test after the invalid weekly budget payload test:

```ts
it("returns 400 for an invalid weekly budget color", async () => {
  const response = await postWeeklyBudget(
    jsonRequest("http://localhost/api/weekly-budgets", {
      name: "Groceries",
      icon: "🛒",
      color: "custom-purple",
      amount: 1000000,
      period: "week",
      periodStartDate: "2026-05-18",
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
  expect(mocks.createBudget).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run route tests to verify they fail**

Run:

```bash
rtk bun run test src/app/api/mutation-routes.test.ts
```

Expected: FAIL because route schemas do not accept `icon` and `color`.

- [ ] **Step 3: Update route schemas**

Modify imports in `src/lib/api/route-schemas.ts`:

```ts
import { BUDGET_COLOR_IDS } from "@/lib/budget-appearance";
```

Add after `budgetPeriodSchema`:

```ts
const budgetIconSchema = z.string().trim().min(1).max(8);
const budgetColorSchema = z.enum(BUDGET_COLOR_IDS);
```

Add to `budgetCreatePayloadSchema` object:

```ts
icon: budgetIconSchema,
color: budgetColorSchema,
```

Add to `budgetUpdatePayloadSchema` object:

```ts
icon: budgetIconSchema.optional(),
color: budgetColorSchema.optional(),
```

- [ ] **Step 4: Update budget query selects and writes**

In `src/db/budget-queries.ts`, import:

```ts
import {
  normalizeBudgetColor,
  normalizeBudgetIcon,
} from "@/lib/budget-appearance";
```

For every budget row select that returns `BudgetListItem`, include:

```ts
icon: budgets.icon,
color: budgets.color,
```

For every `groupBy` containing budget fields, add:

```ts
budgets.icon,
budgets.color,
```

For every returned budget list item object, add:

```ts
icon: normalizeBudgetIcon(budget.icon),
color: normalizeBudgetColor(budget.color),
```

In `createBudget`, add to `.values`:

```ts
icon: normalizeBudgetIcon(input.icon),
color: normalizeBudgetColor(input.color),
```

In `updateBudget`, add before date normalization:

```ts
if (typeof input.icon === "string") {
  updates.icon = normalizeBudgetIcon(input.icon);
}
if (typeof input.color === "string") {
  updates.color = normalizeBudgetColor(input.color);
}
```

Change the `updates` declaration to:

```ts
const updates: Partial<typeof budgets.$inferInsert> = {};
```

- [ ] **Step 5: Add failing budget weekly fetcher mapping test**

In `src/lib/queries/budget-weekly.test.ts`, add a mocked response budget with appearance:

```ts
{
  id: 1,
  name: "Food week",
  icon: "🍜",
  color: "rose",
  period: "week",
  periodStartDate: "2026-05-18",
  periodEndDate: "2026-05-24",
  amount: 1000000,
  spent: 250000,
  remaining: 750000,
}
```

Assert the mapped option contains:

```ts
expect(result[0]).toMatchObject({
  id: 1,
  name: "Food week",
  icon: "🍜",
  color: "rose",
});
```

- [ ] **Step 6: Update `src/lib/queries/budget-weekly.ts`**

Import:

```ts
import {
  type BudgetColorId,
  normalizeBudgetColor,
  normalizeBudgetIcon,
} from "@/lib/budget-appearance";
```

Add response fields:

```ts
icon?: string;
color?: string | null;
```

Add option fields:

```ts
icon: string;
color: BudgetColorId;
```

Add to mapped option:

```ts
icon: normalizeBudgetIcon(budget.icon),
color: normalizeBudgetColor(budget.color),
```

- [ ] **Step 7: Run targeted tests**

Run:

```bash
rtk bun run test src/app/api/mutation-routes.test.ts src/lib/queries/budget-weekly.test.ts
```

Expected: PASS.

- [ ] **Step 8: Format, lint, and commit**

Run:

```bash
rtk bunx prettier --write src/lib/api/route-schemas.ts src/db/budget-queries.ts src/app/api/mutation-routes.test.ts src/lib/queries/budget-weekly.ts src/lib/queries/budget-weekly.test.ts
rtk bunx prettier --check src/lib/api/route-schemas.ts src/db/budget-queries.ts src/app/api/mutation-routes.test.ts src/lib/queries/budget-weekly.ts src/lib/queries/budget-weekly.test.ts
rtk bunx eslint src/lib/api/route-schemas.ts src/db/budget-queries.ts src/app/api/mutation-routes.test.ts src/lib/queries/budget-weekly.ts src/lib/queries/budget-weekly.test.ts
rtk git add src/lib/api/route-schemas.ts src/db/budget-queries.ts src/app/api/mutation-routes.test.ts src/lib/queries/budget-weekly.ts src/lib/queries/budget-weekly.test.ts
rtk git commit -m "feat(budget): validate and return appearance"
```

Expected: checks pass and commit succeeds.

---

### Task 3: Server Expense Rows Use Latest Budget Appearance

**Files:**

- Modify: `src/lib/expenses/list-model.ts`
- Modify: `src/lib/services/expenses.ts`
- Modify: `src/lib/services/expenses.test.ts`
- Modify: `src/lib/services/expense-sync.ts`
- Modify: `src/lib/services/expense-sync.test.ts`
- Modify: `src/lib/services/reports.ts`
- Modify: `src/app/api/read-routes.test.ts`

- [ ] **Step 1: Extend expense list row type**

Modify `src/lib/expenses/list-model.ts`:

```ts
import type { BudgetColorId } from "@/lib/budget-appearance";
```

Add to `ExpenseListItem` after `budgetName`:

```ts
budgetIcon: string | null;
budgetColor: BudgetColorId | null;
```

- [ ] **Step 2: Add failing service expectations for latest appearance**

In `src/lib/services/expenses.test.ts`, update the mocked DB row with a budget:

```ts
budgetName: "Meals",
budgetIcon: "🍜",
budgetColor: "rose",
```

Add expected row fields:

```ts
budgetIcon: "🍜",
budgetColor: "rose",
```

For rows without budget, add:

```ts
budgetIcon: null,
budgetColor: null,
```

- [ ] **Step 3: Update `getExpenseList` joins and normalization**

In `src/lib/services/expenses.ts`, import:

```ts
import {
  normalizeBudgetColor,
  normalizeBudgetIcon,
} from "@/lib/budget-appearance";
```

Add to select:

```ts
budgetIcon: budgets.icon,
budgetColor: budgets.color,
```

Add to normalized row:

```ts
budgetIcon:
  expense.budgetId === null ? null : normalizeBudgetIcon(expense.budgetIcon),
budgetColor:
  expense.budgetId === null ? null : normalizeBudgetColor(expense.budgetColor),
```

- [ ] **Step 4: Update expense sync server row contract**

In `src/lib/services/expense-sync.ts`, import:

```ts
import {
  type BudgetColorId,
  normalizeBudgetColor,
  normalizeBudgetIcon,
} from "@/lib/budget-appearance";
```

Add to `ExpenseSyncServerRow`:

```ts
budgetIcon: string | null;
budgetColor: BudgetColorId | null;
```

Add to `ExpenseSyncRowQueryResult`:

```ts
budgetIcon: string | null;
budgetColor: string | null;
```

Add to `toExpenseSyncServerRow`:

```ts
budgetIcon: row.budgetId === null ? null : normalizeBudgetIcon(row.budgetIcon),
budgetColor:
  row.budgetId === null ? null : normalizeBudgetColor(row.budgetColor),
```

Add to both expense sync selects:

```ts
budgetIcon: budgets.icon,
budgetColor: budgets.color,
```

- [ ] **Step 5: Update expense sync tests**

In `src/lib/services/expense-sync.test.ts`, add to mocked rows with budget:

```ts
budgetIcon: "🍜",
budgetColor: "rose",
```

Add to expected rows:

```ts
budgetIcon: "🍜",
budgetColor: "rose",
```

For rows without budget, expect:

```ts
budgetIcon: null,
budgetColor: null,
```

- [ ] **Step 6: Update reports service transaction metadata**

In `src/lib/services/reports.ts`, add to report row types that currently contain `budgetName`:

```ts
budgetIcon: string | null;
budgetColor: BudgetColorId | null;
```

Import:

```ts
import {
  type BudgetColorId,
  normalizeBudgetColor,
  normalizeBudgetIcon,
} from "@/lib/budget-appearance";
```

Add to selects that join budgets:

```ts
budgetIcon: budgets.icon,
budgetColor: budgets.color,
```

Add to normalized report rows:

```ts
budgetIcon: expense.budgetId === null ? null : normalizeBudgetIcon(expense.budgetIcon),
budgetColor:
  expense.budgetId === null ? null : normalizeBudgetColor(expense.budgetColor),
```

- [ ] **Step 7: Run server read tests**

Run:

```bash
rtk bun run test src/lib/services/expenses.test.ts src/lib/services/expense-sync.test.ts src/lib/services/reports.test.ts src/app/api/read-routes.test.ts
```

Expected: PASS.

- [ ] **Step 8: Format, lint, and commit**

Run:

```bash
rtk bunx prettier --write src/lib/expenses/list-model.ts src/lib/services/expenses.ts src/lib/services/expenses.test.ts src/lib/services/expense-sync.ts src/lib/services/expense-sync.test.ts src/lib/services/reports.ts src/app/api/read-routes.test.ts
rtk bunx prettier --check src/lib/expenses/list-model.ts src/lib/services/expenses.ts src/lib/services/expenses.test.ts src/lib/services/expense-sync.ts src/lib/services/expense-sync.test.ts src/lib/services/reports.ts src/app/api/read-routes.test.ts
rtk bunx eslint src/lib/expenses/list-model.ts src/lib/services/expenses.ts src/lib/services/expenses.test.ts src/lib/services/expense-sync.ts src/lib/services/expense-sync.test.ts src/lib/services/reports.ts src/app/api/read-routes.test.ts
rtk git add src/lib/expenses/list-model.ts src/lib/services/expenses.ts src/lib/services/expenses.test.ts src/lib/services/expense-sync.ts src/lib/services/expense-sync.test.ts src/lib/services/reports.ts src/app/api/read-routes.test.ts
rtk git commit -m "feat(expense): return latest budget appearance"
```

Expected: checks pass and commit succeeds.

---

### Task 4: Local Expense Snapshot Contract

**Files:**

- Modify: `src/lib/sync/expenses/types.ts`
- Modify: `src/lib/queries/expenses.ts`
- Modify: `src/lib/sync/expenses/list.ts`
- Modify: `src/lib/sync/expenses/actions.ts`
- Modify: `src/lib/sync/expenses/coordinator.ts`
- Modify: `src/stores/quick-expense-recovery-store.ts`
- Modify tests beside each file

- [ ] **Step 1: Extend local expense payload types**

Modify `src/lib/sync/expenses/types.ts`:

```ts
import type { BudgetColorId } from "@/lib/budget-appearance";
```

Add to `ExpensePayload`:

```ts
budgetIcon?: string | null;
budgetColor?: BudgetColorId | null;
```

- [ ] **Step 2: Update browser local record guard**

Modify `src/lib/queries/expenses.ts` imports:

```ts
import {
  normalizeBudgetColor,
  normalizeBudgetIcon,
} from "@/lib/budget-appearance";
```

Change `isExpensePayload` so it accepts optional appearance fields:

```ts
const hasValidOptionalBudgetAppearance =
  (typeof candidate.budgetIcon === "string" ||
    candidate.budgetIcon === null ||
    typeof candidate.budgetIcon === "undefined") &&
  (typeof candidate.budgetColor === "string" ||
    candidate.budgetColor === null ||
    typeof candidate.budgetColor === "undefined");
```

Include `hasValidOptionalBudgetAppearance` in the returned boolean.

In `syncRecordToLocalExpense`, spread payload first and normalize after spread:

```ts
const budgetIcon =
  record.payload.budgetId === null
    ? null
    : record.payload.budgetIcon
      ? normalizeBudgetIcon(record.payload.budgetIcon)
      : null;
const budgetColor =
  record.payload.budgetId === null
    ? null
    : record.payload.budgetColor
      ? normalizeBudgetColor(record.payload.budgetColor)
      : null;

return {
  entity: EXPENSE_SYNC_ENTITY,
  clientId: record.clientId,
  serverId: record.serverId,
  syncStatus: record.syncStatus,
  lastError: record.lastError,
  updatedAt: record.updatedAt,
  serverUpdatedAt: record.serverUpdatedAt,
  ...record.payload,
  budgetIcon,
  budgetColor,
};
```

- [ ] **Step 3: Update local list mapping**

In `src/lib/sync/expenses/list.ts`, add to `localExpenseToListItem`:

```ts
budgetIcon: row.budgetIcon ?? null,
budgetColor: row.budgetColor ?? null,
```

- [ ] **Step 4: Update local expense actions**

In `src/lib/sync/expenses/actions.ts`, add to `toExpensePayload`:

```ts
budgetIcon: expense.budgetIcon ?? null,
budgetColor: expense.budgetColor ?? null,
```

Add to created local expense:

```ts
budgetIcon: input.budgetIcon ?? null,
budgetColor: input.budgetColor ?? null,
```

Add to updated local expense:

```ts
budgetIcon:
  typeof input.budgetId !== "undefined"
    ? input.budgetId === null
      ? null
      : (input.budgetIcon ?? existingExpense.budgetIcon ?? null)
    : (existingExpense.budgetIcon ?? null),
budgetColor:
  typeof input.budgetId !== "undefined"
    ? input.budgetId === null
      ? null
      : (input.budgetColor ?? existingExpense.budgetColor ?? null)
    : (existingExpense.budgetColor ?? null),
```

- [ ] **Step 5: Update recovery store contract**

Modify `src/stores/quick-expense-recovery-store.ts` imports:

```ts
import type { BudgetColorId } from "@/lib/budget-appearance";
```

Add to `TQuickExpensePayload`:

```ts
budgetIcon?: string | null;
budgetColor?: BudgetColorId | null;
```

Update `isRecoverableExpense` with optional appearance checks:

```ts
const hasValidBudgetAppearance =
  (typeof value.budgetIcon === "string" ||
    value.budgetIcon === null ||
    typeof value.budgetIcon === "undefined") &&
  (typeof value.budgetColor === "string" ||
    value.budgetColor === null ||
    typeof value.budgetColor === "undefined");
```

Include `hasValidBudgetAppearance` in the return expression.

Add to `draft` in `quickExpenseRecoveryEntryFromOutboxOperation`:

```ts
budgetIcon: operation.payload.budgetIcon ?? null,
budgetColor: operation.payload.budgetColor ?? null,
```

- [ ] **Step 6: Update local sync coordinator normalization**

In `src/lib/sync/expenses/coordinator.ts`, update payload guards to accept optional `budgetIcon` and `budgetColor`, and when mapping server rows to local expenses add:

```ts
budgetIcon: row.budgetIcon ?? null,
budgetColor: row.budgetColor ?? null,
```

When mapping local records to sync records, preserve:

```ts
budgetIcon: expense.budgetIcon ?? null,
budgetColor: expense.budgetColor ?? null,
```

- [ ] **Step 7: Add and update local snapshot tests**

In `src/lib/sync/expenses/actions.test.ts`, add a create test:

```ts
it("persists budget appearance snapshots for local creates", async () => {
  const store = createExpenseSyncStore();

  const created = await createLocalExpense(store, {
    date: "2026-05-26",
    amount: 120000,
    note: "Lunch",
    category: "Food",
    paidBy: "Cubi",
    budgetId: 10,
    budgetName: "Meals",
    budgetIcon: "🍜",
    budgetColor: "rose",
  });

  expect(created).toMatchObject({
    budgetId: 10,
    budgetName: "Meals",
    budgetIcon: "🍜",
    budgetColor: "rose",
  });
});
```

In `src/lib/sync/expenses/list.test.ts`, add:

```ts
it("maps budget appearance snapshots into local list rows", () => {
  const result = buildExpenseListResultFromLocalRows([
    row({
      budgetId: 10,
      budgetName: "Meals",
      budgetIcon: "🍜",
      budgetColor: "rose",
    }),
  ]);

  expect(result.rows[0]).toMatchObject({
    budgetIcon: "🍜",
    budgetColor: "rose",
  });
});
```

In `src/stores/quick-expense-recovery-store.test.ts`, add:

```ts
it("restores budget appearance snapshots from failed outbox operations", () => {
  const store = createQuickExpenseRecoveryStore();

  store.getState().syncFailedOutboxEntries([
    {
      entity: "expenses",
      operationId: "op-appearance",
      type: "create",
      clientId: "client-1",
      serverId: null,
      payload: {
        ...localExpense,
        budgetId: 10,
        budgetName: "Meals",
        budgetIcon: "🍜",
        budgetColor: "rose",
      },
      createdAt: new Date().toISOString(),
      lastAttemptAt: null,
      lastError: "Network failed",
      attemptCount: 1,
    },
  ]);

  expect(store.getState().entries["op-appearance"]?.draft).toMatchObject({
    budgetIcon: "🍜",
    budgetColor: "rose",
  });
});
```

- [ ] **Step 8: Run local sync and recovery tests**

Run:

```bash
rtk bun run test src/lib/queries/expenses.client-boundary.test.ts src/lib/sync/expenses/actions.test.ts src/lib/sync/expenses/list.test.ts src/lib/sync/expenses/coordinator.test.ts src/stores/quick-expense-recovery-store.test.ts
```

Expected: PASS.

- [ ] **Step 9: Format, lint, and commit**

Run:

```bash
rtk bunx prettier --write src/lib/sync/expenses/types.ts src/lib/queries/expenses.ts src/lib/sync/expenses/list.ts src/lib/sync/expenses/actions.ts src/lib/sync/expenses/coordinator.ts src/stores/quick-expense-recovery-store.ts src/lib/queries/expenses.client-boundary.test.ts src/lib/sync/expenses/actions.test.ts src/lib/sync/expenses/list.test.ts src/lib/sync/expenses/coordinator.test.ts src/stores/quick-expense-recovery-store.test.ts
rtk bunx prettier --check src/lib/sync/expenses/types.ts src/lib/queries/expenses.ts src/lib/sync/expenses/list.ts src/lib/sync/expenses/actions.ts src/lib/sync/expenses/coordinator.ts src/stores/quick-expense-recovery-store.ts src/lib/queries/expenses.client-boundary.test.ts src/lib/sync/expenses/actions.test.ts src/lib/sync/expenses/list.test.ts src/lib/sync/expenses/coordinator.test.ts src/stores/quick-expense-recovery-store.test.ts
rtk bunx eslint src/lib/sync/expenses/types.ts src/lib/queries/expenses.ts src/lib/sync/expenses/list.ts src/lib/sync/expenses/actions.ts src/lib/sync/expenses/coordinator.ts src/stores/quick-expense-recovery-store.ts src/lib/queries/expenses.client-boundary.test.ts src/lib/sync/expenses/actions.test.ts src/lib/sync/expenses/list.test.ts src/lib/sync/expenses/coordinator.test.ts src/stores/quick-expense-recovery-store.test.ts
rtk git add src/lib/sync/expenses/types.ts src/lib/queries/expenses.ts src/lib/sync/expenses/list.ts src/lib/sync/expenses/actions.ts src/lib/sync/expenses/coordinator.ts src/stores/quick-expense-recovery-store.ts src/lib/queries/expenses.client-boundary.test.ts src/lib/sync/expenses/actions.test.ts src/lib/sync/expenses/list.test.ts src/lib/sync/expenses/coordinator.test.ts src/stores/quick-expense-recovery-store.test.ts
rtk git commit -m "feat(expense): persist budget appearance snapshots"
```

Expected: checks pass and commit succeeds.

---

### Task 5: Shared Budget Badge Component

**Files:**

- Create: `src/components/BudgetBadge.tsx`
- Create: `src/components/BudgetBadge.test.tsx`

- [ ] **Step 1: Write failing badge tests**

Create `src/components/BudgetBadge.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import BudgetBadge from "./BudgetBadge";

describe("BudgetBadge", () => {
  it("renders budget icon and name", () => {
    render(<BudgetBadge icon="🍜" color="rose" name="Meals" />);

    expect(screen.getByText("🍜")).toBeInTheDocument();
    expect(screen.getByText("Meals")).toBeInTheDocument();
    expect(screen.getByLabelText("Budget: Meals")).toBeInTheDocument();
  });

  it("uses fallback appearance for missing icon and color", () => {
    render(<BudgetBadge icon={null} color={null} name="Budget assigned" />);

    expect(screen.getByText("💰")).toBeInTheDocument();
    expect(screen.getByText("Budget assigned")).toBeInTheDocument();
  });

  it("can render icon-only for dense controls", () => {
    render(<BudgetBadge icon="🛒" color="emerald" name="Groceries" iconOnly />);

    expect(screen.getByText("🛒")).toBeInTheDocument();
    expect(screen.queryByText("Groceries")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run badge tests to verify they fail**

Run:

```bash
rtk bun run test src/components/BudgetBadge.test.tsx
```

Expected: FAIL with module resolution error for `./BudgetBadge`.

- [ ] **Step 3: Implement `BudgetBadge`**

Create `src/components/BudgetBadge.tsx`:

```tsx
"use client";

import React from "react";

import {
  type BudgetColorId,
  getBudgetColorOption,
  normalizeBudgetColor,
  normalizeBudgetIcon,
} from "@/lib/budget-appearance";
import { cn } from "@/lib/utils";

export type TBudgetBadgeProps = {
  icon?: string | null;
  color?: BudgetColorId | string | null;
  name?: string | null;
  iconOnly?: boolean;
  className?: string;
  iconClassName?: string;
  nameClassName?: string;
};

const BudgetBadge = ({
  icon,
  color,
  name,
  iconOnly = false,
  className,
  iconClassName,
  nameClassName,
}: TBudgetBadgeProps) => {
  const normalizedIcon = normalizeBudgetIcon(icon);
  const colorOption = getBudgetColorOption(normalizeBudgetColor(color));
  const label = name?.trim() || "Budget assigned";

  return (
    <span
      aria-label={`Budget: ${label}`}
      className={cn(
        "inline-flex min-w-0 items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium",
        colorOption.chipClassName,
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid size-5 shrink-0 place-items-center text-sm",
          iconClassName
        )}
      >
        {normalizedIcon}
      </span>
      {iconOnly ? null : (
        <span className={cn("min-w-0 truncate", nameClassName)}>{label}</span>
      )}
    </span>
  );
};

export default BudgetBadge;
```

- [ ] **Step 4: Run badge tests**

Run:

```bash
rtk bun run test src/components/BudgetBadge.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Format, lint, and commit**

Run:

```bash
rtk bunx prettier --write src/components/BudgetBadge.tsx src/components/BudgetBadge.test.tsx
rtk bunx prettier --check src/components/BudgetBadge.tsx src/components/BudgetBadge.test.tsx
rtk bunx eslint src/components/BudgetBadge.tsx src/components/BudgetBadge.test.tsx
rtk git add src/components/BudgetBadge.tsx src/components/BudgetBadge.test.tsx
rtk git commit -m "feat(budget): add shared appearance badge"
```

Expected: checks pass and commit succeeds.

---

### Task 6: Budget Management UI

**Files:**

- Modify: `src/components/BudgetWeeklyBudgetsClient.tsx`
- Modify: `src/components/BudgetWeeklyBudgetsClient.mascot.test.tsx`

- [ ] **Step 1: Add budget fixture appearance to tests**

In `src/components/BudgetWeeklyBudgetsClient.mascot.test.tsx`, add to every `BudgetListItem` fixture:

```ts
icon: "🛒",
color: "emerald",
```

- [ ] **Step 2: Add form state and reset helpers**

In `src/components/BudgetWeeklyBudgetsClient.tsx`, import:

```ts
import {
  BUDGET_COLOR_OPTIONS,
  type BudgetColorId,
  DEFAULT_BUDGET_COLOR,
  DEFAULT_BUDGET_ICON,
  normalizeBudgetColor,
  normalizeBudgetIcon,
} from "@/lib/budget-appearance";
import { Check } from "lucide-react";

import BudgetBadge from "@/components/BudgetBadge";
```

Add state near the existing budget form fields:

```ts
const [icon, setIcon] = useState(DEFAULT_BUDGET_ICON);
const [color, setColor] = useState<BudgetColorId>(DEFAULT_BUDGET_COLOR);
```

Add helper:

```ts
const resetBudgetAppearance = () => {
  setIcon(DEFAULT_BUDGET_ICON);
  setColor(DEFAULT_BUDGET_COLOR);
};
```

In `handleOpenChange(false)` and `openCreate`, call `resetBudgetAppearance()`.

In `openEdit`, add:

```ts
setIcon(normalizeBudgetIcon(budget.icon));
setColor(normalizeBudgetColor(budget.color));
```

- [ ] **Step 3: Include appearance in submit payloads**

In `handleSubmit`, add to update input:

```ts
icon,
color,
```

Add to create input:

```ts
icon,
color,
```

- [ ] **Step 4: Render badge on budget cards**

In `renderBudgetItem`, replace the budget name paragraph with:

```tsx
<BudgetBadge
  icon={budget.icon}
  color={budget.color}
  name={budget.name}
  className="max-w-[68%] px-2.5 py-1"
  nameClassName="text-sm font-semibold sm:text-base"
/>
```

- [ ] **Step 5: Render detail drawer badge**

In detail drawer header area, change title content to:

```tsx
<DrawerTitle>
  {detailBudget ? (
    <BudgetBadge
      icon={detailBudget.icon}
      color={detailBudget.color}
      name={detailBudget.name}
      className="max-w-full"
    />
  ) : (
    "Budget detail"
  )}
</DrawerTitle>
```

- [ ] **Step 6: Add appearance controls to the create/edit drawer**

Insert this block in the form after the budget name input block:

```tsx
<div className="space-y-3">
  <div className="flex items-center justify-between gap-3">
    <div>
      <label
        htmlFor="budget-icon-input"
        className="text-foreground text-sm font-medium"
      >
        Appearance
      </label>
      <p className="text-muted-foreground mt-1 text-[11px]">
        Pick an emoji and color for budget badges.
      </p>
    </div>
    <BudgetBadge icon={icon} color={color} name={trimmedName || "Budget"} />
  </div>
  <Input
    id="budget-icon-input"
    value={icon}
    onChange={(event) => setIcon(event.target.value.slice(0, 8))}
    onBlur={() => setIcon((current) => normalizeBudgetIcon(current))}
    aria-label="Budget icon"
    className="h-11 w-20 text-center text-lg"
  />
  <div className="grid grid-cols-6 gap-2">
    {BUDGET_COLOR_OPTIONS.map((option) => {
      const selected = color === option.id;
      return (
        <button
          key={option.id}
          type="button"
          aria-label={`Budget color ${option.label}`}
          aria-pressed={selected}
          onClick={() => setColor(option.id)}
          className={cn(
            "focus-visible:ring-ring/40 grid size-10 place-items-center rounded-xl border transition-[transform,border-color,box-shadow] focus-visible:ring-2 focus-visible:outline-none active:scale-[0.96]",
            selected ? "border-primary shadow-sm" : "border-border/60"
          )}
        >
          <span className={cn("size-5 rounded-full", option.swatchClassName)} />
          {selected ? (
            <Check className="text-foreground absolute h-3.5 w-3.5" />
          ) : null}
        </button>
      );
    })}
  </div>
</div>
```

- [ ] **Step 7: Run budget UI tests**

Run:

```bash
rtk bun run test src/components/BudgetWeeklyBudgetsClient.mascot.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Format, lint, and commit**

Run:

```bash
rtk bunx prettier --write src/components/BudgetWeeklyBudgetsClient.tsx src/components/BudgetWeeklyBudgetsClient.mascot.test.tsx
rtk bunx prettier --check src/components/BudgetWeeklyBudgetsClient.tsx src/components/BudgetWeeklyBudgetsClient.mascot.test.tsx
rtk bunx eslint src/components/BudgetWeeklyBudgetsClient.tsx src/components/BudgetWeeklyBudgetsClient.mascot.test.tsx
rtk git add src/components/BudgetWeeklyBudgetsClient.tsx src/components/BudgetWeeklyBudgetsClient.mascot.test.tsx
rtk git commit -m "feat(budget): edit appearance in budget drawer"
```

Expected: checks pass and commit succeeds.

---

### Task 7: Budget Picker And Transfer Badges

**Files:**

- Modify: `src/components/BudgetPickerSheet.tsx`
- Modify: `src/components/BudgetPickerSheet.test.tsx`
- Modify: `src/components/BudgetTransferDrawer.tsx`
- Modify: `src/components/BudgetTransferDrawer.test.tsx`
- Modify: `src/lib/budget-transfer-groups.test.ts`
- Modify: `src/lib/budget-options.test.ts`

- [ ] **Step 1: Extend picker and transfer fixtures**

In `src/components/BudgetPickerSheet.test.tsx`, add to each `BudgetWeeklyOption`:

```ts
icon: "🍜",
color: "rose",
```

Use different values for the second option:

```ts
icon: "🏠",
color: "sky",
```

In `src/components/BudgetTransferDrawer.test.tsx`, `src/lib/budget-transfer-groups.test.ts`, and `src/lib/budget-options.test.ts`, add default appearance to budget factories:

```ts
icon: "💰",
color: "lime",
```

- [ ] **Step 2: Render badges in `BudgetPickerSheet`**

In `src/components/BudgetPickerSheet.tsx`, import:

```ts
import BudgetBadge from "@/components/BudgetBadge";
```

Replace the row name/range area with:

```tsx
<span className="flex min-w-0 flex-col gap-1">
  <BudgetBadge
    icon={budget.icon}
    color={budget.color}
    name={budget.name}
    className="max-w-full border-0 bg-transparent px-0 py-0"
    nameClassName="text-sm font-medium"
  />
  <span className="text-muted-foreground text-xs">
    {formatBudgetRange(budget)}
  </span>
</span>
```

- [ ] **Step 3: Add picker badge assertion**

In `src/components/BudgetPickerSheet.test.tsx`, add:

```ts
expect(await screen.findByLabelText("Budget: Food week")).toBeInTheDocument();
expect(screen.getByText("🍜")).toBeInTheDocument();
```

- [ ] **Step 4: Render badges in `BudgetTransferDrawer`**

In `src/components/BudgetTransferDrawer.tsx`, import `BudgetBadge` and replace budget name text in destination and candidate rows with:

```tsx
<BudgetBadge
  icon={budget.icon}
  color={budget.color}
  name={budget.name}
  className="max-w-full border-0 bg-transparent px-0 py-0"
/>
```

Use `destination` instead of `budget` in the destination summary block.

- [ ] **Step 5: Run picker and transfer tests**

Run:

```bash
rtk bun run test src/components/BudgetPickerSheet.test.tsx src/components/BudgetTransferDrawer.test.tsx src/lib/budget-transfer-groups.test.ts src/lib/budget-options.test.ts
```

Expected: PASS.

- [ ] **Step 6: Format, lint, and commit**

Run:

```bash
rtk bunx prettier --write src/components/BudgetPickerSheet.tsx src/components/BudgetPickerSheet.test.tsx src/components/BudgetTransferDrawer.tsx src/components/BudgetTransferDrawer.test.tsx src/lib/budget-transfer-groups.test.ts src/lib/budget-options.test.ts
rtk bunx prettier --check src/components/BudgetPickerSheet.tsx src/components/BudgetPickerSheet.test.tsx src/components/BudgetTransferDrawer.tsx src/components/BudgetTransferDrawer.test.tsx src/lib/budget-transfer-groups.test.ts src/lib/budget-options.test.ts
rtk bunx eslint src/components/BudgetPickerSheet.tsx src/components/BudgetPickerSheet.test.tsx src/components/BudgetTransferDrawer.tsx src/components/BudgetTransferDrawer.test.tsx src/lib/budget-transfer-groups.test.ts src/lib/budget-options.test.ts
rtk git add src/components/BudgetPickerSheet.tsx src/components/BudgetPickerSheet.test.tsx src/components/BudgetTransferDrawer.tsx src/components/BudgetTransferDrawer.test.tsx src/lib/budget-transfer-groups.test.ts src/lib/budget-options.test.ts
rtk git commit -m "feat(budget): show appearance in pickers"
```

Expected: checks pass and commit succeeds.

---

### Task 8: Expense Rows And Expense Draft Snapshots

**Files:**

- Modify: `src/components/ExpenseListItem.tsx`
- Modify: `src/components/ExpenseListItem.mascot.test.tsx`
- Modify: `src/components/ExpenseList.test.tsx`
- Modify: `src/components/QuickExpenseSheet.tsx`
- Modify: `src/components/QuickExpenseSheet.test.tsx`
- Modify: `src/components/ManualExpenseForm.tsx`
- Modify: `src/components/ExpenseEditSheetHost.tsx`
- Modify: `src/components/ExpenseEditSheetHost.test.tsx`
- Modify: `src/lib/mutations/index.ts`
- Modify: `src/lib/mutations/index.test.tsx`
- Modify: `src/lib/mutations/expense-optimistic.ts`
- Modify: `src/lib/mutations/expense-optimistic.test.ts`

- [ ] **Step 1: Add expense row badge rendering**

In `src/components/ExpenseListItem.tsx`, import:

```ts
import type { BudgetColorId } from "@/lib/budget-appearance";

import BudgetBadge from "@/components/BudgetBadge";
```

Add to `ExpenseListItemData`:

```ts
budgetIcon?: string | null;
budgetColor?: BudgetColorId | null;
```

Replace the current budget pill:

```tsx
<p className="bg-success/10 text-success max-w-[160px] truncate rounded-2xl px-3 text-sm">
  {budgetBadgeLabel}
</p>
```

with:

```tsx
<BudgetBadge
  icon={expense.budgetIcon ?? null}
  color={expense.budgetColor ?? null}
  name={budgetBadgeLabel}
  className="max-w-[160px] px-2.5 py-0.5 text-sm"
/>
```

- [ ] **Step 2: Extend expense fixtures**

In every expense fixture in `src/components/ExpenseListItem.mascot.test.tsx`, `src/components/ExpenseList.test.tsx`, and `src/components/ExpenseEditSheetHost.test.tsx`, add:

```ts
budgetIcon: null,
budgetColor: null,
```

For fixtures with `budgetName`, use:

```ts
budgetIcon: "🍜",
budgetColor: "rose",
```

- [ ] **Step 3: Extend mutation input types and local write fallback**

In `src/db/type.d.ts`, add optional appearance fields beside `budgetName`:

```ts
budgetIcon?: string | null;
budgetColor?: BudgetColorId | null;
```

Import `BudgetColorId` at the top:

```ts
import type { BudgetColorId } from "@/lib/budget-appearance";
```

In `src/lib/mutations/index.ts`, when building `LocalExpense` in `ensureLocalExpenseForUpdate`, add:

```ts
budgetIcon: input.budgetIcon ?? null,
budgetColor: input.budgetColor ?? null,
```

In `ensureLocalExpenseForDelete`, add:

```ts
budgetIcon: null,
budgetColor: null,
```

- [ ] **Step 4: Copy snapshots in `QuickExpenseSheet`**

In `src/components/QuickExpenseSheet.tsx`, update `TQuickExpenseSheetInitialExpense` with:

```ts
budgetIcon?: string | null;
budgetColor?: BudgetColorId | null;
```

Import `BudgetColorId`.

Add to `buildDefaultDraft`:

```ts
budgetIcon: null,
budgetColor: null,
```

Add to `buildDraftFromExpense`:

```ts
budgetIcon: initialExpense.budgetIcon ?? null,
budgetColor: initialExpense.budgetColor ?? null,
```

Add to `cloneExpenseDraft` and `buildQuickExpensePayload`:

```ts
budgetIcon: draft.budgetIcon ?? null,
budgetColor: draft.budgetColor ?? null,
```

In `handleSubmit`, derive selected budget once:

```ts
const selectedBudget =
  draft.budgetId === null
    ? null
    : (budgetOptionsQuery.data?.find(
        (budget) => budget.id === draft.budgetId
      ) ?? null);
```

Update the submitted draft:

```ts
const submittedDraft = cloneExpenseDraft({
  ...draft,
  budgetName:
    draft.budgetId === null
      ? null
      : (selectedBudget?.name ?? draft.budgetName ?? null),
  budgetIcon:
    draft.budgetId === null
      ? null
      : (selectedBudget?.icon ?? draft.budgetIcon ?? null),
  budgetColor:
    draft.budgetId === null
      ? null
      : (selectedBudget?.color ?? draft.budgetColor ?? null),
});
```

When clearing an invalid budget option, clear all snapshots:

```ts
setDraft((prev) => ({
  ...prev,
  budgetId: null,
  budgetName: null,
  budgetIcon: null,
  budgetColor: null,
}));
```

When `BudgetPickerSheet` changes, replace `onChange={(id) => setField("budgetId", id)}` with:

```tsx
onChange={(id) => {
  const selected = budgetOptionsQuery.data?.find((budget) => budget.id === id);
  setDraft((prev) => ({
    ...prev,
    budgetId: id,
    budgetName: id === null ? null : (selected?.name ?? null),
    budgetIcon: id === null ? null : (selected?.icon ?? null),
    budgetColor: id === null ? null : (selected?.color ?? null),
  }));
}}
```

- [ ] **Step 5: Copy snapshots in `ManualExpenseForm`**

In `src/components/ManualExpenseForm.tsx`, extend prop and submit payload types with:

```ts
budgetIcon?: string | null;
budgetColor?: BudgetColorId | null;
```

Import `BudgetColorId`.

Add state:

```ts
const [budgetIcon, setBudgetIcon] = useState<string | null>(
  initialExpense?.budgetIcon ?? null
);
const [budgetColor, setBudgetColor] = useState<BudgetColorId | null>(
  initialExpense?.budgetColor ?? null
);
```

In the initial expense effect, set:

```ts
setBudgetIcon(initialExpense?.budgetIcon ?? null);
setBudgetColor(initialExpense?.budgetColor ?? null);
```

In `handleBudgetChange`, set all budget fields:

```ts
const handleBudgetChange = useCallback(
  (value: number | null) => {
    const selected = budgetOptions.find((budget) => budget.id === value);
    setBudgetId(value);
    setBudgetIcon(value === null ? null : (selected?.icon ?? null));
    setBudgetColor(value === null ? null : (selected?.color ?? null));
  },
  [budgetOptions]
);
```

In `handleSubmit`, derive `selectedBudget` and add to payload:

```ts
const selectedBudget =
  showBudgetSelect && budgetId !== null
    ? budgetOptions.find((budget) => budget.id === budgetId)
    : null;
```

```ts
budgetName:
  showBudgetSelect && budgetId !== null
    ? (selectedBudget?.name ?? null)
    : null,
budgetIcon:
  showBudgetSelect && budgetId !== null
    ? (selectedBudget?.icon ?? budgetIcon ?? null)
    : null,
budgetColor:
  showBudgetSelect && budgetId !== null
    ? (selectedBudget?.color ?? budgetColor ?? null)
    : null,
```

- [ ] **Step 6: Update optimistic mutation helpers**

In `src/lib/mutations/expense-optimistic.ts`, carry through:

```ts
budgetIcon: input.budgetId === null ? null : (input.budgetIcon ?? null),
budgetColor: input.budgetId === null ? null : (input.budgetColor ?? null),
```

Where the helper currently falls back to previous `budgetName`, add:

```ts
fallbackBudgetIcon: previousRow?.budgetIcon,
fallbackBudgetColor: previousRow?.budgetColor,
```

Use previous fallback only when `budgetId` remains assigned:

```ts
budgetIcon:
  input.budgetId === null
    ? null
    : (input.budgetIcon ?? fallbackBudgetIcon ?? null),
budgetColor:
  input.budgetId === null
    ? null
    : (input.budgetColor ?? fallbackBudgetColor ?? null),
```

- [ ] **Step 7: Add focused snapshot tests**

In `src/components/QuickExpenseSheet.test.tsx`, update the budget option factory with:

```ts
icon: "🍜",
color: "rose",
```

Add assertion to the submit test:

```ts
expect(createExpenseMock).toHaveBeenCalledWith(
  expect.objectContaining({
    budgetId: 1,
    budgetName: "Food week",
    budgetIcon: "🍜",
    budgetColor: "rose",
  })
);
```

In `src/lib/mutations/index.test.tsx`, assert local update fallback includes:

```ts
expect(updateLocalExpenseMock).toHaveBeenCalledWith(
  expect.anything(),
  expect.any(String),
  expect.objectContaining({
    budgetIcon: "🍜",
    budgetColor: "rose",
  })
);
```

In `src/lib/mutations/expense-optimistic.test.ts`, add a case:

```ts
it("preserves budget appearance in optimistic rows", () => {
  const queryClient = new QueryClient();
  seedExpenseList(queryClient, previous);

  applyOptimisticExpenseUpdate(queryClient, {
    id: 1,
    input: {
      date: "2026-05-26",
      amount: 120000,
      note: "Lunch",
      category: "Food",
      paidBy: "Cubi",
      budgetId: 10,
      budgetName: "Meals",
      budgetIcon: "🍜",
      budgetColor: "rose",
    },
  });

  const next = queryClient.getQueryData<ExpenseListResult>(
    queries.expenses.list({ month: "2026-05" }).queryKey
  );

  expect(next?.rows[0]).toMatchObject({
    budgetIcon: "🍜",
    budgetColor: "rose",
  });
});
```

- [ ] **Step 8: Run expense UI and mutation tests**

Run:

```bash
rtk bun run test src/components/ExpenseListItem.mascot.test.tsx src/components/ExpenseList.test.tsx src/components/QuickExpenseSheet.test.tsx src/components/ExpenseEditSheetHost.test.tsx src/lib/mutations/index.test.tsx src/lib/mutations/expense-optimistic.test.ts
```

Expected: PASS.

- [ ] **Step 9: Format, lint, and commit**

Run:

```bash
rtk bunx prettier --write src/db/type.d.ts src/components/ExpenseListItem.tsx src/components/ExpenseListItem.mascot.test.tsx src/components/ExpenseList.test.tsx src/components/QuickExpenseSheet.tsx src/components/QuickExpenseSheet.test.tsx src/components/ManualExpenseForm.tsx src/components/ExpenseEditSheetHost.tsx src/components/ExpenseEditSheetHost.test.tsx src/lib/mutations/index.ts src/lib/mutations/index.test.tsx src/lib/mutations/expense-optimistic.ts src/lib/mutations/expense-optimistic.test.ts
rtk bunx prettier --check src/db/type.d.ts src/components/ExpenseListItem.tsx src/components/ExpenseListItem.mascot.test.tsx src/components/ExpenseList.test.tsx src/components/QuickExpenseSheet.tsx src/components/QuickExpenseSheet.test.tsx src/components/ManualExpenseForm.tsx src/components/ExpenseEditSheetHost.tsx src/components/ExpenseEditSheetHost.test.tsx src/lib/mutations/index.ts src/lib/mutations/index.test.tsx src/lib/mutations/expense-optimistic.ts src/lib/mutations/expense-optimistic.test.ts
rtk bunx eslint src/db/type.d.ts src/components/ExpenseListItem.tsx src/components/ExpenseListItem.mascot.test.tsx src/components/ExpenseList.test.tsx src/components/QuickExpenseSheet.tsx src/components/QuickExpenseSheet.test.tsx src/components/ManualExpenseForm.tsx src/components/ExpenseEditSheetHost.tsx src/components/ExpenseEditSheetHost.test.tsx src/lib/mutations/index.ts src/lib/mutations/index.test.tsx src/lib/mutations/expense-optimistic.ts src/lib/mutations/expense-optimistic.test.ts
rtk git add src/db/type.d.ts src/components/ExpenseListItem.tsx src/components/ExpenseListItem.mascot.test.tsx src/components/ExpenseList.test.tsx src/components/QuickExpenseSheet.tsx src/components/QuickExpenseSheet.test.tsx src/components/ManualExpenseForm.tsx src/components/ExpenseEditSheetHost.tsx src/components/ExpenseEditSheetHost.test.tsx src/lib/mutations/index.ts src/lib/mutations/index.test.tsx src/lib/mutations/expense-optimistic.ts src/lib/mutations/expense-optimistic.test.ts
rtk git commit -m "feat(expense): show budget appearance on expenses"
```

Expected: checks pass and commit succeeds.

---

### Task 9: Final Verification

**Files:**

- Read: `docs/superpowers/specs/2026-05-26-budget-appearance-design.md`
- Verify: all modified `.ts` and `.tsx` files

- [ ] **Step 1: Run the full targeted test set**

Run:

```bash
rtk bun run test \
  src/lib/budget-appearance.test.ts \
  src/app/api/mutation-routes.test.ts \
  src/app/api/read-routes.test.ts \
  src/lib/queries/budget-weekly.test.ts \
  src/lib/queries/expenses.client-boundary.test.ts \
  src/lib/services/expenses.test.ts \
  src/lib/services/expense-sync.test.ts \
  src/lib/services/reports.test.ts \
  src/lib/sync/expenses/actions.test.ts \
  src/lib/sync/expenses/list.test.ts \
  src/lib/sync/expenses/coordinator.test.ts \
  src/stores/quick-expense-recovery-store.test.ts \
  src/components/BudgetBadge.test.tsx \
  src/components/BudgetWeeklyBudgetsClient.mascot.test.tsx \
  src/components/BudgetPickerSheet.test.tsx \
  src/components/BudgetTransferDrawer.test.tsx \
  src/components/ExpenseListItem.mascot.test.tsx \
  src/components/ExpenseList.test.tsx \
  src/components/QuickExpenseSheet.test.tsx \
  src/components/ExpenseEditSheetHost.test.tsx \
  src/lib/mutations/index.test.tsx \
  src/lib/mutations/expense-optimistic.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run final formatting and lint for modified TypeScript files**

Run:

```bash
files="$(rtk git diff --name-only main...HEAD | rtk rg '\\.tsx?$')"
rtk bunx prettier --write $files
rtk bunx prettier --check $files
rtk bunx eslint $files
```

Expected: Prettier check passes and ESLint exits 0.

- [ ] **Step 3: Manual browser check on existing dev server**

The user already has the dev server on port `3000`. Open the app at:

```text
http://localhost:3000/budgets
```

Verify:

- Create budget drawer shows emoji input, 12 color swatches, and live preview.
- Created budget card shows the selected emoji and color.
- Edit budget drawer restores current icon and color.
- Budget picker rows show emoji badges.
- Transfer drawer rows show emoji badges.
- Creating a quick expense assigned to a budget shows the budget badge in the expense list.

- [ ] **Step 4: Commit final verification fixes**

If Step 1, Step 2, or Step 3 required fixes, commit them:

```bash
rtk git add -u
rtk git commit -m "fix(budget): complete appearance integration"
```

Expected: commit succeeds only if files changed.
