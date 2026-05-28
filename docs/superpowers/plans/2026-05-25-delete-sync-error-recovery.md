# Delete Sync Error Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a user-facing recovery flow for failed expense delete sync operations.

**Architecture:** Failed delete operations should stay in the durable outbox and be retried by the existing sync scheduler. Delete recovery entries should be toast-only actions, not `QuickExpenseSheet` reopen flows, because the user's intent was to delete rather than edit a draft.

**Tech Stack:** Next.js App Router, React 19, TanStack Query, Zustand, IndexedDB sync repository, Vitest, Testing Library, Sonner toasts.

---

## File Structure

- Modify `src/lib/sync/expenses/actions.ts`
  - Store a recoverable local expense payload on delete outbox operations.
  - Keep the API push payload unchanged: delete requests still send `payload: null`.
- Modify `src/lib/sync/expenses/actions.test.ts`
  - Update the existing delete outbox expectation to require the local expense payload.
- Modify `src/stores/quick-expense-recovery-store.ts`
  - Add `mode: "delete"` recovery entries.
  - Convert failed delete outbox operations into displayable recovery entries.
  - Keep persistence behavior unchanged: entries and toast ids are not persisted.
- Modify `src/stores/quick-expense-recovery-store.test.ts`
  - Cover failed delete mapping and non-recoverable delete payloads.
- Modify `src/components/QuickExpenseMutationCoordinator.tsx`
  - Include failed delete outbox operations in polling.
  - For `delete`, show a `Retry delete` toast action that clears the current recovery entry and calls `requestExpenseSync(queryClient)`.
  - For `create`/`edit`, keep the current `Reopen` behavior.
- Modify `src/components/QuickExpenseMutationCoordinator.test.tsx`
  - Cover delete toast behavior and retry action.
- Modify `src/components/QuickExpenseRecoverySheetHost.tsx`
  - Guard the sheet host so only `create` and `edit` entries open `QuickExpenseSheet`.
- Modify `src/components/QuickExpenseRecoverySheetHost.test.tsx`
  - Cover that delete recovery entries do not open the sheet.

---

### Task 1: Preserve Delete Payloads In The Outbox

**Files:**
- Modify: `src/lib/sync/expenses/actions.ts`
- Test: `src/lib/sync/expenses/actions.test.ts`

- [ ] **Step 1: Write the failing test**

In `src/lib/sync/expenses/actions.test.ts`, update the assertion inside `it("marks an existing local expense deleted and queues a delete operation", ...)`.

Replace the current delete outbox expectation:

```ts
await expect(syncRepository.outbox.list("expenses")).resolves.toMatchObject([
  {
    entity: "expenses",
    type: "delete",
    clientId: "client-1",
    serverId: 10,
    payload: null,
  },
]);
```

with:

```ts
await expect(syncRepository.outbox.list("expenses")).resolves.toMatchObject([
  {
    entity: "expenses",
    type: "delete",
    clientId: "client-1",
    serverId: 10,
    payload: expect.objectContaining({
      entity: "expenses",
      clientId: "client-1",
      serverId: 10,
      amount: 45000,
      note: "Coffee",
      category: "Food",
      paidBy: "Cubi",
      syncStatus: "deleted",
    }),
  },
]);
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
rtk bun run test src/lib/sync/expenses/actions.test.ts
```

Expected: FAIL because delete outbox operations still have `payload: null`.

- [ ] **Step 3: Implement the minimal code**

In `src/lib/sync/expenses/actions.ts`, change `toOutboxOperation` so it always preserves the expense payload:

```ts
const toOutboxOperation = (
  expense: LocalExpense,
  type: ExpenseOutboxOperation["type"],
  createdAt: string,
  operationId = createLocalId("expense-op")
): ExpenseOutboxOperation => ({
  operationId,
  entity: EXPENSE_SYNC_ENTITY,
  type,
  clientId: expense.clientId,
  serverId: expense.serverId,
  payload: expense,
  createdAt,
  attemptCount: 0,
  lastAttemptAt: null,
  lastError: null,
});
```

Do not change `toPushOperationPayload` in `src/lib/sync/expenses/coordinator.ts`; it already sends `payload: null` for delete operations:

