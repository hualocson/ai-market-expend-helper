# AI Quick Entry Preview Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the keyboard-open AI Quick Entry stack/expanded list with a capped plain pending queue and add an inspection-only Preview Mode.

**Architecture:** Keep `AIQuickEntry.tsx` as the local session owner. Split display responsibilities into a capped pending queue component for Entry Mode and a preview component for inspection. Resolved entries leave the pending queue and trigger a Sonner success toast instead of rendering as active resolved rows.

**Tech Stack:** Next.js 15 App Router, React 19, Zustand, Tailwind v4, Sonner, Vitest, Testing Library.

---

## File Structure

- Create: `src/components/ai-quick-entry/AIQuickEntryPendingQueue.tsx`
  - Capped plain pending queue.
  - Renders up to two newest pending rows plus one overflow row.
  - Opens Preview Mode when a row or overflow is tapped.

- Create: `src/components/ai-quick-entry/AIQuickEntryPendingQueue.test.tsx`
  - Unit tests for empty, one-row, two-row, overflow, ordering, and tap behavior.

- Create: `src/components/ai-quick-entry/AIQuickEntryPreview.tsx`
  - Inspection-only preview surface.
  - Shows pending, completed, and failed sections.
  - Owns scrollable list, bottom blur, and bottom `X` Done control.

- Create: `src/components/ai-quick-entry/AIQuickEntryPreview.test.tsx`
  - Unit tests for section rendering, empty-section hiding, row variants, and Done behavior.

- Modify: `src/components/AIQuickEntry.tsx`
  - Add `mode: "entry" | "preview"`.
  - Replace `AIQuickEntryPendingStack` with `AIQuickEntryPendingQueue`.
  - Render `AIQuickEntryPreview` in Preview Mode.
  - Replace active resolved row timers with success toasts.
  - Refocus composer after returning from Preview Mode.

- Modify: `src/components/AIQuickEntry.test.tsx`
  - Update integration expectations from stack/expanded behavior to queue/preview behavior.
  - Mock `sonner` and assert resolved toast behavior.

- Delete: `src/components/ai-quick-entry/AIQuickEntryPendingStack.tsx`
- Delete: `src/components/ai-quick-entry/AIQuickEntryPendingStack.test.tsx`

---

### Task 1: Add Plain Pending Queue Component

**Files:**
- Create: `src/components/ai-quick-entry/AIQuickEntryPendingQueue.tsx`
- Create: `src/components/ai-quick-entry/AIQuickEntryPendingQueue.test.tsx`
- Uses: `src/components/ai-quick-entry/AIQuickEntryRow.tsx`
- Uses: `src/components/ai-quick-entry/types.ts`

- [ ] **Step 1: Write the failing queue tests**

Create `src/components/ai-quick-entry/AIQuickEntryPendingQueue.test.tsx`:

