# AI Quick Entry Rapid Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current AI Quick Entry card stack with a one-line rapid queue where pending entries collapse into an expandable Sonner-style stack and resolved entries show for 3 seconds before moving behind the status bar.

**Architecture:** Keep `AIQuickEntry.tsx` as the stateful overlay owner. Add focused presentational components under `src/components/ai-quick-entry/` for row rendering, status summary, and pending stack display. Keep all data local to the overlay; no API, TanStack Query, mutation, or persistence work is introduced.

**Tech Stack:** Next.js client components, React state/effects/refs, Zustand open flag, Tailwind v4 classes, Vitest + React Testing Library, existing `mockParseExpense`, existing `ExpenseItemIcon`, existing `formatVndCompact`.

---

## File Structure

| File                                                              | Responsibility                                                                               |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `src/components/ai-quick-entry/types.ts`                          | Shared local `QuickEntry` / status types for AI quick-entry UI components.                   |
| `src/components/ai-quick-entry/AIQuickEntryRow.tsx`               | One-line pending/resolved/failed row; no `ExpenseListItem`.                                  |
| `src/components/ai-quick-entry/AIQuickEntryRow.test.tsx`          | Row behavior and compact one-line rendering tests.                                           |
| `src/components/ai-quick-entry/AIQuickEntryStatusBar.tsx`         | Tappable status summary and completed-view toggle.                                           |
| `src/components/ai-quick-entry/AIQuickEntryStatusBar.test.tsx`    | Status summary text, accessible label, and toggle tests.                                     |
| `src/components/ai-quick-entry/AIQuickEntryPendingStack.tsx`      | Collapsed pending stack with max three visible cards; expanded pending list.                 |
| `src/components/ai-quick-entry/AIQuickEntryPendingStack.test.tsx` | Collapsed/expanded stack behavior tests.                                                     |
| `src/components/AIQuickEntry.tsx`                                 | Overlay state integration: pending stack expansion, completed view, visible resolved timers. |
| `src/components/AIQuickEntry.test.tsx`                            | Integration tests for submit, stack, resolve visibility, status toggle, and reset.           |
| `src/components/AIEntrySkeleton.tsx`                              | Delete after the queue no longer imports it.                                                 |
| `src/components/AIEntrySkeleton.test.tsx`                         | Delete with the skeleton component.                                                          |

## Task 1: Shared Quick Entry Types

**Files:**

- Create: `src/components/ai-quick-entry/types.ts`

- [ ] **Step 1: Create shared types**

Create `src/components/ai-quick-entry/types.ts`:

```ts
import type { ExpenseListItemData } from "@/components/ExpenseListItem";

export type QuickEntryStatus = "pending" | "resolved" | "failed";

export type QuickEntry = {
  id: string;
  input: string;
  status: QuickEntryStatus;
  result?: ExpenseListItemData;
  error?: string;
};
```

- [ ] **Step 2: Run TypeScript-adjacent validation through ESLint**

Run:

```bash
rtk bunx eslint src/components/ai-quick-entry/types.ts
```

Expected: PASS with no output.

- [ ] **Step 3: Commit**

```bash
rtk git add src/components/ai-quick-entry/types.ts
rtk git commit -m "feat(ai-quick-entry): add queue entry types"
```

## Task 2: One-Line Quick Entry Row

**Files:**

- Create: `src/components/ai-quick-entry/AIQuickEntryRow.test.tsx`
- Create: `src/components/ai-quick-entry/AIQuickEntryRow.tsx`
- Uses: `src/components/ai-quick-entry/types.ts`

- [ ] **Step 1: Write failing row tests**

Create `src/components/ai-quick-entry/AIQuickEntryRow.test.tsx`:

