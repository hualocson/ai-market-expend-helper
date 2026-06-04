# AI Quick Entry Expand Composer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an expanded multiline editing state for AI Quick Entry where multiline text shows an expand button inside the composer, and expanded mode grows the textarea to `80svh` with send inside bottom-right.

**Architecture:** Keep the change local to `AIQuickEntry.tsx` and its component tests. Use local React state for expanded/collapsed composer mode, derive multiline detection from the current composer value, and preserve the existing split-and-submit pipeline.

**Tech Stack:** React 19, Next.js App Router, TypeScript, Tailwind v4, lucide-react, Vitest, React Testing Library.

---

## File Structure

- Modify `src/components/AIQuickEntry.tsx`: add expand/collapse composer state, multiline detection, expanded height behavior, in-wrapper controls, and collapse lifecycle.
- Modify `src/components/AIQuickEntry.test.tsx`: add behavior coverage for expand visibility, expanded layout state, collapse behavior, and send-from-expanded behavior.
- Do not modify parser, API routes, mutation hooks, stores, or queue components.

## Task 1: Add Expand Composer Tests

**Files:**
- Modify: `src/components/AIQuickEntry.test.tsx`
- Test: `src/components/AIQuickEntry.test.tsx`

- [ ] **Step 1: Add a helper for the composer element**

Add this helper near the existing `typeComposerText` helper:

```tsx
const getComposer = () => screen.getByLabelText("Describe your expense");
```

Update `typeComposerText` to use it:

```tsx
const typeComposerText = (text: string) => {
  fireEvent.change(getComposer(), {
    target: { value: text },
  });
};
```

- [ ] **Step 2: Add hidden/visible expand button tests**

Add these tests near the existing multiline composer tests:

```tsx
it("hides the composer expand button for single-line input", () => {
  renderQuickEntry();
  openOverlay();

  typeComposerText("Cà phê 35k");

  expect(screen.queryByLabelText("Expand composer")).not.toBeInTheDocument();
});

it("shows the composer expand button for multiline input", () => {
  renderQuickEntry();
  openOverlay();

  typeComposerText("Cà phê 35k\nCơm trưa 60k");

  expect(screen.getByLabelText("Expand composer")).toBeInTheDocument();
});
```

- [ ] **Step 3: Add expanded/collapsed behavior test**

Add this test near the tests from Step 2:

```tsx
it("expands and collapses the multiline composer", () => {
  renderQuickEntry();
  openOverlay();

  typeComposerText("Cà phê 35k\nCơm trưa 60k");

  fireEvent.click(screen.getByLabelText("Expand composer"));

  expect(getComposer()).toHaveAttribute("data-expanded", "true");
  expect(screen.getByLabelText("Collapse composer")).toBeInTheDocument();
  expect(screen.getByLabelText("Send expense")).toHaveAttribute(
    "data-inside-composer",
    "true"
  );

  fireEvent.click(screen.getByLabelText("Collapse composer"));

  expect(getComposer()).toHaveAttribute("data-expanded", "false");
  expect(screen.getByLabelText("Expand composer")).toBeInTheDocument();
  expect(screen.getByLabelText("Send expense")).toHaveAttribute(
    "data-inside-composer",
    "false"
  );
});
```

- [ ] **Step 4: Add auto-collapse when newlines are removed**

Add:

```tsx
it("auto-collapses when expanded composer becomes single-line", () => {
  renderQuickEntry();
  openOverlay();

  typeComposerText("Cà phê 35k\nCơm trưa 60k");
  fireEvent.click(screen.getByLabelText("Expand composer"));

  typeComposerText("Cà phê 35k");

  expect(getComposer()).toHaveAttribute("data-expanded", "false");
  expect(screen.queryByLabelText("Collapse composer")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Expand composer")).not.toBeInTheDocument();
});
```

- [ ] **Step 5: Add send-from-expanded behavior test**

Add:

```tsx
it("sends multiline entries and collapses from expanded composer", () => {
  mockUnresolvedParseResponse();
  renderQuickEntry();
  openOverlay();

  typeComposerText("Cà phê 35k\nCơm trưa 60k");
  fireEvent.click(screen.getByLabelText("Expand composer"));
  fireEvent.click(screen.getByLabelText("Send expense"));

  expect(screen.getByText("Cơm trưa 60k")).toBeInTheDocument();
  expect(screen.getByText("Cà phê 35k")).toBeInTheDocument();
  expect(getComposer()).toHaveValue("");
  expect(getComposer()).toHaveAttribute("data-expanded", "false");
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run:

```bash
rtk bunx vitest run src/components/AIQuickEntry.test.tsx
```

Expected: the new tests fail because `Expand composer`, `Collapse composer`, `data-expanded`, and `data-inside-composer` do not exist yet.

## Task 2: Implement Expand Composer State And Controls

**Files:**
- Modify: `src/components/AIQuickEntry.tsx`
- Test: `src/components/AIQuickEntry.test.tsx`

- [ ] **Step 1: Add icon imports**

Change:

```tsx
import { ArrowUp, XIcon } from "lucide-react";
```

To:

```tsx
import { ArrowUp, Maximize2, Minimize2, XIcon } from "lucide-react";
```

- [ ] **Step 2: Add expanded state and multiline flag**

After the existing composer state:

```tsx
const [composer, setComposer] = useState("");
```

Add:

```tsx
const [composerExpanded, setComposerExpanded] = useState(false);
const hasMultipleComposerLines = composer.includes("\n");
```

- [ ] **Step 3: Collapse on close/open reset and single-line input**

In the `useEffect` that resets state on `open`, add `setComposerExpanded(false)` in both close and open paths:

```tsx
if (!open) {
  setActiveDrawerItem(null);
  activeDrawerItemRef.current = null;
  setComposerExpanded(false);
  return;
}

setMode("entry");
setComposer("");
setComposerExpanded(false);
setActiveDrawerItem(null);
activeDrawerItemRef.current = null;
```

Add a new effect after it:

```tsx
useEffect(() => {
  if (!hasMultipleComposerLines && composerExpanded) {
    setComposerExpanded(false);
  }
}, [composerExpanded, hasMultipleComposerLines]);
```

- [ ] **Step 4: Update textarea height effect**

Replace the current height effect body:

```tsx
composerElement.style.height = "auto";
composerElement.style.height = `${Math.min(
  composerElement.scrollHeight,
  QUICK_ENTRY_COMPOSER_MAX_HEIGHT
)}px`;
```

With:

```tsx
if (composerExpanded) {
  composerElement.style.height = "80svh";
  return;
}

composerElement.style.height = "auto";
composerElement.style.height = `${Math.min(
  composerElement.scrollHeight,
  QUICK_ENTRY_COMPOSER_MAX_HEIGHT
)}px`;
```

Update the dependency list from:

```tsx
}, [composer]);
```

To:

```tsx
}, [composer, composerExpanded]);
```

- [ ] **Step 5: Collapse when opening preview and sending**

In `openPreview`, add `setComposerExpanded(false)` before blurring:

```tsx
const openPreview = () => {
  setMode("preview");
  setComposerExpanded(false);
  inputRef.current?.blur();
};
```

In `submit`, after `setComposer("")`, add:

```tsx
setComposerExpanded(false);
```

- [ ] **Step 6: Extract send button element**

Before `return`, add:

```tsx
const sendButton = (
  <button
    type="submit"
    aria-label="Send expense"
    data-inside-composer={composerExpanded ? "true" : "false"}
    disabled={!canSend}
    onPointerDown={(event) => event.preventDefault()}
    className={cn(
      "ds-glass glass-border text-primary-foreground grid size-12 shrink-0 place-items-center rounded-full !text-white transition-opacity",
      composerExpanded && "absolute right-2 bottom-2",
      !canSend && "opacity-40"
    )}
  >
    <ArrowUp className="size-4" />
  </button>
);
```

- [ ] **Step 7: Add wrapper class names**

Before `sendButton`, add:

```tsx
const composerWrapperClassName = cn(
  "relative flex-1",
  composerExpanded && "w-full"
);

