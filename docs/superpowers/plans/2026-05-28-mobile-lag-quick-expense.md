# Mobile Lag Quick Expense Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce iPhone 13 mobile lag by removing thousands of hidden expense-row action controls from the home page, then verify quick expense sheet and route transition timing.

**Architecture:** Move row secondary-action ownership up to `ExpenseList`, so only one row can have duplicate/edit/delete controls mounted at a time. Move delete confirmation and delete mutation ownership into one shared list-level dialog, keep `ExpenseListItem` focused on visible row rendering and row-action gestures, and disable prefetch for repeated day links.

**Tech Stack:** Next.js 15 App Router, React 19, TanStack Query, Radix Dialog, Motion React, Testing Library, Vitest, agent-browser, Bun, ESLint, Prettier.

---

## Scope

This plan implements the approved first target from [the design spec](../specs/2026-05-28-mobile-lag-quick-expense-design.md): reduce home expense list DOM and interactive-action cost before deeper `QuickExpenseSheet.tsx` tuning. It also includes mobile browser measurement after the list fix. If the post-fix measurement still shows a 150 ms or worse quick-sheet tap-to-input delay, write a follow-up spec/plan for splitting the quick sheet body; do not mix that larger refactor into this first implementation.

## File Structure

- Modify `src/components/ExpenseListItem.tsx`
  - Keep visible row UI, swipe/open state, duplicate action, and edit callback.
  - Remove per-row delete mutation hook, toast usage, and per-row Radix dialog.
  - Add controlled action-open props so parent state decides which row can mount actions.
  - Render secondary action buttons only when the row is open.

- Modify `src/components/ExpenseList.tsx`
  - Own `activeActionExpenseId`.
  - Own `deleteCandidateExpense`.
  - Render one shared delete confirmation dialog for the selected expense.
  - Pass controlled action state and callbacks into each `ExpenseListItem`.
  - Add `prefetch={false}` to repeated day-summary links.

- Create `src/components/ExpenseDeleteConfirmDialog.tsx`
  - Own one delete mutation hook and delete toasts for the active candidate.
  - Render the same confirmation UI currently duplicated inside every row.
  - Close after success or cancel.

- Modify `src/components/ExpenseListItem.mascot.test.tsx`
  - Cover no hidden row actions at rest.
  - Cover controlled action rendering.
  - Cover duplicate dispatch and edit/delete action callbacks.
  - Remove expectations tied to per-row delete mutation ownership.

- Modify `src/components/ExpenseList.test.tsx`
  - Update the `ExpenseListItem` mock to accept action-state props.
  - Cover one central delete dialog host.
  - Cover repeated day link `prefetch={false}`.

- Create `src/components/ExpenseDeleteConfirmDialog.test.tsx`
  - Cover cancel, success, failure, and pending states for the shared dialog.

## Task 1: Add Failing Tests For Lightweight Row Actions

**Files:**
- Modify: `src/components/ExpenseListItem.mascot.test.tsx`
- Test: `src/components/ExpenseListItem.mascot.test.tsx`

- [ ] **Step 1: Replace mutation and toast mocks with prefill mock plus action callbacks**

Remove the `deleteExpenseMutationMock`, `deleteExpenseIsPendingMock`, `toastMock`, `@/lib/mutations` mock, and `sonner` mock from `src/components/ExpenseListItem.mascot.test.tsx`.

Add this mock near the other mocks:

```tsx
const dispatchExpensePrefillMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/expense-prefill", () => ({
  dispatchExpensePrefill: dispatchExpensePrefillMock,
}));
```

Update `beforeEach` to:

```tsx
beforeEach(() => {
  vi.clearAllMocks();
});
```

- [ ] **Step 2: Update the test helper for controlled action state**

Replace `renderItem` with this helper:

```tsx
const renderItem = ({
  actionOpen = false,
  onActionOpenChange = vi.fn(),
  onDeleteExpense = vi.fn(),
  onEditExpense = vi.fn(),
  overrides = {},
}: {
  actionOpen?: boolean;
  onActionOpenChange?: (open: boolean) => void;
  onDeleteExpense?: (expense: ExpenseListItemData) => void;
  onEditExpense?: (expense: ExpenseListItemData) => void;
  overrides?: Partial<ExpenseFixture>;
} = {}) => {
  const item = { ...expense, ...overrides };

  render(
    <ExpenseListItem
      actionOpen={actionOpen}
      expense={item}
      onActionOpenChange={onActionOpenChange}
      onDeleteExpense={onDeleteExpense}
      onEditExpense={onEditExpense}
    />
  );

  return { expense: item, onActionOpenChange, onDeleteExpense, onEditExpense };
};
```

- [ ] **Step 3: Add tests for at-rest DOM and controlled action rendering**

Add these tests in `describe("ExpenseListItem edit flow", ...)` before the existing edit tests:

