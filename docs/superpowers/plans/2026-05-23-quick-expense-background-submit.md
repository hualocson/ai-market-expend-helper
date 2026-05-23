# Quick Expense Background Submit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `QuickExpenseSheet` close immediately after add/edit submit while a stable coordinator handles the mutation, loading toast, success/error toast, and failed-draft recovery.

**Architecture:** `QuickExpenseSheet` captures a submitted draft, enqueues it in a Zustand recovery store, and closes. `QuickExpenseMutationCoordinator` is mounted near the app providers, observes queued operations, owns the existing TanStack Query mutation hooks, updates toast state, and marks failed entries. `QuickExpenseRecoverySheetHost` is mounted beside the coordinator and can reopen a failed draft even when the original sheet/list item unmounted.

**Tech Stack:** Next.js App Router, React 19 client components, TanStack Query mutations, Zustand with `persist`, Sonner toasts, Vitest and Testing Library.

---

## File Structure

- Create `src/stores/quick-expense-recovery-store.ts`
  - Owns recovery entry types, operation ids, TTL pruning, queued/running/failed state, toast ids, active recovery id, and a persisted Zustand store.
  - Persists draft/payload metadata to `sessionStorage`; excludes `toastId` from persisted state.
- Create `src/stores/quick-expense-recovery-store.test.ts`
  - Unit tests for enqueue, running, toast id attach, failed state, active recovery selection, clear, prune, and persisted partialization.
- Modify `src/components/QuickExpenseSheet.tsx`
  - Export `TExpenseDraft`.
  - Add optional `recoveryDraft` prop for the stable recovery host.
  - Replace direct create/update mutation calls with recovery-store enqueue.
  - Keep missing edit `transactionId` behavior as an immediate error toast.
- Modify `src/components/QuickExpenseSheet.test.tsx`
  - Remove mutation-hook mocks from sheet-submit expectations.
  - Assert create/edit submit enqueues draft + payload and closes immediately.
  - Assert missing edit id does not enqueue.
- Create `src/components/QuickExpenseMutationCoordinator.tsx`
  - Uses `useCreateExpenseMutation` and `useUpdateExpenseMutation`.
  - Processes queued recovery entries, creates loading toast, stores toast id, starts `mutateAsync`, clears on success, marks failed on error, and wires `Reopen`.
- Create `src/components/QuickExpenseMutationCoordinator.test.tsx`
  - Tests create/update processing, toast id use, success cleanup, error recovery, no duplicate running processing, and missing toast id fallback.
- Create `src/components/QuickExpenseRecoverySheetHost.tsx`
  - Reads `activeRecoveryOperationId`, renders `QuickExpenseSheet` with the failed draft, and clears active recovery on close.
- Create `src/components/QuickExpenseRecoverySheetHost.test.tsx`
  - Tests that failed create/edit entries open with the submitted draft and transaction id via the stable host.
- Modify `src/app/layout.tsx`
  - Mount `QuickExpenseMutationCoordinator` and `QuickExpenseRecoverySheetHost` inside `SettingsStoreProvider` and `ReactQueryProvider`, before `BottomNav`.

## Task 1: Recovery Store

**Files:**
- Create: `src/stores/quick-expense-recovery-store.ts`
- Create: `src/stores/quick-expense-recovery-store.test.ts`

- [ ] **Step 1: Write the failing store tests**

Create `src/stores/quick-expense-recovery-store.test.ts`:

```ts
import { Category, PaidBy } from "@/enums";
import {
  QUICK_EXPENSE_RECOVERY_TTL_MS,
  createQuickExpenseRecoveryStore,
  getPersistableQuickExpenseRecoveryState,
  type TQuickExpensePayload,
  type TQuickExpenseRecoveryEntry,
} from "./quick-expense-recovery-store";
import { describe, expect, it } from "vitest";

const payload: TQuickExpensePayload = {
  date: "20/05/2026",
  amount: 34000,
  note: "Retry lunch",
  category: Category.FOOD,
  paidBy: PaidBy.CUBI,
  budgetId: null,
};

const entry = (
  override: Partial<TQuickExpenseRecoveryEntry> = {}
): TQuickExpenseRecoveryEntry => ({
  operationId: "op-1",
  mode: "create",
  draft: payload,
  payload,
  status: "queued",
  createdAt: 1_000,
  ...override,
});

describe("quick expense recovery store", () => {
  it("enqueues entries and moves them through running and failed states", () => {
    const store = createQuickExpenseRecoveryStore();

    store.getState().enqueue(entry());
    expect(store.getState().entries["op-1"]).toMatchObject({
      operationId: "op-1",
      status: "queued",
      draft: payload,
    });
    expect(store.getState().getQueuedEntries()).toHaveLength(1);

    store.getState().markRunning("op-1");
    expect(store.getState().entries["op-1"]?.status).toBe("running");
    expect(store.getState().getQueuedEntries()).toHaveLength(0);

    store.getState().attachToastId("op-1", "toast-1");
    expect(store.getState().entries["op-1"]?.toastId).toBe("toast-1");

    store.getState().markFailed("op-1");
    expect(store.getState().entries["op-1"]?.status).toBe("failed");
  });

  it("clears entries and active recovery ids", () => {
    const store = createQuickExpenseRecoveryStore();

    store.getState().enqueue(entry({ operationId: "op-2" }));
    store.getState().setActiveRecovery("op-2");
    expect(store.getState().activeRecoveryOperationId).toBe("op-2");

    store.getState().clear("op-2");
    expect(store.getState().entries["op-2"]).toBeUndefined();
    expect(store.getState().activeRecoveryOperationId).toBeNull();
  });

  it("prunes expired entries using the recovery TTL", () => {
    const store = createQuickExpenseRecoveryStore();

    store.getState().enqueue(entry({ operationId: "old", createdAt: 1_000 }));
    store.getState().enqueue(
      entry({
        operationId: "fresh",
        createdAt: 1_000 + QUICK_EXPENSE_RECOVERY_TTL_MS,
      })
    );

    store
      .getState()
      .pruneExpired(1_000 + QUICK_EXPENSE_RECOVERY_TTL_MS + 1);

    expect(store.getState().entries.old).toBeUndefined();
    expect(store.getState().entries.fresh).toBeDefined();
  });

  it("excludes toast ids from persisted recovery state", () => {
    const state = {
      entries: {
        "op-3": entry({
          operationId: "op-3",
          toastId: "toast-3",
          status: "failed",
        }),
      },
      activeRecoveryOperationId: "op-3",
    };

    expect(getPersistableQuickExpenseRecoveryState(state)).toEqual({
      entries: {
        "op-3": {
          ...state.entries["op-3"],
          toastId: undefined,
        },
      },
      activeRecoveryOperationId: "op-3",
    });
  });
});
```

- [ ] **Step 2: Run the failing store tests**

Run:

```bash
rtk npm run test -- src/stores/quick-expense-recovery-store.test.ts
```

Expected: FAIL because `src/stores/quick-expense-recovery-store.ts` does not exist.

- [ ] **Step 3: Implement the recovery store**

Create `src/stores/quick-expense-recovery-store.ts`:

```ts
import { Category, PaidBy } from "@/enums";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";

export const QUICK_EXPENSE_RECOVERY_TTL_MS = 30 * 60 * 1000;

export type TQuickExpensePayload = {
  date: string;
  amount: number;
  note: string;
  category: Category;
  paidBy: PaidBy;
  budgetId: number | null;
};

export type TQuickExpenseDraft = TQuickExpensePayload;

export type TQuickExpenseRecoveryStatus = "queued" | "running" | "failed";

export type TQuickExpenseRecoveryEntry = {
  operationId: string;
  mode: "create" | "edit";
  transactionId?: number;
  draft: TQuickExpenseDraft;
  payload: TQuickExpensePayload;
  toastId?: string | number;
  status: TQuickExpenseRecoveryStatus;
  createdAt: number;
};

export type TQuickExpenseRecoveryPersistedState = {
  entries: Record<string, TQuickExpenseRecoveryEntry>;
  activeRecoveryOperationId: string | null;
};

export type TQuickExpenseRecoveryState =
  TQuickExpenseRecoveryPersistedState & {
    enqueue: (entry: TQuickExpenseRecoveryEntry) => void;
    markRunning: (operationId: string) => void;
    attachToastId: (
      operationId: string,
      toastId: string | number | undefined
    ) => void;
    markFailed: (operationId: string) => void;
    clear: (operationId: string) => void;
    setActiveRecovery: (operationId: string | null) => void;
    pruneExpired: (now: number) => void;
    getQueuedEntries: () => TQuickExpenseRecoveryEntry[];
  };

const buildState = (
  set: (
    partial:
      | Partial<TQuickExpenseRecoveryPersistedState>
      | ((
          state: TQuickExpenseRecoveryPersistedState
        ) => Partial<TQuickExpenseRecoveryPersistedState>)
  ) => void,
  get: () => TQuickExpenseRecoveryState
): TQuickExpenseRecoveryState => ({
  entries: {},
  activeRecoveryOperationId: null,
  enqueue: (entry) =>
    set((state) => ({
      entries: {
        ...state.entries,
        [entry.operationId]: entry,
      },
    })),
  markRunning: (operationId) =>
    set((state) => {
      const entry = state.entries[operationId];
      if (!entry || entry.status !== "queued") {
        return {};
      }
      return {
        entries: {
          ...state.entries,
          [operationId]: { ...entry, status: "running" },
        },
      };
    }),
  attachToastId: (operationId, toastId) =>
    set((state) => {
      const entry = state.entries[operationId];
      if (!entry) {
        return {};
      }
      return {
        entries: {
          ...state.entries,
          [operationId]: { ...entry, toastId },
        },
      };
    }),
  markFailed: (operationId) =>
    set((state) => {
      const entry = state.entries[operationId];
      if (!entry) {
        return {};
      }
      return {
        entries: {
          ...state.entries,
          [operationId]: { ...entry, status: "failed" },
        },
      };
    }),
  clear: (operationId) =>
    set((state) => {
      const { [operationId]: _removed, ...entries } = state.entries;
      return {
        entries,
        activeRecoveryOperationId:
          state.activeRecoveryOperationId === operationId
            ? null
            : state.activeRecoveryOperationId,
      };
    }),
  setActiveRecovery: (operationId) =>
    set({ activeRecoveryOperationId: operationId }),
  pruneExpired: (now) =>
    set((state) => {
      const entries = Object.fromEntries(
        Object.entries(state.entries).filter(
          ([, entry]) => now - entry.createdAt <= QUICK_EXPENSE_RECOVERY_TTL_MS
        )
      );
      return {
        entries,
        activeRecoveryOperationId:
          state.activeRecoveryOperationId &&
          entries[state.activeRecoveryOperationId]
            ? state.activeRecoveryOperationId
            : null,
      };
    }),
  getQueuedEntries: () =>
    Object.values(get().entries).filter((entry) => entry.status === "queued"),
});

export const getPersistableQuickExpenseRecoveryState = (
  state: TQuickExpenseRecoveryPersistedState
): TQuickExpenseRecoveryPersistedState => ({
  entries: Object.fromEntries(
    Object.entries(state.entries).map(([operationId, entry]) => [
      operationId,
      { ...entry, toastId: undefined },
    ])
  ),
  activeRecoveryOperationId: state.activeRecoveryOperationId,
});

export const createQuickExpenseRecoveryStore = () =>
  createStore<TQuickExpenseRecoveryState>()((set, get) =>
    buildState(set, get)
  );

export const useQuickExpenseRecoveryStore =
  create<TQuickExpenseRecoveryState>()(
    persist((set, get) => buildState(set, get), {
      version: 1,
      name: "quick-expense-recovery",
      storage: createJSONStorage(() => sessionStorage),
      partialize: getPersistableQuickExpenseRecoveryState,
    })
  );
```