```tsx
import React from "react";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AIQuickEntryPendingQueue from "./AIQuickEntryPendingQueue";
import type { QuickEntry } from "./types";

const pending = (id: string, input: string): QuickEntry => ({
  id,
  input,
  status: "pending",
});

describe("AIQuickEntryPendingQueue", () => {
  it("renders nothing with no pending entries", () => {
    const { container } = render(
      <AIQuickEntryPendingQueue pendingEntries={[]} onOpenPreview={() => {}} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders one compact pending row", () => {
    render(
      <AIQuickEntryPendingQueue
        pendingEntries={[pending("1", "Cà phê 35k")]}
        onOpenPreview={() => {}}
      />
    );

    expect(screen.getByText("Cà phê 35k")).toBeInTheDocument();
    expect(screen.getByTestId("ai-quick-entry-amount-skeleton")).toBeInTheDocument();
    expect(screen.queryByText(/more parsing/)).not.toBeInTheDocument();
  });

  it("renders two newest pending rows without overflow", () => {
    render(
      <AIQuickEntryPendingQueue
        pendingEntries={[
          pending("1", "Older"),
          pending("2", "Newest"),
        ]}
        onOpenPreview={() => {}}
      />
    );

    expect(screen.getByText("Newest")).toBeInTheDocument();
    expect(screen.getByText("Older")).toBeInTheDocument();
    expect(screen.queryByText(/more parsing/)).not.toBeInTheDocument();
  });

  it("renders two newest rows plus overflow when more than two are pending", () => {
    render(
      <AIQuickEntryPendingQueue
        pendingEntries={[
          pending("1", "First"),
          pending("2", "Second"),
          pending("3", "Third"),
          pending("4", "Newest"),
        ]}
        onOpenPreview={() => {}}
      />
    );

    expect(screen.getByText("Newest")).toBeInTheDocument();
    expect(screen.getByText("Third")).toBeInTheDocument();
    expect(screen.queryByText("Second")).not.toBeInTheDocument();
    expect(screen.queryByText("First")).not.toBeInTheDocument();
    expect(screen.getByText("+2 more parsing")).toBeInTheDocument();
  });

  it("opens preview when a pending row is tapped", () => {
    const onOpenPreview = vi.fn();

    render(
      <AIQuickEntryPendingQueue
        pendingEntries={[pending("1", "Cà phê 35k")]}
        onOpenPreview={onOpenPreview}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /preview pending expense/i }));

    expect(onOpenPreview).toHaveBeenCalledTimes(1);
  });

  it("opens preview when the overflow row is tapped", () => {
    const onOpenPreview = vi.fn();

    render(
      <AIQuickEntryPendingQueue
        pendingEntries={[
          pending("1", "First"),
          pending("2", "Second"),
          pending("3", "Newest"),
        ]}
        onOpenPreview={onOpenPreview}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Preview 1 more parsing expense" }));

    expect(onOpenPreview).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run queue tests to verify they fail**

Run:

```bash
rtk bunx vitest run src/components/ai-quick-entry/AIQuickEntryPendingQueue.test.tsx
```

Expected: FAIL because `AIQuickEntryPendingQueue.tsx` does not exist.

- [ ] **Step 3: Implement the queue component**

Create `src/components/ai-quick-entry/AIQuickEntryPendingQueue.tsx`:

```tsx
"use client";

import React from "react";

import { cn } from "@/lib/utils";

import AIQuickEntryRow from "./AIQuickEntryRow";
import type { QuickEntry } from "./types";

type AIQuickEntryPendingQueueProps = {
  pendingEntries: QuickEntry[];
  onOpenPreview: () => void;
};

const newestFirst = (entries: QuickEntry[]) => [...entries].reverse();

const AIQuickEntryPendingQueue = ({
  pendingEntries,
  onOpenPreview,
}: AIQuickEntryPendingQueueProps) => {
  if (pendingEntries.length === 0) {
    return null;
  }

  const orderedEntries = newestFirst(pendingEntries);
  const visibleEntries = orderedEntries.slice(0, 2);
  const hiddenCount = Math.max(pendingEntries.length - visibleEntries.length, 0);

  return (
    <div className="space-y-2" data-testid="ai-quick-entry-pending-queue">
      {visibleEntries.map((entry) => (
        <button
          key={entry.id}
          type="button"
          aria-label={`Preview pending expense: ${entry.input}`}
          onClick={onOpenPreview}
          onPointerDown={(event) => event.preventDefault()}
          className="block w-full text-left"
        >
          <AIQuickEntryRow entry={entry} variant="pending" />
        </button>
      ))}

      {hiddenCount > 0 ? (
        <button
          type="button"
          aria-label={`Preview ${hiddenCount} more parsing expense${
            hiddenCount === 1 ? "" : "s"
          }`}
          onClick={onOpenPreview}
          onPointerDown={(event) => event.preventDefault()}
          className={cn(
            "text-muted-foreground bg-surface-3/55 ds-glass glass-border flex h-9 w-full items-center rounded-[18px] px-4 text-left text-xs font-semibold"
          )}
        >
          +{hiddenCount} more parsing
        </button>
      ) : null}
    </div>
  );
};

export default AIQuickEntryPendingQueue;
```

- [ ] **Step 4: Run queue tests to verify they pass**

Run:

```bash
rtk bunx vitest run src/components/ai-quick-entry/AIQuickEntryPendingQueue.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit queue component**

Run:

```bash
rtk git add src/components/ai-quick-entry/AIQuickEntryPendingQueue.tsx src/components/ai-quick-entry/AIQuickEntryPendingQueue.test.tsx
rtk git commit -m "feat(ai-quick-entry): add compact pending queue"
```

Expected: commit succeeds.

---

### Task 2: Add Inspection-Only Preview Component

