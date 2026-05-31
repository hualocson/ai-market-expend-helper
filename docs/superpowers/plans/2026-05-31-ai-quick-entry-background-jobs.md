# AI Quick Entry Background Jobs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AI quick entry continue submitted parse/save work after the drawer closes, with the same runtime queue visible again when the drawer reopens.

**Architecture:** Extend the existing non-persisted `useAIQuickEntryStore` so it owns the runtime entry queue and status transitions. Keep `AIQuickEntry` as the stable controller that runs async parse/save work with React hooks, but stop using drawer close as a stale-session guard. Closing the drawer hides UI and clears nested drawer selection only; it does not clear entries or invalidate active work.

**Tech Stack:** Next.js 15 App Router, React 19, Zustand 5, TanStack Query 5, Vitest, Testing Library, Sonner, local-first expense sync.

---

## File Structure

- Modify `src/stores/ai-quick-entry-store.ts`
  - Owns `open`, runtime `entries`, and pure queue transition actions.
  - Does not call network, TanStack Query, mutation hooks, toasts, or haptics.

- Modify `src/stores/ai-quick-entry-store.test.ts`
  - Tests queue defaults and transition actions.

- Modify `src/components/AIQuickEntry.tsx`
  - Reads/writes entries through the store.
  - Keeps `mode`, composer, and nested drawer selection local.
  - Continues `runEntry` after drawer close.
  - Clears nested drawer selection on close without clearing entries.

- Modify `src/components/AIQuickEntry.test.tsx`
  - Replaces old stale-close expectations.
  - Adds close/reopen tests for active, saved, review, and create-failure paths.

No new route handlers, server actions, persisted storage, or sync/outbox files are needed.

## Task 1: Add Runtime Queue Actions To The Store

**Files:**
- Modify: `src/stores/ai-quick-entry-store.ts`
- Modify: `src/stores/ai-quick-entry-store.test.ts`

- [ ] **Step 1: Write failing store tests**

Replace `src/stores/ai-quick-entry-store.test.ts` with:

```ts
import { afterEach, describe, expect, it } from "vitest";

import { Category, PaidBy } from "@/enums";

import { useAIQuickEntryStore } from "./ai-quick-entry-store";

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

const savedExpense = {
  ...reviewDraft,
  id: 101,
  clientId: "client-1",
  syncStatus: "pending" as const,
};

afterEach(() => {
  const store = useAIQuickEntryStore.getState();
  store.setOpen(false);
  store.clearEntries();
});

describe("useAIQuickEntryStore", () => {
  it("defaults to closed with no entries", () => {
    expect(useAIQuickEntryStore.getState().open).toBe(false);
    expect(useAIQuickEntryStore.getState().entries).toEqual([]);
  });

  it("opens and closes via setOpen without clearing entries", () => {
    const store = useAIQuickEntryStore.getState();
    const entry = store.enqueueEntry("cf 35k");

    store.setOpen(true);
    store.setOpen(false);

    expect(useAIQuickEntryStore.getState().open).toBe(false);
    expect(useAIQuickEntryStore.getState().entries).toMatchObject([
      { id: entry.id, input: "cf 35k", status: "parsing" },
    ]);
  });

  it("enqueues parsing entries with stable runtime fields", () => {
    const before = Date.now();
    const entry = useAIQuickEntryStore.getState().enqueueEntry("tea 20k");

    expect(entry).toMatchObject({
      input: "tea 20k",
      status: "parsing",
    });
    expect(entry.id).toEqual(expect.any(String));
    expect(entry.createdAt).toBeGreaterThanOrEqual(before);
    expect(useAIQuickEntryStore.getState().entries).toEqual([entry]);
  });

  it("moves only the targeted entry through parsing, saving, saved, and review", () => {
    const store = useAIQuickEntryStore.getState();
    const first = store.enqueueEntry("first");
    const second = store.enqueueEntry("second");

    store.markEntrySaving(first.id, reviewDraft);
    expect(useAIQuickEntryStore.getState().entries).toMatchObject([
      { id: first.id, status: "saving", reviewDraft },
      { id: second.id, status: "parsing" },
    ]);

    store.markEntrySaving(second.id, reviewDraft);
    store.markEntryParsing(second.id);
    expect(useAIQuickEntryStore.getState().entries).toMatchObject([
      { id: first.id, status: "saving", reviewDraft },
      { id: second.id, status: "parsing" },
    ]);

    store.markEntrySaved(first.id, savedExpense);
    expect(useAIQuickEntryStore.getState().entries).toMatchObject([
      { id: first.id, status: "saved", savedExpense },
      { id: second.id, status: "parsing" },
    ]);

    store.markEntryForReview(second.id, reviewDraft, "no_budget_match");
    expect(useAIQuickEntryStore.getState().entries).toMatchObject([
      { id: first.id, status: "saved", savedExpense },
      {
        id: second.id,
        status: "needsReview",
        reviewDraft,
        errorReason: "no_budget_match",
      },
    ]);
  });

  it("ignores transitions for missing entries", () => {
    const store = useAIQuickEntryStore.getState();

    store.markEntryParsing("missing");
    store.markEntrySaving("missing", reviewDraft);
    store.markEntrySaved("missing", savedExpense);
    store.markEntryForReview("missing", reviewDraft, "parse_error");

    expect(useAIQuickEntryStore.getState().entries).toEqual([]);
  });

  it("clears entries only when clearEntries is called", () => {
    const store = useAIQuickEntryStore.getState();
    store.enqueueEntry("cf 35k");

    store.clearEntries();

    expect(useAIQuickEntryStore.getState().entries).toEqual([]);
  });
});
```