```ts
payload:
  operation.type === "delete" || payload === null
    ? null
    : {
        clientId: payload.clientId,
        date: payload.date,
        amount: payload.amount,
        note: payload.note,
        category: payload.category,
        paidBy: payload.paidBy,
        budgetId: payload.budgetId,
      },
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
rtk bun run test src/lib/sync/expenses/actions.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/lib/sync/expenses/actions.ts src/lib/sync/expenses/actions.test.ts
rtk git commit -m "preserve failed delete recovery payloads"
```

---

### Task 2: Add Delete Recovery Entries To The Store

**Files:**
- Modify: `src/stores/quick-expense-recovery-store.ts`
- Test: `src/stores/quick-expense-recovery-store.test.ts`

- [ ] **Step 1: Write the failing store tests**

In `src/stores/quick-expense-recovery-store.test.ts`, add this test after the update recovery test:

```ts
it("maps failed delete outbox operations to delete recovery entries", () => {
  const operation = buildFailedOperation({
    operationId: "expense-op-delete",
    type: "delete",
    serverId: 42,
    payload: {
      ...localExpense,
      serverId: 42,
      syncStatus: "deleted",
    },
    lastError: "Failed to delete expense",
  });
  const store = syncFailedEntries([operation]);

  expect(store.getState().entries[operation.operationId]).toMatchObject({
    mode: "delete",
    operationId: "expense-op-delete",
    clientId: "expense-client-1",
    serverId: 42,
    transactionId: 42,
    status: "failed",
    lastError: "Failed to delete expense",
    draft: expect.objectContaining({
      clientId: "expense-client-1",
      amount: 34000,
      note: "Retry lunch",
      category: Category.FOOD,
      paidBy: PaidBy.CUBI,
    }),
  });
});
```

Then update `it("ignores non-recoverable outbox operations", ...)` so the delete operation is non-recoverable because its payload is invalid, not because deletes are ignored:

```ts
buildFailedOperation({
  operationId: "delete-op",
  type: "delete",
  payload: null,
  lastError: "Cannot delete",
}),
```

Keep the expected `entries` as `{}` for this invalid delete payload case.

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
rtk bun run test src/stores/quick-expense-recovery-store.test.ts
```

Expected: FAIL because `quickExpenseRecoveryEntryFromOutboxOperation` still returns `null` for all delete operations.

- [ ] **Step 3: Extend the recovery mode type**

In `src/stores/quick-expense-recovery-store.ts`, change:

```ts
mode: "create" | "edit";
```

to:

```ts
mode: "create" | "edit" | "delete";
```

- [ ] **Step 4: Implement delete mapping**

In `quickExpenseRecoveryEntryFromOutboxOperation`, replace the early return condition:

```ts
if (
  operation.entity !== "expenses" ||
  operation.lastError === null ||
  operation.type === "delete" ||
  !isRecoverableExpense(operation.payload)
) {
  return null;
}
```

with:

```ts
if (
  operation.entity !== "expenses" ||
  operation.lastError === null ||
  !isRecoverableExpense(operation.payload)
) {
  return null;
}
```

Then replace:

```ts
const mode = operation.type === "update" ? "edit" : "create";
```

with:

```ts
const mode =
  operation.type === "update"
    ? "edit"
    : operation.type === "delete"
      ? "delete"
      : "create";
```

Keep:

```ts
transactionId:
  mode === "edit" && serverId !== null ? serverId : undefined,
```

and change it to include delete:

```ts
transactionId:
  (mode === "edit" || mode === "delete") && serverId !== null
    ? serverId
    : undefined,