**Files:**
- Create: `src/components/ai-quick-entry/AIQuickEntryPreview.tsx`
- Create: `src/components/ai-quick-entry/AIQuickEntryPreview.test.tsx`
- Uses: `src/components/ai-quick-entry/AIQuickEntryRow.tsx`
- Uses: `src/components/ai-quick-entry/types.ts`

- [ ] **Step 1: Write the failing preview tests**

Create `src/components/ai-quick-entry/AIQuickEntryPreview.test.tsx`:

```tsx
import React from "react";

import { Category } from "@/enums";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AIQuickEntryPreview from "./AIQuickEntryPreview";
import type { QuickEntry } from "./types";

const pending = (id: string, input: string): QuickEntry => ({
  id,
  input,
  status: "pending",
});

const resolved = (id: string, input: string): QuickEntry => ({
  id,
  input,
  status: "resolved",
  result: {
    id: Number(id),
    date: "2026-05-31",
    amount: 35000,
    note: input,
    category: Category.OTHER,
    paidBy: "Cubi",
    budgetId: null,
    budgetName: null,
    budgetIcon: null,
    budgetColor: null,
    syncStatus: "synced",
  },
});

const failed = (id: string, input: string): QuickEntry => ({
  id,
  input,
  status: "failed",
  error: "Could not parse expense",
});

describe("AIQuickEntryPreview", () => {
  it("renders pending, completed, and failed sections", () => {
    render(
      <AIQuickEntryPreview
        pendingEntries={[pending("1", "Cơm trưa 60k")]}
        completedEntries={[resolved("2", "Cà phê 35k")]}
        failedEntries={[failed("3", "bad input")]}
        onDone={() => {}}
      />
    );

    expect(screen.getByText("Parsing")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Needs review")).toBeInTheDocument();
    expect(screen.getByText("Cơm trưa 60k")).toBeInTheDocument();
    expect(screen.getByText("Cà phê 35k")).toBeInTheDocument();
    expect(screen.getByText("bad input")).toBeInTheDocument();
  });

  it("hides empty sections", () => {
    render(
      <AIQuickEntryPreview
        pendingEntries={[]}
        completedEntries={[resolved("2", "Cà phê 35k")]}
        failedEntries={[]}
        onDone={() => {}}
      />
    );

    expect(screen.queryByText("Parsing")).not.toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.queryByText("Needs review")).not.toBeInTheDocument();
  });

  it("calls onDone from the bottom X button", () => {
    const onDone = vi.fn();

    render(
      <AIQuickEntryPreview
        pendingEntries={[pending("1", "Cơm trưa 60k")]}
        completedEntries={[]}
        failedEntries={[]}
        onDone={onDone}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Return to quick entry" }));

    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run preview tests to verify they fail**

Run:

```bash
rtk bunx vitest run src/components/ai-quick-entry/AIQuickEntryPreview.test.tsx
```

Expected: FAIL because `AIQuickEntryPreview.tsx` does not exist.

- [ ] **Step 3: Implement the preview component**

Create `src/components/ai-quick-entry/AIQuickEntryPreview.tsx`:

```tsx
"use client";

import React from "react";

import { XIcon } from "lucide-react";

import AIQuickEntryRow from "./AIQuickEntryRow";
import type { QuickEntry } from "./types";

type AIQuickEntryPreviewProps = {
  pendingEntries: QuickEntry[];
  completedEntries: QuickEntry[];
  failedEntries: QuickEntry[];
  onDone: () => void;
};

type PreviewSectionProps = {
  title: string;
  entries: QuickEntry[];
  variant: "pending" | "resolved" | "failed";
};

const PreviewSection = ({ title, entries, variant }: PreviewSectionProps) => {
  if (entries.length === 0) {
    return null;
  }

  return (
    <section className="space-y-2">
      <h3 className="text-muted-foreground px-1 text-[11px] font-bold tracking-[0.12em] uppercase">
        {title}
      </h3>
      <div className="space-y-2">
        {entries.map((entry) => (
          <AIQuickEntryRow key={entry.id} entry={entry} variant={variant} />
        ))}
      </div>
    </section>
  );
};