- [ ] **Step 4: Run store tests until they pass**

Run:

```bash
rtk npm run test -- src/stores/quick-expense-recovery-store.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

Run:

```bash
rtk git add src/stores/quick-expense-recovery-store.ts src/stores/quick-expense-recovery-store.test.ts
rtk git commit -m "feat: add quick expense recovery store"
```

## Task 2: Sheet Enqueue Behavior

**Files:**
- Modify: `src/components/QuickExpenseSheet.tsx`
- Modify: `src/components/QuickExpenseSheet.test.tsx`

- [ ] **Step 1: Update sheet tests for enqueue-only submit**

In `src/components/QuickExpenseSheet.test.tsx`, replace the mutation mock setup with a recovery-store mock:

```ts
const recoveryStoreMock = vi.hoisted(() => ({
  enqueue: vi.fn(),
}));

vi.mock("@/stores/quick-expense-recovery-store", async () => {
  const actual = await vi.importActual<
    typeof import("@/stores/quick-expense-recovery-store")
  >("@/stores/quick-expense-recovery-store");

  return {
    ...actual,
    useQuickExpenseRecoveryStore: (selector: (state: unknown) => unknown) =>
      selector({
        enqueue: recoveryStoreMock.enqueue,
      }),
  };
});
```

Remove the `vi.mock("@/lib/mutations", ...)` block from this test file. Keep the `sonner` mock because the missing edit id path still uses `toast.error`.

Replace the create-submit assertion with:

```ts
it("enqueues a create operation with the full submitted draft and closes immediately", async () => {
  const user = await openSheet();
  const note = screen.getByPlaceholderText(/what did you spend on/i);
  const amount = screen.getByPlaceholderText("0");

  await user.type(note, "Retry lunch");
  await user.click(amount);
  await user.keyboard("12000");
  await user.click(screen.getByRole("button", { name: /save expense/i }));

  expect(recoveryStoreMock.enqueue).toHaveBeenCalledWith(
    expect.objectContaining({
      operationId: expect.any(String),
      mode: "create",
      status: "queued",
      transactionId: undefined,
      draft: expect.objectContaining({
        amount: 12000,
        note: "Retry lunch",
        category: "Food",
        paidBy: expect.any(String),
        budgetId: null,
      }),
      payload: expect.objectContaining({
        amount: 12000,
        note: "Retry lunch",
        category: "Food",
        paidBy: expect.any(String),
        budgetId: null,
      }),
      createdAt: expect.any(Number),
    })
  );
  expect(
    screen.queryByPlaceholderText(/what did you spend on/i)
  ).not.toBeInTheDocument();
});
```

Replace the budget-clear submit assertion with:

```ts
await waitFor(() => {
  expect(recoveryStoreMock.enqueue).toHaveBeenCalledWith(
    expect.objectContaining({
      payload: expect.objectContaining({ budgetId: null }),
      draft: expect.objectContaining({ budgetId: null }),
    })
  );
});
```

Replace edit-submit assertions with:

```ts
it("enqueues an edit operation instead of calling mutations directly", async () => {
  const user = userEvent.setup();
  weeklyBudgetOptionsMock.mockResolvedValue([
    budgetOption({ id: 2, name: "Sports week" }),
  ]);
  const { onOpenChange } = renderEditSheet();

  await user.click(screen.getByRole("button", { name: /update expense/i }));

  expect(recoveryStoreMock.enqueue).toHaveBeenCalledWith(
    expect.objectContaining({
      operationId: expect.any(String),
      mode: "edit",
      transactionId: 42,
      status: "queued",
      draft: expect.objectContaining({
        date: "20/05/2026",
        amount: 150000,
        note: "Badminton court",
        category: "Badminton",
        paidBy: "Embe",
        budgetId: 2,
      }),
      payload: expect.objectContaining({
        date: "20/05/2026",
        amount: 150000,
        note: "Badminton court",
        category: "Badminton",
        paidBy: "Embe",
        budgetId: 2,
      }),
      createdAt: expect.any(Number),
    })
  );
  expect(onOpenChange).toHaveBeenCalledWith(false);
});
```

Update the missing id test to assert no enqueue:

```ts
expect(recoveryStoreMock.enqueue).not.toHaveBeenCalled();
expect(toastMock.error).toHaveBeenCalledWith("Failed to update expense");
```

Remove the earlier tests that simulate `options.onSuccess` and `options.onError` from `QuickExpenseSheet.test.tsx`; those move to coordinator and recovery-host tests.

- [ ] **Step 2: Run sheet tests to verify failure**

Run:

```bash
rtk npm run test -- src/components/QuickExpenseSheet.test.tsx
```

Expected: FAIL because `QuickExpenseSheet` still calls mutation hooks directly and does not enqueue recovery operations.

- [ ] **Step 3: Update `QuickExpenseSheet` to enqueue operations**

Modify imports at the top of `src/components/QuickExpenseSheet.tsx`:

```ts
import React, { useEffect, useMemo, useRef, useState } from "react";

