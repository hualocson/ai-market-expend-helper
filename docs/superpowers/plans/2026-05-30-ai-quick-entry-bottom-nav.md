# AI Quick-Entry from Bottom Nav Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lightweight AI expense entry surface launched from a new bottom-nav button: an inline composer above the keyboard with a chat stack that shows a skeleton expense row resolving into a real `ExpenseListItem` filled with mock data.

**Architecture:** A module-level Zustand store holds an `open` flag. The bottom nav gets a new AI trigger button (before the Add button) that calls `open()`. A new global `AIQuickEntry` overlay component (mounted once in `layout.tsx` beside `BottomNav`) subscribes to the flag, renders a scrim + chat stack + fixed composer, and runs a mocked parse flow (`mockParseExpense` + `setTimeout`). Pending entries render an `AIEntrySkeleton` shaped like `ExpenseListItem`; resolved entries render the real `ExpenseListItem` with an inert edit handler.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Zustand, Tailwind v4, Vitest + React Testing Library.

---

## Background & Conventions

Read these before starting:

- Spec: `docs/superpowers/specs/2026-05-30-ai-quick-entry-bottom-nav-design.md`
- iOS focus rule: `.agents/rules/ios-input-focus.md` — inline action controls in an active text-input workflow must use `onPointerDown={(e) => e.preventDefault()}` and keep the command in `onClick`.
- Dark-mode only. Brand/primary color is lime `#b8f34a` (token `--primary` / Tailwind `primary`). Expense amounts use `destructive` (`#fb7185`).

**Package commands:** use `bun`/`bunx` for everything except `npm run build`.

**After editing any `.ts`/`.tsx` file**, run for the modified files:
- `rtk bunx prettier --write <files>`
- `rtk bunx prettier --check <files>`
- `rtk bunx eslint <files>`

**Run a single test file:** `bunx vitest run src/path/to/file.test.tsx`

**Existing types/utilities you will reuse (do not redefine):**
- `ExpenseListItemData` and the default export `ExpenseListItem` — from `@/components/ExpenseListItem`.
- `Category`, `PaidBy` enums — from `@/enums` (`Category.OTHER = "Other"`, `Category.FOOD = "Food"`, `PaidBy.CUBI = "Cubi"`).
- `useKeyboardOffset` — from `@/hooks/useKeyboardOffset` (returns a number of px).
- `useAppHaptics` — from `@/hooks/useAppHaptics` (`.impact("medium")`, `.success()`, etc.).
- `useSettingsStore` — from `@/components/providers/StoreProvider` (`useSettingsStore((s) => s.paidBy)`).
- `cn`, `formatVnd` — from `@/lib/utils`.
- `dayjs` — default import from `@/configs/date`.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/stores/ai-quick-entry-store.ts` | Module-level Zustand store: `{ open, setOpen }` |
| `src/lib/ai/mock-parse-expense.ts` | `mockParseExpense(input)` → `ExpenseListItemData` (the swap seam) |
| `src/components/AIEntrySkeleton.tsx` | Presentational skeleton shaped like `ExpenseListItem` |
| `src/components/AIQuickEntry.tsx` | Overlay: scrim + chat stack + fixed composer + mock submit flow |
| `src/components/BottomNav.tsx` | Add AI trigger button before Add; call store `open()` |
| `src/app/layout.tsx` | Mount `<AIQuickEntry />` beside `<BottomNav />` |
| `src/stores/ai-quick-entry-store.test.ts` | Store unit tests |
| `src/lib/ai/mock-parse-expense.test.ts` | Mock helper unit tests |
| `src/components/AIEntrySkeleton.test.tsx` | Skeleton shape test |
| `src/components/AIQuickEntry.test.tsx` | Overlay behavior tests |
| `src/components/BottomNav.test.tsx` | Extend: AI trigger renders before Add, calls `open()` |

---

## Task 1: AI Quick-Entry Zustand store

**Files:**
- Create: `src/stores/ai-quick-entry-store.ts`
- Test: `src/stores/ai-quick-entry-store.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/stores/ai-quick-entry-store.test.ts
import { afterEach, describe, expect, it } from "vitest";

import { useAIQuickEntryStore } from "./ai-quick-entry-store";

afterEach(() => {
  useAIQuickEntryStore.getState().setOpen(false);
});