const AIQuickEntryPreview = ({
  pendingEntries,
  completedEntries,
  failedEntries,
  onDone,
}: AIQuickEntryPreviewProps) => {
  return (
    <div className="relative mx-auto flex h-dvh w-full max-w-[390px] flex-col px-4 pt-[calc(env(safe-area-inset-top)+18px)] pb-0">
      <h2 className="text-foreground text-center text-sm font-bold">
        AI Quick Entry
      </h2>

      <div className="no-scrollbar mt-4 flex-1 space-y-5 overflow-y-auto pb-32">
        <PreviewSection
          title="Parsing"
          entries={pendingEntries}
          variant="pending"
        />
        <PreviewSection
          title="Completed"
          entries={completedEntries}
          variant="resolved"
        />
        <PreviewSection
          title="Needs review"
          entries={failedEntries}
          variant="failed"
        />
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-[linear-gradient(to_top,var(--background)_25%,color-mix(in_srgb,var(--background)_80%,transparent)_62%,transparent)] backdrop-blur-sm"
      />
      <button
        type="button"
        aria-label="Return to quick entry"
        onClick={onDone}
        className="ds-glass glass-border text-foreground absolute bottom-[calc(env(safe-area-inset-bottom)+20px)] left-1/2 grid size-14 -translate-x-1/2 place-items-center rounded-full bg-white/10 shadow-[0_18px_40px_rgb(0_0_0_/_40%)] transition-transform active:scale-[0.96]"
      >
        <XIcon className="size-5" />
      </button>
    </div>
  );
};

export default AIQuickEntryPreview;
```

- [ ] **Step 4: Run preview tests to verify they pass**

Run:

```bash
rtk bunx vitest run src/components/ai-quick-entry/AIQuickEntryPreview.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit preview component**

Run:

```bash
rtk git add src/components/ai-quick-entry/AIQuickEntryPreview.tsx src/components/ai-quick-entry/AIQuickEntryPreview.test.tsx
rtk git commit -m "feat(ai-quick-entry): add preview mode"
```

Expected: commit succeeds.

---

### Task 3: Integrate Queue And Preview Into AIQuickEntry

**Files:**
- Modify: `src/components/AIQuickEntry.tsx`
- Modify: `src/components/AIQuickEntry.test.tsx`
- Delete: `src/components/ai-quick-entry/AIQuickEntryPendingStack.tsx`
- Delete: `src/components/ai-quick-entry/AIQuickEntryPendingStack.test.tsx`
- Uses: `src/components/QuickExpenseSuccessToast.tsx`

- [ ] **Step 1: Update integration tests for queue and preview behavior**

In `src/components/AIQuickEntry.test.tsx`, add a Sonner mock near the other mocks:

```tsx
const toastSuccessMock = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
  },
}));
```

In `beforeEach`, reset the mock:

```tsx
toastSuccessMock.mockClear();
```

Replace the existing stack/expanded tests with these tests inside `describe("AIQuickEntry", () => { ... })`:

```tsx
it("renders a capped plain pending queue above the composer", () => {
  render(<AIQuickEntry />);
  openOverlay();

  act(() => {
    typeAndSend("first");
    typeAndSend("second");
    typeAndSend("third");
    typeAndSend("newest");
  });

  expect(screen.getByTestId("ai-quick-entry-pending-queue")).toBeInTheDocument();
  expect(screen.getByText("newest")).toBeInTheDocument();
  expect(screen.getByText("third")).toBeInTheDocument();
  expect(screen.queryByText("second")).not.toBeInTheDocument();
  expect(screen.queryByText("first")).not.toBeInTheDocument();
  expect(screen.getByText("+2 more parsing")).toBeInTheDocument();
  expect(screen.queryByLabelText(/Expand 4 pending expenses/)).not.toBeInTheDocument();
});

it("opens preview mode from the pending queue", () => {
  render(<AIQuickEntry />);
  openOverlay();

  act(() => {
    typeAndSend("first");
    typeAndSend("second");
    typeAndSend("third");
  });

  fireEvent.click(screen.getByRole("button", { name: "Preview 1 more parsing expense" }));

  expect(screen.getByText("AI Quick Entry")).toBeInTheDocument();
  expect(screen.getByText("Parsing")).toBeInTheDocument();
  expect(screen.getByText("third")).toBeInTheDocument();
  expect(screen.getByText("second")).toBeInTheDocument();
  expect(screen.getByText("first")).toBeInTheDocument();
});

it("opens preview mode from the status bar", () => {
  render(<AIQuickEntry />);
  openOverlay();

  act(() => {
    typeAndSend("Cà phê 35k");
  });

  fireEvent.click(screen.getByLabelText(/AI quick entry status/));

  expect(screen.getByText("AI Quick Entry")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Return to quick entry" })).toBeInTheDocument();
});

it("returns from preview mode to entry mode and refocuses the composer", () => {
  const focusSpy = vi
    .spyOn(HTMLInputElement.prototype, "focus")
    .mockImplementation(() => {});

  render(<AIQuickEntry />);
  openOverlay();

  act(() => {
    typeAndSend("Cà phê 35k");
  });

  fireEvent.click(screen.getByLabelText(/AI quick entry status/));
  fireEvent.click(screen.getByRole("button", { name: "Return to quick entry" }));

  expect(screen.getByLabelText("Describe your expense")).toBeInTheDocument();
  expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });

  focusSpy.mockRestore();
});

it("removes resolved entries from the pending queue and shows a success toast", async () => {
  render(<AIQuickEntry />);
  openOverlay();

  act(() => {
    typeAndSend("Cà phê 35k");
  });

  expect(screen.getByText("Cà phê 35k")).toBeInTheDocument();

  await advanceParse();

  expect(screen.queryByTestId("ai-quick-entry-pending-queue")).not.toBeInTheDocument();
  expect(toastSuccessMock).toHaveBeenCalledTimes(1);
});
```

