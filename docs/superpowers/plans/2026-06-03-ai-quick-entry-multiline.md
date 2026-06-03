# AI Quick Entry Multiline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let AI Quick Entry accept multiple expenses in one composer, with Enter adding new lines and the send button submitting one independent expense per non-empty line.

**Architecture:** Keep the parser API unchanged and split the textarea content locally in `AIQuickEntry.tsx`. Each split line reuses the existing `enqueueEntry(line)` and `runEntry(entry.id, line)` pipeline, preserving queue, preview, review, toast, haptics, budget query, and mutation ownership.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, TanStack Query, Zustand, Tailwind v4, Vitest, React Testing Library.

---

## File Structure

- Modify `src/components/AIQuickEntry.tsx`: replace the single-line input with a textarea, add a line-splitting helper, remove Enter-to-submit behavior, and submit one queued entry per non-empty line.
- Modify `src/components/AIQuickEntry.test.tsx`: add behavior tests for newline input, multiline send, blank-line filtering, composer clearing, and preserved single-line auto-save.
- No API, parser, mutation, store, or schema files should change.

## Task 1: Add Multiline Composer Tests

**Files:**
- Modify: `src/components/AIQuickEntry.test.tsx`
- Test: `src/components/AIQuickEntry.test.tsx`

- [ ] **Step 1: Add a multiline typing helper in the test file**

Add this helper near the existing `typeAndSend` helper:

```tsx
const typeComposerText = (text: string) => {
  fireEvent.change(screen.getByLabelText("Describe your expense"), {
    target: { value: text },
  });
};
```

Then simplify `typeAndSend` to reuse it:

```tsx
const typeAndSend = (text: string) => {
  typeComposerText(text);
  fireEvent.click(screen.getByLabelText("Send expense"));
};
```

- [ ] **Step 2: Add the Enter/newline behavior test**

Add this test inside `describe("AIQuickEntry", () => { ... })`, near the existing composer behavior tests:

```tsx
it("keeps newline text in the composer when Enter is used", () => {
  mockUnresolvedParseResponse();
  renderQuickEntry();
  openOverlay();

  const composer = screen.getByLabelText("Describe your expense");

  fireEvent.change(composer, {
    target: { value: "Cà phê 35k\nCơm trưa 60k" },
  });
  fireEvent.keyDown(composer, { key: "Enter", code: "Enter" });

  expect(composer).toHaveValue("Cà phê 35k\nCơm trưa 60k");
  expect(
    screen.queryByTestId("ai-quick-entry-pending-queue")
  ).not.toBeInTheDocument();
});
```

- [ ] **Step 3: Add the multiline send test**

Add this test near `"renders one active row and clears the composer after submit"`:

```tsx
it("submits each non-empty composer line as an active entry", () => {
  mockUnresolvedParseResponse();
  renderQuickEntry();
  openOverlay();

  act(() => {
    typeAndSend("Cà phê 35k\n\n  Cơm trưa 60k  \nGrab 42k");
  });

  expect(screen.getByText("Cà phê 35k")).toBeInTheDocument();
  expect(screen.getByText("Grab 42k")).toBeInTheDocument();
  expect(screen.queryByText("Cơm trưa 60k")).not.toBeInTheDocument();
  expect(screen.getByText("+1 more active")).toBeInTheDocument();
  expect(screen.getByLabelText("Describe your expense")).toHaveValue("");
});
```

This expects the existing active queue cap of two visible rows. The middle valid line should be hidden behind `+1 more active`, proving blank lines were ignored and three entries were enqueued.

- [ ] **Step 4: Add the blank-only send-disabled test**

Add this test near `"disables send for empty input"`:

```tsx
it("disables send for blank multiline input", () => {
  renderQuickEntry();
  openOverlay();

  typeComposerText("  \n\n  ");

  expect(screen.getByLabelText("Send expense")).toBeDisabled();
});
```

- [ ] **Step 5: Run tests to verify they fail**

Run:

```bash
rtk bunx vitest run src/components/AIQuickEntry.test.tsx
```

Expected: at least the new tests fail because the current composer is an `<input>`, Enter submits, and `submit()` enqueues the whole composer as one entry instead of splitting lines.

## Task 2: Implement Multiline Composer Behavior

**Files:**
- Modify: `src/components/AIQuickEntry.tsx`
- Test: `src/components/AIQuickEntry.test.tsx`

- [ ] **Step 1: Update React imports**

In `src/components/AIQuickEntry.tsx`, remove `type KeyboardEvent` from the React import list.

Before:

```tsx
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  useCallback,
```

After:

```tsx
  type CSSProperties,
  type FormEvent,
  useCallback,
```

- [ ] **Step 2: Add the line-splitting helper**

Add this helper near `newestFirst`:

```tsx
const splitQuickEntryComposerInput = (input: string): string[] =>
  input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
```