import dayjs from "@/configs/date";
import { Category, PaidBy } from "@/enums";
import { useAutoShrinkFont } from "@/hooks/useAutoShrinkFont";
import {
  EXPENSE_PREFILL_EVENT,
  type ExpensePrefillPayload,
} from "@/lib/expense-prefill";
import { queries } from "@/lib/queries";
import { cn, formatVnd, parseVndInput } from "@/lib/utils";
import { getWeekRange } from "@/lib/week";
import {
  type TQuickExpenseDraft,
  type TQuickExpensePayload,
  useQuickExpenseRecoveryStore,
} from "@/stores/quick-expense-recovery-store";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Plus, UserRound, Wallet, XIcon } from "lucide-react";
import { toast } from "sonner";
```

Remove `useCreateExpenseMutation`, `useUpdateExpenseMutation`, and `Loader2` imports.

Change the props and draft type:

```ts
export type TQuickExpenseSheetProps = {
  compact?: boolean;
  mode?: "create" | "edit";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialExpense?: TQuickExpenseSheetInitialExpense | null;
  transactionId?: number;
  onSuccess?: () => void;
  showTrigger?: boolean;
  recoveryDraft?: TQuickExpenseDraft | null;
};

export type TExpenseDraft = TQuickExpenseDraft;
```

Include `recoveryDraft = null` in props. Update initial state and edit open behavior to prefer recovery draft:

```ts
const buildInitialDraft = () =>
  recoveryDraft
    ? { ...recoveryDraft }
    : isEditMode
      ? buildDraftFromExpense(initialExpense, fallbackPaidBy)
      : buildDefaultDraft(fallbackPaidBy);

const [draft, setDraft] = useState<TExpenseDraft>(buildInitialDraft);
```

Keep `onSuccess` in `TQuickExpenseSheetProps` for compatibility with existing callers, but remove it from the component destructuring if it is no longer read after enqueue-only submit.

Add recovery store action and a focused queueing flag:

```ts
const enqueueRecovery = useQuickExpenseRecoveryStore((state) => state.enqueue);
const [queueing, setQueueing] = useState(false);

const canSubmit = draft.amount > 0 && !queueing;
```

Replace `handleSubmit` with enqueue-only logic:

```ts
const cloneDraft = (value: TExpenseDraft): TExpenseDraft => ({
  date: value.date,
  amount: value.amount,
  note: value.note,
  category: value.category,
  budgetId: value.budgetId,
  paidBy: value.paidBy,
});

const buildPayload = (value: TExpenseDraft): TQuickExpensePayload => ({
  date: value.date,
  amount: value.amount,
  note: value.note,
  category: value.category,
  paidBy: value.paidBy,
  budgetId: value.budgetId,
});

