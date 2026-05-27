# Quick Expense Local Success Toast Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show quick add/edit success toasts after the local-first expense write succeeds.

**Architecture:** Keep UI feedback in `QuickExpenseSheet`, where submit intent and create/edit mode are known. Leave TanStack Query mutation hooks focused on local writes, invalidation, and sync scheduling, and leave server sync failure feedback in the existing recovery coordinator.

**Tech Stack:** Next.js App Router, React, TypeScript, TanStack Query mutations, Sonner toasts, Vitest, Testing Library, Prettier, ESLint.

---

## File Structure

- Modify `src/components/QuickExpenseSheet.tsx`
  - Add `toast.success(...)` to the existing `localWrite` promise chain after the local create/update promise resolves.
  - Preserve immediate sheet close behavior and existing local-write error toast behavior.
- Modify `src/components/QuickExpenseSheet.test.tsx`
  - Add a create test that proves success toast waits for local mutation resolution.
  - Add an edit test that proves success toast waits for local mutation resolution.
  - Keep assertions in the component test because the toast is component-owned UI feedback.

---

### Task 1: Add Create Success Toast Test

**Files:**
- Modify: `src/components/QuickExpenseSheet.test.tsx`

- [ ] **Step 1: Add the failing create test**

Insert this test in `describe("QuickExpenseSheet — submit", () => { ... })`, immediately after the existing test named `"closes immediately after dispatching a local-first create"`:

```tsx
  it("shows create success toast after the local write resolves", async () => {
    let resolveCreate: (value: { clientId: string }) => void = () => {};
    mutationMocks.createMutateAsync.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      })
    );
    const user = await openSheet();

    await user.click(screen.getByPlaceholderText("0"));
    await user.keyboard("12000");
    await user.click(screen.getByRole("button", { name: /save expense/i }));

    await waitFor(() =>
      expect(mutationMocks.createMutateAsync).toHaveBeenCalled()
    );
    expect(toastMock.success).not.toHaveBeenCalled();

    await act(async () => {
      resolveCreate({ clientId: "expense-client-1" });
    });

    await waitFor(() =>
      expect(toastMock.success).toHaveBeenCalledWith("Expense added.")
    );
  });
```

- [ ] **Step 2: Run the focused create test and verify it fails**

Run:

```bash
rtk bunx vitest run src/components/QuickExpenseSheet.test.tsx -t "shows create success toast after the local write resolves"
```

Expected: FAIL because `toastMock.success` is never called with `Expense added.`.

- [ ] **Step 3: Commit the failing test**

Run:

```bash
rtk git add src/components/QuickExpenseSheet.test.tsx
rtk git commit -m "test: cover quick expense create success toast"
```

---

### Task 2: Add Edit Success Toast Test

**Files:**
- Modify: `src/components/QuickExpenseSheet.test.tsx`

- [ ] **Step 1: Add the failing edit test**

Insert this test in `describe("QuickExpenseSheet — edit mode", () => { ... })`, immediately after the existing test named `"calls the local-first update mutation with the submitted draft and closes"`:

```tsx
  it("shows edit success toast after the local write resolves", async () => {
    let resolveUpdate: (value: { clientId: string }) => void = () => {};
    mutationMocks.updateMutateAsync.mockReturnValue(
      new Promise((resolve) => {
        resolveUpdate = resolve;
      })
    );
    const user = userEvent.setup();
    weeklyBudgetOptionsMock.mockResolvedValue([
      budgetOption({ id: 2, name: "Sports week" }),
    ]);
    renderEditSheet();

    await user.click(screen.getByRole("button", { name: /^update$/i }));

    await waitFor(() =>
      expect(mutationMocks.updateMutateAsync).toHaveBeenCalled()
    );
    expect(toastMock.success).not.toHaveBeenCalled();

    await act(async () => {
      resolveUpdate({ clientId: "expense-client-1" });
    });

    await waitFor(() =>
      expect(toastMock.success).toHaveBeenCalledWith("Expense updated.")
    );
  });
```