Delete tests that assert:

- stack card count with `ai-pending-stack-card`;
- `aria-label="Expand 4 pending expenses"`;
- active resolved rows remain visible for 3 seconds;
- completed list opens inline in `ai-quick-entry-list`;
- completed list collapses on new submit;
- pending stack expanded state updates.

- [ ] **Step 2: Run integration tests to verify they fail**

Run:

```bash
rtk bunx vitest run src/components/AIQuickEntry.test.tsx
```

Expected: FAIL because `AIQuickEntry.tsx` still imports the stack component and does not render Preview Mode.

- [ ] **Step 3: Update AIQuickEntry imports and state**

In `src/components/AIQuickEntry.tsx`, replace imports:

```tsx
import { toast } from "sonner";

import { Category, PaidBy } from "@/enums";
import AIQuickEntryPendingQueue from "@/components/ai-quick-entry/AIQuickEntryPendingQueue";
import AIQuickEntryPreview from "@/components/ai-quick-entry/AIQuickEntryPreview";
import AIQuickEntryRow from "@/components/ai-quick-entry/AIQuickEntryRow";
import AIQuickEntryStatusBar from "@/components/ai-quick-entry/AIQuickEntryStatusBar";
import type { QuickEntry } from "@/components/ai-quick-entry/types";
import {
  QuickExpenseSuccessToast,
  QUICK_EXPENSE_SUCCESS_TOAST_OPTIONS,
} from "@/components/QuickExpenseSuccessToast";
```

Remove:

```tsx
import AIQuickEntryPendingStack from "@/components/ai-quick-entry/AIQuickEntryPendingStack";
```

Add mode type near constants:

```tsx
type AIQuickEntryMode = "entry" | "preview";
```

Remove:

```tsx
const RESOLVED_VISIBLE_MS = 3000;
```

Replace local state:

```tsx
const [mode, setMode] = useState<AIQuickEntryMode>("entry");
const [composer, setComposer] = useState("");
const [entries, setEntries] = useState<QuickEntry[]>([]);
```

Remove these state values:

```tsx
const [completedOpen, setCompletedOpen] = useState(false);
const [pendingStackExpanded, setPendingStackExpanded] = useState(false);
const [visibleResolvedIds, setVisibleResolvedIds] = useState<Set<string>>(
  () => new Set()
);
```

In the open reset effect, replace the old reset block with:

```tsx
setMode("entry");
setEntries([]);
setComposer("");
```

Remove the effect that collapses the pending stack when pending count is zero.

- [ ] **Step 4: Update derived lists and preview handlers**

In `src/components/AIQuickEntry.tsx`, replace completed/active resolved derivations with:

```tsx
const pendingEntries = useMemo(
  () => entries.filter((entry) => entry.status === "pending"),
  [entries]
);
const completedEntries = useMemo(
  () => newestFirst(entries.filter((entry) => entry.status === "resolved")),
  [entries]
);
const failedEntries = useMemo(
  () => newestFirst(entries.filter((entry) => entry.status === "failed")),
  [entries]
);
const failedCount = failedEntries.length;
const completedCount = completedEntries.length;
```

Add preview handlers:

