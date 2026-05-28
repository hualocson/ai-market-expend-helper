# Web Haptics Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable generic `web-haptics` hook and wire it into explicit high-signal mobile interactions.

**Architecture:** Install `web-haptics`, add a small client hook in `src/hooks/useAppHaptics.ts`, then import that hook only at explicit call sites. Each component owns its haptic timing and pairs the haptic call with an existing visible state change.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Bun, `web-haptics`, Testing Library, Vitest, Prettier, ESLint.

---

## File Structure

- Create: `src/hooks/useAppHaptics.ts`
  - Client hook wrapping `useWebHaptics()` from `web-haptics/react`.
  - Exposes generic methods only: `success`, `warning`, `error`, `selection`, `impact`, `trigger`.
- Create: `src/hooks/useAppHaptics.test.tsx`
  - Unit tests for hook method-to-preset mapping.
- Modify: `package.json`
  - Add `web-haptics` dependency through `bun add web-haptics`.
- Modify: `bun.lock`
  - Bun-managed lockfile update from dependency install.
- Modify: `src/components/ManualExpenseForm.tsx`
  - Trigger success/error haptics on submit result.
  - Trigger selection haptics when quick mode changes to advanced.
- Modify: `src/components/ManualExpenseForm.quick-mode.test.tsx`
  - Mock `useAppHaptics()` and cover submit success, submit error, and mode-switch selection.
- Modify: `src/components/AIExpenseChat.tsx`
  - Trigger success/warning/error haptics when parse result replaces pending state.
- Modify: `src/components/AIExpenseChat.test.tsx`
  - Mock `useAppHaptics()` and cover parse success, fallback, and error paths.
- Modify: `src/components/BudgetPickerSheet.tsx`
  - Trigger selection haptic when a budget or no-budget row is selected.
- Modify: `src/components/BudgetPickerSheet.test.tsx`
  - Mock `useAppHaptics()` and cover selection calls.
- Modify: `src/components/PullToRefresh.tsx`
  - Trigger one light impact when a gesture first crosses the refresh threshold.
- Create: `src/components/PullToRefresh.test.tsx`
  - Cover threshold haptic behavior and repeated move suppression.
- Modify: `src/components/BudgetTransferDrawer.tsx`
  - Trigger success/error haptics on transfer result.
- Modify: `src/components/BudgetTransferDrawer.test.tsx`
  - Mock `useAppHaptics()` and cover transfer success and failure paths.
- Modify: `docs/web-haptics-map.md`
  - Mark implemented call sites as `implemented`.

## Task 1: Install `web-haptics`

**Files:**

- Modify: `package.json`
- Modify: `bun.lock`

- [ ] **Step 1: Install dependency with Bun**

Run:

```bash
rtk bun add web-haptics
```

Expected: command exits `0`, `package.json` includes `web-haptics`, and `bun.lock` changes.

- [ ] **Step 2: Verify dependency is recorded**

Run:

```bash
rtk rg -n '"web-haptics"|web-haptics' package.json bun.lock
```

Expected: output contains a `package.json` dependency entry and `bun.lock` package entries.

- [ ] **Step 3: Commit dependency install**

Run:

```bash
rtk git add package.json bun.lock
rtk git commit -m "chore: install web haptics"
```

Expected: commit succeeds.

## Task 2: Add Generic Haptics Hook

**Files:**

- Create: `src/hooks/useAppHaptics.ts`
- Create: `src/hooks/useAppHaptics.test.tsx`

- [ ] **Step 1: Write the failing hook test**

Create `src/hooks/useAppHaptics.test.tsx`:

```tsx
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAppHaptics } from "./useAppHaptics";

const { triggerMock } = vi.hoisted(() => ({
  triggerMock: vi.fn(),
}));

vi.mock("web-haptics/react", () => ({
  useWebHaptics: () => ({
    trigger: triggerMock,
  }),
}));

beforeEach(() => {
  triggerMock.mockReset();
});

describe("useAppHaptics", () => {
  it("maps notification and selection methods to web-haptics presets", () => {
    const { result } = renderHook(() => useAppHaptics());

    act(() => {
      result.current.success();
      result.current.warning();
      result.current.error();
      result.current.selection();
    });

    expect(triggerMock).toHaveBeenNthCalledWith(1, "success");
    expect(triggerMock).toHaveBeenNthCalledWith(2, "warning");
    expect(triggerMock).toHaveBeenNthCalledWith(3, "error");
    expect(triggerMock).toHaveBeenNthCalledWith(4, "selection");
  });

  it("maps impact levels and the direct trigger method", () => {
    const { result } = renderHook(() => useAppHaptics());

    act(() => {
      result.current.impact("light");
      result.current.impact();
      result.current.trigger("heavy");
    });

    expect(triggerMock).toHaveBeenNthCalledWith(1, "light");
    expect(triggerMock).toHaveBeenNthCalledWith(2, "medium");
    expect(triggerMock).toHaveBeenNthCalledWith(3, "heavy");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
rtk bun run test src/hooks/useAppHaptics.test.tsx
```

Expected: FAIL because `src/hooks/useAppHaptics.ts` does not exist.

- [ ] **Step 3: Implement the hook**

Create `src/hooks/useAppHaptics.ts`:

```ts
"use client";

import { useCallback, useMemo } from "react";

import { useWebHaptics } from "web-haptics/react";

export type AppHapticImpact = "light" | "medium" | "heavy";
export type AppHapticNotification = "success" | "warning" | "error";
export type AppHapticType =
  | AppHapticNotification
  | "selection"
  | AppHapticImpact;

export type AppHaptics = {
  success: () => void;
  warning: () => void;
  error: () => void;
  selection: () => void;
  impact: (level?: AppHapticImpact) => void;
  trigger: (type?: AppHapticType) => void;
};

export function useAppHaptics(): AppHaptics {
  const webHaptics = useWebHaptics();

  const trigger = useCallback(
    (type?: AppHapticType) => {
      webHaptics.trigger(type);
    },
    [webHaptics]
  );

  return useMemo(
    () => ({
      success: () => trigger("success"),
      warning: () => trigger("warning"),
      error: () => trigger("error"),
      selection: () => trigger("selection"),
      impact: (level: AppHapticImpact = "medium") => trigger(level),
      trigger,
    }),
    [trigger]
  );
}
```

- [ ] **Step 4: Run hook test to verify it passes**

Run:

```bash
rtk bun run test src/hooks/useAppHaptics.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Format and lint hook files**

Run:

```bash
rtk bunx prettier --write src/hooks/useAppHaptics.ts src/hooks/useAppHaptics.test.tsx
rtk bunx prettier --check src/hooks/useAppHaptics.ts src/hooks/useAppHaptics.test.tsx
rtk bunx eslint src/hooks/useAppHaptics.ts src/hooks/useAppHaptics.test.tsx
```

Expected: all commands exit `0`.

- [ ] **Step 6: Commit hook**

Run:

```bash
rtk git add src/hooks/useAppHaptics.ts src/hooks/useAppHaptics.test.tsx
rtk git commit -m "feat: add generic app haptics hook"
```

Expected: commit succeeds.

## Task 3: Wire Manual Expense Form

**Files:**

- Modify: `src/components/ManualExpenseForm.tsx`
- Modify: `src/components/ManualExpenseForm.quick-mode.test.tsx`

- [ ] **Step 1: Write failing haptics tests**

Add the hook mock near the existing mocks in `src/components/ManualExpenseForm.quick-mode.test.tsx`:

```tsx
const { hapticsMock } = vi.hoisted(() => ({
  hapticsMock: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    selection: vi.fn(),
    impact: vi.fn(),
    trigger: vi.fn(),
  },
}));

vi.mock("@/hooks/useAppHaptics", () => ({
  useAppHaptics: () => hapticsMock,
}));
```

Add this reset inside the existing `afterEach`:

```tsx
hapticsMock.success.mockReset();
hapticsMock.warning.mockReset();
hapticsMock.error.mockReset();
hapticsMock.selection.mockReset();
hapticsMock.impact.mockReset();
hapticsMock.trigger.mockReset();
```

Add these tests inside `describe("ManualExpenseForm quick mode", () => { ... })`:

```tsx
it("triggers success haptics after submit succeeds", async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn().mockResolvedValue(undefined);

  await renderManualExpenseForm({
    initialMode: "quick",
    prefillExpense: {
      amount: 45000,
      note: "Coffee",
      category: Category.FOOD,
    },
    onSubmit,
  });

  await user.click(screen.getByRole("button", { name: /add expense/i }));

  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  expect(hapticsMock.success).toHaveBeenCalledTimes(1);
  expect(hapticsMock.error).not.toHaveBeenCalled();
});

