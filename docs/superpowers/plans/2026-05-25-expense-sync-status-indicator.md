# Expense Sync Status Indicator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show compact pending/failed sync dots inside each expense item immediately before the paid-by icon.

**Architecture:** Carry item-level sync status through the existing local expense list builder into `ExpenseListResult.rows`, then render a tiny dot in `ExpenseListItem`. The component stays display-only and does not query IndexedDB, Zustand, or mutation state.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, TanStack Query, Zustand sync store, Tailwind v4, Vitest, Testing Library.

---

## File Structure

- Modify `src/lib/expenses/list-model.ts`
  - Add a small exported display status type for list rows.
  - Add optional `syncStatus` to `ExpenseListItem`.
- Modify `src/lib/sync/expenses/list.ts`
  - Map `LocalExpense.syncStatus` into `ExpenseListItem.syncStatus` for visible rows.
- Modify `src/lib/sync/expenses/list.test.ts`
  - Add focused coverage proving row and grouped item status carry through.
- Modify `src/components/ExpenseListItem.tsx`
  - Add optional `syncStatus` to `ExpenseListItemData`.
  - Render a tiny status dot before `PaidByIcon` for `pending` and `failed` only.
- Modify `src/components/ExpenseListItem.mascot.test.tsx`
  - Add focused rendering tests for hidden, pending, failed, and order-before-paid-by behavior.

## Task 1: Carry Sync Status Through Expense List Rows

**Files:**
- Modify: `src/lib/expenses/list-model.ts`
- Modify: `src/lib/sync/expenses/list.ts`
- Test: `src/lib/sync/expenses/list.test.ts`

- [ ] **Step 1: Write the failing list mapping test**

Append this test inside the existing `describe("local expense list builder", () => { ... })` block in `src/lib/sync/expenses/list.test.ts`:

```ts
  it("carries sync status through rows and grouped items", () => {
    const result = buildExpenseListResultFromLocalRows(
      [
        row({
          clientId: "pending-client",
          serverId: null,
          note: "Pending coffee",
          syncStatus: "pending",
          updatedAt: "2026-05-24T10:00:00.000Z",
        }),
        row({
          clientId: "failed-client",
          serverId: 2,
          note: "Failed lunch",
          syncStatus: "failed",
          updatedAt: "2026-05-24T09:00:00.000Z",
        }),
        row({
          clientId: "synced-client",
          serverId: 1,
          note: "Synced tea",
          syncStatus: "synced",
          updatedAt: "2026-05-24T08:00:00.000Z",
        }),
      ],
      { limit: 30 }
    );

    expect(result.rows.map((expense) => expense.syncStatus)).toEqual([
      "pending",
      "failed",
      "synced",
    ]);
    expect(
      result.groupedRows[0]?.items.map((expense) => expense.syncStatus)
    ).toEqual(["pending", "failed", "synced"]);
  });
```

- [ ] **Step 2: Run the new list test and verify it fails**

Run:

```bash
rtk bunx vitest run src/lib/sync/expenses/list.test.ts -t "carries sync status through rows and grouped items"
```

Expected: FAIL because `syncStatus` is not present on returned expense rows.

- [ ] **Step 3: Add the row sync status type**

In `src/lib/expenses/list-model.ts`, replace the current `ExpenseListItem` type block with this block:

```ts
export type ExpenseListItemSyncStatus = "synced" | "pending" | "failed";

export type ExpenseListItem = {
  id: number;
  clientId?: string | null;
  date: string;
  amount: number;
  note: string;
  category: string;
  paidBy: string;
  budgetId: number | null;
  budgetName: string | null;
  syncStatus?: ExpenseListItemSyncStatus;
};
```

- [ ] **Step 4: Map local sync status into list items**

In `src/lib/sync/expenses/list.ts`, replace the `localExpenseToListItem` function with this implementation:

```ts
const localExpenseToListItem = (
  row: LocalExpense,
  usedIds: Set<number>
): ExpenseListItem => ({
  id: reserveLocalExpenseListId(row, usedIds),
  clientId: row.clientId,
  date: row.date,
  amount: row.amount,
  note: row.note,
  category: row.category,
  paidBy: row.paidBy,
  budgetId: row.budgetId,
  budgetName: row.budgetName,
  syncStatus: row.syncStatus === "deleted" ? undefined : row.syncStatus,
});
```

- [ ] **Step 5: Run list tests and verify they pass**

Run:

```bash
rtk bunx vitest run src/lib/sync/expenses/list.test.ts
```