```tsx
it("does not mount secondary action buttons while closed", () => {
  renderItem();

  expect(
    screen.queryByRole("button", { name: "Duplicate expense" })
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /^Edit expense$/i })
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Delete expense" })
  ).not.toBeInTheDocument();
});

it("mounts secondary action buttons only when controlled open", () => {
  renderItem({ actionOpen: true });

  expect(
    screen.getByRole("button", { name: "Duplicate expense" })
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /^Edit expense$/i })
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Delete expense" })
  ).toBeInTheDocument();
});
```

- [ ] **Step 4: Replace swipe edit/delete tests with controlled action tests**

Replace the current `"requests edit from the parent host from the swipe edit action"` test with:

```tsx
it("requests edit from the parent host from the open row edit action", async () => {
  const user = userEvent.setup();
  const { onEditExpense } = renderItem({ actionOpen: true });

  await user.click(screen.getByRole("button", { name: /^Edit expense$/i }));

  expect(onEditExpense).toHaveBeenCalledTimes(1);
  expect(onEditExpense).toHaveBeenCalledWith(expense);
});
```

Add these action tests:

```tsx
it("dispatches quick expense prefill from the open row duplicate action", async () => {
  const user = userEvent.setup();
  renderItem({ actionOpen: true });

  await user.click(screen.getByRole("button", { name: "Duplicate expense" }));

  expect(dispatchExpensePrefillMock).toHaveBeenCalledWith({
    amount: expense.amount,
    note: expense.note,
    category: expense.category,
    source: "repeat_entry",
  });
});

it("requests shared delete confirmation from the open row delete action", async () => {
  const user = userEvent.setup();
  const { onDeleteExpense } = renderItem({ actionOpen: true });

  await user.click(screen.getByRole("button", { name: "Delete expense" }));

  expect(onDeleteExpense).toHaveBeenCalledTimes(1);
  expect(onDeleteExpense).toHaveBeenCalledWith(expense);
});
```

- [ ] **Step 5: Delete old per-row delete-flow tests**

Remove the whole `describe("ExpenseListItem delete flow", ...)` block. Those behaviors will move to `ExpenseDeleteConfirmDialog.test.tsx` in Task 3.

- [ ] **Step 6: Run the test to verify it fails**

Run:

```bash
rtk bunx vitest run src/components/ExpenseListItem.mascot.test.tsx
```

Expected: FAIL because `ExpenseListItem` does not yet accept `actionOpen`, `onActionOpenChange`, or `onDeleteExpense`, and still renders secondary action buttons while closed.

## Task 2: Make ExpenseListItem Render Actions Only When Open

**Files:**
- Modify: `src/components/ExpenseListItem.tsx`
- Test: `src/components/ExpenseListItem.mascot.test.tsx`

- [ ] **Step 1: Update imports**

In `src/components/ExpenseListItem.tsx`, remove:

```tsx
import { useDeleteExpenseMutation } from "@/lib/mutations";
import { NotebookIcon, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
```

Replace the icon import with:

```tsx
import { Copy, Pencil, Trash2 } from "lucide-react";
```

Keep `dispatchExpensePrefill` because duplicate stays in the row action surface.

- [ ] **Step 2: Update props**

Replace the props type with:

```tsx
type ExpenseListItemProps = {
  actionOpen: boolean;
  expense: ExpenseListItemData;
  onActionOpenChange: (open: boolean) => void;
  onDeleteExpense: (expense: ExpenseListItemData) => void;
  onEditExpense: (expense: ExpenseListItemData) => void;
};
```

Replace the component signature with:

```tsx
const ExpenseListItem = ({
  actionOpen,
  expense,
  onActionOpenChange,
  onDeleteExpense,
  onEditExpense,
}: ExpenseListItemProps) => {
```

- [ ] **Step 3: Remove local delete and open state**

Delete these declarations:

```tsx
const [isOpen, setIsOpen] = useState(false);
const [confirmOpen, setConfirmOpen] = useState(false);
const deleteExpenseMutation = useDeleteExpenseMutation();
const isDeleting = deleteExpenseMutation.isPending;
```

Add:

```tsx
const isOpen = actionOpen;
```

- [ ] **Step 4: Update row-open ownership**

In `handleDragEnd`, replace:

```tsx
setIsOpen(true);
window.dispatchEvent(
  new CustomEvent(OPEN_EVENT_NAME, { detail: expense.id })
);
```

with:

```tsx
onActionOpenChange(true);
window.dispatchEvent(
  new CustomEvent(OPEN_EVENT_NAME, { detail: expense.id })
);
```

Replace:

```tsx
setIsOpen(false);
```

with:

```tsx
onActionOpenChange(false);
```

In `handleOtherOpen`, replace:

```tsx
setIsOpen(false);
```

with:

```tsx
onActionOpenChange(false);
```

In the outside-pointer effect, replace:

```tsx
setIsOpen(false);
```

with:

```tsx
onActionOpenChange(false);
```