it("triggers error haptics after submit fails", async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn().mockRejectedValue(new Error("save failed"));

  await renderManualExpenseForm({
    initialMode: "quick",
    prefillExpense: {
      amount: 45000,
      note: "Coffee",
      category: Category.FOOD,
    },
    onSubmit,
  });

  await user.click(screen.getByRole("button", { name: /add expense/i }));

  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  expect(hapticsMock.error).toHaveBeenCalledTimes(1);
  expect(hapticsMock.success).not.toHaveBeenCalled();
});

it("triggers selection haptics when quick mode opens advanced options", async () => {
  const user = userEvent.setup();

  await renderManualExpenseForm({
    initialMode: "quick",
    prefillExpense: {
      amount: 45000,
      note: "Coffee",
      category: Category.FOOD,
    },
  });

  await user.click(screen.getByRole("button", { name: /more options/i }));

  expect(hapticsMock.selection).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
rtk bun run test src/components/ManualExpenseForm.quick-mode.test.tsx
```

Expected: FAIL because `useAppHaptics()` is not called from `ManualExpenseForm`.

- [ ] **Step 3: Implement manual form haptics**

In `src/components/ManualExpenseForm.tsx`, add this import:

```tsx
import { useAppHaptics } from "@/hooks/useAppHaptics";
```

Inside the component body, near the mutation hooks, add:

```tsx
const haptics = useAppHaptics();
```

In `handleSubmit`, call haptics next to the existing visible result feedback:

```tsx
toast.success(successMessage);
haptics.success();
onSuccess?.();
```

and:

```tsx
console.error(error);
toast.error(errorMessage);
haptics.error();
```

Add `haptics` to the `handleSubmit` dependency array.

Replace the quick-mode `More options` click handler:

```tsx
onClick={() => setMode("advanced")}
```

with:

```tsx
onClick={() => {
  if (mode !== "advanced") {
    haptics.selection();
  }
  setMode("advanced");
}}
```

- [ ] **Step 4: Run manual form tests**

Run:

```bash
rtk bun run test src/components/ManualExpenseForm.quick-mode.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Format and lint manual form files**

Run:

```bash
rtk bunx prettier --write src/components/ManualExpenseForm.tsx src/components/ManualExpenseForm.quick-mode.test.tsx
rtk bunx prettier --check src/components/ManualExpenseForm.tsx src/components/ManualExpenseForm.quick-mode.test.tsx
rtk bunx eslint src/components/ManualExpenseForm.tsx src/components/ManualExpenseForm.quick-mode.test.tsx
```

Expected: all commands exit `0`.

- [ ] **Step 6: Commit manual form integration**

Run:

```bash
rtk git add src/components/ManualExpenseForm.tsx src/components/ManualExpenseForm.quick-mode.test.tsx
rtk git commit -m "feat: add haptics to manual expense form"
```

Expected: commit succeeds.

## Task 4: Wire AI Expense Chat

**Files:**

- Modify: `src/components/AIExpenseChat.tsx`
- Modify: `src/components/AIExpenseChat.test.tsx`

- [ ] **Step 1: Write failing AI chat haptics tests**

Add the hook mock near the top of `src/components/AIExpenseChat.test.tsx`:

```tsx
const { hapticsMock } = vi.hoisted(() => ({
  hapticsMock: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    selection: vi.fn(),
    impact: vi.fn(),
    trigger: vi.fn(),
  },
}));

vi.mock("@/hooks/useAppHaptics", () => ({
  useAppHaptics: () => hapticsMock,
}));
```

Add these resets inside the existing `afterEach` before `vi.restoreAllMocks()`:

```tsx
hapticsMock.success.mockReset();
hapticsMock.warning.mockReset();
hapticsMock.error.mockReset();
hapticsMock.selection.mockReset();
hapticsMock.impact.mockReset();
hapticsMock.trigger.mockReset();
```

Add expectations to existing tests:

In `submits a message and renders a preview card for a successful parse`, after the preview card is found:

```tsx
expect(hapticsMock.success).toHaveBeenCalledTimes(1);
expect(hapticsMock.warning).not.toHaveBeenCalled();
expect(hapticsMock.error).not.toHaveBeenCalled();
```

In `renders the manual form inline for fallback responses`, after the manual form assertion:

```tsx
expect(hapticsMock.warning).toHaveBeenCalledTimes(1);
expect(hapticsMock.success).not.toHaveBeenCalled();
expect(hapticsMock.error).not.toHaveBeenCalled();
```

In the existing request failure test, add after the error UI assertion:

```tsx
expect(hapticsMock.error).toHaveBeenCalledTimes(1);
expect(hapticsMock.success).not.toHaveBeenCalled();
expect(hapticsMock.warning).not.toHaveBeenCalled();
```

- [ ] **Step 2: Run AI chat tests to verify they fail**

Run:

```bash
rtk bun run test src/components/AIExpenseChat.test.tsx
```

Expected: FAIL because the component does not call haptics.

- [ ] **Step 3: Implement AI chat haptics**

In `src/components/AIExpenseChat.tsx`, add this import:

```tsx
import { useAppHaptics } from "@/hooks/useAppHaptics";
```

Inside `AIExpenseChat`, near state declarations, add:

```tsx
const haptics = useAppHaptics();
```

In `sendInput`, after setting the success message:

```tsx
replaceMessage(assistantId, {
  id: assistantId,
  role: "assistant",
  variant: "success",
  expense: payload.expense,
});
haptics.success();
return;
```

After setting the fallback message:

```tsx
replaceMessage(assistantId, {
  id: assistantId,
  role: "assistant",
  variant: "fallback",
  prefill: payload.prefill,
});
haptics.warning();
```

In the catch path:

```tsx
console.error(requestError);
replaceMessage(assistantId, {
  id: assistantId,
  role: "assistant",
  variant: "error",
  retryInput: input,
});
haptics.error();
```

- [ ] **Step 4: Run AI chat tests**

Run:

```bash
rtk bun run test src/components/AIExpenseChat.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Format and lint AI chat files**

Run:

```bash
rtk bunx prettier --write src/components/AIExpenseChat.tsx src/components/AIExpenseChat.test.tsx
rtk bunx prettier --check src/components/AIExpenseChat.tsx src/components/AIExpenseChat.test.tsx
rtk bunx eslint src/components/AIExpenseChat.tsx src/components/AIExpenseChat.test.tsx
```

Expected: all commands exit `0`.

- [ ] **Step 6: Commit AI chat integration**

Run:

```bash
rtk git add src/components/AIExpenseChat.tsx src/components/AIExpenseChat.test.tsx
rtk git commit -m "feat: add haptics to ai expense chat"
```

Expected: commit succeeds.

## Task 5: Wire Budget Picker

**Files:**

- Modify: `src/components/BudgetPickerSheet.tsx`
- Modify: `src/components/BudgetPickerSheet.test.tsx`

- [ ] **Step 1: Write failing budget picker haptics tests**

Add the hook mock near the top of `src/components/BudgetPickerSheet.test.tsx`:

```tsx
const { hapticsMock } = vi.hoisted(() => ({
  hapticsMock: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    selection: vi.fn(),
    impact: vi.fn(),
    trigger: vi.fn(),
  },
}));

vi.mock("@/hooks/useAppHaptics", () => ({
  useAppHaptics: () => hapticsMock,
}));
```

Add `afterEach` if the file does not already have one:

```tsx
afterEach(() => {
  hapticsMock.success.mockReset();
  hapticsMock.warning.mockReset();
  hapticsMock.error.mockReset();
  hapticsMock.selection.mockReset();
  hapticsMock.impact.mockReset();
  hapticsMock.trigger.mockReset();
  vi.restoreAllMocks();
});
```

Update the existing selection tests:

```tsx
it("calls onChange(id), triggers selection haptics, and closes when a budget is selected", async () => {
  const user = userEvent.setup();
  const { onChange, onOpenChange } = renderSheet();

  await user.click(await screen.findByRole("button", { name: /Food week/i }));

  expect(onChange).toHaveBeenCalledWith(1);
  expect(hapticsMock.selection).toHaveBeenCalledTimes(1);
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

it("calls onChange(null) and triggers selection haptics when 'No budget' is selected", async () => {
  const user = userEvent.setup();
  const { onChange } = renderSheet({ value: 1 });

  await user.click(await screen.findByRole("button", { name: /no budget/i }));

  expect(onChange).toHaveBeenCalledWith(null);
  expect(hapticsMock.selection).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run budget picker tests to verify they fail**

Run:

```bash
rtk bun run test src/components/BudgetPickerSheet.test.tsx
```

Expected: FAIL because `BudgetPickerSheet` does not call haptics.

- [ ] **Step 3: Implement budget picker haptics**

In `src/components/BudgetPickerSheet.tsx`, add this import:

```tsx
import { useAppHaptics } from "@/hooks/useAppHaptics";
```

Inside the component body, add:

```tsx
const haptics = useAppHaptics();
```

Update `handleSelect`:

```tsx
const handleSelect = (id: number | null) => {
  haptics.selection();
  onChange(id);
  flushSync(() => {
    onOpenChange(false);
  });
  onRestoreFocusRequest?.();
};
```

- [ ] **Step 4: Run budget picker tests**

Run:

```bash
rtk bun run test src/components/BudgetPickerSheet.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Format and lint budget picker files**

Run:

```bash
rtk bunx prettier --write src/components/BudgetPickerSheet.tsx src/components/BudgetPickerSheet.test.tsx
rtk bunx prettier --check src/components/BudgetPickerSheet.tsx src/components/BudgetPickerSheet.test.tsx
rtk bunx eslint src/components/BudgetPickerSheet.tsx src/components/BudgetPickerSheet.test.tsx
```

Expected: all commands exit `0`.

- [ ] **Step 6: Commit budget picker integration**

Run:

```bash
rtk git add src/components/BudgetPickerSheet.tsx src/components/BudgetPickerSheet.test.tsx
rtk git commit -m "feat: add haptics to budget picker"
```

Expected: commit succeeds.

## Task 6: Wire Pull To Refresh

**Files:**

- Modify: `src/components/PullToRefresh.tsx`
- Create: `src/components/PullToRefresh.test.tsx`

- [ ] **Step 1: Write failing pull-to-refresh haptics test**

Create `src/components/PullToRefresh.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PullToRefresh } from "./PullToRefresh";

const { hapticsMock } = vi.hoisted(() => ({
  hapticsMock: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    selection: vi.fn(),
    impact: vi.fn(),
    trigger: vi.fn(),
  },
}));

vi.mock("@/hooks/useAppHaptics", () => ({
  useAppHaptics: () => hapticsMock,
}));

const setMobileViewport = () => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 390,
  });
  Object.defineProperty(navigator, "maxTouchPoints", {
    configurable: true,
    value: 1,
  });
};