const handleSubmit = () => {
  if (!canSubmit) {
    return;
  }

  if (isEditMode && !transactionId) {
    toast.error("Failed to update expense");
    return;
  }

  setQueueing(true);
  const submittedDraft = cloneDraft(draft);
  const payload = buildPayload(submittedDraft);
  enqueueRecovery({
    operationId:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    mode: isEditMode ? "edit" : "create",
    transactionId: isEditMode ? transactionId : undefined,
    draft: submittedDraft,
    payload,
    status: "queued",
    createdAt: Date.now(),
  });
  handleOpenChange(false);
  setQueueing(false);
};
```

Update `handleOpenChange(true)` and the edit-mode `useEffect` to prefer `recoveryDraft`:

```ts
if (isEditMode) {
  setDraft(recoveryDraft ? { ...recoveryDraft } : buildDraftFromExpense(initialExpense, fallbackPaidBy));
}
```

Update the submit button body:

```tsx
{isEditMode ? "Update expense" : "Save expense"}
```

- [ ] **Step 4: Run sheet tests until they pass**

Run:

```bash
rtk npm run test -- src/components/QuickExpenseSheet.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

Run:

```bash
rtk git add src/components/QuickExpenseSheet.tsx src/components/QuickExpenseSheet.test.tsx
rtk git commit -m "feat: queue quick expense sheet submissions"
```

## Task 3: Mutation Coordinator

**Files:**
- Create: `src/components/QuickExpenseMutationCoordinator.tsx`
- Create: `src/components/QuickExpenseMutationCoordinator.test.tsx`

- [ ] **Step 1: Write coordinator tests**

Create `src/components/QuickExpenseMutationCoordinator.test.tsx`:

```ts
import React from "react";

import { Category, PaidBy } from "@/enums";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import QuickExpenseMutationCoordinator from "./QuickExpenseMutationCoordinator";
import {
  useQuickExpenseRecoveryStore,
  type TQuickExpenseRecoveryEntry,
} from "@/stores/quick-expense-recovery-store";

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  loading: vi.fn(),
}));

const mutationMocks = vi.hoisted(() => ({
  createExpenseMutateAsync: vi.fn(),
  updateExpenseMutateAsync: vi.fn(),
}));

vi.mock("@/lib/mutations", () => ({
  useCreateExpenseMutation: () => ({
    mutateAsync: mutationMocks.createExpenseMutateAsync,
  }),
  useUpdateExpenseMutation: () => ({
    mutateAsync: mutationMocks.updateExpenseMutateAsync,
  }),
}));

vi.mock("sonner", () => ({
  toast: toastMock,
}));

const payload = {
  date: "20/05/2026",
  amount: 34000,
  note: "Retry lunch",
  category: Category.FOOD,
  paidBy: PaidBy.CUBI,
  budgetId: null,
};

const entry = (
  override: Partial<TQuickExpenseRecoveryEntry> = {}
): TQuickExpenseRecoveryEntry => ({
  operationId: "op-1",
  mode: "create",
  draft: payload,
  payload,
  status: "queued",
  createdAt: Date.now(),
  ...override,
});

const renderCoordinator = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <QuickExpenseMutationCoordinator />
    </QueryClientProvider>
  );
};

describe("QuickExpenseMutationCoordinator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    toastMock.loading.mockReturnValue("toast-1");
    mutationMocks.createExpenseMutateAsync.mockResolvedValue({});
    mutationMocks.updateExpenseMutateAsync.mockResolvedValue({});
    useQuickExpenseRecoveryStore.setState({
      entries: {},
      activeRecoveryOperationId: null,
    });
  });

  it("starts a queued create operation and clears it on success", async () => {
    useQuickExpenseRecoveryStore.getState().enqueue(entry());

    renderCoordinator();

    await waitFor(() =>
      expect(mutationMocks.createExpenseMutateAsync).toHaveBeenCalledWith(
        payload
      )
    );
    await waitFor(() =>
      expect(useQuickExpenseRecoveryStore.getState().entries["op-1"]).toBeUndefined()
    );
    expect(toastMock.loading).toHaveBeenCalledWith("Adding expense...");
    expect(toastMock.success).toHaveBeenCalledWith("Expense added", {
      id: "toast-1",
    });
  });

  it("starts a queued edit operation and clears it on success", async () => {
    useQuickExpenseRecoveryStore.getState().enqueue(
      entry({
        operationId: "op-2",
        mode: "edit",
        transactionId: 42,
      })
    );

    renderCoordinator();

    await waitFor(() =>
      expect(mutationMocks.updateExpenseMutateAsync).toHaveBeenCalledWith({
        id: 42,
        input: payload,
      })
    );
    expect(toastMock.loading).toHaveBeenCalledWith("Updating expense...");
    await waitFor(() =>
      expect(useQuickExpenseRecoveryStore.getState().entries["op-2"]).toBeUndefined()
    );
  });

  it("marks failed operations and wires Reopen to active recovery", async () => {
    mutationMocks.createExpenseMutateAsync.mockRejectedValue(
      new Error("Network failed")
    );
    useQuickExpenseRecoveryStore.getState().enqueue(entry());

    renderCoordinator();

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith(
        "Network failed",
        expect.objectContaining({
          id: "toast-1",
          action: expect.objectContaining({
            label: "Reopen",
            onClick: expect.any(Function),
          }),
        })
      )
    );
    expect(useQuickExpenseRecoveryStore.getState().entries["op-1"]?.status).toBe(
      "failed"
    );

    const errorOptions = toastMock.error.mock.calls.at(-1)?.[1];
    errorOptions.action.onClick();
    expect(
      useQuickExpenseRecoveryStore.getState().activeRecoveryOperationId
    ).toBe("op-1");
  });

  it("shows an error toast without an id when the loading toast id is missing", async () => {
    toastMock.loading.mockReturnValue(undefined);
    mutationMocks.createExpenseMutateAsync.mockRejectedValue(
      new Error("Network failed")
    );
    useQuickExpenseRecoveryStore.getState().enqueue(
      entry({ operationId: "op-no-toast" })
    );

    renderCoordinator();

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith(
        "Network failed",
        expect.objectContaining({
          id: undefined,
          action: expect.objectContaining({
            label: "Reopen",
          }),
        })
      )
    );
  });

  it("does not process entries already marked running", async () => {
    useQuickExpenseRecoveryStore.getState().enqueue(
      entry({ operationId: "running-op", status: "running" })
    );

    renderCoordinator();

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mutationMocks.createExpenseMutateAsync).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run coordinator tests to verify failure**

Run:

```bash
rtk npm run test -- src/components/QuickExpenseMutationCoordinator.test.tsx
```

Expected: FAIL because `QuickExpenseMutationCoordinator.tsx` does not exist.

- [ ] **Step 3: Implement coordinator**

Create `src/components/QuickExpenseMutationCoordinator.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";