Update the dependencies for both effects to include `onActionOpenChange`.

- [ ] **Step 5: Replace delete handlers**

Delete `handleDelete` and `handleDeleteRequest`.

Add:

```tsx
const handleDeleteRequest = () => {
  onDeleteExpense(expense);
  onActionOpenChange(false);
};
```

Update `handleDuplicate` and `openEditSheet` to close via the parent callback:

```tsx
const handleDuplicate = () => {
  dispatchExpensePrefill({
    amount: expense.amount,
    note: expense.note ?? "",
    category: expense.category,
    source: "repeat_entry",
  });
  onActionOpenChange(false);
};

const openEditSheet = () => {
  onEditExpense(expense);
  onActionOpenChange(false);
};
```

- [ ] **Step 6: Conditionally render the action button layer**

Wrap the first action `motion.div` with `isOpen ? (...) : null`.

The result should be:

```tsx
{isOpen ? (
  <motion.div
    initial={false}
    animate={{ opacity: 1, x: "0%" }}
    transition={{
      type: "spring",
      stiffness: 500,
      damping: 40,
      mass: 0.7,
      duration: 0.4,
    }}
    className="absolute inset-y-0 right-0 z-50 flex items-center justify-end gap-2"
  >
    <Button
      type="button"
      size="icon"
      variant="secondary"
      aria-label="Duplicate expense"
      onClick={handleDuplicate}
      className="backdrop-blur-md"
    >
      <Copy className="h-4 w-4" />
    </Button>
    <Button
      type="button"
      size="icon"
      variant="secondary"
      aria-label="Edit expense"
      onClick={openEditSheet}
      className="backdrop-blur-md"
    >
      <Pencil className="h-4 w-4" />
    </Button>
    <Button
      type="button"
      size="icon"
      variant="destructive"
      aria-label="Delete expense"
      onClick={handleDeleteRequest}
      className="backdrop-blur-md"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  </motion.div>
) : null}
```

- [ ] **Step 7: Remove the per-row dialog JSX**

Delete the entire trailing `<Dialog open={confirmOpen} ...>` block from `ExpenseListItem.tsx`. After this step, `ExpenseListItem` should not import anything from `@/components/ui/dialog`.

- [ ] **Step 8: Run the row test**

Run:

```bash
rtk bunx vitest run src/components/ExpenseListItem.mascot.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Format and lint the modified row files**

Run:

```bash
rtk bunx prettier --write src/components/ExpenseListItem.tsx src/components/ExpenseListItem.mascot.test.tsx
rtk bunx prettier --check src/components/ExpenseListItem.tsx src/components/ExpenseListItem.mascot.test.tsx
rtk bunx eslint src/components/ExpenseListItem.tsx src/components/ExpenseListItem.mascot.test.tsx
```

Expected: all commands pass.

- [ ] **Step 10: Commit**

Run:

```bash
rtk git add src/components/ExpenseListItem.tsx src/components/ExpenseListItem.mascot.test.tsx
rtk git commit -m "perf: mount expense row actions only when open"
```

Expected: commit succeeds.

## Task 3: Add One Shared Delete Confirmation Dialog

**Files:**
- Create: `src/components/ExpenseDeleteConfirmDialog.tsx`
- Create: `src/components/ExpenseDeleteConfirmDialog.test.tsx`
- Test: `src/components/ExpenseDeleteConfirmDialog.test.tsx`

- [ ] **Step 1: Write the shared dialog test**

Create `src/components/ExpenseDeleteConfirmDialog.test.tsx` with:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ExpenseListItemData } from "./ExpenseListItem";
import ExpenseDeleteConfirmDialog from "./ExpenseDeleteConfirmDialog";

const deleteExpenseMutationMock = vi.hoisted(() => vi.fn());
const deleteExpenseIsPendingMock = vi.hoisted(() => ({ value: false }));
const toastMock = vi.hoisted(() => ({
  loading: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/lib/mutations", () => ({
  useDeleteExpenseMutation: () => ({
    mutateAsync: deleteExpenseMutationMock,
    isPending: deleteExpenseIsPendingMock.value,
  }),
}));

vi.mock("sonner", () => ({
  toast: toastMock,
}));

vi.mock("@/components/ExpenseItemIcon", () => ({
  default: ({ category }: { category: string }) => (
    <div data-testid="expense-item-icon">{category}</div>
  ),
}));

const expense: ExpenseListItemData = {
  id: 1,
  clientId: "pending-client-1",
  date: "2026-04-01",
  amount: 125000,
  note: "Lunch",
  category: "Food",
  paidBy: "me",
  budgetId: null,
  budgetName: null,
  budgetIcon: null,
  budgetColor: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  deleteExpenseIsPendingMock.value = false;
  deleteExpenseMutationMock.mockResolvedValue({ id: 1 });
  toastMock.loading.mockReturnValue("loading-toast");
});

describe("ExpenseDeleteConfirmDialog", () => {
  it("renders closed when there is no expense", () => {
    render(<ExpenseDeleteConfirmDialog expense={null} onOpenChange={vi.fn()} />);

    expect(
      screen.queryByRole("heading", { name: "Delete this expense?" })
    ).not.toBeInTheDocument();
  });

  it("closes without deleting when keeping the expense", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <ExpenseDeleteConfirmDialog
        expense={expense}
        onOpenChange={onOpenChange}
      />
    );

    await user.click(screen.getByRole("button", { name: "Keep it" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(deleteExpenseMutationMock).not.toHaveBeenCalled();
  });

  it("shows a loading toast and replaces it on successful delete", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <ExpenseDeleteConfirmDialog
        expense={expense}
        onOpenChange={onOpenChange}
      />
    );

    await user.click(screen.getByRole("button", { name: "Delete expense" }));

    expect(toastMock.loading).toHaveBeenCalledWith("Deleting expense...");
    expect(deleteExpenseMutationMock).toHaveBeenCalledWith({
      id: 1,
      clientId: "pending-client-1",
    });
    await waitFor(() =>
      expect(toastMock.success).toHaveBeenCalledWith("Expense deleted.", {
        id: "loading-toast",
      })
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("replaces the loading toast on delete failure and keeps the dialog open", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    deleteExpenseMutationMock.mockRejectedValue(new Error("Network down"));
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    render(
      <ExpenseDeleteConfirmDialog
        expense={expense}
        onOpenChange={onOpenChange}
      />
    );

    await user.click(screen.getByRole("button", { name: "Delete expense" }));

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith(
        "Failed to delete expense.",
        { id: "loading-toast" }
      )
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);

    consoleErrorSpy.mockRestore();
  });

  it("disables dialog actions while delete is pending", () => {
    deleteExpenseIsPendingMock.value = true;

    render(
      <ExpenseDeleteConfirmDialog expense={expense} onOpenChange={vi.fn()} />
    );

    expect(screen.getByRole("button", { name: "Keep it" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Delete expense" })
    ).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run the dialog test to verify it fails**

Run:

```bash
rtk bunx vitest run src/components/ExpenseDeleteConfirmDialog.test.tsx
```

Expected: FAIL because `ExpenseDeleteConfirmDialog.tsx` does not exist.

- [ ] **Step 3: Create the shared dialog component**

Create `src/components/ExpenseDeleteConfirmDialog.tsx` with:

```tsx
"use client";