const dispatchTouch = (
  type: "touchstart" | "touchmove" | "touchend",
  clientY: number
) => {
  const event = new Event(type, {
    bubbles: true,
    cancelable: type === "touchmove",
  }) as Event & { touches: Array<{ clientY: number }> };

  Object.defineProperty(event, "touches", {
    configurable: true,
    value: type === "touchend" ? [] : [{ clientY }],
  });

  document.dispatchEvent(event);
};

beforeEach(() => {
  setMobileViewport();
  vi.spyOn(window, "scrollY", "get").mockReturnValue(0);
});

afterEach(() => {
  hapticsMock.success.mockReset();
  hapticsMock.warning.mockReset();
  hapticsMock.error.mockReset();
  hapticsMock.selection.mockReset();
  hapticsMock.impact.mockReset();
  hapticsMock.trigger.mockReset();
  vi.restoreAllMocks();
});

describe("PullToRefresh", () => {
  it("triggers one light impact when the pull crosses the refresh threshold", () => {
    render(
      <PullToRefresh>
        <main>Content</main>
      </PullToRefresh>
    );

    expect(screen.getByText("Content")).toBeInTheDocument();

    dispatchTouch("touchstart", 0);
    dispatchTouch("touchmove", 180);
    dispatchTouch("touchmove", 220);

    expect(hapticsMock.impact).toHaveBeenCalledTimes(1);
    expect(hapticsMock.impact).toHaveBeenCalledWith("light");
  });
});
```

- [ ] **Step 2: Run pull-to-refresh test to verify it fails**

Run:

```bash
rtk bun run test src/components/PullToRefresh.test.tsx
```

Expected: FAIL because threshold haptics are not implemented.

- [ ] **Step 3: Implement threshold haptics**

In `src/components/PullToRefresh.tsx`, add this import:

```tsx
import { useAppHaptics } from "@/hooks/useAppHaptics";
```

Inside `PullToRefresh`, add:

```tsx
const haptics = useAppHaptics();
const hasTriggeredThresholdHaptic = useRef(false);
```

Inside `handleTouchStart`, after assigning `touchStartY.current`, reset the gesture flag:

```tsx
hasTriggeredThresholdHaptic.current = false;
```

Inside `handleTouchMove`, after `setPullDistance(distance);`, add:

```tsx
if (distance >= PULL_THRESHOLD && !hasTriggeredThresholdHaptic.current) {
  hasTriggeredThresholdHaptic.current = true;
  haptics.impact("light");
}
```

Inside `handleTouchEnd` and `handleTouchCancel`, before returning from each handler, reset the flag:

```tsx
hasTriggeredThresholdHaptic.current = false;
```

Add `haptics` to the effect dependency array:

```tsx
}, [haptics, isMobile]);
```

- [ ] **Step 4: Run pull-to-refresh test**

Run:

```bash
rtk bun run test src/components/PullToRefresh.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Format and lint pull-to-refresh files**