```tsx
import React from "react";

import { Category } from "@/enums";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AIQuickEntryRow from "./AIQuickEntryRow";
import type { QuickEntry } from "./types";

const resolvedEntry: QuickEntry = {
  id: "entry-1",
  input: "Cà phê 35k",
  status: "resolved",
  result: {
    id: -1,
    date: "2026-05-30",
    amount: 35000,
    note: "Cà phê 35k",
    category: Category.OTHER,
    paidBy: "Cubi",
    budgetId: null,
    budgetName: null,
    budgetIcon: null,
    budgetColor: null,
    syncStatus: "synced",
  },
};

describe("AIQuickEntryRow", () => {
  it("renders a pending entry as one compact row", () => {
    render(
      <AIQuickEntryRow
        entry={{ id: "entry-1", input: "Bánh mì 25k", status: "pending" }}
        variant="pending"
      />
    );

    expect(screen.getByTestId("ai-quick-entry-row")).toHaveAttribute(
      "data-variant",
      "pending"
    );
    expect(screen.getByText("Bánh mì 25k")).toBeInTheDocument();
    expect(screen.getByText("--")).toBeInTheDocument();
    expect(screen.queryByTestId("ai-quick-entry-row-secondary")).toBeNull();
  });

  it("renders a resolved entry with note and compact amount", () => {
    render(<AIQuickEntryRow entry={resolvedEntry} variant="resolved" />);

    expect(screen.getByTestId("ai-quick-entry-row")).toHaveAttribute(
      "data-variant",
      "resolved"
    );
    expect(screen.getByText("Cà phê 35k")).toBeInTheDocument();
    expect(screen.getByText("-35K")).toBeInTheDocument();
    expect(screen.queryByTestId("expense-row")).toBeNull();
  });

  it("falls back to the original input when a resolved note is empty", () => {
    render(
      <AIQuickEntryRow
        entry={{
          ...resolvedEntry,
          input: "Taxi 90k",
          result: { ...resolvedEntry.result!, note: "" },
        }}
        variant="resolved"
      />
    );

    expect(screen.getByText("Taxi 90k")).toBeInTheDocument();
  });

  it("renders a failed entry as one compact review row", () => {
    render(
      <AIQuickEntryRow
        entry={{
          id: "entry-2",
          input: "hard to parse",
          status: "failed",
          error: "Could not parse expense",
        }}
        variant="failed"
      />
    );

    expect(screen.getByTestId("ai-quick-entry-row")).toHaveAttribute(
      "data-variant",
      "failed"
    );
    expect(screen.getByText("hard to parse")).toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run row test to verify it fails**

Run:

```bash
rtk bunx vitest run src/components/ai-quick-entry/AIQuickEntryRow.test.tsx
```

Expected: FAIL because `./AIQuickEntryRow` does not exist.

- [ ] **Step 3: Implement the row component**

Create `src/components/ai-quick-entry/AIQuickEntryRow.tsx`:

```tsx
"use client";

import React from "react";

import { Category } from "@/enums";
import { cn, formatVndCompact } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

import ExpenseItemIcon from "@/components/ExpenseItemIcon";
import VndSymbol from "@/components/VndSymbol";

import type { QuickEntry } from "./types";

type AIQuickEntryRowProps = {
  entry: QuickEntry;
  variant: "pending" | "resolved" | "failed";
  className?: string;
};

const rowClassName =
  "bg-surface-2/95 glass-border grid min-h-12 grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-2 rounded-[18px] px-2.5 py-2 shadow-[0_12px_28px_color-mix(in_srgb,var(--background)_50%,transparent)]";

const PendingIndicator = () => (
  <span
    aria-hidden
    className="bg-muted mx-auto block size-8 animate-pulse rounded-full"
  />
);

const FailedIndicator = () => (
  <span
    aria-hidden
    className="text-destructive bg-destructive/15 mx-auto grid size-8 place-items-center rounded-full"
  >
    <AlertTriangle className="size-4" />
  </span>
);

const CompactAmount = ({ amount }: { amount: number }) => (
  <span className="text-destructive shrink-0 text-right text-sm font-semibold tabular-nums">
    -{formatVndCompact(amount)} <VndSymbol />
  </span>
);

const AIQuickEntryRow = ({
  entry,
  variant,
  className,
}: AIQuickEntryRowProps) => {
  const note = entry.result?.note.trim() || entry.input;

  return (
    <div
      data-ai-quick-entry-row
      data-testid="ai-quick-entry-row"
      data-variant={variant}
      aria-label={
        variant === "pending"
          ? `Parsing expense: ${entry.input}`
          : variant === "failed"
            ? `Expense needs review: ${entry.input}`
            : `Parsed expense: ${note}, ${formatVndCompact(
                entry.result?.amount ?? 0
              )}`
      }
      className={cn(rowClassName, className)}
    >
      {variant === "resolved" && entry.result ? (
        <ExpenseItemIcon
          category={entry.result.category as Category}
          size="sm"
          className="mx-auto size-8 [&_svg]:size-4"
        />
      ) : variant === "failed" ? (
        <FailedIndicator />
      ) : (
        <PendingIndicator />
      )}

      <p className="text-foreground/90 min-w-0 truncate text-sm font-semibold">
        {note}
      </p>

      {variant === "resolved" && entry.result ? (
        <CompactAmount amount={entry.result.amount} />
      ) : variant === "failed" ? (
        <span className="text-destructive shrink-0 text-xs font-semibold">
          Review
        </span>
      ) : (
        <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
          --
        </span>
      )}
    </div>
  );
};

export default AIQuickEntryRow;
```

- [ ] **Step 4: Run row test to verify it passes**

Run:

```bash
rtk bunx vitest run src/components/ai-quick-entry/AIQuickEntryRow.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Format and lint row files**

Run:

```bash
rtk bunx prettier --write src/components/ai-quick-entry/AIQuickEntryRow.tsx src/components/ai-quick-entry/AIQuickEntryRow.test.tsx src/components/ai-quick-entry/types.ts
rtk bunx prettier --check src/components/ai-quick-entry/AIQuickEntryRow.tsx src/components/ai-quick-entry/AIQuickEntryRow.test.tsx src/components/ai-quick-entry/types.ts
rtk bunx eslint src/components/ai-quick-entry/AIQuickEntryRow.tsx src/components/ai-quick-entry/AIQuickEntryRow.test.tsx src/components/ai-quick-entry/types.ts
```