import { useMemo } from "react";

import { useDeleteExpenseMutation } from "@/lib/mutations";
import { formatVnd } from "@/lib/utils";
import { NotebookIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import ExpenseItemIcon from "@/components/ExpenseItemIcon";
import VndSymbol from "@/components/VndSymbol";

import type { ExpenseListItemData } from "./ExpenseListItem";

type ExpenseDeleteConfirmDialogProps = {
  expense: ExpenseListItemData | null;
  onOpenChange: (open: boolean) => void;
};

export default function ExpenseDeleteConfirmDialog({
  expense,
  onOpenChange,
}: ExpenseDeleteConfirmDialogProps) {
  const deleteExpenseMutation = useDeleteExpenseMutation();
  const isDeleting = deleteExpenseMutation.isPending;
  const formattedAmount = useMemo(
    () => (expense ? formatVnd(expense.amount) : ""),
    [expense]
  );

  const handleDelete = async () => {
    if (!expense || isDeleting) {
      return;
    }

    const loadingToastId = toast.loading("Deleting expense...");

    try {
      await deleteExpenseMutation.mutateAsync({
        id: expense.id,
        clientId: expense.clientId,
      });
      toast.success("Expense deleted.", { id: loadingToastId });
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete expense.", { id: loadingToastId });
    }
  };

  return (
    <Dialog open={Boolean(expense)} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 sm:max-w-md">
        {expense ? (
          <>
            <div className="bg-muted/40 flex items-start gap-4 border-b px-6 py-5">
              <div className="bg-destructive/10 text-destructive flex size-11 shrink-0 items-center justify-center rounded-full">
                <Trash2 className="h-5 w-5" />
              </div>
              <DialogHeader className="text-left">
                <DialogTitle>Delete this expense?</DialogTitle>
                <DialogDescription>
                  We will remove it from your list. This cannot be undone.
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="bg-card/80 border-border mx-2 space-y-4 rounded-xl border p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm">
                    {expense.date}
                  </p>
                  <div className="flex items-center gap-2">
                    <ExpenseItemIcon
                      category={expense.category}
                      size="sm"
                    />
                    <span className="text-sm font-medium">
                      {expense.category}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Amount
                  </p>
                  <p className="text-destructive text-lg font-semibold">
                    -{formattedAmount} <VndSymbol />
                  </p>
                </div>
              </div>
              {expense.note ? (
                <div className="text-muted-foreground flex items-center gap-2">
                  <NotebookIcon className="size-4" />
                  <span className="text-sm font-medium">{expense.note}</span>
                </div>
              ) : null}
            </div>
            <DialogFooter className="border-t px-6 py-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={isDeleting}
              >
                Keep it
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => void handleDelete()}
                disabled={isDeleting}
              >
                Delete expense
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run the dialog test**

Run:

```bash
rtk bunx vitest run src/components/ExpenseDeleteConfirmDialog.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Format and lint dialog files**

Run:

```bash
rtk bunx prettier --write src/components/ExpenseDeleteConfirmDialog.tsx src/components/ExpenseDeleteConfirmDialog.test.tsx
rtk bunx prettier --check src/components/ExpenseDeleteConfirmDialog.tsx src/components/ExpenseDeleteConfirmDialog.test.tsx
rtk bunx eslint src/components/ExpenseDeleteConfirmDialog.tsx src/components/ExpenseDeleteConfirmDialog.test.tsx
```

Expected: all commands pass.

- [ ] **Step 6: Commit**

Run:

```bash
rtk git add src/components/ExpenseDeleteConfirmDialog.tsx src/components/ExpenseDeleteConfirmDialog.test.tsx
rtk git commit -m "feat: add shared expense delete dialog"
```

Expected: commit succeeds.

## Task 4: Wire Central Action State Into ExpenseList

**Files:**
- Modify: `src/components/ExpenseList.tsx`
- Modify: `src/components/ExpenseList.test.tsx`
- Test: `src/components/ExpenseList.test.tsx`

- [ ] **Step 1: Update the ExpenseListItem mock**

In `src/components/ExpenseList.test.tsx`, add this `next/link` mock before the `ExpenseListItem` mock so tests can assert `prefetch={false}`:

```tsx
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    prefetch,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    prefetch?: boolean;
  }) => (
    <a
      href={href}
      data-prefetch={prefetch === false ? "false" : "true"}
      {...props}
    >
      {children}
    </a>
  ),
}));
```

Then replace the `ExpenseListItem` mock with:

```tsx
vi.mock("@/components/ExpenseListItem", () => ({
  default: ({
    actionOpen,
    expense,
    onActionOpenChange,
    onDeleteExpense,
    onEditExpense,
  }: {
    actionOpen: boolean;
    expense: { id: number; note: string };
    onActionOpenChange: (open: boolean) => void;
    onDeleteExpense: (expense: { id: number; note: string }) => void;
    onEditExpense: (expense: { id: number; note: string }) => void;
  }) => (
    <div data-action-open={String(actionOpen)} data-testid="expense-item">
      <button type="button" onClick={() => onEditExpense(expense)}>
        {expense.note}
      </button>
      <button type="button" onClick={() => onActionOpenChange(true)}>
        Open actions {expense.note}
      </button>
      {actionOpen ? (
        <button type="button" onClick={() => onDeleteExpense(expense)}>
          Request delete {expense.note}
        </button>
      ) : null}
    </div>
  ),
}));
```

- [ ] **Step 2: Mock the shared delete dialog**

Add this mock after the `ExpenseEditSheetHost` mock:

```tsx
vi.mock("@/components/ExpenseDeleteConfirmDialog", () => ({
  default: ({
    expense,
    onOpenChange,
  }: {
    expense: { note: string } | null;
    onOpenChange: (open: boolean) => void;
  }) => (
    <div data-testid="expense-delete-confirm-dialog">
      <span>{expense?.note ?? ""}</span>
      <button type="button" onClick={() => onOpenChange(false)}>
        Close delete dialog
      </button>
    </div>
  ),
}));
```

- [ ] **Step 3: Add tests for central action/delete state and prefetch**

Add these tests inside `describe("ExpenseList", ...)`:

```tsx
it("keeps only one expense item action surface open", async () => {
  globalThis.React = React;

  const user = userEvent.setup();
  const queryClient = buildClient();
  const params = { limit: 30 };
  const secondExpense = {
    ...firstExpense,
    id: 2,
    note: "Tea leaves",
  };
  const payload: InfiniteData<ExpenseListResult, number> = {
    pageParams: [0],
    pages: [buildPage([firstExpense, secondExpense])],
  };

  queryClient.setQueryData(queries.expenses.list(params).queryKey, payload);

  render(
    <QueryClientProvider client={queryClient}>
      <ExpenseList />
    </QueryClientProvider>
  );

  const items = screen.getAllByTestId("expense-item");
  expect(items[0]).toHaveAttribute("data-action-open", "false");
  expect(items[1]).toHaveAttribute("data-action-open", "false");

  await user.click(screen.getByRole("button", { name: /open actions coffee/i }));
  expect(items[0]).toHaveAttribute("data-action-open", "true");
  expect(items[1]).toHaveAttribute("data-action-open", "false");

  await user.click(screen.getByRole("button", { name: /open actions tea/i }));
  expect(items[0]).toHaveAttribute("data-action-open", "false");
  expect(items[1]).toHaveAttribute("data-action-open", "true");
});