```

- [ ] **Step 5: Run the test to verify it passes**

Run:

```bash
rtk bun run test src/stores/quick-expense-recovery-store.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
rtk git add src/stores/quick-expense-recovery-store.ts src/stores/quick-expense-recovery-store.test.ts
rtk git commit -m "map failed deletes to recovery entries"
```

---

### Task 3: Add Retry Delete Toast Behavior

**Files:**
- Modify: `src/components/QuickExpenseMutationCoordinator.tsx`
- Test: `src/components/QuickExpenseMutationCoordinator.test.tsx`

- [ ] **Step 1: Write the failing coordinator test**

In `src/components/QuickExpenseMutationCoordinator.test.tsx`, add imports:

```ts
import { requestExpenseSync } from "@/lib/sync/expenses/scheduler";
```

Add this mock near the existing `sonner` mock:

```ts
vi.mock("@/lib/sync/expenses/scheduler", () => ({
  requestExpenseSync: vi.fn().mockResolvedValue(undefined),
}));
```

Add this test after the update recovery test:

```ts
it("shows a retry delete toast for failed delete outbox operations", async () => {
  const operation = buildOperation({
    operationId: "expense-op-delete",
    type: "delete",
    serverId: 42,
    payload: {
      ...localExpense,
      serverId: 42,
      syncStatus: "deleted",
    },
    lastError: "Delete failed",
  });
  await syncRepository.outbox.put(operation);

  renderCoordinator();

  await waitFor(() =>
    expect(toastMock.error).toHaveBeenCalledWith(
      "Delete failed",
      expect.objectContaining({
        duration: 9000,
        action: expect.objectContaining({ label: "Retry delete" }),
      })
    )
  );

  expect(
    useQuickExpenseRecoveryStore.getState().entries[operation.operationId]
  ).toMatchObject({
    mode: "delete",
    clientId: "expense-client-1",
    serverId: 42,
    toastId: "toast-1",
  });

  const options = toastMock.error.mock.calls[0]?.[1] as {
    action: { onClick: () => void };
  };
  act(() => {
    options.action.onClick();
  });

  expect(
    useQuickExpenseRecoveryStore.getState().entries[operation.operationId]
  ).toBeUndefined();
  expect(requestExpenseSync).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
rtk bun run test src/components/QuickExpenseMutationCoordinator.test.tsx
```

Expected: FAIL because failed delete operations are still filtered out or use the wrong toast action.

- [ ] **Step 3: Implement delete retry behavior**

In `src/components/QuickExpenseMutationCoordinator.tsx`, add:

```ts
import { requestExpenseSync } from "@/lib/sync/expenses/scheduler";
import { useQueryClient } from "@tanstack/react-query";
```

Inside `QuickExpenseMutationCoordinator`, add:

```ts
const queryClient = useQueryClient();
const clearRecovery = useQuickExpenseRecoveryStore((state) => state.clear);
```

Change `isRecoverableFailedExpenseOperation` from:

```ts
(candidate.type === "create" || candidate.type === "update") &&
```

to:

```ts
(candidate.type === "create" ||
  candidate.type === "update" ||
  candidate.type === "delete") &&
```

Replace the toast action creation inside `unnotifiedEntries.forEach` with:

```ts
const toastId = toast.error(entry.lastError, {
  duration: RECOVERY_TOAST_DURATION_MS,
  action:
    entry.mode === "delete"
      ? {
          label: "Retry delete",
          onClick: () => {
            clearRecovery(entry.operationId);
            void requestExpenseSync(queryClient);
          },
        }
      : {
          label: "Reopen",
          onClick: () => setActiveRecovery(entry.operationId),
        },
});
```

Update the effect dependency array to include `clearRecovery` and `queryClient`:

```ts
}, [
  clearRecovery,
  markNotified,
  queryClient,
  setActiveRecovery,
  unnotifiedEntries,
]);
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
rtk bun run test src/components/QuickExpenseMutationCoordinator.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/components/QuickExpenseMutationCoordinator.tsx src/components/QuickExpenseMutationCoordinator.test.tsx
rtk git commit -m "add retry toast for failed deletes"
```

---

### Task 4: Keep Delete Entries Out Of The Recovery Sheet Host

**Files:**
- Modify: `src/components/QuickExpenseRecoverySheetHost.tsx`
- Test: `src/components/QuickExpenseRecoverySheetHost.test.tsx`

- [ ] **Step 1: Write the failing host test**

In `src/components/QuickExpenseRecoverySheetHost.test.tsx`, add this test before `renders nothing when active id is missing`:

```ts
it("does not open the edit sheet for failed delete recovery entries", () => {
  activateRecovery(
    buildOperation({
      operationId: "delete-1",
      type: "delete",
      serverId: 42,
      payload: {
        ...localExpense,
        serverId: 42,
        syncStatus: "deleted",
      },
      lastError: "Delete failed",
    })
  );

  renderHost();

  expect(
    screen.queryByPlaceholderText(/what did you spend on/i)
  ).not.toBeInTheDocument();
  expect(screen.queryByPlaceholderText("0")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
rtk bun run test src/components/QuickExpenseRecoverySheetHost.test.tsx
```

Expected: FAIL because the host currently opens `QuickExpenseSheet` for any failed entry.

- [ ] **Step 3: Implement the host guard**

In `src/components/QuickExpenseRecoverySheetHost.tsx`, replace:

```ts
if (!entry || entry.status !== "failed") {
  return null;
}
```

with:

```ts
if (
  !entry ||
  entry.status !== "failed" ||
  (entry.mode !== "create" && entry.mode !== "edit")
) {
  return null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
rtk bun run test src/components/QuickExpenseRecoverySheetHost.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/components/QuickExpenseRecoverySheetHost.tsx src/components/QuickExpenseRecoverySheetHost.test.tsx
rtk git commit -m "keep delete recovery out of edit sheet"
```

---

### Task 5: Run Focused Regression Checks

**Files:**
- Verify only; no planned edits.

- [ ] **Step 1: Run all affected tests**

Run:

```bash
rtk bun run test src/lib/sync/expenses/actions.test.ts src/stores/quick-expense-recovery-store.test.ts src/components/QuickExpenseMutationCoordinator.test.tsx src/components/QuickExpenseRecoverySheetHost.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run formatter**

Run:

```bash
rtk bunx prettier --write src/lib/sync/expenses/actions.ts src/lib/sync/expenses/actions.test.ts src/stores/quick-expense-recovery-store.ts src/stores/quick-expense-recovery-store.test.ts src/components/QuickExpenseMutationCoordinator.tsx src/components/QuickExpenseMutationCoordinator.test.tsx src/components/QuickExpenseRecoverySheetHost.tsx src/components/QuickExpenseRecoverySheetHost.test.tsx
```

Expected: all listed files are formatted.

- [ ] **Step 3: Check formatting**

Run:

```bash
rtk bunx prettier --check src/lib/sync/expenses/actions.ts src/lib/sync/expenses/actions.test.ts src/stores/quick-expense-recovery-store.ts src/stores/quick-expense-recovery-store.test.ts src/components/QuickExpenseMutationCoordinator.tsx src/components/QuickExpenseMutationCoordinator.test.tsx src/components/QuickExpenseRecoverySheetHost.tsx src/components/QuickExpenseRecoverySheetHost.test.tsx
```

Expected: `All matched files use Prettier code style!`

- [ ] **Step 4: Run ESLint for modified TypeScript scopes**

Run:

```bash
rtk bunx eslint src/lib/sync/expenses/actions.ts src/lib/sync/expenses/actions.test.ts src/stores/quick-expense-recovery-store.ts src/stores/quick-expense-recovery-store.test.ts src/components/QuickExpenseMutationCoordinator.tsx src/components/QuickExpenseMutationCoordinator.test.tsx src/components/QuickExpenseRecoverySheetHost.tsx src/components/QuickExpenseRecoverySheetHost.test.tsx
```

Expected: exit code `0`.

- [ ] **Step 5: Commit final formatting or test adjustments if needed**

Only run this if Task 5 produced changes:

```bash
rtk git add src/lib/sync/expenses/actions.ts src/lib/sync/expenses/actions.test.ts src/stores/quick-expense-recovery-store.ts src/stores/quick-expense-recovery-store.test.ts src/components/QuickExpenseMutationCoordinator.tsx src/components/QuickExpenseMutationCoordinator.test.tsx src/components/QuickExpenseRecoverySheetHost.tsx src/components/QuickExpenseRecoverySheetHost.test.tsx
rtk git commit -m "verify delete sync recovery"
```

---

## Self-Review

- Spec coverage: The plan covers failed delete persistence, store mapping, retry toast behavior, sheet-host guarding, and focused verification.
- Placeholder scan: No unresolved implementation markers remain.
- Type consistency: `mode: "delete"` is introduced in the recovery entry type, consumed by the coordinator toast branch, and excluded from the sheet host.