Run:

```bash
rtk bunx prettier --write src/components/PullToRefresh.tsx src/components/PullToRefresh.test.tsx
rtk bunx prettier --check src/components/PullToRefresh.tsx src/components/PullToRefresh.test.tsx
rtk bunx eslint src/components/PullToRefresh.tsx src/components/PullToRefresh.test.tsx
```

Expected: all commands exit `0`.

- [ ] **Step 6: Commit pull-to-refresh integration**

Run:

```bash
rtk git add src/components/PullToRefresh.tsx src/components/PullToRefresh.test.tsx
rtk git commit -m "feat: add haptics to pull refresh threshold"
```

Expected: commit succeeds.

## Task 7: Wire Budget Transfer Drawer

**Files:**

- Modify: `src/components/BudgetTransferDrawer.tsx`
- Modify: `src/components/BudgetTransferDrawer.test.tsx`

- [ ] **Step 1: Write failing budget transfer haptics tests**

Add the hook mock near the top of `src/components/BudgetTransferDrawer.test.tsx`:

```tsx
const { hapticsMock } = vi.hoisted(() => ({
  hapticsMock: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    selection: vi.fn(),
    impact: vi.fn(),
    trigger: vi.fn(),
  },
}));

vi.mock("@/hooks/useAppHaptics", () => ({
  useAppHaptics: () => hapticsMock,
}));
```