it("opens one shared delete dialog for the selected expense", async () => {
  globalThis.React = React;

  const user = userEvent.setup();
  const queryClient = buildClient();
  const params = { limit: 30 };
  const payload: InfiniteData<ExpenseListResult, number> = {
    pageParams: [0],
    pages: [buildPage()],
  };

  queryClient.setQueryData(queries.expenses.list(params).queryKey, payload);

  render(
    <QueryClientProvider client={queryClient}>
      <ExpenseList />
    </QueryClientProvider>
  );

  expect(screen.getAllByTestId("expense-delete-confirm-dialog")).toHaveLength(1);
  expect(screen.getByTestId("expense-delete-confirm-dialog")).not.toHaveTextContent(
    "Coffee beans"
  );

  await user.click(screen.getByRole("button", { name: /open actions coffee/i }));
  await user.click(screen.getByRole("button", { name: /request delete coffee/i }));

  expect(screen.getByTestId("expense-delete-confirm-dialog")).toHaveTextContent(
    "Coffee beans"
  );

  await user.click(screen.getByRole("button", { name: "Close delete dialog" }));

  expect(screen.getByTestId("expense-delete-confirm-dialog")).not.toHaveTextContent(
    "Coffee beans"
  );
});

it("disables prefetch for repeated day summary links", () => {
  globalThis.React = React;

  const queryClient = buildClient();
  const params = { limit: 30 };
  const payload: InfiniteData<ExpenseListResult, number> = {
    pageParams: [0],
    pages: [buildPage()],
  };

  queryClient.setQueryData(queries.expenses.list(params).queryKey, payload);

  render(
    <QueryClientProvider client={queryClient}>
      <ExpenseList />
    </QueryClientProvider>
  );

  const dayLink = screen.getByRole("link", {
    name: /Saturday, 23\/05\/2026/i,
  });

  expect(dayLink).toHaveAttribute("href", "/report/day/2026-05-23");
  expect(dayLink).toHaveAttribute("data-prefetch", "false");
});
```

- [ ] **Step 4: Run the list test to verify it fails**

Run:

```bash
rtk bunx vitest run src/components/ExpenseList.test.tsx
```

Expected: FAIL because `ExpenseList` has not wired central action state, the shared delete dialog, or `prefetch={false}`.

- [ ] **Step 5: Update imports in ExpenseList**

In `src/components/ExpenseList.tsx`, add:

```tsx
import ExpenseDeleteConfirmDialog from "@/components/ExpenseDeleteConfirmDialog";
```

- [ ] **Step 6: Add central action and delete state**

After `editingExpense` state, add:

```tsx
const [activeActionExpenseId, setActiveActionExpenseId] = useState<
  number | null