```tsx
const openPreview = () => {
  setMode("preview");
  inputRef.current?.blur();
};

const returnToEntry = () => {
  setMode("entry");
  window.requestAnimationFrame(() => {
    inputRef.current?.focus({ preventScroll: true });
  });
};
```

- [ ] **Step 5: Update submit and resolve behavior**

In `submit`, remove:

```tsx
setCompletedOpen(false);
```

In the parse timer, replace the resolved visibility timer logic with:

```tsx
const result = mockParseExpense(input, { paidBy });

setEntries((current) =>
  current.map((entry) =>
    entry.id === id
      ? {
          ...entry,
          status: "resolved",
          result,
        }
      : entry
  )
);

toast.success(
  <QuickExpenseSuccessToast
    draft={{
      date: result.date,
      amount: result.amount,
      note: result.note,
      category: result.category as Category,
      paidBy: result.paidBy as PaidBy,
      budgetId: result.budgetId,
      budgetName: result.budgetName,
      budgetIcon: result.budgetIcon,
      budgetColor: result.budgetColor,
    }}
  />,
  QUICK_EXPENSE_SUCCESS_TOAST_OPTIONS
);
```

Keep `timersRef.current.push(parseTimer)` for parse timer cleanup.

- [ ] **Step 6: Update status bar behavior**

In the `AIQuickEntryStatusBar` render, pass Preview Mode behavior:

```tsx
<AIQuickEntryStatusBar
  totalCount={entries.length}
  pendingCount={pendingEntries.length}
  completedCount={completedCount}
  failedCount={failedCount}
  completedOpen={mode === "preview"}
  onToggleCompleted={openPreview}
/>
```

This keeps the current prop shape and uses `completedOpen` as the visual expanded state until a follow-up rename is worth doing.

- [ ] **Step 7: Render Preview Mode or Entry Mode**

Inside `DrawerContent`, after `DrawerHeader`, render Preview Mode before the entry layout:

```tsx
{mode === "preview" ? (
  <AIQuickEntryPreview
    pendingEntries={newestFirst(pendingEntries)}
    completedEntries={completedEntries}
    failedEntries={failedEntries}
    onDone={returnToEntry}
  />
) : (
  <div className="relative h-dvh overflow-hidden">
    <div
      className="absolute inset-x-0 bottom-0 flex flex-col"
      style={{ paddingBottom: keyboardOffset } as CSSProperties}
    >
      <div
        data-testid="ai-quick-entry-list"
        className="no-scrollbar mx-auto flex w-full max-w-[390px] flex-col gap-2.5 overflow-hidden px-4 pb-2"
      >
        <AIQuickEntryPendingQueue
          pendingEntries={pendingEntries}
          onOpenPreview={openPreview}
        />
      </div>

      <div className="px-4 pb-2">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex w-full max-w-[390px] items-center gap-2"
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
            className="text-foreground placeholder:text-muted-foreground/70 ds-glass glass-border flex-1 rounded-[28px] border-0 bg-transparent px-4 py-3 text-base outline-none"
          />
          <button
            type="submit"
            aria-label="Send expense"
            disabled={!canSend}
            onPointerDown={(event) => event.preventDefault()}
            className={cn(
              "ds-glass glass-border text-primary-foreground grid size-12 shrink-0 place-items-center rounded-full !text-white transition-opacity",
              !canSend && "opacity-40"
            )}
          >
            <ArrowUp className="size-4" />
          </button>
        </form>
      </div>
    </div>
  </div>
)}
```

Remove the old completed list, active resolved rows, and `AIQuickEntryPendingStack` render.

- [ ] **Step 8: Delete old pending stack files**

Run:

```bash
rtk rm src/components/ai-quick-entry/AIQuickEntryPendingStack.tsx src/components/ai-quick-entry/AIQuickEntryPendingStack.test.tsx
```

Expected: files are removed.

- [ ] **Step 9: Run integration tests**

Run:

```bash
rtk bunx vitest run src/components/AIQuickEntry.test.tsx src/components/ai-quick-entry/AIQuickEntryPendingQueue.test.tsx src/components/ai-quick-entry/AIQuickEntryPreview.test.tsx src/components/ai-quick-entry/AIQuickEntryRow.test.tsx src/components/ai-quick-entry/AIQuickEntryStatusBar.test.tsx
```

Expected: PASS.

- [ ] **Step 10: Commit integration**

Run:

```bash
rtk git add src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx src/components/ai-quick-entry
rtk git commit -m "feat(ai-quick-entry): integrate preview queue"
```

Expected: commit succeeds.

---

### Task 4: Run Formatting And ESLint For Modified TypeScript Files

**Files:**
- Check: `src/components/AIQuickEntry.tsx`
- Check: `src/components/AIQuickEntry.test.tsx`
- Check: `src/components/ai-quick-entry/AIQuickEntryPendingQueue.tsx`
- Check: `src/components/ai-quick-entry/AIQuickEntryPendingQueue.test.tsx`
- Check: `src/components/ai-quick-entry/AIQuickEntryPreview.tsx`
- Check: `src/components/ai-quick-entry/AIQuickEntryPreview.test.tsx`

- [ ] **Step 1: Format modified files**

Run:

```bash
rtk bunx prettier --write src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx src/components/ai-quick-entry/AIQuickEntryPendingQueue.tsx src/components/ai-quick-entry/AIQuickEntryPendingQueue.test.tsx src/components/ai-quick-entry/AIQuickEntryPreview.tsx src/components/ai-quick-entry/AIQuickEntryPreview.test.tsx
```

Expected: Prettier writes the files or reports they are unchanged.

- [ ] **Step 2: Check formatting**

Run:

```bash
rtk bunx prettier --check src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx src/components/ai-quick-entry/AIQuickEntryPendingQueue.tsx src/components/ai-quick-entry/AIQuickEntryPendingQueue.test.tsx src/components/ai-quick-entry/AIQuickEntryPreview.tsx src/components/ai-quick-entry/AIQuickEntryPreview.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run ESLint for modified files**

Run:

```bash
rtk bunx eslint src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx src/components/ai-quick-entry/AIQuickEntryPendingQueue.tsx src/components/ai-quick-entry/AIQuickEntryPendingQueue.test.tsx src/components/ai-quick-entry/AIQuickEntryPreview.tsx src/components/ai-quick-entry/AIQuickEntryPreview.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Run focused tests one more time**

Run:

```bash
rtk bunx vitest run src/components/AIQuickEntry.test.tsx src/components/ai-quick-entry/AIQuickEntryPendingQueue.test.tsx src/components/ai-quick-entry/AIQuickEntryPreview.test.tsx src/components/ai-quick-entry/AIQuickEntryRow.test.tsx src/components/ai-quick-entry/AIQuickEntryStatusBar.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit validation cleanup**

Run:

```bash
rtk git status --short
```

Expected: either clean working tree or only formatting changes in the modified TypeScript files.

If formatting changed files after the integration commit, run:

```bash
rtk git add src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx src/components/ai-quick-entry/AIQuickEntryPendingQueue.tsx src/components/ai-quick-entry/AIQuickEntryPendingQueue.test.tsx src/components/ai-quick-entry/AIQuickEntryPreview.tsx src/components/ai-quick-entry/AIQuickEntryPreview.test.tsx
rtk git commit -m "chore(ai-quick-entry): format preview queue"
```

Expected: commit succeeds only when formatting produced tracked changes.

---

### Task 5: Manual Mobile Sanity Check

**Files:**
- Check in browser: AI Quick Entry drawer from bottom nav.

- [ ] **Step 1: Start the dev server**

Run:

```bash
rtk bun run dev
```

Expected: Next.js dev server starts and prints a local URL.

- [ ] **Step 2: Verify Entry Mode on mobile viewport**

Open the app in an iPhone 13/14-sized viewport. Tap the bottom-nav Sparkles button.

Expected:

- Keyboard opens.
- Composer is focused.
- No pending queue is visible before submit.
- After submitting one entry, one compact pending row appears above input.
- After submitting two entries, two compact pending rows appear.
- After submitting three entries, two compact pending rows plus `+1 more parsing` appear.
- The pending queue does not scroll.

- [ ] **Step 3: Verify Preview Mode**

Tap the status bar, a pending row, and the overflow row in separate runs.

Expected:

- Keyboard dismisses.
- Preview Mode opens.
- Pending, completed, and failed sections appear only when they have entries.
- List scrolls behind the bottom blur overlay.
- Bottom circular `X` returns to Entry Mode.
- Returning to Entry Mode focuses the composer.

- [ ] **Step 4: Stop the dev server**

Stop the running dev server with `Ctrl-C`.

Expected: terminal returns to the shell prompt.