- [ ] **Step 2: Run store tests and verify they fail**

Run:

```bash
rtk bunx vitest run src/stores/ai-quick-entry-store.test.ts
```

Expected: FAIL with TypeScript/runtime errors for missing `entries`, `clearEntries`, `enqueueEntry`, `markEntryParsing`, `markEntrySaving`, `markEntrySaved`, and `markEntryForReview`.

- [ ] **Step 3: Implement the store queue API**

Replace `src/stores/ai-quick-entry-store.ts` with:

```ts
import type { AIQuickEntryReviewReason } from "@/components/ai-quick-entry/real-parse";
import type { QuickEntry } from "@/components/ai-quick-entry/types";
import type { TQuickExpenseDrawerInitialExpense } from "@/components/QuickExpenseDrawer";
import { create } from "zustand";

const createEntryId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

type SavedQuickEntryExpense = NonNullable<QuickEntry["savedExpense"]>;

type AIQuickEntryState = {
  open: boolean;
  entries: QuickEntry[];
  setOpen: (value: boolean) => void;
  enqueueEntry: (input: string) => QuickEntry;
  markEntryParsing: (id: string) => void;
  markEntrySaving: (
    id: string,
    reviewDraft: TQuickExpenseDrawerInitialExpense
  ) => void;
  markEntrySaved: (id: string, savedExpense: SavedQuickEntryExpense) => void;
  markEntryForReview: (
    id: string,
    reviewDraft: TQuickExpenseDrawerInitialExpense,
    errorReason: AIQuickEntryReviewReason
  ) => void;
  clearEntries: () => void;
};

export const useAIQuickEntryStore = create<AIQuickEntryState>((set) => ({
  open: false,
  entries: [],
  setOpen: (value) => set({ open: value }),
  enqueueEntry: (input) => {
    const entry: QuickEntry = {
      id: createEntryId(),
      input,
      status: "parsing",
      createdAt: Date.now(),
    };

    set((state) => ({ entries: [...state.entries, entry] }));

    return entry;
  },
  markEntryParsing: (id) =>
    set((state) => ({
      entries: state.entries.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              status: "parsing",
              reviewDraft: undefined,
              savedExpense: undefined,
              errorReason: undefined,
            }
          : entry
      ),
    })),
  markEntrySaving: (id, reviewDraft) =>
    set((state) => ({
      entries: state.entries.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              status: "saving",
              reviewDraft,
              savedExpense: undefined,
              errorReason: undefined,
            }
          : entry
      ),
    })),
  markEntrySaved: (id, savedExpense) =>
    set((state) => ({
      entries: state.entries.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              status: "saved",
              reviewDraft: undefined,
              savedExpense,
              errorReason: undefined,
            }
          : entry
      ),
    })),
  markEntryForReview: (id, reviewDraft, errorReason) =>
    set((state) => ({
      entries: state.entries.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              status: "needsReview",
              reviewDraft,
              savedExpense: undefined,
              errorReason,
            }
          : entry
      ),
    })),
  clearEntries: () => set({ entries: [] }),
}));
```