Expected: Prettier check passes; ESLint exits 0.

- [ ] **Step 6: Commit**

```bash
rtk git add src/components/ai-quick-entry/types.ts src/components/ai-quick-entry/AIQuickEntryRow.tsx src/components/ai-quick-entry/AIQuickEntryRow.test.tsx
rtk git commit -m "feat(ai-quick-entry): add compact queue row"
```

## Task 3: Status Bar Component

**Files:**

- Create: `src/components/ai-quick-entry/AIQuickEntryStatusBar.test.tsx`
- Create: `src/components/ai-quick-entry/AIQuickEntryStatusBar.tsx`

- [ ] **Step 1: Write failing status bar tests**

Create `src/components/ai-quick-entry/AIQuickEntryStatusBar.test.tsx`:

```tsx
import React from "react";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AIQuickEntryStatusBar from "./AIQuickEntryStatusBar";

describe("AIQuickEntryStatusBar", () => {
  it("renders total, pending, and completed counts", () => {
    render(
      <AIQuickEntryStatusBar
        totalCount={7}
        pendingCount={2}
        completedCount={5}
        failedCount={0}
        completedOpen={false}
        onToggleCompleted={() => {}}
      />
    );

    expect(screen.getByRole("button")).toHaveTextContent(
      "7 entries · 2 parsing · 5 done"
    );
    expect(screen.getByRole("button")).toHaveAccessibleName(
      "AI quick entry status: 7 entries, 2 parsing, 5 completed. Show completed entries."
    );
  });

  it("renders failed count when present", () => {
    render(
      <AIQuickEntryStatusBar
        totalCount={3}
        pendingCount={0}
        completedCount={2}
        failedCount={1}
        completedOpen={true}
        onToggleCompleted={() => {}}
      />
    );

    expect(screen.getByRole("button")).toHaveTextContent(
      "3 entries · 2 done · 1 failed"
    );
    expect(screen.getByRole("button")).toHaveAccessibleName(
      "AI quick entry status: 3 entries, 2 completed, 1 failed. Hide completed entries."
    );
  });

  it("calls onToggleCompleted when clicked", () => {
    const onToggleCompleted = vi.fn();

    render(
      <AIQuickEntryStatusBar
        totalCount={1}
        pendingCount={1}
        completedCount={0}
        failedCount={0}
        completedOpen={false}
        onToggleCompleted={onToggleCompleted}
      />
    );

    fireEvent.click(screen.getByRole("button"));

    expect(onToggleCompleted).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run status bar test to verify it fails**

Run:

```bash
rtk bunx vitest run src/components/ai-quick-entry/AIQuickEntryStatusBar.test.tsx
```

Expected: FAIL because `./AIQuickEntryStatusBar` does not exist.

- [ ] **Step 3: Implement status bar**

Create `src/components/ai-quick-entry/AIQuickEntryStatusBar.tsx`:

```tsx
"use client";

import React from "react";

import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

type AIQuickEntryStatusBarProps = {
  totalCount: number;
  pendingCount: number;
  completedCount: number;
  failedCount: number;
  completedOpen: boolean;
  onToggleCompleted: () => void;
};