>(null);
const [deleteCandidateExpense, setDeleteCandidateExpense] =
  useState<ExpenseListItemData | null>(null);
```

Add these callbacks after `handleEditOpenChange`:

```tsx
const handleActionOpenChange = useCallback(
  (expenseId: number, nextOpen: boolean) => {
    setActiveActionExpenseId(nextOpen ? expenseId : null);
  },
  []
);

const handleDeleteExpense = useCallback((expense: ExpenseListItemData) => {
  setDeleteCandidateExpense(expense);
  setActiveActionExpenseId(null);
}, []);

const handleDeleteDialogOpenChange = useCallback((nextOpen: boolean) => {
  if (!nextOpen) {
    setDeleteCandidateExpense(null);
  }
}, []);
```

- [ ] **Step 7: Disable prefetch on repeated day links**

In the day-summary `<Link>`, add `prefetch={false}`:

```tsx
<Link
  href={`/report/day/${group.key}`}
  prefetch={false}
  className="group hover:border-border hover:bg-card/80 flex items-center justify-between rounded-2xl border border-transparent px-2 py-1 transition"
>
```

- [ ] **Step 8: Pass central action props into ExpenseListItem**

Replace the `ExpenseListItem` JSX with:

```tsx
<ExpenseListItem
  key={expense.id}
  actionOpen={activeActionExpenseId === expense.id}
  expense={expense}
  onActionOpenChange={(nextOpen) =>
    handleActionOpenChange(expense.id, nextOpen)
  }
  onDeleteExpense={handleDeleteExpense}
  onEditExpense={handleEditExpense}
/>
```

- [ ] **Step 9: Render the shared delete dialog**

After `ExpenseEditSheetHost`, add:

```tsx
<ExpenseDeleteConfirmDialog
  expense={deleteCandidateExpense}
  onOpenChange={handleDeleteDialogOpenChange}