- [ ] **Step 4: Run store tests and verify they pass**

Run:

```bash
rtk bunx vitest run src/stores/ai-quick-entry-store.test.ts
```

Expected: PASS.

- [ ] **Step 5: Format and lint modified store files**

Run:

```bash
rtk bunx prettier --write src/stores/ai-quick-entry-store.ts src/stores/ai-quick-entry-store.test.ts
rtk bunx prettier --check src/stores/ai-quick-entry-store.ts src/stores/ai-quick-entry-store.test.ts
rtk bunx eslint src/stores/ai-quick-entry-store.ts src/stores/ai-quick-entry-store.test.ts
```

Expected: all commands PASS.

- [ ] **Step 6: Commit store queue API**

Run:

```bash
rtk git add src/stores/ai-quick-entry-store.ts src/stores/ai-quick-entry-store.test.ts
rtk git commit -m "feat(ai-quick-entry): add runtime entry queue store"
```

Expected: commit succeeds.

## Task 2: Preserve Active Entries Across Drawer Close/Reopen

**Files:**
- Modify: `src/components/AIQuickEntry.test.tsx`
- Modify: `src/components/AIQuickEntry.tsx`

- [ ] **Step 1: Replace the stale-close test with a failing preserve-active test**

In `src/components/AIQuickEntry.test.tsx`, replace the test named `"ignores stale parse results after the drawer closes and reopens"` with:

```tsx
  it("keeps an active parse visible after the drawer closes and reopens", async () => {
    const parseResponse = mockDeferredParseResponse();
    renderQuickEntry();
    openOverlay();

    act(() => {
      typeAndSend("cf 35k");
    });

    expect(screen.getByText("cf 35k")).toBeInTheDocument();

    act(() => {
      useAIQuickEntryStore.getState().setOpen(false);
    });
    openOverlay();

    expect(screen.getByText("cf 35k")).toBeInTheDocument();
    expect(createExpenseMock).not.toHaveBeenCalled();

    await act(async () => {
      parseResponse.resolve({
        status: 200,
        json: vi
          .fn()
          .mockResolvedValue({ success: true, data: trustedParseResponse }),
      });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(createExpenseMock).toHaveBeenCalledTimes(1));
  });
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
rtk bunx vitest run src/components/AIQuickEntry.test.tsx --testNamePattern "keeps an active parse visible after the drawer closes and reopens"
```

Expected: FAIL because `cf 35k` is not visible after reopen and/or `createExpenseMock` is not called after the deferred parse resolves.

- [ ] **Step 3: Wire `AIQuickEntry` to store entries and queue actions**

In `src/components/AIQuickEntry.tsx`, replace the local `entries` state and close-session refs:

```tsx
  const [entries, setEntries] = useState<QuickEntry[]>([]);
  const [activeDrawerItem, setActiveDrawerItem] =
    useState<ActiveQuickEntryDrawerItem>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeDrawerItemRef = useRef<ActiveQuickEntryDrawerItem>(null);
  const openRef = useRef(open);
  const sessionRef = useRef(0);
```

with:

```tsx
  const entries = useAIQuickEntryStore((state) => state.entries);
  const enqueueEntry = useAIQuickEntryStore((state) => state.enqueueEntry);
  const markEntrySaving = useAIQuickEntryStore(
    (state) => state.markEntrySaving
  );
  const markEntrySaved = useAIQuickEntryStore((state) => state.markEntrySaved);
  const markEntryForReviewInStore = useAIQuickEntryStore(
    (state) => state.markEntryForReview
  );
  const [activeDrawerItem, setActiveDrawerItem] =
    useState<ActiveQuickEntryDrawerItem>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeDrawerItemRef = useRef<ActiveQuickEntryDrawerItem>(null);
```

Replace the `useEffect` that currently increments `sessionRef` and clears entries:

```tsx
  useEffect(() => {
    openRef.current = open;
    sessionRef.current += 1;

    if (!open) {
      setActiveDrawerItem(null);
      activeDrawerItemRef.current = null;
      return;
    }

    setMode("entry");
    setEntries([]);
    setComposer("");
    setActiveDrawerItem(null);
    activeDrawerItemRef.current = null;
  }, [open]);
```

with:

```tsx
  useEffect(() => {
    if (!open) {
      setActiveDrawerItem(null);
      activeDrawerItemRef.current = null;
      return;
    }

    setMode("entry");
    setComposer("");
    setActiveDrawerItem(null);
    activeDrawerItemRef.current = null;
  }, [open]);
```

Delete the `isCurrentSession` callback:

```tsx
  const isCurrentSession = useCallback(
    (sessionId: number) => openRef.current && sessionRef.current === sessionId,
    []
  );
```

- [ ] **Step 4: Update entry transitions in `AIQuickEntry`**

Replace `markEntryForReview` with a callback that delegates to the store:

```tsx
  const markEntryForReview = useCallback(
    ({
      entryId,
      reviewDraft,
      errorReason,
    }: {
      entryId: string;
      reviewDraft: TQuickExpenseDrawerInitialExpense;
      errorReason: AIQuickEntryReviewReason;
    }) => {
      markEntryForReviewInStore(entryId, reviewDraft, errorReason);
    },
    [markEntryForReviewInStore]
  );
```

Change the `runEntry` signature:

```tsx
    async (entryId: string, input: string, sessionId: number) => {
```

to:

```tsx
    async (entryId: string, input: string) => {
```

Inside `runEntry`, delete every block shaped like:

```tsx
        if (!isCurrentSession(sessionId)) {
          return;
        }
```

Replace the saving transition:

```tsx
        setEntries((current) =>
          current.map((entry) =>
            entry.id === entryId
              ? {
                  ...entry,
                  status: "saving",
                  reviewDraft: decision.initialExpense,
                }
              : entry
          )
        );
```

with:

```tsx
        markEntrySaving(entryId, decision.initialExpense);
```

Replace the saved transition:

```tsx
        setEntries((current) =>
          current.map((entry) =>
            entry.id === entryId
              ? {
                  ...entry,
                  status: "saved",
                  reviewDraft: undefined,
                  savedExpense,
                  errorReason: undefined,
                }
              : entry
          )
        );
```

with:

```tsx
        markEntrySaved(entryId, savedExpense);
```

Update the `runEntry` dependency list to:

```tsx
    [
      createExpense,
      haptics,
      markEntryForReview,
      markEntrySaved,
      markEntrySaving,
      paidBy,
      queryClient,
    ]
```

Replace submit queueing:

```tsx
    const id = createEntryId();
    const sessionId = sessionRef.current;
    setEntries((current) => [
      ...current,
      { id, input, status: "parsing", createdAt: Date.now() },
    ]);
    setComposer("");
    haptics.impact("medium");
    void runEntry(id, input, sessionId);
```

with:

```tsx
    const entry = enqueueEntry(input);
    setComposer("");
    haptics.impact("medium");
    void runEntry(entry.id, input);
```

Replace the saved-row success transition in `handleQuickExpenseDrawerSuccess`:

```tsx
    setEntries((current) =>
      current.map((entry) =>
        entry.id === drawerItem.entryId
          ? {
              ...entry,
              status: "saved",
              reviewDraft: undefined,
              savedExpense,
              errorReason: undefined,
            }
          : entry
      )
    );
```

with:

```tsx
    markEntrySaved(drawerItem.entryId, savedExpense);
```

In `handleOpenChange`, remove the stale-session mutation:

```tsx
    if (!nextOpen) {
      openRef.current = false;
      sessionRef.current += 1;
    }
```

Do not leave unused `createEntryId`, `setEntries`, `openRef`, `sessionRef`, or `isCurrentSession` code behind.

- [ ] **Step 5: Run the focused preserve-active test and verify it passes**

Run:

```bash
rtk bunx vitest run src/components/AIQuickEntry.test.tsx --testNamePattern "keeps an active parse visible after the drawer closes and reopens"
```

Expected: PASS.

- [ ] **Step 6: Run store tests again**

Run:

```bash
rtk bunx vitest run src/stores/ai-quick-entry-store.test.ts
```

Expected: PASS.

- [ ] **Step 7: Format and lint modified TypeScript files**

Run:

```bash
rtk bunx prettier --write src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx src/stores/ai-quick-entry-store.ts src/stores/ai-quick-entry-store.test.ts
rtk bunx prettier --check src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx src/stores/ai-quick-entry-store.ts src/stores/ai-quick-entry-store.test.ts
rtk bunx eslint src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx src/stores/ai-quick-entry-store.ts src/stores/ai-quick-entry-store.test.ts
```

Expected: all commands PASS.

- [ ] **Step 8: Commit active-entry preservation**

Run:

```bash
rtk git add src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx src/stores/ai-quick-entry-store.ts src/stores/ai-quick-entry-store.test.ts
rtk git commit -m "fix(ai-quick-entry): keep active jobs after close"
```

Expected: commit succeeds.

## Task 3: Cover Saved And Review Completion While Closed

**Files:**
- Modify: `src/components/AIQuickEntry.test.tsx`
- Modify: `src/components/AIQuickEntry.tsx`

- [ ] **Step 1: Add closed-drawer auto-save and fallback tests**

In `src/components/AIQuickEntry.test.tsx`, after the preserve-active test, add:

```tsx
  it("auto-saves a trusted parse while closed and shows it after reopen", async () => {
    const parseResponse = mockDeferredParseResponse();
    renderQuickEntry();
    openOverlay();

    act(() => {
      typeAndSend("cf 35k");
    });

    act(() => {
      useAIQuickEntryStore.getState().setOpen(false);
    });

    await act(async () => {
      parseResponse.resolve({
        status: 200,
        json: vi
          .fn()
          .mockResolvedValue({ success: true, data: trustedParseResponse }),
      });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(createExpenseMock).toHaveBeenCalledTimes(1));
    expect(toastSuccessMock).toHaveBeenCalledTimes(1);

    openOverlay();
    fireEvent.click(screen.getByLabelText(/Open preview/));

    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByText("Cà phê sữa đá")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /Edit saved expense Cà phê sữa đá.*35\.000/,
      })
    ).toBeInTheDocument();
  });

  it("moves a fallback parse to needs review while closed and shows it after reopen", async () => {
    const parseResponse = mockDeferredParseResponse();
    renderQuickEntry();
    openOverlay();

    act(() => {
      typeAndSend("maybe coffee");
    });

    act(() => {
      useAIQuickEntryStore.getState().setOpen(false);
    });

    await act(async () => {
      parseResponse.resolve({
        status: 200,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: {
            status: "fallback",
            originalInput: "maybe coffee",
            prefill: {
              note: "maybe coffee",
              amount: 35000,
              date: "30/05/2026",
              budgetId: null,
            },
            reason: "no_budget_match",
          },
        }),
      });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(createExpenseMock).not.toHaveBeenCalled();

    openOverlay();
    fireEvent.click(screen.getByLabelText(/Open preview/));

    expect(screen.getByText("Needs review")).toBeInTheDocument();
    expect(screen.getByText("maybe coffee")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /Review expense maybe coffee.*35\.000/,
      })
    ).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the new focused tests**

Run:

```bash
rtk bunx vitest run src/components/AIQuickEntry.test.tsx --testNamePattern "while closed"
```

Expected: PASS if Task 2 implemented all close-independent transitions correctly. If this fails because `waitFor` cannot observe a closed component, the implementation still needs store-backed entries, not component-local state.

- [ ] **Step 3: Add create-failure-while-closed test**

In `src/components/AIQuickEntry.test.tsx`, after the existing `"moves a create failure to needs review with the parsed draft"` test, add:

```tsx
  it("moves a create failure to needs review while closed", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    createExpenseMock.mockRejectedValue(new Error("create failed"));
    const parseResponse = mockDeferredParseResponse();
    renderQuickEntry();
    openOverlay();

    act(() => {
      typeAndSend("cf 35k");
    });

    act(() => {
      useAIQuickEntryStore.getState().setOpen(false);
    });

    await act(async () => {
      parseResponse.resolve({
        status: 200,
        json: vi
          .fn()
          .mockResolvedValue({ success: true, data: trustedParseResponse }),
      });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(createExpenseMock).toHaveBeenCalledTimes(1));

    openOverlay();
    fireEvent.click(screen.getByLabelText(/Open preview/));

    expect(screen.getByText("Needs review")).toBeInTheDocument();
    expect(screen.getByText("Cà phê sữa đá")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /Review expense Cà phê sữa đá.*35\.000/,
      })
    ).toBeInTheDocument();

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.any(Error));
    consoleErrorSpy.mockRestore();
  });