- [ ] **Step 3: Update the composer ref type**

Change:

```tsx
const inputRef = useRef<HTMLInputElement>(null);
```

To:

```tsx
const inputRef = useRef<HTMLTextAreaElement>(null);
```

- [ ] **Step 4: Split and enqueue each line on submit**

Replace the existing `submit` function:

```tsx
const submit = () => {
  const input = composer.trim();
  if (!input) {
    return;
  }

  const entry = enqueueEntry(input);
  setComposer("");
  haptics.impact("medium");
  void runEntry(entry.id, input);
};
```

With:

```tsx
const submit = () => {
  const inputs = splitQuickEntryComposerInput(composer);
  if (inputs.length === 0) {
    return;
  }

  const queuedEntries = inputs.map((input) => ({
    entry: enqueueEntry(input),
    input,
  }));

  setComposer("");
  haptics.impact("medium");

  queuedEntries.forEach(({ entry, input }) => {
    void runEntry(entry.id, input);
  });
};
```

- [ ] **Step 5: Remove the Enter-to-submit handler**

Delete the whole `handleKeyDown` function:

```tsx
const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
  if (event.key === "Enter") {
    event.preventDefault();
    submit();
  }
};
```

- [ ] **Step 6: Compute `canSend` from split lines**

Change:

```tsx
const canSend = composer.trim().length > 0;
```

To:

```tsx
const canSend = splitQuickEntryComposerInput(composer).length > 0;
```

- [ ] **Step 7: Replace the input with a textarea**

Replace the `<input ... />` composer element with:

```tsx
<textarea
  id={inputId}
  ref={inputRef}
  value={composer}
  onChange={(event) => setComposer(event.target.value)}
  placeholder={"Cà phê 35k\nCơm trưa 60k\nGrab 42k"}
  rows={1}
  className="text-foreground placeholder:text-muted-foreground/70 ds-glass glass-border max-h-32 min-h-12 flex-1 resize-none rounded-[24px] border-0 bg-transparent px-4 py-3 text-base outline-none"
/>
```

Do not add `onKeyDown` to this textarea. The browser should handle Enter by inserting a newline.

- [ ] **Step 8: Align the send button with the bottom of the textarea**

Change the form class from:

```tsx
className="mx-auto flex w-full max-w-[390px] items-center gap-2"
```

To:

```tsx
className="mx-auto flex w-full max-w-[390px] items-end gap-2"
```

- [ ] **Step 9: Run the targeted component test**

Run:

```bash
rtk bunx vitest run src/components/AIQuickEntry.test.tsx
```

Expected: all tests in `AIQuickEntry.test.tsx` pass.

## Task 3: Polish And Required Checks

**Files:**
- Modify: `src/components/AIQuickEntry.tsx`
- Modify: `src/components/AIQuickEntry.test.tsx`

- [ ] **Step 1: Format modified TSX files**

Run:

```bash
rtk bunx prettier --write src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx
```

Expected: Prettier completes and reports the two files as written or unchanged.

- [ ] **Step 2: Check formatting**

Run:

```bash
rtk bunx prettier --check src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx
```

Expected: output includes `All matched files use Prettier code style!`.

- [ ] **Step 3: Run ESLint on the modified scope**

Run:

```bash
rtk bunx eslint src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx
```

Expected: command exits successfully with no lint errors.

- [ ] **Step 4: Run the targeted test file again**

Run:

```bash
rtk bunx vitest run src/components/AIQuickEntry.test.tsx
```

Expected: all tests in `AIQuickEntry.test.tsx` pass.

- [ ] **Step 5: Review the diff**

Run:

```bash
rtk git diff -- src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx
```

Expected: diff only shows the textarea/multiline behavior and matching tests. It should not modify parser contracts, API routes, mutation hooks, stores, or unrelated UI.

- [ ] **Step 6: Commit the implementation**

Run:

```bash
rtk git status --short
rtk git add src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx docs/superpowers/plans/2026-06-03-ai-quick-entry-multiline.md
rtk git commit -m "feat: support multiline ai quick entry"
```

Expected: commit succeeds on branch `dev-ai-quick-entry-multiline`. Leave unrelated untracked files, such as `.codex-screenshots/`, unstaged.

## Self-Review

- Spec coverage: The plan covers textarea entry, Enter-as-newline behavior, send-button-only submit, newline splitting, blank-line filtering, preserved single-expense parser API, independent per-line lifecycle, tests, formatting, ESLint, and targeted Vitest validation.
- Placeholder scan: No `TBD`, `TODO`, unspecified error handling, or missing test instructions remain.
- Type consistency: The plan uses `HTMLTextAreaElement`, `splitQuickEntryComposerInput`, `composer`, `enqueueEntry`, and `runEntry` consistently across tasks.