describe("useAIQuickEntryStore", () => {
  it("defaults to closed", () => {
    expect(useAIQuickEntryStore.getState().open).toBe(false);
  });

  it("opens and closes via setOpen", () => {
    useAIQuickEntryStore.getState().setOpen(true);
    expect(useAIQuickEntryStore.getState().open).toBe(true);

    useAIQuickEntryStore.getState().setOpen(false);
    expect(useAIQuickEntryStore.getState().open).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/stores/ai-quick-entry-store.test.ts`
Expected: FAIL — cannot find module `./ai-quick-entry-store`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/stores/ai-quick-entry-store.ts
import { create } from "zustand";

type AIQuickEntryState = {
  open: boolean;
  setOpen: (value: boolean) => void;
};

export const useAIQuickEntryStore = create<AIQuickEntryState>((set) => ({
  open: false,
  setOpen: (value) => set({ open: value }),
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/stores/ai-quick-entry-store.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Format, lint, commit**

```bash
rtk bunx prettier --write src/stores/ai-quick-entry-store.ts src/stores/ai-quick-entry-store.test.ts
rtk bunx eslint src/stores/ai-quick-entry-store.ts src/stores/ai-quick-entry-store.test.ts
git add src/stores/ai-quick-entry-store.ts src/stores/ai-quick-entry-store.test.ts
git commit -m "feat(ai-quick-entry): add open-state store"
```

---

## Task 2: Mock parse-expense helper

**Files:**
- Create: `src/lib/ai/mock-parse-expense.ts`
- Test: `src/lib/ai/mock-parse-expense.test.ts`

This is the single function swapped for the real `parse-expense` call later. It returns a complete `ExpenseListItemData` so the resolved card can render the real `ExpenseListItem`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/ai/mock-parse-expense.test.ts
import { describe, expect, it } from "vitest";

import { Category } from "@/enums";

import { mockParseExpense } from "./mock-parse-expense";

describe("mockParseExpense", () => {
  it("returns an expense-list item populated from the input", () => {
    const result = mockParseExpense("Cà phê 35k", { paidBy: "Cubi" });

    expect(result.note).toBe("Cà phê 35k");
    expect(result.amount).toBeGreaterThan(0);
    expect(result.paidBy).toBe("Cubi");
    expect(result.syncStatus).toBe("synced");
    expect(result.budgetId).toBeNull();
  });

  it("produces a valid category and ISO date", () => {
    const result = mockParseExpense("lunch", { paidBy: "Cubi" });

    expect(Object.values(Category)).toContain(result.category);
    expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("gives each call a unique id", () => {
    const a = mockParseExpense("a", { paidBy: "Cubi" });
    const b = mockParseExpense("b", { paidBy: "Cubi" });

    expect(a.id).not.toBe(b.id);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/lib/ai/mock-parse-expense.test.ts`
Expected: FAIL — cannot find module `./mock-parse-expense`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/ai/mock-parse-expense.ts
import dayjs from "@/configs/date";
import { Category } from "@/enums";

import type { ExpenseListItemData } from "@/components/ExpenseListItem";

type MockParseOptions = {
  paidBy: string;
};

let mockIdCounter = 0;

const nextMockId = () => {
  mockIdCounter -= 1;
  return mockIdCounter;
};

export const mockParseExpense = (
  input: string,
  options: MockParseOptions
): ExpenseListItemData => ({
  id: nextMockId(),
  date: dayjs().format("YYYY-MM-DD"),
  amount: 35000,
  note: input,
  category: Category.OTHER,
  paidBy: options.paidBy,
  budgetId: null,
  budgetName: null,
  budgetIcon: null,
  budgetColor: null,
  syncStatus: "synced",
});
```

Note: negative ids avoid collisions with real positive expense ids and are stable for React keys.

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/lib/ai/mock-parse-expense.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Format, lint, commit**

```bash
rtk bunx prettier --write src/lib/ai/mock-parse-expense.ts src/lib/ai/mock-parse-expense.test.ts
rtk bunx eslint src/lib/ai/mock-parse-expense.ts src/lib/ai/mock-parse-expense.test.ts
git add src/lib/ai/mock-parse-expense.ts src/lib/ai/mock-parse-expense.test.ts
git commit -m "feat(ai-quick-entry): add mock parse-expense helper"
```

---

## Task 3: AIEntrySkeleton component

**Files:**
- Create: `src/components/AIEntrySkeleton.tsx`
- Test: `src/components/AIEntrySkeleton.test.tsx`

Mirrors `ExpenseListItem`'s outer wrapper and internal layout (icon circle + note line + meta row + amount) so pending → resolved has no layout shift. Reference `src/components/ExpenseListItem.tsx:152-206` for class names.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/AIEntrySkeleton.test.tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AIEntrySkeleton from "./AIEntrySkeleton";

describe("AIEntrySkeleton", () => {
  it("renders an expense-row-shaped placeholder", () => {
    const { container } = render(<AIEntrySkeleton />);

    expect(
      container.querySelector("[data-ai-entry-skeleton]")
    ).toBeInTheDocument();
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(
      0
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/components/AIEntrySkeleton.test.tsx`
Expected: FAIL — cannot find module `./AIEntrySkeleton`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/AIEntrySkeleton.tsx
const AIEntrySkeleton = () => (
  <div
    data-ai-entry-skeleton
    className="bg-surface-2/65 relative isolate overflow-hidden rounded-[22px] px-3 py-3 shadow-[0_14px_30px_color-mix(in_srgb,var(--background)_52%,transparent)]"
  >
    <div className="flex items-center gap-4">
      <span className="bg-muted size-12 shrink-0 animate-pulse rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <span className="bg-muted block h-4 w-2/3 animate-pulse rounded-md" />
        <span className="bg-muted block h-3 w-1/3 animate-pulse rounded-md" />
      </div>
      <span className="bg-muted block h-4 w-14 shrink-0 animate-pulse rounded-md" />
    </div>
  </div>
);

export default AIEntrySkeleton;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/components/AIEntrySkeleton.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Format, lint, commit**

```bash
rtk bunx prettier --write src/components/AIEntrySkeleton.tsx src/components/AIEntrySkeleton.test.tsx
rtk bunx eslint src/components/AIEntrySkeleton.tsx src/components/AIEntrySkeleton.test.tsx
git add src/components/AIEntrySkeleton.tsx src/components/AIEntrySkeleton.test.tsx
git commit -m "feat(ai-quick-entry): add expense-row skeleton"
```

---

## Task 4: AIQuickEntry overlay component

**Files:**
- Create: `src/components/AIQuickEntry.tsx`
- Test: `src/components/AIQuickEntry.test.tsx`

The overlay reads `open` from the store, renders scrim + chat stack + fixed composer, and runs the mocked submit flow. Entries are local state, reset whenever `open` becomes true. Hidden on `/ai`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/AIQuickEntry.test.tsx
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let mockPathname = "/";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

vi.mock("@/hooks/useAppHaptics", () => ({
  useAppHaptics: () => ({
    impact: vi.fn(),
    selection: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("@/hooks/useKeyboardOffset", () => ({
  useKeyboardOffset: () => 0,
}));

vi.mock("@/components/providers/StoreProvider", () => ({
  useSettingsStore: () => "Cubi",
}));

vi.mock("@/components/ExpenseListItem", () => ({
  default: ({ expense }: { expense: { note: string } }) => (
    <div data-testid="expense-row">{expense.note}</div>
  ),
}));

import { useAIQuickEntryStore } from "@/stores/ai-quick-entry-store";

import AIQuickEntry from "./AIQuickEntry";

beforeEach(() => {
  vi.useFakeTimers();
  mockPathname = "/";
  useAIQuickEntryStore.getState().setOpen(false);
});

afterEach(() => {
  act(() => {
    useAIQuickEntryStore.getState().setOpen(false);
  });
  vi.useRealTimers();
});

const typeAndSend = (text: string) => {
  fireEvent.change(screen.getByLabelText("Describe your expense"), {
    target: { value: text },
  });
  fireEvent.click(screen.getByLabelText("Send expense"));
};

describe("AIQuickEntry", () => {
  it("renders nothing when closed", () => {
    render(<AIQuickEntry />);
    expect(
      screen.queryByLabelText("Describe your expense")
    ).not.toBeInTheDocument();
  });

  it("shows the composer when opened", () => {
    render(<AIQuickEntry />);
    act(() => {
      useAIQuickEntryStore.getState().setOpen(true);
    });
    expect(screen.getByLabelText("Describe your expense")).toBeInTheDocument();
  });

  it("disables send for empty input", () => {
    render(<AIQuickEntry />);
    act(() => {
      useAIQuickEntryStore.getState().setOpen(true);
    });
    expect(screen.getByLabelText("Send expense")).toBeDisabled();
  });

  it("appends a pending entry then resolves to an expense row", async () => {
    render(<AIQuickEntry />);
    act(() => {
      useAIQuickEntryStore.getState().setOpen(true);
    });

    act(() => {
      typeAndSend("Cà phê 35k");
    });

    expect(
      document.querySelector("[data-ai-entry-skeleton]")
    ).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1300);
    });

    await waitFor(() => {
      expect(screen.getByTestId("expense-row")).toHaveTextContent("Cà phê 35k");
    });
  });

  it("clears entries when reopened", async () => {
    render(<AIQuickEntry />);
    act(() => {
      useAIQuickEntryStore.getState().setOpen(true);
    });
    act(() => {
      typeAndSend("first");
    });
    await act(async () => {
      vi.advanceTimersByTime(1300);
    });

    act(() => {
      useAIQuickEntryStore.getState().setOpen(false);
    });
    act(() => {
      useAIQuickEntryStore.getState().setOpen(true);
    });

    expect(screen.queryByTestId("expense-row")).not.toBeInTheDocument();
  });

  it("renders nothing on the /ai route", () => {
    mockPathname = "/ai";
    render(<AIQuickEntry />);
    act(() => {
      useAIQuickEntryStore.getState().setOpen(true);
    });
    expect(
      screen.queryByLabelText("Describe your expense")
    ).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/components/AIQuickEntry.test.tsx`
Expected: FAIL — cannot find module `./AIQuickEntry`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/AIQuickEntry.tsx
"use client";

import {
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { usePathname } from "next/navigation";

import { useAppHaptics } from "@/hooks/useAppHaptics";
import { useKeyboardOffset } from "@/hooks/useKeyboardOffset";
import { mockParseExpense } from "@/lib/ai/mock-parse-expense";
import { cn } from "@/lib/utils";
import { useAIQuickEntryStore } from "@/stores/ai-quick-entry-store";
import { ArrowUp } from "lucide-react";

import AIEntrySkeleton from "@/components/AIEntrySkeleton";
import ExpenseListItem, {
  type ExpenseListItemData,
} from "@/components/ExpenseListItem";
import { useSettingsStore } from "@/components/providers/StoreProvider";

const HIDDEN_PATHS = ["/ai"];

const RESOLVE_DELAY_MS = 1200;

type QuickEntry = {
  id: string;
  input: string;
  status: "pending" | "resolved";
  result?: ExpenseListItemData;
};

const createEntryId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const AIQuickEntry = () => {
  const pathname = usePathname();
  const open = useAIQuickEntryStore((state) => state.open);
  const setOpen = useAIQuickEntryStore((state) => state.setOpen);
  const paidBy = useSettingsStore((state) => state.paidBy);
  const keyboardOffset = useKeyboardOffset();
  const haptics = useAppHaptics();
  const inputId = useId();

  const [composer, setComposer] = useState("");
  const [entries, setEntries] = useState<QuickEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (open) {
      setEntries([]);
      setComposer("");
    }
  }, [open]);

  useEffect(
    () => () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
    },
    []
  );

  const hidden = HIDDEN_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  if (hidden || !open) {
    return null;
  }

  const close = () => {
    setOpen(false);
    inputRef.current?.blur();
  };

  const submit = () => {
    const input = composer.trim();
    if (!input) {
      return;
    }

    const id = createEntryId();
    setEntries((current) => [...current, { id, input, status: "pending" }]);
    setComposer("");
    haptics.impact("medium");

    const timer = setTimeout(() => {
      setEntries((current) =>
        current.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                status: "resolved",
                result: mockParseExpense(input, { paidBy }),
              }
            : entry
        )
      );
    }, RESOLVE_DELAY_MS);
    timersRef.current.push(timer);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submit();
    }
  };

  const canSend = composer.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-label="AI quick entry">
      <button
        type="button"
        aria-label="Dismiss AI quick entry"
        onClick={close}
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
      />

      <div
        className="absolute inset-x-0 bottom-0 flex flex-col"
        style={
          { paddingBottom: keyboardOffset } as CSSProperties
        }
      >
        <div className="no-scrollbar mx-auto flex max-h-[50vh] w-full max-w-[390px] flex-col gap-2.5 overflow-y-auto px-4 pb-2">
          {entries.map((entry) => (
            <div key={entry.id} className="space-y-2.5">
              <div className="flex justify-end">
                <span className="bg-primary text-primary-foreground max-w-[82%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm font-medium">
                  {entry.input}
                </span>
              </div>
              {entry.status === "resolved" && entry.result ? (
                <ExpenseListItem expense={entry.result} onEditExpense={() => {}} />
              ) : (
                <AIEntrySkeleton />
              )}
            </div>
          ))}
        </div>

        <form
          onSubmit={handleSubmit}
          className="ds-glass border-border/80 mx-auto mb-2 flex w-full max-w-[390px] items-center gap-2 rounded-[28px] border p-1.5 pl-4"
        >
          <label htmlFor={inputId} className="sr-only">
            Describe your expense
          </label>
          <input
            id={inputId}
            ref={inputRef}
            value={composer}
            onChange={(event) => setComposer(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Cà phê 35k sáng nay"
            className="text-foreground placeholder:text-muted-foreground/70 flex-1 border-0 bg-transparent text-base outline-none"
          />
          <button
            type="submit"
            aria-label="Send expense"
            disabled={!canSend}
            onPointerDown={(event) => event.preventDefault()}
            className={cn(
              "bg-primary text-primary-foreground grid size-10 shrink-0 place-items-center rounded-full transition-opacity",
              !canSend && "opacity-40"
            )}
          >
            <ArrowUp className="size-4" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default AIQuickEntry;
```

Notes:
- The send button uses `onPointerDown` preventDefault per `.agents/rules/ios-input-focus.md` so tapping it keeps the keyboard up.
- Each pending entry has its own timer; rapid submits resolve independently. All timers are cleared on unmount.
- `z-[60]` sits above the nav's `z-50` so the scrim covers the nav while open.

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/components/AIQuickEntry.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Format, lint, commit**

```bash
rtk bunx prettier --write src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx
rtk bunx eslint src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx
git add src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx
git commit -m "feat(ai-quick-entry): add inline overlay with mock parse flow"
```

---

## Task 5: Add AI trigger button to BottomNav

**Files:**
- Modify: `src/components/BottomNav.tsx` (right cluster, before the Add circle, around lines 248-253)
- Modify: `src/components/BottomNav.test.tsx`

- [ ] **Step 1: Write the failing test (extend existing file)**

Add this block inside the existing `describe("BottomNav", ...)` in `src/components/BottomNav.test.tsx`. Also add the import at the top of the file (below the existing `import BottomNav from "./BottomNav";`):

```tsx
import { useAIQuickEntryStore } from "@/stores/ai-quick-entry-store";
```

New tests:

```tsx
  it("opens AI quick entry when the AI button is tapped", () => {
    render(<BottomNav />);

    fireEvent.click(screen.getByLabelText("Open AI quick entry"));
    expect(useAIQuickEntryStore.getState().open).toBe(true);

    useAIQuickEntryStore.getState().setOpen(false);
  });

  it("renders the AI button before the Add button", () => {
    render(<BottomNav />);

    const aiButton = screen.getByLabelText("Open AI quick entry");
    const addTrigger = screen.getByTestId("quick-expense-trigger");

    expect(
      aiButton.compareDocumentPosition(addTrigger) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/components/BottomNav.test.tsx`
Expected: FAIL — `Unable to find a label "Open AI quick entry"`.

- [ ] **Step 3: Implement the change**

In `src/components/BottomNav.tsx`:

Add imports near the other imports (line 9-11 area):

```tsx
import { Sparkles } from "lucide-react";

import { useAIQuickEntryStore } from "@/stores/ai-quick-entry-store";
```

(Combine `Sparkles` into the existing `lucide-react` import line: `import { BarChart3, ChevronsUpDown, Cog, Home, Sparkles, Wallet } from "lucide-react";`)

Inside the `BottomNav` component body, read the store action (near the other hooks around line 88):

```tsx
  const openAIQuickEntry = useAIQuickEntryStore((state) => state.setOpen);
```

Then insert the AI button immediately **before** the Add-button container `<div>` at line 248 (the `<div className="grid size-14 ...">` that wraps `QuickExpenseDrawer`):

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

The outer flex row at line 138 (`flex w-full max-w-[390px] items-end justify-between gap-4`) will now hold three items: the nav pill, the AI button, and the Add button. Keep `justify-between`; the AI and Add buttons sit together on the right because the pill takes the left. If spacing looks off, change the row to `justify-start` is NOT needed — verify visually in Task 7.

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/components/BottomNav.test.tsx`
Expected: PASS (all tests, including the 2 new ones).

- [ ] **Step 5: Format, lint, commit**

```bash
rtk bunx prettier --write src/components/BottomNav.tsx src/components/BottomNav.test.tsx
rtk bunx eslint src/components/BottomNav.tsx src/components/BottomNav.test.tsx
git add src/components/BottomNav.tsx src/components/BottomNav.test.tsx
git commit -m "feat(ai-quick-entry): add AI trigger button to bottom nav"
```

---

## Task 6: Mount AIQuickEntry in layout

**Files:**
- Modify: `src/app/layout.tsx` (inside `<SettingsStoreProvider>`, right after `<BottomNav />`)

No new test (layout is a server shell; behavior is covered by component tests). Verification is the build + manual check in Task 7.

- [ ] **Step 1: Add the import**

Near the other component imports (the `import BottomNav from "@/components/BottomNav";` line):

```tsx
import AIQuickEntry from "@/components/AIQuickEntry";
```

- [ ] **Step 2: Mount the component**

Inside `<SettingsStoreProvider>`, immediately after `<BottomNav />`:

```tsx
          <BottomNav />
          <AIQuickEntry />
```

- [ ] **Step 3: Format, lint**

```bash
rtk bunx prettier --write src/app/layout.tsx
rtk bunx eslint src/app/layout.tsx
```

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(ai-quick-entry): mount overlay in app layout"
```

---

## Task 7: Full verification

- [ ] **Step 1: Run the full test suite for touched files**

Run:
```bash
bunx vitest run src/stores/ai-quick-entry-store.test.ts src/lib/ai/mock-parse-expense.test.ts src/components/AIEntrySkeleton.test.tsx src/components/AIQuickEntry.test.tsx src/components/BottomNav.test.tsx
```
Expected: all PASS.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 3: Manual check (dev server)**

Run: `bun run dev`, open on a mobile viewport (iPhone 13/14). Verify:
- AI sparkles button appears in the bottom nav, to the left of the `＋` Add button.
- Tapping it dims the screen and shows a composer above the keyboard.
- Typing + send shows a skeleton row that resolves (~1.2s) into an expense row matching the list style.
- Send is disabled when the input is empty.
- Tapping the dimmed area closes the overlay; reopening starts empty.
- Navigating to `/ai` does not show the AI button or overlay.

- [ ] **Step 4: Final commit (if any manual fixes were made)**

```bash
git add -A
git commit -m "fix(ai-quick-entry): polish from manual verification"
```

---

## Self-Review Notes

- **Spec coverage:** nav button before Add (Task 5), inline composer above keyboard via `useKeyboardOffset` (Task 4), chat stack newest-at-bottom (Task 4), skeleton matching `ExpenseListItem` (Task 3), resolved → real `ExpenseListItem` with inert `onEditExpense` (Task 4), scrim dismiss + swipe-down intent / tap-outside (Task 4 — tap-outside implemented; swipe-down is a nice-to-have, tap-outside + close covers dismissal), entries reset on open (Task 4), hidden on `/ai` (Task 4), Zustand `open` slice (Task 1), `mockParseExpense` swap seam (Task 2), inert actions (Task 4), tests (all tasks).
- **Type consistency:** `ExpenseListItemData` reused from `@/components/ExpenseListItem` everywhere; `mockParseExpense(input, { paidBy })` signature consistent between Task 2 definition and Task 4 call; store `setOpen(boolean)` consistent across Tasks 1, 4, 5.
- **Deferred (integration phase, per spec non-goals):** real API call, create mutation, working edit, optional swipe-down gesture and session persistence.