/>
```

- [ ] **Step 10: Run the list test**

Run:

```bash
rtk bunx vitest run src/components/ExpenseList.test.tsx
```

Expected: PASS.

- [ ] **Step 11: Run the row and dialog tests together**

Run:

```bash
rtk bunx vitest run src/components/ExpenseListItem.mascot.test.tsx src/components/ExpenseDeleteConfirmDialog.test.tsx src/components/ExpenseList.test.tsx
```

Expected: PASS.

- [ ] **Step 12: Format and lint list files**

Run:

```bash
rtk bunx prettier --write src/components/ExpenseList.tsx src/components/ExpenseList.test.tsx
rtk bunx prettier --check src/components/ExpenseList.tsx src/components/ExpenseList.test.tsx
rtk bunx eslint src/components/ExpenseList.tsx src/components/ExpenseList.test.tsx
```

Expected: all commands pass.

- [ ] **Step 13: Commit**

Run:

```bash
rtk git add src/components/ExpenseList.tsx src/components/ExpenseList.test.tsx
rtk git commit -m "perf: centralize expense list row actions"
```

Expected: commit succeeds.

## Task 5: Verify QuickExpenseSheet Regression Coverage

**Files:**
- Test: `src/components/QuickExpenseSheet.test.tsx`
- Test: `src/components/ExpenseListItem.mascot.test.tsx`
- Test: `src/components/ExpenseDeleteConfirmDialog.test.tsx`
- Test: `src/components/ExpenseList.test.tsx`

- [ ] **Step 1: Run quick sheet open/focus and prefill tests**

Run:

```bash
rtk bunx vitest run src/components/QuickExpenseSheet.test.tsx -t "opens when the trigger is clicked and focuses the note input|opens and populates fields when EXPENSE_PREFILL_EVENT fires"
```

Expected: PASS.

- [ ] **Step 2: Run the full touched component test set**

Run:

```bash
rtk bunx vitest run src/components/ExpenseListItem.mascot.test.tsx src/components/ExpenseDeleteConfirmDialog.test.tsx src/components/ExpenseList.test.tsx src/components/QuickExpenseSheet.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Commit if test-only fixes were needed**

If Step 1 or Step 2 required test or code fixes, commit them:

```bash
rtk git add src/components/QuickExpenseSheet.test.tsx src/components/ExpenseListItem.mascot.test.tsx src/components/ExpenseDeleteConfirmDialog.test.tsx src/components/ExpenseList.test.tsx
rtk git commit -m "test: cover mobile expense action flow"
```

Expected: commit succeeds only if there were additional changes. If no files changed, skip this commit.

## Task 6: Mobile Performance Verification

**Files:**
- No source files expected.
- Optional evidence: save screenshots or trace files under `tmp-shots/`; do not commit `tmp-shots/`.

- [ ] **Step 1: Start or reuse the local app on port 3001**

Check whether the app is already serving:

```bash
rtk curl -I http://localhost:3001
```

Expected: an HTTP response. If the command cannot connect, start the dev server in a long-running terminal session:

```bash
rtk bun run dev -- --port 3001
```

Expected: Next.js dev server reports it is ready on `http://localhost:3001`.

- [ ] **Step 2: Open the mobile viewport**

Run:

```bash
rtk agent-browser --session spendly-mobile-perf close
rtk agent-browser --session spendly-mobile-perf set viewport 390 844 3
rtk agent-browser --session spendly-mobile-perf open http://localhost:3001/
rtk agent-browser --session spendly-mobile-perf wait --load networkidle
```

Expected: page opens on `/`.

- [ ] **Step 3: Measure home DOM and quick sheet open**

Run:

```bash
rtk agent-browser --session spendly-mobile-perf eval --stdin <<'EVALEOF'
(async () => {
  const result = {
    nodeCountBefore: document.querySelectorAll("*").length,
    buttonsBefore: document.querySelectorAll("button").length,
    linksBefore: document.querySelectorAll("a").length,
    clickToDialogMs: null,
    clickToNoteInputMs: null,
    clickToFocusMs: null,
    nodeCountAfter: null,
    buttonsAfter: null,
    linksAfter: null,
    longTasks: [],
    errors: [],
  };
  const longTaskObserver = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      result.longTasks.push({
        start: entry.startTime,
        duration: entry.duration,
        name: entry.name,
      });
    }
  });
  try {
    longTaskObserver.observe({ entryTypes: ["longtask"] });
  } catch (error) {
    result.errors.push(`longtask observer unavailable: ${String(error)}`);
  }

  const button = document.querySelector('button[aria-label="Add expense"]');
  if (!(button instanceof HTMLButtonElement)) {
    result.errors.push("Add expense button not found");
    return result;
  }

  const start = performance.now();
  const seen = { dialog: false, input: false, focus: false };
  const observer = new MutationObserver(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!seen.dialog && dialog) {
      seen.dialog = true;
      result.clickToDialogMs = performance.now() - start;
    }
    const note = document.querySelector(
      'input[placeholder="What did you spend on?"]'
    );
    if (!seen.input && note) {
      seen.input = true;
      result.clickToNoteInputMs = performance.now() - start;
    }
    if (!seen.focus && document.activeElement === note) {
      seen.focus = true;
      result.clickToFocusMs = performance.now() - start;
    }
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
  });

  button.click();
  await new Promise((resolve) => setTimeout(resolve, 1400));
  observer.disconnect();
  longTaskObserver.disconnect();

  const note = document.querySelector(
    'input[placeholder="What did you spend on?"]'
  );
  if (result.clickToFocusMs === null && document.activeElement === note) {
    result.clickToFocusMs = performance.now() - start;
  }
  result.nodeCountAfter = document.querySelectorAll("*").length;
  result.buttonsAfter = document.querySelectorAll("button").length;
  result.linksAfter = document.querySelectorAll("a").length;
  return result;
})()
EVALEOF
```