- [ ] **Step 2: Run the focused edit test and verify it fails**

Run:

```bash
rtk bunx vitest run src/components/QuickExpenseSheet.test.tsx -t "shows edit success toast after the local write resolves"
```

Expected: FAIL because `toastMock.success` is never called with `Expense updated.`.

- [ ] **Step 3: Commit the failing test**

Run:

```bash
rtk git add src/components/QuickExpenseSheet.test.tsx
rtk git commit -m "test: cover quick expense edit success toast"
```

---

### Task 3: Implement Local Success Toasts

**Files:**
- Modify: `src/components/QuickExpenseSheet.tsx`
- Test: `src/components/QuickExpenseSheet.test.tsx`

- [ ] **Step 1: Update the background local write promise chain**

In `src/components/QuickExpenseSheet.tsx`, replace the existing `void localWrite` chain:

```tsx
      void localWrite
        .catch(() => {
          toast.error(
            isEditMode ? "Failed to update expense" : "Failed to add expense"
          );
        })
        .finally(() => {
          setQueueing(false);
        });
```

with this implementation:

```tsx
      void localWrite
        .then(() => {
          toast.success(isEditMode ? "Expense updated." : "Expense added.");
        })
        .catch(() => {
          toast.error(
            isEditMode ? "Failed to update expense" : "Failed to add expense"
          );
        })
        .finally(() => {
          setQueueing(false);
        });
```

- [ ] **Step 2: Run the focused success toast tests**

Run:

```bash
rtk bunx vitest run src/components/QuickExpenseSheet.test.tsx -t "shows .* success toast after the local write resolves"
```

Expected: PASS for both success toast tests.

- [ ] **Step 3: Run the full QuickExpenseSheet test file**

Run:

```bash
rtk bunx vitest run src/components/QuickExpenseSheet.test.tsx
```

Expected: PASS for all tests in `QuickExpenseSheet.test.tsx`.

- [ ] **Step 4: Format the modified TypeScript files**

Run:

```bash
rtk bunx prettier --write src/components/QuickExpenseSheet.tsx src/components/QuickExpenseSheet.test.tsx
```

Expected: Prettier completes successfully and may report both files as written or unchanged.

- [ ] **Step 5: Check formatting for the modified TypeScript files**

Run:

```bash
rtk bunx prettier --check src/components/QuickExpenseSheet.tsx src/components/QuickExpenseSheet.test.tsx
```

Expected: `All matched files use Prettier code style!`

- [ ] **Step 6: Run ESLint for the modified TypeScript files**

Run:

```bash
rtk bunx eslint src/components/QuickExpenseSheet.tsx src/components/QuickExpenseSheet.test.tsx
```

Expected: exit code 0 with no lint errors.

- [ ] **Step 7: Commit the implementation**

Run:

```bash
rtk git add src/components/QuickExpenseSheet.tsx src/components/QuickExpenseSheet.test.tsx
rtk git commit -m "feat: show quick expense local success toast"
```

---

## Self-Review

- Spec coverage: Task 1 covers create success after local write resolution. Task 2 covers edit success after local write resolution. Task 3 implements the shared component behavior, preserves immediate close behavior by leaving `handleOpenChange(false)` before the promise resolution, and keeps server sync/recovery untouched.
- Placeholder scan: The plan contains concrete file paths, commands, expected outcomes, and code snippets for every code change.
- Type consistency: Tests use existing `toastMock`, `mutationMocks`, `openSheet`, `renderEditSheet`, `budgetOption`, `screen`, `waitFor`, `act`, and `userEvent` symbols already present in `src/components/QuickExpenseSheet.test.tsx`. Implementation uses the existing `toast`, `isEditMode`, `localWrite`, and `setQueueing` symbols already present in `src/components/QuickExpenseSheet.tsx`.