```

- [ ] **Step 4: Run the create-failure focused test**

Run:

```bash
rtk bunx vitest run src/components/AIQuickEntry.test.tsx --testNamePattern "moves a create failure to needs review while closed"
```

Expected: PASS.

- [ ] **Step 5: Ensure review-needed rows still open the nested drawer after closed completion**

In the fallback-while-closed test from Step 1, append:

```tsx
    fireEvent.click(
      screen.getByRole("button", {
        name: /Review expense maybe coffee.*35\.000/,
      })
    );

    expect(screen.getByTestId("quick-expense-drawer")).toHaveAttribute(
      "data-mode",
      "create"
    );
    expect(quickExpenseDrawerPropsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        open: true,
        mode: "create",
        transactionId: undefined,
        initialExpenseKey: expect.stringMatching(/^review:/),
        initialExpense: expect.objectContaining({
          note: "maybe coffee",
          amount: 35000,
        }),
      })
    );
```

- [ ] **Step 6: Run the fallback-while-closed test**

Run:

```bash
rtk bunx vitest run src/components/AIQuickEntry.test.tsx --testNamePattern "moves a fallback parse to needs review while closed"
```

Expected: PASS.

- [ ] **Step 7: Format and lint AI quick entry files**

Run:

```bash
rtk bunx prettier --write src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx
rtk bunx prettier --check src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx
rtk bunx eslint src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx
```

Expected: all commands PASS.

- [ ] **Step 8: Commit closed-completion coverage**

Run:

```bash
rtk git add src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx
rtk git commit -m "test(ai-quick-entry): cover closed job completion"
```

Expected: commit succeeds.

## Task 4: Preserve Queue But Reset View Chrome On Reopen

**Files:**
- Modify: `src/components/AIQuickEntry.test.tsx`
- Modify: `src/components/AIQuickEntry.tsx`

- [ ] **Step 1: Replace the old clears-on-reopen test**

In `src/components/AIQuickEntry.test.tsx`, replace the test named `"clears entries when reopened"` with:

```tsx
  it("keeps entries when reopened but returns to entry mode", async () => {
    mockParseResponse({
      status: "fallback",
      originalInput: "first",
      prefill: { note: "first", amount: 0, budgetId: null },
      reason: "no_budget_match",
    });
    renderQuickEntry();
    openOverlay();

    act(() => {
      typeAndSend("first");
    });
    await waitFor(() =>
      expect(screen.getByTestId("ai-status-failed-count")).toHaveTextContent(
        "1"
      )
    );

    fireEvent.click(screen.getByLabelText(/Open preview/));
    expect(screen.getByText("AI Quick Entry")).toBeInTheDocument();

    act(() => {
      useAIQuickEntryStore.getState().setOpen(false);
    });
    openOverlay();

    expect(screen.getByLabelText("Describe your expense")).toBeInTheDocument();
    expect(screen.queryByText("AI Quick Entry")).not.toBeInTheDocument();
    expect(screen.getByTestId("ai-status-failed-count")).toHaveTextContent("1");

    fireEvent.click(screen.getByLabelText(/Open preview/));
    expect(screen.getByText("Needs review")).toBeInTheDocument();
    expect(screen.getByText("first")).toBeInTheDocument();
  });