Add these resets inside the existing `beforeEach`:

```tsx
hapticsMock.success.mockReset();
hapticsMock.warning.mockReset();
hapticsMock.error.mockReset();
hapticsMock.selection.mockReset();
hapticsMock.impact.mockReset();
hapticsMock.trigger.mockReset();
```

Add these tests inside `describe("BudgetTransferDrawer", () => { ... })`:

```tsx
it("triggers success haptics when funds are moved", async () => {
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  const destination = makeBudget({
    id: 1,
    name: "Groceries",
    amount: 100_000,
  });
  const source = makeBudget({
    id: 2,
    name: "Dining",
    amount: 200_000,
    remaining: 150_000,
  });
  transferMock.mockResolvedValue({ ok: true });
  useQueryMock.mockReturnValue(useQueryReturn({ data: [source] }));

  render(
    <BudgetTransferDrawer
      open
      onOpenChange={() => {}}
      destination={destination}
    />
  );

  fireEvent.click(
    screen.getByRole("button", { name: /select source budget/i })
  );
  fireEvent.click(screen.getByRole("button", { name: /Dining/i }));
  fireEvent.click(screen.getByRole("button", { name: /Use "Dining"/i }));
  await user.type(screen.getByLabelText(/amount/i), "30000");
  await user.click(screen.getByRole("button", { name: /move funds/i }));

  expect(await screen.findByText(/move funds/i)).toBeInTheDocument();
  expect(hapticsMock.success).toHaveBeenCalledTimes(1);
  expect(hapticsMock.error).not.toHaveBeenCalled();
});

it("triggers error haptics when moving funds fails", async () => {
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  const destination = makeBudget({
    id: 1,
    name: "Groceries",
    amount: 100_000,
  });
  const source = makeBudget({
    id: 2,
    name: "Dining",
    amount: 200_000,
    remaining: 150_000,
  });
  transferMock.mockResolvedValue({
    ok: false,
    code: "NOT_FOUND",
  });
  useQueryMock.mockReturnValue(useQueryReturn({ data: [source] }));

  render(
    <BudgetTransferDrawer
      open
      onOpenChange={() => {}}
      destination={destination}
    />
  );

  fireEvent.click(
    screen.getByRole("button", { name: /select source budget/i })
  );
  fireEvent.click(screen.getByRole("button", { name: /Dining/i }));
  fireEvent.click(screen.getByRole("button", { name: /Use "Dining"/i }));
  await user.type(screen.getByLabelText(/amount/i), "30000");
  await user.click(screen.getByRole("button", { name: /move funds/i }));

  expect(hapticsMock.error).toHaveBeenCalledTimes(1);
  expect(hapticsMock.success).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run budget transfer tests to verify they fail**

Run:

```bash
rtk bun run test src/components/BudgetTransferDrawer.test.tsx
```

Expected: FAIL because `BudgetTransferDrawer` does not call haptics.

- [ ] **Step 3: Implement budget transfer haptics**

In `src/components/BudgetTransferDrawer.tsx`, add this import:

```tsx
import { useAppHaptics } from "@/hooks/useAppHaptics";
```

Inside `BudgetTransferDrawer`, near mutation setup, add:

```tsx
const haptics = useAppHaptics();
```

In `handleSubmit`, update the successful result block:

```tsx
if (result.ok) {
  toast.success("Funds moved.");
  haptics.success();
  onOpenChange(false);
  return;
}
```

After the `switch (result.code) { ... }` block for non-ok results, add:

```tsx
haptics.error();
```

In the catch path, add:

```tsx
console.error(error);
toast.error("Failed to move funds.");
haptics.error();
```

- [ ] **Step 4: Run budget transfer tests**

Run:

```bash
rtk bun run test src/components/BudgetTransferDrawer.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Format and lint budget transfer files**