const pluralize = (count: number, singular: string, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;

const buildVisibleLabel = ({
  totalCount,
  pendingCount,
  completedCount,
  failedCount,
}: Pick<
  AIQuickEntryStatusBarProps,
  "totalCount" | "pendingCount" | "completedCount" | "failedCount"
>) => {
  const parts = [pluralize(totalCount, "entry", "entries")];

  if (pendingCount > 0) {
    parts.push(`${pendingCount} parsing`);
  }
  if (completedCount > 0) {
    parts.push(`${completedCount} done`);
  }
  if (failedCount > 0) {
    parts.push(`${failedCount} failed`);
  }

  return parts.join(" · ");
};

const buildAccessibleLabel = ({
  totalCount,
  pendingCount,
  completedCount,
  failedCount,
  completedOpen,
}: AIQuickEntryStatusBarProps) => {
  const parts = [`${pluralize(totalCount, "entry", "entries")}`];

  if (pendingCount > 0) {
    parts.push(`${pendingCount} parsing`);
  }
  if (completedCount > 0) {
    parts.push(`${completedCount} completed`);
  }
  if (failedCount > 0) {
    parts.push(`${failedCount} failed`);
  }

  return `AI quick entry status: ${parts.join(", ")}. ${
    completedOpen ? "Hide" : "Show"
  } completed entries.`;
};

const AIQuickEntryStatusBar = (props: AIQuickEntryStatusBarProps) => {
  const {
    completedOpen,
    onToggleCompleted,
    totalCount,
    pendingCount,
    completedCount,
    failedCount,
  } = props;

  if (totalCount <= 0) {
    return null;
  }

  return (
    <button
      type="button"
      aria-expanded={completedOpen}
      aria-label={buildAccessibleLabel(props)}
      onClick={onToggleCompleted}
      onPointerDown={(event) => event.preventDefault()}
      className="text-muted-foreground mx-auto flex h-8 max-w-[390px] items-center justify-center gap-1.5 rounded-full px-3 text-xs font-medium"
    >
      <span>
        {buildVisibleLabel({
          totalCount,
          pendingCount,
          completedCount,
          failedCount,
        })}
      </span>
      <ChevronDown
        aria-hidden
        className={cn(
          "size-3.5 transition-transform duration-150 ease-out",
          completedOpen && "rotate-180"
        )}
      />
    </button>
  );
};

export default AIQuickEntryStatusBar;
```

- [ ] **Step 4: Run status bar test to verify it passes**

Run:

```bash
rtk bunx vitest run src/components/ai-quick-entry/AIQuickEntryStatusBar.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Format and lint status bar files**

Run:

```bash
rtk bunx prettier --write src/components/ai-quick-entry/AIQuickEntryStatusBar.tsx src/components/ai-quick-entry/AIQuickEntryStatusBar.test.tsx
rtk bunx prettier --check src/components/ai-quick-entry/AIQuickEntryStatusBar.tsx src/components/ai-quick-entry/AIQuickEntryStatusBar.test.tsx
rtk bunx eslint src/components/ai-quick-entry/AIQuickEntryStatusBar.tsx src/components/ai-quick-entry/AIQuickEntryStatusBar.test.tsx
```

Expected: Prettier check passes; ESLint exits 0.

- [ ] **Step 6: Commit**

```bash
rtk git add src/components/ai-quick-entry/AIQuickEntryStatusBar.tsx src/components/ai-quick-entry/AIQuickEntryStatusBar.test.tsx
rtk git commit -m "feat(ai-quick-entry): add session status bar"
```

## Task 4: Expandable Pending Stack

**Files:**

- Create: `src/components/ai-quick-entry/AIQuickEntryPendingStack.test.tsx`
- Create: `src/components/ai-quick-entry/AIQuickEntryPendingStack.tsx`
- Uses: `src/components/ai-quick-entry/AIQuickEntryRow.tsx`

- [ ] **Step 1: Write failing pending stack tests**

Create `src/components/ai-quick-entry/AIQuickEntryPendingStack.test.tsx`:

```tsx
import React from "react";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AIQuickEntryPendingStack from "./AIQuickEntryPendingStack";
import type { QuickEntry } from "./types";

const pending = (id: string, input: string): QuickEntry => ({
  id,
  input,
  status: "pending",
});

describe("AIQuickEntryPendingStack", () => {
  it("renders nothing with no pending entries", () => {
    const { container } = render(
      <AIQuickEntryPendingStack
        pendingEntries={[]}
        expanded={false}
        onToggleExpanded={() => {}}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders one pending row without a hidden count", () => {
    render(
      <AIQuickEntryPendingStack
        pendingEntries={[pending("1", "Cà phê 35k")]}
        expanded={false}
        onToggleExpanded={() => {}}
      />
    );

    expect(screen.getByText("Cà phê 35k")).toBeInTheDocument();
    expect(screen.queryByText(/\+1 parsing/)).toBeNull();
  });

  it("collapses many pending entries to at most three visible stack cards", () => {
    render(
      <AIQuickEntryPendingStack
        pendingEntries={[
          pending("1", "First"),
          pending("2", "Second"),
          pending("3", "Third"),
          pending("4", "Newest"),
        ]}
        expanded={false}
        onToggleExpanded={() => {}}
      />
    );

    expect(screen.getByText("Newest")).toBeInTheDocument();
    expect(screen.queryByText("First")).toBeNull();
    expect(screen.getAllByTestId("ai-pending-stack-card")).toHaveLength(3);
    expect(screen.getByText("+3 parsing")).toBeInTheDocument();
  });

  it("toggles expansion when the collapsed stack is clicked", () => {
    const onToggleExpanded = vi.fn();

    render(
      <AIQuickEntryPendingStack
        pendingEntries={[pending("1", "First"), pending("2", "Newest")]}
        expanded={false}
        onToggleExpanded={onToggleExpanded}
      />
    );

    fireEvent.click(screen.getByRole("button"));

    expect(onToggleExpanded).toHaveBeenCalledTimes(1);
  });

  it("renders all pending rows in expanded state", () => {
    render(
      <AIQuickEntryPendingStack
        pendingEntries={[
          pending("1", "First"),
          pending("2", "Second"),
          pending("3", "Newest"),
        ]}
        expanded
        onToggleExpanded={() => {}}
      />
    );

    expect(screen.getByText("Newest")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
  });
});
```

- [ ] **Step 2: Run pending stack test to verify it fails**

Run:

```bash
rtk bunx vitest run src/components/ai-quick-entry/AIQuickEntryPendingStack.test.tsx
```

Expected: FAIL because `./AIQuickEntryPendingStack` does not exist.

- [ ] **Step 3: Implement pending stack**

Create `src/components/ai-quick-entry/AIQuickEntryPendingStack.tsx`:

```tsx
"use client";

import React from "react";

import { cn } from "@/lib/utils";

import AIQuickEntryRow from "./AIQuickEntryRow";
import type { QuickEntry } from "./types";

type AIQuickEntryPendingStackProps = {
  pendingEntries: QuickEntry[];
  expanded: boolean;
  onToggleExpanded: () => void;
};

const newestFirst = (entries: QuickEntry[]) => [...entries].reverse();

const AIQuickEntryPendingStack = ({
  pendingEntries,
  expanded,
  onToggleExpanded,
}: AIQuickEntryPendingStackProps) => {
  if (pendingEntries.length === 0) {
    return null;
  }

  const orderedEntries = newestFirst(pendingEntries);
  const frontEntry = orderedEntries[0];
  const visibleStackCards = orderedEntries.slice(0, 3);
  const hiddenPendingCount = Math.max(0, pendingEntries.length - 1);
  const canExpand = pendingEntries.length > 1;

  if (expanded && canExpand) {
    return (
      <div className="space-y-2" data-ai-pending-stack-state="expanded">
        <button
          type="button"
          aria-expanded="true"
          aria-label={`Collapse ${pendingEntries.length} pending expenses`}
          onClick={onToggleExpanded}
          onPointerDown={(event) => event.preventDefault()}
          className="text-muted-foreground w-full px-1 text-left text-xs font-medium"
        >
          {pendingEntries.length} parsing
        </button>
        <div className="no-scrollbar max-h-48 space-y-2 overflow-y-auto">
          {orderedEntries.map((entry) => (
            <AIQuickEntryRow key={entry.id} entry={entry} variant="pending" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-expanded="false"
      aria-label={
        canExpand
          ? `Expand ${pendingEntries.length} pending expenses`
          : `Parsing expense: ${frontEntry.input}`
      }
      onClick={canExpand ? onToggleExpanded : undefined}
      onPointerDown={(event) => event.preventDefault()}
      className={cn(
        "relative block w-full text-left",
        !canExpand && "cursor-default"
      )}
      data-ai-pending-stack-state="collapsed"
    >
      <div className="relative">
        {visibleStackCards
          .slice(1)
          .reverse()
          .map((entry, index) => (
            <div
              key={entry.id}
              data-testid="ai-pending-stack-card"
              aria-hidden
              className={cn(
                "bg-surface-2/60 glass-border absolute inset-x-1 top-0 h-12 rounded-[18px]",
                index === 0 && "translate-y-2 scale-[0.98]",
                index === 1 && "translate-y-4 scale-[0.96]"
              )}
            />
          ))}
        <div
          data-testid="ai-pending-stack-card"
          className={cn(canExpand && visibleStackCards.length > 1 && "pb-4")}
        >
          <AIQuickEntryRow entry={frontEntry} variant="pending" />
        </div>
      </div>
      {hiddenPendingCount > 0 ? (
        <span className="text-muted-foreground mt-1 block px-3 text-xs font-medium">
          +{hiddenPendingCount} parsing
        </span>
      ) : null}
    </button>
  );
};

export default AIQuickEntryPendingStack;
```

- [ ] **Step 4: Run pending stack test to verify it passes**

Run:

```bash
rtk bunx vitest run src/components/ai-quick-entry/AIQuickEntryPendingStack.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Format and lint pending stack files**

Run:

```bash
rtk bunx prettier --write src/components/ai-quick-entry/AIQuickEntryPendingStack.tsx src/components/ai-quick-entry/AIQuickEntryPendingStack.test.tsx
rtk bunx prettier --check src/components/ai-quick-entry/AIQuickEntryPendingStack.tsx src/components/ai-quick-entry/AIQuickEntryPendingStack.test.tsx
rtk bunx eslint src/components/ai-quick-entry/AIQuickEntryPendingStack.tsx src/components/ai-quick-entry/AIQuickEntryPendingStack.test.tsx
```

Expected: Prettier check passes; ESLint exits 0.

- [ ] **Step 6: Commit**

```bash
rtk git add src/components/ai-quick-entry/AIQuickEntryPendingStack.tsx src/components/ai-quick-entry/AIQuickEntryPendingStack.test.tsx
rtk git commit -m "feat(ai-quick-entry): add expandable pending stack"
```

## Task 5: Integrate Rapid Queue State In AIQuickEntry

**Files:**

- Modify: `src/components/AIQuickEntry.test.tsx`
- Modify: `src/components/AIQuickEntry.tsx`
- Delete: `src/components/AIEntrySkeleton.tsx`
- Delete: `src/components/AIEntrySkeleton.test.tsx`

- [ ] **Step 1: Replace integration tests with rapid queue behavior tests**

Replace `src/components/AIQuickEntry.test.tsx` with:

```tsx
import React from "react";

import { useAIQuickEntryStore } from "@/stores/ai-quick-entry-store";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AIQuickEntry from "./AIQuickEntry";

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

const openOverlay = () => {
  act(() => {
    useAIQuickEntryStore.getState().setOpen(true);
  });
};

const typeAndSend = (text: string) => {
  fireEvent.change(screen.getByLabelText("Describe your expense"), {
    target: { value: text },
  });
  fireEvent.click(screen.getByLabelText("Send expense"));
};

const advanceParse = async () => {
  await act(async () => {
    vi.advanceTimersByTime(1300);
  });
};

describe("AIQuickEntry", () => {
  it("renders nothing when closed", () => {
    render(<AIQuickEntry />);
    expect(
      screen.queryByLabelText("Describe your expense")
    ).not.toBeInTheDocument();
  });

  it("shows and focuses the composer when opened", () => {
    const focusSpy = vi
      .spyOn(HTMLInputElement.prototype, "focus")
      .mockImplementation(() => {});

    render(<AIQuickEntry />);
    openOverlay();

    expect(screen.getByLabelText("Describe your expense")).toBeInTheDocument();
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });

    focusSpy.mockRestore();
  });

  it("disables send for empty input", () => {
    render(<AIQuickEntry />);
    openOverlay();

    expect(screen.getByLabelText("Send expense")).toBeDisabled();
  });

  it("renders one pending row and clears the composer after submit", () => {
    render(<AIQuickEntry />);
    openOverlay();

    act(() => {
      typeAndSend("Cà phê 35k");
    });

    expect(screen.getByText("Cà phê 35k")).toBeInTheDocument();
    expect(screen.getByText("--")).toBeInTheDocument();
    expect(screen.getByLabelText("Describe your expense")).toHaveValue("");
    expect(screen.queryByText(/\+1 parsing/)).not.toBeInTheDocument();
  });

  it("collapses multiple pending entries and expands them on stack tap", () => {
    render(<AIQuickEntry />);
    openOverlay();

    act(() => {
      typeAndSend("first");
      typeAndSend("second");
      typeAndSend("third");
      typeAndSend("newest");
    });

    expect(screen.getByText("newest")).toBeInTheDocument();
    expect(screen.queryByText("first")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("ai-pending-stack-card")).toHaveLength(3);
    expect(screen.getByText("+3 parsing")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Expand 4 pending expenses"));

    expect(screen.getByText("newest")).toBeInTheDocument();
    expect(screen.getByText("third")).toBeInTheDocument();
    expect(screen.getByText("second")).toBeInTheDocument();
    expect(screen.getByText("first")).toBeInTheDocument();
  });

  it("shows resolved rows for 3 seconds then moves them behind the status bar", async () => {
    render(<AIQuickEntry />);
    openOverlay();

    act(() => {
      typeAndSend("Cà phê 35k");
    });

    await advanceParse();

    expect(screen.getByText("Cà phê 35k")).toBeInTheDocument();
    expect(screen.getByText("-35K")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.queryByText("Cà phê 35k")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Show completed entries/));

    expect(screen.getByText("Cà phê 35k")).toBeInTheDocument();
  });

  it("keeps pending stack updated when one entry resolves", async () => {
    render(<AIQuickEntry />);
    openOverlay();

    act(() => {
      typeAndSend("first");
      typeAndSend("second");
    });

    await advanceParse();

    await waitFor(() => {
      expect(screen.queryByText("+1 parsing")).not.toBeInTheDocument();
    });
  });

  it("clears entries when reopened", async () => {
    render(<AIQuickEntry />);
    openOverlay();

    act(() => {
      typeAndSend("first");
    });
    await advanceParse();

    act(() => {
      useAIQuickEntryStore.getState().setOpen(false);
    });
    openOverlay();

    expect(screen.queryByText("first")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/AI quick entry status/)).toBeNull();
  });

  it("renders nothing on the /ai route", () => {
    mockPathname = "/ai";
    render(<AIQuickEntry />);
    openOverlay();

    expect(
      screen.queryByLabelText("Describe your expense")
    ).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run integration test to verify it fails**

Run:

```bash
rtk bunx vitest run src/components/AIQuickEntry.test.tsx
```

Expected: FAIL because `AIQuickEntry.tsx` still renders `AIEntrySkeleton` / `ExpenseListItem` and does not implement stack/status/timer behavior.

- [ ] **Step 3: Replace AIQuickEntry implementation**

Replace `src/components/AIQuickEntry.tsx` with:

```tsx
"use client";

import React, {
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useId,
  useMemo,
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

import AIQuickEntryPendingStack from "@/components/ai-quick-entry/AIQuickEntryPendingStack";
import AIQuickEntryRow from "@/components/ai-quick-entry/AIQuickEntryRow";
import AIQuickEntryStatusBar from "@/components/ai-quick-entry/AIQuickEntryStatusBar";
import type { QuickEntry } from "@/components/ai-quick-entry/types";
import { useSettingsStore } from "@/components/providers/StoreProvider";

const HIDDEN_PATHS = ["/ai"];

const RESOLVE_DELAY_MS = 1200;
const RESOLVED_VISIBLE_MS = 3000;

const createEntryId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const newestFirst = (entries: QuickEntry[]) => [...entries].reverse();

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
  const [completedOpen, setCompletedOpen] = useState(false);
  const [pendingStackExpanded, setPendingStackExpanded] = useState(false);
  const [visibleResolvedIds, setVisibleResolvedIds] = useState<Set<string>>(
    () => new Set()
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const hidden = HIDDEN_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  const clearTimers = () => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current = [];
  };

  useEffect(() => {
    if (open) {
      clearTimers();
      setEntries([]);
      setComposer("");
      setCompletedOpen(false);
      setPendingStackExpanded(false);
      setVisibleResolvedIds(new Set());
    }
  }, [open]);

  useEffect(() => {
    if (!open || hidden) {
      return;
    }

    inputRef.current?.focus({ preventScroll: true });
  }, [hidden, open]);

  useEffect(
    () => () => {
      clearTimers();
    },
    []
  );

  const pendingEntries = useMemo(
    () => entries.filter((entry) => entry.status === "pending"),
    [entries]
  );
  const activeResolvedEntries = useMemo(
    () =>
      entries.filter(
        (entry) =>
          entry.status === "resolved" && visibleResolvedIds.has(entry.id)
      ),
    [entries, visibleResolvedIds]
  );
  const completedEntries = useMemo(
    () =>
      newestFirst(
        entries.filter(
          (entry) => entry.status === "resolved" || entry.status === "failed"
        )
      ),
    [entries]
  );
  const failedCount = entries.filter(
    (entry) => entry.status === "failed"
  ).length;
  const completedCount = entries.filter(
    (entry) => entry.status === "resolved"
  ).length;

  useEffect(() => {
    if (pendingEntries.length === 0) {
      setPendingStackExpanded(false);
    }
  }, [pendingEntries.length]);

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

    const parseTimer = setTimeout(() => {
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
      setVisibleResolvedIds((current) => new Set(current).add(id));

      const hideTimer = setTimeout(() => {
        setVisibleResolvedIds((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
      }, RESOLVED_VISIBLE_MS);
      timersRef.current.push(hideTimer);
    }, RESOLVE_DELAY_MS);
    timersRef.current.push(parseTimer);
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
  const hasEntries = entries.length > 0;

  return (
    <div
      className="fixed inset-0 z-[60]"
      role="dialog"
      aria-label="AI quick entry"
    >
      <button
        type="button"
        aria-label="Dismiss AI quick entry"
        onClick={close}
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
      />

      <div
        className="absolute inset-x-0 bottom-0 flex flex-col"
        style={{ paddingBottom: keyboardOffset } as CSSProperties}
      >
        <div className="no-scrollbar mx-auto flex max-h-[50vh] w-full max-w-[390px] flex-col gap-2.5 overflow-y-auto px-4 pb-2">
          {hasEntries ? (
            <AIQuickEntryStatusBar
              totalCount={entries.length}
              pendingCount={pendingEntries.length}
              completedCount={completedCount}
              failedCount={failedCount}
              completedOpen={completedOpen}
              onToggleCompleted={() => setCompletedOpen((current) => !current)}
            />
          ) : null}

          {completedOpen && completedEntries.length > 0 ? (
            <div className="no-scrollbar max-h-44 space-y-2 overflow-y-auto">
              {completedEntries.map((entry) => (
                <AIQuickEntryRow
                  key={entry.id}
                  entry={entry}
                  variant={entry.status === "failed" ? "failed" : "resolved"}
                />
              ))}
            </div>
          ) : null}

          {activeResolvedEntries.map((entry) => (
            <AIQuickEntryRow key={entry.id} entry={entry} variant="resolved" />
          ))}

          <AIQuickEntryPendingStack
            pendingEntries={pendingEntries}
            expanded={pendingStackExpanded}
            onToggleExpanded={() =>
              setPendingStackExpanded((current) => !current)
            }
          />
        </div>

        <div className="px-4 pb-2">
          <form
            onSubmit={handleSubmit}
            className="flex w-full max-w-[390px] items-center gap-2"
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
  );
};

export default AIQuickEntry;
```

- [ ] **Step 4: Delete old skeleton files**

Delete:

```bash
rm src/components/AIEntrySkeleton.tsx src/components/AIEntrySkeleton.test.tsx
```

- [ ] **Step 5: Run integration test to verify it passes**

Run:

```bash
rtk bunx vitest run src/components/AIQuickEntry.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Run focused component test suite**

Run:

```bash
rtk bunx vitest run src/components/AIQuickEntry.test.tsx src/components/ai-quick-entry/AIQuickEntryRow.test.tsx src/components/ai-quick-entry/AIQuickEntryPendingStack.test.tsx src/components/ai-quick-entry/AIQuickEntryStatusBar.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Format and lint modified TypeScript/TSX scope**

Run:

```bash
rtk bunx prettier --write src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx src/components/ai-quick-entry/types.ts src/components/ai-quick-entry/AIQuickEntryRow.tsx src/components/ai-quick-entry/AIQuickEntryRow.test.tsx src/components/ai-quick-entry/AIQuickEntryPendingStack.tsx src/components/ai-quick-entry/AIQuickEntryPendingStack.test.tsx src/components/ai-quick-entry/AIQuickEntryStatusBar.tsx src/components/ai-quick-entry/AIQuickEntryStatusBar.test.tsx
rtk bunx prettier --check src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx src/components/ai-quick-entry/types.ts src/components/ai-quick-entry/AIQuickEntryRow.tsx src/components/ai-quick-entry/AIQuickEntryRow.test.tsx src/components/ai-quick-entry/AIQuickEntryPendingStack.tsx src/components/ai-quick-entry/AIQuickEntryPendingStack.test.tsx src/components/ai-quick-entry/AIQuickEntryStatusBar.tsx src/components/ai-quick-entry/AIQuickEntryStatusBar.test.tsx
rtk bunx eslint src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx src/components/ai-quick-entry/types.ts src/components/ai-quick-entry/AIQuickEntryRow.tsx src/components/ai-quick-entry/AIQuickEntryRow.test.tsx src/components/ai-quick-entry/AIQuickEntryPendingStack.tsx src/components/ai-quick-entry/AIQuickEntryPendingStack.test.tsx src/components/ai-quick-entry/AIQuickEntryStatusBar.tsx src/components/ai-quick-entry/AIQuickEntryStatusBar.test.tsx
```

Expected: Prettier check passes; ESLint exits 0.

- [ ] **Step 8: Commit**

```bash
rtk git add src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx src/components/ai-quick-entry src/components/AIEntrySkeleton.tsx src/components/AIEntrySkeleton.test.tsx
rtk git commit -m "feat(ai-quick-entry): integrate rapid queue overlay"
```

## Task 6: Final Verification

**Files:**

- Verify all files touched by Tasks 1-5.

- [ ] **Step 1: Run focused test suite**

Run:

```bash
rtk bunx vitest run src/components/AIQuickEntry.test.tsx src/components/ai-quick-entry/AIQuickEntryRow.test.tsx src/components/ai-quick-entry/AIQuickEntryPendingStack.test.tsx src/components/ai-quick-entry/AIQuickEntryStatusBar.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run required formatter and lint checks**

Run:

```bash
rtk bunx prettier --check src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx src/components/ai-quick-entry/types.ts src/components/ai-quick-entry/AIQuickEntryRow.tsx src/components/ai-quick-entry/AIQuickEntryRow.test.tsx src/components/ai-quick-entry/AIQuickEntryPendingStack.tsx src/components/ai-quick-entry/AIQuickEntryPendingStack.test.tsx src/components/ai-quick-entry/AIQuickEntryStatusBar.tsx src/components/ai-quick-entry/AIQuickEntryStatusBar.test.tsx
rtk bunx eslint src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx src/components/ai-quick-entry/types.ts src/components/ai-quick-entry/AIQuickEntryRow.tsx src/components/ai-quick-entry/AIQuickEntryRow.test.tsx src/components/ai-quick-entry/AIQuickEntryPendingStack.tsx src/components/ai-quick-entry/AIQuickEntryPendingStack.test.tsx src/components/ai-quick-entry/AIQuickEntryStatusBar.tsx src/components/ai-quick-entry/AIQuickEntryStatusBar.test.tsx
```

Expected: Prettier check passes; ESLint exits 0.

- [ ] **Step 3: Inspect final diff**

Run:

```bash
rtk git diff --stat
rtk git diff -- src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx src/components/ai-quick-entry
```

Expected: Diff shows only AI Quick Entry rapid queue work and deletion of obsolete skeleton files.

## Self-Review

**Spec coverage:** Tasks cover one-line rows, no chat bubbles, no `ExpenseListItem` in the queue, pending stack collapsed by default, max three visible stack cards, tap-to-expand pending list, resolved rows visible for `3s`, status bar completed view, local-only state, `/ai` suppression, and close/reopen reset.

**Placeholder scan:** This plan contains no `TBD`, `TODO`, "similar to", or unspecified implementation steps.

**Type consistency:** `QuickEntry`, `QuickEntryStatus`, `AIQuickEntryRowProps`, `AIQuickEntryPendingStackProps`, and `AIQuickEntryStatusBarProps` are defined once and reused consistently across tasks.