Expected: PASS for all tests in `src/lib/sync/expenses/list.test.ts`.

- [ ] **Step 6: Commit the list data contract change**

Run:

```bash
rtk git add src/lib/expenses/list-model.ts src/lib/sync/expenses/list.ts src/lib/sync/expenses/list.test.ts
rtk git commit -m "Add expense list sync status field"
```

Expected: commit succeeds with only these three files staged.

## Task 2: Render the Compact Status Dot Before PaidByIcon

**Files:**
- Modify: `src/components/ExpenseListItem.tsx`
- Test: `src/components/ExpenseListItem.mascot.test.tsx`

- [ ] **Step 1: Update the component test helper**

In `src/components/ExpenseListItem.mascot.test.tsx`, replace the existing `renderItem` helper with this version:

```tsx
type ExpenseFixture = typeof expense & {
  syncStatus?: "synced" | "pending" | "failed";
};

const renderItem = (
  onEditExpense = vi.fn(),
  overrides: Partial<ExpenseFixture> = {}
) => {
  const item = { ...expense, ...overrides };

  render(<ExpenseListItem expense={item} onEditExpense={onEditExpense} />);
  return { expense: item, onEditExpense };
};
```

- [ ] **Step 2: Add failing component rendering tests**

Append this block to `src/components/ExpenseListItem.mascot.test.tsx` after the `ExpenseListItem edit flow` tests and before the delete flow tests:

```tsx
describe("ExpenseListItem sync status indicator", () => {
  it("does not render a sync dot for synced or missing status", () => {
    const onEditExpense = vi.fn();
    const { rerender } = render(
      <ExpenseListItem
        expense={{ ...expense, syncStatus: "synced" }}
        onEditExpense={onEditExpense}
      />
    );

    expect(screen.queryByLabelText(/sync/i)).not.toBeInTheDocument();

    rerender(
      <ExpenseListItem
        expense={{ ...expense, syncStatus: undefined }}
        onEditExpense={onEditExpense}
      />
    );

    expect(screen.queryByLabelText(/sync/i)).not.toBeInTheDocument();
  });

  it("renders the pending sync dot before the paid-by icon", () => {
    renderItem(vi.fn(), { syncStatus: "pending" });

    const indicator = screen.getByLabelText("Sync pending");
    const paidByIcon = screen.getByTestId("paid-by-icon");

    expect(indicator).toHaveAttribute("title", "Sync pending");
    expect(indicator).toHaveClass("bg-warning");
    expect(
      indicator.compareDocumentPosition(paidByIcon) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("renders the failed sync dot before the paid-by icon", () => {
    renderItem(vi.fn(), { syncStatus: "failed" });

    const indicator = screen.getByLabelText("Sync failed");
    const paidByIcon = screen.getByTestId("paid-by-icon");

    expect(indicator).toHaveAttribute("title", "Sync failed");
    expect(indicator).toHaveClass("bg-destructive");
    expect(
      indicator.compareDocumentPosition(paidByIcon) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run the new component tests and verify they fail**

Run:

```bash
rtk bunx vitest run src/components/ExpenseListItem.mascot.test.tsx -t "sync status indicator"
```

Expected: FAIL because the sync dot is not rendered yet.

- [ ] **Step 4: Add the sync status type import and prop field**

In `src/components/ExpenseListItem.tsx`, add this import near the existing app imports:

```ts
import type { ExpenseListItemSyncStatus } from "@/lib/expenses/list-model";
```

Then add this optional field to the exported `ExpenseListItemData` type:

```ts
  syncStatus?: ExpenseListItemSyncStatus;
```

The resulting type should be:

```ts
export type ExpenseListItemData = {
  id: number;
  clientId?: string | null;
  date: string;
  amount: number;
  note: string;
  category: string;
  paidBy: string;
  budgetId: number | null;
  budgetName: string | null;
  syncStatus?: ExpenseListItemSyncStatus;
};
```

- [ ] **Step 5: Add the compact status dot helper**

In `src/components/ExpenseListItem.tsx`, add this helper below the constants and above `const ExpenseListItem = ...`:

```tsx
const EXPENSE_SYNC_DOT_LABEL: Record<
  Exclude<ExpenseListItemSyncStatus, "synced">,
  string
> = {
  pending: "Sync pending",
  failed: "Sync failed",
};

