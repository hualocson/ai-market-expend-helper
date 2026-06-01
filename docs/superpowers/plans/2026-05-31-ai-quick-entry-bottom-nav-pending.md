# AI Quick Entry Bottom Nav Pending Indicator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a compact active-work indicator on the bottom-nav AI button when AI quick-entry parsing or saving continues after the drawer is closed.

**Architecture:** Derive the indicator directly inside `BottomNav` from the existing non-persisted `useAIQuickEntryStore`. Do not add store state: the button should subscribe to `open` and `entries`, compute active work from `parsing` and `saving`, and render a layout-stable dot only while the drawer is closed.

**Tech Stack:** Next.js 15 App Router, React 19, Zustand 5, Tailwind v4, Vitest, Testing Library, lucide-react.

---

## File Structure

- Modify `src/components/BottomNav.tsx`
  - Derives whether the AI quick-entry queue has active work.
  - Shows the compact pending dot on the AI button only when active work exists and the drawer is closed.
  - Updates the AI button accessible label while the pending dot is visible.

- Modify `src/components/BottomNav.test.tsx`
  - Clears the AI quick-entry queue between tests.
  - Covers closed active work, open active work, and non-active saved/review entries.

No store, route handler, mutation, persistence, or sync/outbox changes are needed.

## Task 1: Add Bottom Nav Pending State Tests

**Files:**

- Modify: `src/components/BottomNav.test.tsx`

- [ ] **Step 1: Add enum imports for saved and review test fixtures**

Change the import block near the top of `src/components/BottomNav.test.tsx` from:

```tsx
import React from "react";

import { useAIQuickEntryStore } from "@/stores/ai-quick-entry-store";
```

to:

```tsx
import React from "react";

import { Category, PaidBy } from "@/enums";
import { useAIQuickEntryStore } from "@/stores/ai-quick-entry-store";
```

- [ ] **Step 2: Clear the AI quick-entry queue around each BottomNav test**

In `src/components/BottomNav.test.tsx`, change the existing `beforeEach` and `afterEach` setup from:

```tsx
beforeEach(() => {
  (globalThis as unknown as Record<string, unknown>).React = React;
  pathnameState.value = "/";
  routerPushMock.mockReset();
  hapticsMock.success.mockReset();
  hapticsMock.warning.mockReset();
  hapticsMock.error.mockReset();
  hapticsMock.selection.mockReset();
  hapticsMock.impact.mockReset();
  hapticsMock.trigger.mockReset();
  useAIQuickEntryStore.getState().setOpen(false);
});

afterEach(() => {
  if (typeof originalGlobalReact === "undefined") {
    Reflect.deleteProperty(globalThis, "React");
    return;
  }
  (globalThis as unknown as Record<string, unknown>).React =
    originalGlobalReact;
});
```

to:

```tsx
beforeEach(() => {
  (globalThis as unknown as Record<string, unknown>).React = React;
  pathnameState.value = "/";
  routerPushMock.mockReset();
  hapticsMock.success.mockReset();
  hapticsMock.warning.mockReset();
  hapticsMock.error.mockReset();
  hapticsMock.selection.mockReset();
  hapticsMock.impact.mockReset();
  hapticsMock.trigger.mockReset();
  useAIQuickEntryStore.getState().setOpen(false);
  useAIQuickEntryStore.getState().clearEntries();
});

afterEach(() => {
  useAIQuickEntryStore.getState().setOpen(false);
  useAIQuickEntryStore.getState().clearEntries();

  if (typeof originalGlobalReact === "undefined") {
    Reflect.deleteProperty(globalThis, "React");
    return;
  }
  (globalThis as unknown as Record<string, unknown>).React =
    originalGlobalReact;
});
```

- [ ] **Step 3: Add the failing pending indicator tests**

In `src/components/BottomNav.test.tsx`, after the existing `"opens AI quick entry when the AI button is tapped"` test, add:

```tsx
it("shows a pending indicator on the AI button when active work continues while closed", () => {
  const store = useAIQuickEntryStore.getState();

  store.enqueueEntry("cf 35k");
  store.setOpen(false);

  render(<BottomNav />);

  expect(
    screen.getByRole("button", {
      name: /open ai quick entry, background work in progress/i,
    })
  ).toBeInTheDocument();
  expect(
    screen.getByTestId("ai-quick-entry-pending-indicator")
  ).toBeInTheDocument();
});

it("hides the AI pending indicator while the drawer is open", () => {
  const store = useAIQuickEntryStore.getState();

  store.enqueueEntry("cf 35k");
  store.setOpen(true);

  render(<BottomNav />);

  expect(
    screen.getByRole("button", { name: /open ai quick entry$/i })
  ).toBeInTheDocument();
  expect(
    screen.queryByTestId("ai-quick-entry-pending-indicator")
  ).not.toBeInTheDocument();
});

it("does not show the AI pending indicator for saved or review entries", () => {
  const reviewDraft = {
    date: "30/05/2026",
    amount: 35000,
    note: "Cà phê",
    category: Category.FOOD,
    paidBy: PaidBy.CUBI,
    budgetId: null,
    budgetName: null,
    budgetIcon: null,
    budgetColor: null,
  };
  const store = useAIQuickEntryStore.getState();
  const savedEntry = store.enqueueEntry("saved");
  const reviewEntry = store.enqueueEntry("review");

  store.markEntrySaved(savedEntry.id, {
    ...reviewDraft,
    id: 101,
    clientId: "client-1",
    syncStatus: "pending",
  });
  store.markEntryForReview(reviewEntry.id, reviewDraft, "no_budget_match");
  store.setOpen(false);

  render(<BottomNav />);

  expect(
    screen.getByRole("button", { name: /open ai quick entry$/i })
  ).toBeInTheDocument();
  expect(
    screen.queryByTestId("ai-quick-entry-pending-indicator")
  ).not.toBeInTheDocument();
});
```

- [ ] **Step 4: Run the focused tests and verify they fail**

Run:

```bash
rtk bunx vitest run src/components/BottomNav.test.tsx --testNamePattern "AI button|AI pending"
```

Expected: FAIL because `ai-quick-entry-pending-indicator` is not rendered and the AI button accessible label does not include `background work in progress`.

- [ ] **Step 5: Commit nothing for Task 1**

Do not commit the failing tests alone. Continue to Task 2 and commit the passing implementation with the tests.

## Task 2: Render The Closed Active-Work Indicator

**Files:**

- Modify: `src/components/BottomNav.tsx`
- Modify: `src/components/BottomNav.test.tsx`

- [ ] **Step 1: Derive active AI quick-entry work in BottomNav**

In `src/components/BottomNav.tsx`, replace this line inside `BottomNav`:

```tsx
const openAIQuickEntry = useAIQuickEntryStore((state) => state.setOpen);
```

with:

```tsx
const aiQuickEntryOpen = useAIQuickEntryStore((state) => state.open);
const hasActiveAIQuickEntryWork = useAIQuickEntryStore((state) =>
  state.entries.some(
    (entry) => entry.status === "parsing" || entry.status === "saving"
  )
);
const openAIQuickEntry = useAIQuickEntryStore((state) => state.setOpen);
const showAIQuickEntryPending = !aiQuickEntryOpen && hasActiveAIQuickEntryWork;
```

- [ ] **Step 2: Add a dynamic accessible label to the AI button**

In `src/components/BottomNav.tsx`, replace:

```tsx
<button
  type="button"
  aria-label="Open AI quick entry"
  onClick={() => {
    haptics.impact("medium");
    openAIQuickEntry(true);
  }}
  className="text-primary grid size-14 shrink-0 place-items-center rounded-full bg-[linear-gradient(180deg,color-mix(in_srgb,#ffffff_9%,transparent),color-mix(in_srgb,#ffffff_2%,transparent)),color-mix(in_srgb,var(--surface-3)_78%,transparent)] shadow-[inset_0_1px_0_color-mix(in_srgb,#ffffff_20%,transparent),0_20px_46px_color-mix(in_srgb,#000000_58%,transparent)] backdrop-blur-2xl transition-transform active:scale-[0.96]"
>
  <Sparkles className="size-6" />
</button>
```

with:

```tsx
<button
  type="button"
  aria-label={
    showAIQuickEntryPending
      ? "Open AI quick entry, background work in progress"
      : "Open AI quick entry"
  }
  onClick={() => {
    haptics.impact("medium");
    openAIQuickEntry(true);
  }}
  className="text-primary relative grid size-14 shrink-0 place-items-center rounded-full bg-[linear-gradient(180deg,color-mix(in_srgb,#ffffff_9%,transparent),color-mix(in_srgb,#ffffff_2%,transparent)),color-mix(in_srgb,var(--surface-3)_78%,transparent)] shadow-[inset_0_1px_0_color-mix(in_srgb,#ffffff_20%,transparent),0_20px_46px_color-mix(in_srgb,#000000_58%,transparent)] backdrop-blur-2xl transition-transform active:scale-[0.96]"
>
  <Sparkles className="size-6" />
  {showAIQuickEntryPending && (
    <span
      aria-hidden="true"
      data-testid="ai-quick-entry-pending-indicator"
      className="bg-primary before:bg-primary absolute top-1.5 right-1.5 size-3 rounded-full shadow-[0_0_0_3px_color-mix(in_srgb,var(--surface-3)_82%,transparent),0_0_18px_color-mix(in_srgb,var(--primary)_75%,transparent)] before:absolute before:inset-0 before:animate-ping before:rounded-full before:opacity-45 before:content-['']"
    />
  )}
</button>
```

This keeps the button size stable and adds only an absolutely positioned visual indicator.

- [ ] **Step 3: Run the focused tests and verify they pass**

Run:

```bash
rtk bunx vitest run src/components/BottomNav.test.tsx --testNamePattern "AI button|AI pending"
```

Expected: PASS.

- [ ] **Step 4: Run the full BottomNav test file**

Run:

```bash
rtk bunx vitest run src/components/BottomNav.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Format and lint modified TypeScript files**

Run:

```bash
rtk bunx prettier --write src/components/BottomNav.tsx src/components/BottomNav.test.tsx
rtk bunx prettier --check src/components/BottomNav.tsx src/components/BottomNav.test.tsx
rtk bunx eslint src/components/BottomNav.tsx src/components/BottomNav.test.tsx
```

Expected: all commands PASS.

- [ ] **Step 6: Commit the pending indicator implementation**

Run:

```bash
rtk git add src/components/BottomNav.tsx src/components/BottomNav.test.tsx
rtk git commit -m "feat(ai-quick-entry): show bottom nav pending state"
```

Expected: commit succeeds.

## Task 3: Final Validation

**Files:**

- Verify: `src/components/BottomNav.tsx`
- Verify: `src/components/BottomNav.test.tsx`
- Verify: `src/stores/ai-quick-entry-store.ts`

- [ ] **Step 1: Run directly affected tests**

Run:

```bash
rtk bunx vitest run src/components/BottomNav.test.tsx src/stores/ai-quick-entry-store.test.ts src/components/AIQuickEntry.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run required formatting and ESLint checks**

Run:

```bash
rtk bunx prettier --write src/components/BottomNav.tsx src/components/BottomNav.test.tsx
rtk bunx prettier --check src/components/BottomNav.tsx src/components/BottomNav.test.tsx
rtk bunx eslint src/components/BottomNav.tsx src/components/BottomNav.test.tsx
```

Expected: all commands PASS.

- [ ] **Step 3: Confirm no persistence or new store field was added**

Run:

```bash
rtk sed -n '1,180p' src/stores/ai-quick-entry-store.ts
```

Expected: the store still uses direct `create` from `zustand`, does not import `persist`, does not reference `localStorage` or `sessionStorage`, and has no new pending-indicator-specific state field.

- [ ] **Step 4: Inspect the final diff**

Run:

```bash
rtk git diff --stat HEAD~1..HEAD
rtk git diff HEAD~1..HEAD -- src/components/BottomNav.tsx src/components/BottomNav.test.tsx
```

Expected: the implementation commit changes only `src/components/BottomNav.tsx` and `src/components/BottomNav.test.tsx`, derives pending state from `open` and `entries`, and renders the indicator only when the drawer is closed with active work.

- [ ] **Step 5: Commit final validation fixes if needed**

If Steps 1 through 4 require no edits, skip this step. If a scoped fix is needed, run:

```bash
rtk git add src/components/BottomNav.tsx src/components/BottomNav.test.tsx
rtk git commit -m "chore(ai-quick-entry): finish bottom nav pending validation"
```

Expected: commit succeeds only if there are staged changes.