import {
  useCreateExpenseMutation,
  useUpdateExpenseMutation,
} from "@/lib/mutations";
import {
  useQuickExpenseRecoveryStore,
  type TQuickExpenseRecoveryEntry,
} from "@/stores/quick-expense-recovery-store";
import { toast } from "sonner";

const getErrorMessage = (
  error: unknown,
  entry: TQuickExpenseRecoveryEntry
) => {
  if (error instanceof Error) {
    return error.message;
  }
  return entry.mode === "edit"
    ? "Failed to update expense"
    : "Failed to add expense";
};

const QuickExpenseMutationCoordinator = () => {
  const createExpenseMutation = useCreateExpenseMutation();
  const updateExpenseMutation = useUpdateExpenseMutation();
  const queuedEntries = useQuickExpenseRecoveryStore((state) =>
    state.getQueuedEntries()
  );
  const markRunning = useQuickExpenseRecoveryStore((state) => state.markRunning);
  const attachToastId = useQuickExpenseRecoveryStore(
    (state) => state.attachToastId
  );
  const markFailed = useQuickExpenseRecoveryStore((state) => state.markFailed);
  const clear = useQuickExpenseRecoveryStore((state) => state.clear);
  const setActiveRecovery = useQuickExpenseRecoveryStore(
    (state) => state.setActiveRecovery
  );
  const inFlightRef = useRef(new Set<string>());

  useEffect(() => {
    queuedEntries.forEach((entry) => {
      if (inFlightRef.current.has(entry.operationId)) {
        return;
      }
      inFlightRef.current.add(entry.operationId);
      markRunning(entry.operationId);
      const toastId = toast.loading(
        entry.mode === "edit" ? "Updating expense..." : "Adding expense..."
      );
      attachToastId(entry.operationId, toastId);

      const mutation =
        entry.mode === "edit"
          ? updateExpenseMutation.mutateAsync({
              id: entry.transactionId as number,
              input: entry.payload,
            })
          : createExpenseMutation.mutateAsync(entry.payload);

      mutation
        .then(() => {
          const latest =
            useQuickExpenseRecoveryStore.getState().entries[entry.operationId];
          toast.success(
            entry.mode === "edit" ? "Expense updated" : "Expense added",
            latest?.toastId ? { id: latest.toastId } : undefined
          );
          clear(entry.operationId);
        })
        .catch((error: unknown) => {
          const latest =
            useQuickExpenseRecoveryStore.getState().entries[entry.operationId];
          markFailed(entry.operationId);
          toast.error(getErrorMessage(error, entry), {
            id: latest?.toastId,
            action: {
              label: "Reopen",
              onClick: () => setActiveRecovery(entry.operationId),
            },
          });
        })
        .finally(() => {
          inFlightRef.current.delete(entry.operationId);
        });
    });
  }, [
    attachToastId,
    clear,
    createExpenseMutation,
    markFailed,
    markRunning,
    queuedEntries,
    setActiveRecovery,
    updateExpenseMutation,
  ]);

  return null;
};

export default QuickExpenseMutationCoordinator;
```

- [ ] **Step 4: Run coordinator tests until they pass**

Run:

```bash
rtk npm run test -- src/components/QuickExpenseMutationCoordinator.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

Run:

```bash
rtk git add src/components/QuickExpenseMutationCoordinator.tsx src/components/QuickExpenseMutationCoordinator.test.tsx
rtk git commit -m "feat: add quick expense mutation coordinator"
```

## Task 4: Recovery Sheet Host

**Files:**
- Create: `src/components/QuickExpenseRecoverySheetHost.tsx`
- Create: `src/components/QuickExpenseRecoverySheetHost.test.tsx`

- [ ] **Step 1: Write recovery host tests**