const ExpenseSyncStatusDot = ({
  status,
}: {
  status?: ExpenseListItemSyncStatus;
}) => {
  if (status !== "pending" && status !== "failed") {
    return null;
  }

  const label = EXPENSE_SYNC_DOT_LABEL[status];

  return (
    <span
      aria-label={label}
      title={label}
      className={cn(
        "size-2 shrink-0 rounded-full",
        status === "pending" &&
          "bg-warning shadow-[0_0_10px_color-mix(in_srgb,var(--warning)_55%,transparent)]",
        status === "failed" &&
          "bg-destructive shadow-[0_0_10px_color-mix(in_srgb,var(--destructive)_45%,transparent)]"
      )}
    />
  );
};
```

- [ ] **Step 6: Render the dot before PaidByIcon**

In `src/components/ExpenseListItem.tsx`, replace this current block:

```tsx
              {expense.paidBy ? (
                <div className="flex justify-end">
                  <PaidByIcon paidBy={expense.paidBy} size="sm" />
                </div>
              ) : null}
```

with this block:

```tsx
              {expense.paidBy || expense.syncStatus ? (
                <div className="flex items-center justify-end gap-1.5">
                  <ExpenseSyncStatusDot status={expense.syncStatus} />
                  {expense.paidBy ? (
                    <PaidByIcon paidBy={expense.paidBy} size="sm" />
                  ) : null}
                </div>
              ) : null}
```

- [ ] **Step 7: Run component tests and verify they pass**

Run:

```bash
rtk bunx vitest run src/components/ExpenseListItem.mascot.test.tsx
```

Expected: PASS for all tests in `src/components/ExpenseListItem.mascot.test.tsx`.

- [ ] **Step 8: Commit the component rendering change**

Run:

```bash
rtk git add src/components/ExpenseListItem.tsx src/components/ExpenseListItem.mascot.test.tsx
rtk git commit -m "Show expense sync status dot"
```

Expected: commit succeeds with only these two files staged.

## Task 3: Run Targeted Verification

**Files:**
- Check: `src/lib/expenses/list-model.ts`
- Check: `src/lib/sync/expenses/list.ts`
- Check: `src/lib/sync/expenses/list.test.ts`
- Check: `src/components/ExpenseListItem.tsx`
- Check: `src/components/ExpenseListItem.mascot.test.tsx`

- [ ] **Step 1: Run focused tests**

Run:

```bash
rtk bunx vitest run src/lib/sync/expenses/list.test.ts src/components/ExpenseListItem.mascot.test.tsx
```

Expected: PASS for both test files.

- [ ] **Step 2: Format modified TypeScript files**

Run:

```bash
rtk bunx prettier --write src/lib/expenses/list-model.ts src/lib/sync/expenses/list.ts src/lib/sync/expenses/list.test.ts src/components/ExpenseListItem.tsx src/components/ExpenseListItem.mascot.test.tsx
```

Expected: Prettier completes and reports the five files.

- [ ] **Step 3: Check formatting**

Run:

```bash
rtk bunx prettier --check src/lib/expenses/list-model.ts src/lib/sync/expenses/list.ts src/lib/sync/expenses/list.test.ts src/components/ExpenseListItem.tsx src/components/ExpenseListItem.mascot.test.tsx
```

Expected: PASS with `All matched files use Prettier code style!`.

- [ ] **Step 4: Run ESLint for modified file scope**

Run:

```bash
rtk bunx eslint src/lib/expenses/list-model.ts src/lib/sync/expenses/list.ts src/lib/sync/expenses/list.test.ts src/components/ExpenseListItem.tsx src/components/ExpenseListItem.mascot.test.tsx
```

Expected: PASS with no lint errors.

- [ ] **Step 5: Inspect final diff**

Run:

```bash
rtk git diff --stat
rtk git diff -- src/lib/expenses/list-model.ts src/lib/sync/expenses/list.ts src/lib/sync/expenses/list.test.ts src/components/ExpenseListItem.tsx src/components/ExpenseListItem.mascot.test.tsx
```

Expected: Diff only contains the sync status row field, list mapping test, compact dot rendering, component tests, and formatting from modified files.
If Task 1 and Task 2 were already committed and Prettier made no further changes, the scoped diff may be empty.

- [ ] **Step 6: Commit verification formatting changes if needed**

Run:

```bash
rtk git status --short
```

If Prettier changed files after Task 1 or Task 2 commits, run:

```bash
rtk git add src/lib/expenses/list-model.ts src/lib/sync/expenses/list.ts src/lib/sync/expenses/list.test.ts src/components/ExpenseListItem.tsx src/components/ExpenseListItem.mascot.test.tsx
rtk git commit -m "Format expense sync status indicator changes"
```

Expected: either no changes remain for these five files, or a formatting-only commit succeeds.