```

- [ ] **Step 2: Add nested drawer selection close/reset test**

In `src/components/AIQuickEntry.test.tsx`, after the new keeps-entries test, add:

```tsx
  it("clears nested drawer selection on close without clearing review entries", async () => {
    mockParseResponse({
      status: "fallback",
      originalInput: "maybe coffee",
      prefill: {
        note: "maybe coffee",
        amount: 35000,
        date: "30/05/2026",
        budgetId: null,
      },
      reason: "no_budget_match",
    });
    renderQuickEntry();
    openOverlay();

    act(() => {
      typeAndSend("maybe coffee");
    });

    await waitFor(() =>
      expect(screen.getByTestId("ai-status-failed-count")).toHaveTextContent(
        "1"
      )
    );
    fireEvent.click(screen.getByLabelText(/Open preview/));
    fireEvent.click(
      screen.getByRole("button", {
        name: /Review expense maybe coffee.*35\.000/,
      })
    );

    expect(screen.getByTestId("quick-expense-drawer")).toHaveAttribute(
      "data-open",
      "true"
    );

    act(() => {
      useAIQuickEntryStore.getState().setOpen(false);
    });
    openOverlay();

    expect(screen.getByTestId("quick-expense-drawer")).toHaveAttribute(
      "data-open",
      "false"
    );
    expect(screen.getByTestId("ai-status-failed-count")).toHaveTextContent("1");
  });