Create `src/components/QuickExpenseRecoverySheetHost.test.tsx`:

```ts
import React from "react";

import { Category, PaidBy } from "@/enums";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsStoreProvider } from "@/components/providers/StoreProvider";
import QuickExpenseRecoverySheetHost from "./QuickExpenseRecoverySheetHost";
import { useQuickExpenseRecoveryStore } from "@/stores/quick-expense-recovery-store";

vi.mock("@/lib/queries", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/queries")>("@/lib/queries");
  const options = Object.assign(
    () => ({
      queryKey: ["budgetWeekly", "options", "mock"],
      queryFn: async () => [],
    }),
    { _def: ["budgetWeekly", "options"] }
  );

  return {
    ...actual,
    queries: {
      ...actual.queries,
      budgetWeekly: {
        ...actual.queries.budgetWeekly,
        options,
      },
    },
  };
});

const draft = {
  date: "20/05/2026",
  amount: 34000,
  note: "Retry lunch",
  category: Category.FOOD,
  paidBy: PaidBy.CUBI,
  budgetId: null,
};

const renderHost = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SettingsStoreProvider>
        <QuickExpenseRecoverySheetHost />
      </SettingsStoreProvider>
    </QueryClientProvider>
  );
};

describe("QuickExpenseRecoverySheetHost", () => {
  beforeEach(() => {
    useQuickExpenseRecoveryStore.setState({
      entries: {},
      activeRecoveryOperationId: null,
    });
  });

  it("opens a failed create draft from the recovery store", async () => {
    useQuickExpenseRecoveryStore.getState().enqueue({
      operationId: "op-create",
      mode: "create",
      draft,
      payload: draft,
      status: "failed",
      createdAt: Date.now(),
    });
    useQuickExpenseRecoveryStore.getState().setActiveRecovery("op-create");

    renderHost();

    expect(
      await screen.findByPlaceholderText(/what did you spend on/i)
    ).toHaveValue("Retry lunch");
    expect(screen.getByPlaceholderText("0")).toHaveValue("34.000");
    expect(screen.getByRole("button", { name: /save expense/i })).toBeInTheDocument();
  });

  it("opens a failed edit draft and clears active recovery on close", async () => {
    const user = userEvent.setup();
    useQuickExpenseRecoveryStore.getState().enqueue({
      operationId: "op-edit",
      mode: "edit",
      transactionId: 42,
      draft: { ...draft, note: "Retry badminton" },
      payload: { ...draft, note: "Retry badminton" },
      status: "failed",
      createdAt: Date.now(),
    });
    useQuickExpenseRecoveryStore.getState().setActiveRecovery("op-edit");

    renderHost();

    expect(
      await screen.findByPlaceholderText(/what did you spend on/i)
    ).toHaveValue("Retry badminton");
    expect(
      screen.getByRole("button", { name: /update expense/i })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /close/i }));
    expect(
      useQuickExpenseRecoveryStore.getState().activeRecoveryOperationId
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run recovery host tests to verify failure**

Run:

```bash
rtk npm run test -- src/components/QuickExpenseRecoverySheetHost.test.tsx
```

Expected: FAIL because `QuickExpenseRecoverySheetHost.tsx` does not exist.

- [ ] **Step 3: Implement recovery host**

Create `src/components/QuickExpenseRecoverySheetHost.tsx`:

```tsx
"use client";

import QuickExpenseSheet from "@/components/QuickExpenseSheet";
import { useQuickExpenseRecoveryStore } from "@/stores/quick-expense-recovery-store";

const QuickExpenseRecoverySheetHost = () => {
  const activeRecoveryOperationId = useQuickExpenseRecoveryStore(
    (state) => state.activeRecoveryOperationId
  );
  const entry = useQuickExpenseRecoveryStore((state) =>
    activeRecoveryOperationId
      ? state.entries[activeRecoveryOperationId]
      : undefined
  );
  const setActiveRecovery = useQuickExpenseRecoveryStore(
    (state) => state.setActiveRecovery
  );

  if (!entry || entry.status !== "failed") {
    return null;
  }

  return (
    <QuickExpenseSheet
      mode={entry.mode}
      open
      onOpenChange={(next) => {
        if (!next) {
          setActiveRecovery(null);
        }
      }}
      showTrigger={false}
      transactionId={entry.transactionId}
      recoveryDraft={entry.draft}
    />
  );
};

export default QuickExpenseRecoverySheetHost;
```

- [ ] **Step 4: Run recovery host tests until they pass**

Run:

```bash
rtk npm run test -- src/components/QuickExpenseRecoverySheetHost.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

Run:

```bash
rtk git add src/components/QuickExpenseRecoverySheetHost.tsx src/components/QuickExpenseRecoverySheetHost.test.tsx
rtk git commit -m "feat: add quick expense recovery sheet host"
```

## Task 5: App Mounting and Focused Integration

**Files:**
- Modify: `src/app/layout.tsx`
- Test: `src/components/QuickExpenseMutationCoordinator.test.tsx`
- Test: `src/components/QuickExpenseRecoverySheetHost.test.tsx`
- Test: `src/components/QuickExpenseSheet.test.tsx`