Expected:

- `buttonsBefore` is far below the production baseline of 2,794.
- `nodeCountBefore` is far below the production baseline of 38,008.
- `clickToNoteInputMs` is materially below the production baseline of 241 ms.
- No 250 ms-class long task appears during sheet open.

- [ ] **Step 4: Measure home to report transition**

Close the quick sheet if it is open, then run:

```bash
rtk agent-browser --session spendly-mobile-perf click @e2 || true
rtk agent-browser --session spendly-mobile-perf wait 400
rtk agent-browser --session spendly-mobile-perf eval --stdin <<'EVALEOF'
(async () => {
  const result = {
    nodeCountBefore: document.querySelectorAll("*").length,
    clickToUrlMs: null,
    clickToHeadingMs: null,
    nodeCountAfter: null,
    longTasks: [],
    errors: [],
  };
  const longTaskObserver = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      result.longTasks.push({
        start: entry.startTime,
        duration: entry.duration,
        name: entry.name,
      });
    }
  });
  try {
    longTaskObserver.observe({ entryTypes: ["longtask"] });
  } catch (error) {
    result.errors.push(String(error));
  }
  const link = document.querySelector('a[aria-label="Reports"]');
  if (!(link instanceof HTMLAnchorElement)) {
    result.errors.push("Reports link not found");
    return result;
  }
  const start = performance.now();
  const timer = window.setInterval(() => {
    if (result.clickToUrlMs === null && location.pathname.startsWith("/report")) {
      result.clickToUrlMs = performance.now() - start;
    }
    const h = document.querySelector("h1");
    if (
      result.clickToHeadingMs === null &&
      h?.textContent?.includes("Report")
    ) {
      result.clickToHeadingMs = performance.now() - start;
    }
  }, 8);
  link.click();
  await new Promise((resolve) => setTimeout(resolve, 2200));
  window.clearInterval(timer);
  longTaskObserver.disconnect();
  result.nodeCountAfter = document.querySelectorAll("*").length;
  return result;
})()
EVALEOF
```

Expected:

- Heading timing is materially below the production baseline of 1,130 ms.
- No 150 ms-class long task is caused by old home row action DOM.

- [ ] **Step 5: Run final scoped formatting and lint checks**

Run:

```bash
rtk bunx prettier --check src/components/ExpenseListItem.tsx src/components/ExpenseListItem.mascot.test.tsx src/components/ExpenseDeleteConfirmDialog.tsx src/components/ExpenseDeleteConfirmDialog.test.tsx src/components/ExpenseList.tsx src/components/ExpenseList.test.tsx
rtk bunx eslint src/components/ExpenseListItem.tsx src/components/ExpenseListItem.mascot.test.tsx src/components/ExpenseDeleteConfirmDialog.tsx src/components/ExpenseDeleteConfirmDialog.test.tsx src/components/ExpenseList.tsx src/components/ExpenseList.test.tsx
```

Expected: all commands pass.

- [ ] **Step 6: Commit verification docs only if source/test changes were needed**

If Task 6 produced source or test fixes, commit them with:

```bash
rtk git add src/components/ExpenseListItem.tsx src/components/ExpenseListItem.mascot.test.tsx src/components/ExpenseDeleteConfirmDialog.tsx src/components/ExpenseDeleteConfirmDialog.test.tsx src/components/ExpenseList.tsx src/components/ExpenseList.test.tsx
rtk git commit -m "test: verify mobile expense list performance"
```

Expected: commit succeeds only if there were additional source or test changes. Do not commit `tmp-shots/`.

## Plan Self-Review

- Spec coverage: the plan reduces home list DOM/action cost, centralizes delete confirmation, disables repeated day-link prefetch, preserves duplicate/edit/delete behavior, keeps mutation ownership in mutation hooks, and includes mobile browser measurement for quick sheet and route transition timing.
- Placeholder scan: no red-flag placeholder terms or unspecified implementation steps remain.
- Type consistency: `ExpenseListItemData`, `actionOpen`, `onActionOpenChange`, `onDeleteExpense`, `deleteCandidateExpense`, and `ExpenseDeleteConfirmDialog` are named consistently across tasks.