Run:

```bash
rtk bunx prettier --write src/components/BudgetTransferDrawer.tsx src/components/BudgetTransferDrawer.test.tsx
rtk bunx prettier --check src/components/BudgetTransferDrawer.tsx src/components/BudgetTransferDrawer.test.tsx
rtk bunx eslint src/components/BudgetTransferDrawer.tsx src/components/BudgetTransferDrawer.test.tsx
```

Expected: all commands exit `0`.

- [ ] **Step 6: Commit budget transfer integration**

Run:

```bash
rtk git add src/components/BudgetTransferDrawer.tsx src/components/BudgetTransferDrawer.test.tsx
rtk git commit -m "feat: add haptics to budget transfer"
```

Expected: commit succeeds.

## Task 8: Update Tracking Map

**Files:**

- Modify: `docs/web-haptics-map.md`

- [ ] **Step 1: Update map statuses**

Replace the call-site table in `docs/web-haptics-map.md` with:

```md
| Area                   | File                                      | Interaction                                 | Haptic method     | Status      | Notes                                                                                 |
| ---------------------- | ----------------------------------------- | ------------------------------------------- | ----------------- | ----------- | ------------------------------------------------------------------------------------- |
| Manual expense form    | `src/components/ManualExpenseForm.tsx`    | Submit succeeds and success toast appears   | `success()`       | implemented | Triggered after the create or caller-owned submit promise resolves.                   |
| Manual expense form    | `src/components/ManualExpenseForm.tsx`    | Submit fails and error toast appears        | `error()`         | implemented | Triggered in the same catch path that shows the error toast.                          |
| Manual expense form    | `src/components/ManualExpenseForm.tsx`    | Quick/advanced mode changes                 | `selection()`     | implemented | Triggered only when quick mode opens advanced options.                                |
| AI expense chat        | `src/components/AIExpenseChat.tsx`        | Parse returns a full expense result         | `success()`       | implemented | Triggered when the assistant success bubble replaces pending state.                   |
| AI expense chat        | `src/components/AIExpenseChat.tsx`        | Parse returns fallback prefill              | `warning()`       | implemented | Fallback is not a hard error, but it needs user attention.                            |
| AI expense chat        | `src/components/AIExpenseChat.tsx`        | Parse request fails                         | `error()`         | implemented | Triggered when the visible error assistant message is set.                            |
| Budget picker          | `src/components/BudgetPickerSheet.tsx`    | Budget row or no-budget row is selected     | `selection()`     | implemented | Triggered before or alongside closing the sheet.                                      |
| Budget transfer drawer | `src/components/BudgetTransferDrawer.tsx` | Transfer succeeds and success toast appears | `success()`       | implemented | Triggered after mutation resolves.                                                    |
| Budget transfer drawer | `src/components/BudgetTransferDrawer.tsx` | Transfer fails and error toast appears      | `error()`         | implemented | Triggered in the same catch path as the error toast.                                  |
| Pull to refresh        | `src/components/PullToRefresh.tsx`        | Pull crosses the refresh threshold          | `impact("light")` | implemented | Triggered once per gesture when the threshold is first crossed, not every move event. |
```