- [ ] **Step 1: Mount coordinator and recovery host in the app shell**

Modify `src/app/layout.tsx` imports:

```ts
import QuickExpenseMutationCoordinator from "@/components/QuickExpenseMutationCoordinator";
import QuickExpenseRecoverySheetHost from "@/components/QuickExpenseRecoverySheetHost";
```

Mount them inside `SettingsStoreProvider`, after `AppMain` and before `BottomNav`:

```tsx
<SettingsStoreProvider>
  <AppMain>
    <PullToRefresh>{children}</PullToRefresh>
  </AppMain>
  <QuickExpenseMutationCoordinator />
  <QuickExpenseRecoverySheetHost />
  <ProgressiveBlur
    className="fixed right-0 bottom-0 left-0"
    position="bottom"
    height="120px"
  />
  <BottomNav />
</SettingsStoreProvider>
```

- [ ] **Step 2: Run focused component tests**

Run:

```bash
rtk npm run test -- src/stores/quick-expense-recovery-store.test.ts src/components/QuickExpenseSheet.test.tsx src/components/QuickExpenseMutationCoordinator.test.tsx src/components/QuickExpenseRecoverySheetHost.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run existing optimistic-list regression tests**

Run:

```bash
rtk npm run test -- src/lib/mutations/expense-optimistic.test.ts src/lib/mutations/index.test.tsx src/components/ExpenseList.test.tsx src/components/QuickExpenseSheet.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Run TypeScript**

Run:

```bash
rtk npx tsc --noEmit
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 5: Commit Task 5**

Run:

```bash
rtk git add src/app/layout.tsx
rtk git commit -m "feat: mount quick expense background submit flow"
```

## Task 6: Browser Smoke Test

**Files:**
- No code files unless the smoke test finds a bug.

- [ ] **Step 1: Start or reuse the dev server on port 3000**

Run:

```bash
rtk npm run dev
```

Expected: app available at `http://localhost:3000`. If port 3000 is already serving this app, reuse it.

- [ ] **Step 2: Smoke test create flow in browser**

Use `agent-browser` on `http://localhost:3000`:

1. Open the add expense sheet.
2. Enter note `Background submit smoke`.
3. Enter amount `12345`.
4. Submit.
5. Verify the sheet closes immediately.
6. Verify a loading toast appears.
7. Verify the optimistic row appears in the visible transaction list.
8. Verify the loading toast changes to success.

Expected: no blocking sheet while the request is pending.

- [ ] **Step 3: Smoke test edit flow in browser**

Use `agent-browser`:

1. Open the newly created expense actions.
2. Open edit.
3. Change note to `Background submit smoke edited`.
4. Submit.
5. Verify the edit sheet closes immediately.
6. Verify a loading toast appears and then success.
7. Verify the visible list updates optimistically.

Expected: edit flow does not depend on the edit sheet staying mounted.

- [ ] **Step 4: Smoke test delete cleanup**

Use `agent-browser`:

1. Delete the smoke-test expense.
2. Verify it disappears from the visible list.

Expected: existing delete flow remains functional.

- [ ] **Step 5: Commit smoke-test fixes if needed**

If the smoke test required code changes, run:

```bash
rtk git status --short
rtk git add src/stores/quick-expense-recovery-store.ts src/stores/quick-expense-recovery-store.test.ts src/components/QuickExpenseSheet.tsx src/components/QuickExpenseSheet.test.tsx src/components/QuickExpenseMutationCoordinator.tsx src/components/QuickExpenseMutationCoordinator.test.tsx src/components/QuickExpenseRecoverySheetHost.tsx src/components/QuickExpenseRecoverySheetHost.test.tsx src/app/layout.tsx
rtk git commit -m "fix: stabilize quick expense background submit flow"
```

If no code changes were required, do not create an empty commit.

## Final Verification

Run these before declaring the implementation complete:

```bash
rtk npm run test -- src/stores/quick-expense-recovery-store.test.ts src/components/QuickExpenseSheet.test.tsx src/components/QuickExpenseMutationCoordinator.test.tsx src/components/QuickExpenseRecoverySheetHost.test.tsx
rtk npm run test -- src/lib/mutations/expense-optimistic.test.ts src/lib/mutations/index.test.tsx src/components/ExpenseList.test.tsx src/components/QuickExpenseSheet.test.tsx
rtk npx tsc --noEmit
```

Do not run `npm run build`.

## Implementation Notes

- Do not add Server Actions.
- Do not call `fetch("/api/...")` from components.
- Keep optimistic list updates inside `src/lib/mutations` and `src/lib/mutations/expense-optimistic.ts`.
- Keep dashboard, report, budget, and derived caches corrected by existing invalidation only.
- Do not revert unrelated dirty work. At the time this plan was written, `src/components/QuickExpenseSheet.test.tsx` had pre-existing uncommitted edits from earlier exploration, and `docs/superpowers/plans/2026-05-23-transaction-optimistic-visible-list.md` was already untracked.