const composerTextareaClassName = cn(
  "text-foreground placeholder:text-muted-foreground/70 ds-glass glass-border field-sizing-content max-h-32 min-h-12 w-full resize-none overflow-y-auto rounded-[24px] border-0 bg-transparent px-4 py-3 text-base outline-none",
  hasMultipleComposerLines && "pr-12",
  composerExpanded && "h-[80svh] max-h-[80svh] pb-16"
);
```

- [ ] **Step 8: Replace composer JSX**

Replace the existing textarea and button block inside the form with:

```tsx
<div className={composerWrapperClassName}>
  <textarea
    id={inputId}
    ref={inputRef}
    value={composer}
    onChange={(event) => setComposer(event.target.value)}
    placeholder="Cà phê 35k"
    rows={1}
    data-expanded={composerExpanded ? "true" : "false"}
    className={composerTextareaClassName}
  />
  {hasMultipleComposerLines ? (
    <button
      type="button"
      aria-label={composerExpanded ? "Collapse composer" : "Expand composer"}
      onPointerDown={(event) => event.preventDefault()}
      onClick={() => {
        setComposerExpanded((expanded) => !expanded);
        haptics.selection();
      }}
      className="text-muted-foreground ds-glass glass-border absolute top-2 right-2 grid size-8 place-items-center rounded-full transition-opacity active:scale-95"
    >
      {composerExpanded ? (
        <Minimize2 className="size-4" />
      ) : (
        <Maximize2 className="size-4" />
      )}
    </button>
  ) : null}
  {composerExpanded ? sendButton : null}
</div>
{composerExpanded ? null : sendButton}
```

- [ ] **Step 9: Run component tests**

Run:

```bash
rtk bunx vitest run src/components/AIQuickEntry.test.tsx
```

Expected: all tests pass.

## Task 3: Polish, Verify, And Commit

**Files:**
- Modify: `src/components/AIQuickEntry.tsx`
- Modify: `src/components/AIQuickEntry.test.tsx`

- [ ] **Step 1: Format modified files**

Run:

```bash
rtk bunx prettier --write src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx
```

Expected: Prettier completes successfully.

- [ ] **Step 2: Check formatting**

Run:

```bash
rtk bunx prettier --check src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx
```

Expected: output includes `All matched files use Prettier code style!`.

- [ ] **Step 3: Run ESLint**

Run:

```bash
rtk bunx eslint src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx
```

Expected: exits successfully with no lint errors.

- [ ] **Step 4: Run focused tests**

Run:

```bash
rtk bunx vitest run src/components/AIQuickEntry.test.tsx
```

Expected: all AI Quick Entry tests pass.

- [ ] **Step 5: Review diff**

Run:

```bash
rtk git diff -- src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx docs/superpowers/plans/2026-06-03-ai-quick-entry-expand-composer.md
```

Expected: diff only includes composer expanded-state behavior, tests, and this plan.

- [ ] **Step 6: Commit**

Run:

```bash
rtk git status --short
rtk git add src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx docs/superpowers/plans/2026-06-03-ai-quick-entry-expand-composer.md
rtk git commit -m "feat: expand ai quick entry composer"
```

Expected: commit succeeds. Leave unrelated `.codex-screenshots/` unstaged.

## Self-Review

- Spec coverage: The plan covers multiline detection, top-right in-composer expand button, `80svh` expanded height, internal scroll behavior, send button inside bottom-right in expanded mode, collapse triggers, tests, and required validation.
- Placeholder scan: No placeholder tasks or unspecified test work remain.
- Type consistency: The plan uses `composerExpanded`, `hasMultipleComposerLines`, `data-expanded`, and `data-inside-composer` consistently.