- [ ] **Step 2: Format and check map**

Run:

```bash
rtk bunx prettier --write docs/web-haptics-map.md
rtk bunx prettier --check docs/web-haptics-map.md
```

Expected: both commands exit `0`.

- [ ] **Step 3: Commit map update**

Run:

```bash
rtk git add docs/web-haptics-map.md
rtk git commit -m "docs: update web haptics map"
```

Expected: commit succeeds.

## Task 9: Final Verification

**Files:**

- Verify all implementation files from previous tasks.

- [ ] **Step 1: Run focused tests**

Run:

```bash
rtk bun run test src/hooks/useAppHaptics.test.tsx src/components/ManualExpenseForm.quick-mode.test.tsx src/components/AIExpenseChat.test.tsx src/components/BudgetPickerSheet.test.tsx src/components/PullToRefresh.test.tsx src/components/BudgetTransferDrawer.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run formatter check for all changed source and docs files**

Run:

```bash
rtk bunx prettier --check src/hooks/useAppHaptics.ts src/hooks/useAppHaptics.test.tsx src/components/ManualExpenseForm.tsx src/components/ManualExpenseForm.quick-mode.test.tsx src/components/AIExpenseChat.tsx src/components/AIExpenseChat.test.tsx src/components/BudgetPickerSheet.tsx src/components/BudgetPickerSheet.test.tsx src/components/PullToRefresh.tsx src/components/PullToRefresh.test.tsx src/components/BudgetTransferDrawer.tsx src/components/BudgetTransferDrawer.test.tsx docs/web-haptics-map.md
```

Expected: PASS.

- [ ] **Step 3: Run ESLint for all changed TS and TSX files**

Run:

```bash
rtk bunx eslint src/hooks/useAppHaptics.ts src/hooks/useAppHaptics.test.tsx src/components/ManualExpenseForm.tsx src/components/ManualExpenseForm.quick-mode.test.tsx src/components/AIExpenseChat.tsx src/components/AIExpenseChat.test.tsx src/components/BudgetPickerSheet.tsx src/components/BudgetPickerSheet.test.tsx src/components/PullToRefresh.tsx src/components/PullToRefresh.test.tsx src/components/BudgetTransferDrawer.tsx src/components/BudgetTransferDrawer.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Inspect final diff**

Run:

```bash
rtk git status --short
rtk git diff --stat main...HEAD
```

Expected: working tree has no unstaged implementation changes. Diff includes dependency install, hook, tests, explicit call-site integrations, and the tracking map update.

- [ ] **Step 5: Final commit if verification produced cleanup changes**

Run only if Step 2 or Step 3 reformatted or fixed files:

```bash
rtk git add src docs package.json bun.lock
rtk git commit -m "chore: finalize web haptics integration"
```

Expected: commit succeeds when there are staged cleanup changes. If there are no cleanup changes, skip this command.