```

- [ ] **Step 3: Run the focused lifecycle tests**

Run:

```bash
rtk bunx vitest run src/components/AIQuickEntry.test.tsx --testNamePattern "keeps entries when reopened|clears nested drawer selection"
```

Expected: PASS. If it fails because preview remains open after reopening, keep `setMode("entry")` in the `open === true` branch. If it fails because the queue is empty, verify no `clearEntries` call runs on open/close.

- [ ] **Step 4: Remove dead code from `AIQuickEntry.tsx`**

Inspect `src/components/AIQuickEntry.tsx` and remove imports or declarations that became unused after Tasks 2 and 3:

```tsx
// Remove these if they are unused:
const createEntryId = ...
const sessionRef = ...
const openRef = ...
const isCurrentSession = ...
const setEntries = ...
```

The import list should still include React hooks actually used by the file:

```tsx
import React, {
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
```

- [ ] **Step 5: Run full AI quick entry component tests**

Run:

```bash
rtk bunx vitest run src/components/AIQuickEntry.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Format and lint AI quick entry files**

Run:

```bash
rtk bunx prettier --write src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx
rtk bunx prettier --check src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx
rtk bunx eslint src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx
```

Expected: all commands PASS.

- [ ] **Step 7: Commit lifecycle reset behavior**

Run:

```bash
rtk git add src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx
rtk git commit -m "fix(ai-quick-entry): preserve queue across reopen"
```

Expected: commit succeeds.

## Task 5: Final Scope Validation

**Files:**
- Verify: `src/components/AIQuickEntry.tsx`
- Verify: `src/components/AIQuickEntry.test.tsx`
- Verify: `src/stores/ai-quick-entry-store.ts`
- Verify: `src/stores/ai-quick-entry-store.test.ts`

- [ ] **Step 1: Run all directly affected tests**

Run:

```bash
rtk bunx vitest run src/stores/ai-quick-entry-store.test.ts src/components/AIQuickEntry.test.tsx src/components/ai-quick-entry/AIQuickEntryPendingQueue.test.tsx src/components/ai-quick-entry/AIQuickEntryStatusBar.test.tsx src/components/ai-quick-entry/AIQuickEntryPreview.test.tsx src/components/ai-quick-entry/AIQuickEntryRow.test.tsx src/components/ai-quick-entry/real-parse.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run required formatting and ESLint checks for all modified `.ts` and `.tsx` files**

Run:

```bash
rtk bunx prettier --write src/stores/ai-quick-entry-store.ts src/stores/ai-quick-entry-store.test.ts src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx
rtk bunx prettier --check src/stores/ai-quick-entry-store.ts src/stores/ai-quick-entry-store.test.ts src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx
rtk bunx eslint src/stores/ai-quick-entry-store.ts src/stores/ai-quick-entry-store.test.ts src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx
```

Expected: all commands PASS.

- [ ] **Step 3: Search for stale close-session behavior**

Run:

```bash
rtk rg -n "sessionRef|openRef|isCurrentSession|setEntries\\(|clears entries when reopened|ignores stale parse results" src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx
```

Expected: no matches for `sessionRef`, `openRef`, `isCurrentSession`, `setEntries(`, `"clears entries when reopened"`, or `"ignores stale parse results"`.

- [ ] **Step 4: Confirm the store is still non-persisted**

Run:

```bash
rtk sed -n '1,220p' src/stores/ai-quick-entry-store.ts
```

Expected: `create` from `zustand` is used directly, and there is no `persist`, `createJSONStorage`, `localStorage`, or `sessionStorage`.

- [ ] **Step 5: Commit final validation fixes if any were needed**

If Step 1 through Step 4 required no edits, skip this step. If edits were needed, run:

```bash
rtk git add src/stores/ai-quick-entry-store.ts src/stores/ai-quick-entry-store.test.ts src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx
rtk git commit -m "chore(ai-quick-entry): finish background job validation"
```

Expected: commit succeeds only if there are staged changes.

## Manual Smoke

- [ ] Open the app on an iPhone 13/14 viewport.
- [ ] Open AI quick entry.
- [ ] Submit a trusted parse such as `cf 35k`, immediately close the drawer, wait, reopen, and confirm the saved entry appears in preview.
- [ ] Submit an ambiguous/fallback entry, immediately close the drawer, wait, reopen, and confirm the entry appears under needs review.
- [ ] Open a needs-review row, close the AI drawer, reopen, and confirm the nested `QuickExpenseDrawer` is closed while the needs-review row remains.

## Self-Review

- Spec coverage:
  - Close hides only: Task 2 and Task 4.
  - Active parse/save continues after close: Task 2 and Task 3.
  - Saved/review entries preserved across runtime reopen: Task 3 and Task 4.
  - Existing local-first mutation boundary unchanged: Task 2 uses `createExpense(decision.payload)` as before; Task 5 verifies affected scope only.
  - Nested `QuickExpenseDrawer` flow preserved: Task 3 and Task 4.
  - No reload persistence or abort-on-close: Task 1 uses plain Zustand and Task 5 verifies no persistence.
- Placeholder scan: no `TBD`, `TODO`, "similar to", or unspecified test steps remain.
- Type consistency:
  - Store actions use `QuickEntry`, `TQuickExpenseDrawerInitialExpense`, `AIQuickEntryReviewReason`, and `QuickEntry["savedExpense"]`.
  - Component transitions call `enqueueEntry`, `markEntrySaving`, `markEntrySaved`, and `markEntryForReviewInStore`, matching the store API from Task 1. `markEntryParsing` is covered by store tests and available for future explicit retry/reset flows, but normal first submission enters parsing through `enqueueEntry`.
