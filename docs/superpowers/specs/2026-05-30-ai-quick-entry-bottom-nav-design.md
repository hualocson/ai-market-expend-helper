# AI Quick-Entry from Bottom Nav — Design (Smoke Phase)

**Date:** 2026-05-30
**Branch:** `dev-polish-chat`
**Status:** Approved design, ready for implementation plan

## Summary

Add a second, lighter way to log an expense via AI, living in the bottom navigation. Tapping a new AI button opens an inline overlay with a text input pinned above the keyboard and a chat-style stack of entries above it. Submitting shows a skeleton expense row that resolves into a real expense-row card populated with mock data.

This phase is **UI-only ("full mock, inert actions")**: the parse step is faked with a timer and canned result; the resolved card's Edit affordance is a non-functional placeholder. The real `parse-expense` API call and create/edit wiring come in a later integration phase.

The existing full-page `/ai` chat (`AIExpenseChat.tsx`), its `parse-expense` API, the header "Spendly AI" button, and the onboarding card all stay untouched. The two AI surfaces **coexist**.

## Goals

- New AI trigger button in the bottom nav, on the right side, immediately **before** the `＋` Add button.
- Inline overlay: scrim + chat stack + fixed composer above the keyboard, send button on the right.
- Submit (tap send or Enter) appends a user bubble + a skeleton expense card; after a fake delay the skeleton swaps to a **real `ExpenseListItem`** rendered with mock data.
- Dismiss via tap-outside (scrim) or swipe-down; entries reset on each open.

## Non-Goals (this phase)

- No real `parse-expense` API call.
- No create mutation / persistence.
- No working Edit/Add actions on the resolved card (inert placeholders with `// TODO: integrate` seams).
- No changes to the existing `/ai` full-page chat.
- No budget suggestion, no confidence/auto-add logic (that lives in `AIExpenseChat` and is out of scope here).

## Architecture

One new self-contained client component, a small nav change, a tiny Zustand slice, and a presentational skeleton/result component. No refactor of the existing `/ai` chat.

### `AIQuickEntry.tsx` (new, `src/components/`)

- Owns local state: `composer` (string) and `entries` (the chat stack array).
- Reads `open` from a Zustand slice (see below). Clears `entries` when `open` transitions to true (fresh stack each open) and on close.
- Mounted **once** in `layout.tsx` as a sibling of `<BottomNav />`, inside `SettingsStoreProvider` so it overlays every page and can read settings (e.g. `paidBy`).
- When closed: renders nothing.
- When open: renders a scrim (dim background), the chat stack, and a fixed composer positioned above the keyboard.
- Uses `useKeyboardOffset()` for `bottom: calc(${offset}px + …)` positioning, matching the existing `QuickExpenseDrawer` pattern.
- Suppressed on `/ai` (same `hiddenPaths` check BottomNav uses).

### `BottomNav.tsx` (changed)

- Add an AI trigger button in the right cluster, **before** the `＋` Add circle.
- Same glass-circle styling as the Add button; lime sparkles icon (`✦` / `Sparkles` from lucide), using the real `--primary` lime `#b8f34a` as the icon accent.
- On tap: calls the Zustand slice's `open()`. Fires a haptic (`haptics.impact("medium")`), matching the Add button.
- Suppressed on `/ai` (button is inside the already-hidden nav).

### `AIEntrySkeleton.tsx` + resolved rendering (new, `src/components/`)

- **Skeleton:** presentational component mirroring `ExpenseListItem`'s exact wrapper, spacing, and internal layout (icon circle + note line + category/budget row + amount), with shimmer animation — so pending → resolved has no layout shift.
- **Resolved:** renders the **actual `ExpenseListItem`** with a complete mock `ExpenseListItemData` object and an **inert `onEditExpense` no-op** (the `// TODO: integrate` seam). This yields a genuine expense-row appearance for free while keeping actions inert.

### Zustand slice (new, `src/stores/`)

- `aiQuickEntry` store: `{ open: boolean; setOpen(v: boolean): void }` (or `open()`/`close()` actions).
- BottomNav's AI button calls `open()`; `AIQuickEntry` subscribes to `open`.
- No entry data in the store — entries are local component state, reset on each open. Matches the project's existing Zustand pattern; avoids prop drilling and stringly-typed DOM events.

## Data Flow

### Entry state shape (local to `AIQuickEntry`)

```ts
type QuickEntry = {
  id: string;
  input: string;                 // raw user text (bubble)
  status: "pending" | "resolved";
  result?: ExpenseListItemData;  // present when resolved
};
```

### Submit flow (mocked)

1. User types, then taps send or hits Enter (Enter submits; Shift+Enter inserts a newline — mirrors the existing chat composer).
2. Push `{ status: "pending", input }`, clear composer, keep focus so the keyboard stays up for rapid entry.
3. `setTimeout` (~1.2s) flips that entry to `status: "resolved"` with a canned result from a single helper, `mockParseExpense(input)`. This helper is the **one function swapped for the real `parse-expense` call** in the integration phase.
4. Skeleton card swaps to a real `ExpenseListItem` rendered with the mock `ExpenseListItemData`.

### `mockParseExpense(input)` output

Returns a complete `ExpenseListItemData`, e.g.:

```ts
{
  id: <mockId>,
  date: <today, YYYY-MM-DD>,
  amount: 35000,
  note: "Cà phê",
  category: "Drinks",
  paidBy: <from settings store>,
  budgetId: null,
  budgetName: null,
  budgetIcon: null,
  budgetColor: null,
  syncStatus: "synced",
}
```

### Stack rendering

- Newest entry at the bottom, directly above the composer; reads upward (matches the visual mock).
- Stack scrolls if it overflows; capped max height so the composer stays anchored.

## Interaction & Edge Cases

- **Empty / whitespace input:** send button disabled when composer is empty or whitespace-only (mirrors existing chat's `!trimmedComposer`).
- **Rapid submits:** allowed. Each tap adds a new pending entry; each has its own timer and resolves independently. No global loading lock.
- **iOS keyboard / focus:** send button uses `onPointerDown={(e) => e.preventDefault()}` so tapping it does not blur the input or drop the keyboard (per `.agents/rules/ios-input-focus.md`). Composer keeps focus after submit.
- **Dismiss:** tapping the scrim or swiping the composer/stack down closes the overlay; `entries` cleared on close; input blurred (keyboard dismisses).
- **Open behavior:** background dims via scrim; the scrim sits above the nav's `z-50` so the AI/Add circles are covered while open.
- **Route `/ai`:** overlay and its nav trigger suppressed (the full-page chat already covers that use case).
- **Safe area:** composer respects `env(safe-area-inset-bottom)` when the keyboard is closed and `keyboardOffset` when open — same calc `QuickExpenseDrawer` uses.

## Visual Reference

Token-faithful mockup in `.superpowers/brainstorm/.../content/nav-and-input.html`. Key tokens: background `#090d10`, surfaces `#11161b`/`#181f26`, brand/primary lime `#b8f34a`, destructive (amounts) `#fb7185`. Nav circles use the existing glass gradient + `backdrop-blur` styling.

## Testing

Vitest + React Testing Library, behavior-focused (project convention):

- **`AIQuickEntry.test.tsx`:**
  - Opening via the store makes the overlay visible.
  - Typing + send appends a pending entry (skeleton).
  - After advancing timers (`vi.useFakeTimers`), the entry resolves and renders an expense row with the mock data.
  - Empty/whitespace input keeps send disabled.
  - Dismiss clears entries; reopening starts empty.
- **`BottomNav` (extend existing `BottomNav.test.tsx`):** AI trigger renders before the Add button and calls the store's `open()`.
- **Skeleton:** renders the expense-row shape (smoke-level assertion).
- **Inert actions:** assert the resolved row's edit handler is a no-op / not wired (light assertion; real behavior arrives in the integration phase).

## Integration Phase (later, out of scope now)

- Replace `mockParseExpense` with a call to `/api/ai/parse-expense` (reuse `ParseExpenseResponse` contract and `loadTodayBudgets` logic from `AIExpenseChat`).
- Wire the resolved card's Edit affordance to the existing `QuickExpenseDrawer` prefill flow (`dispatchExpensePrefill`).
- Decide auto-add vs. confirm behavior (the chosen direction was auto-add + edit affordance; align with `AIExpenseChat.handleResult`).
- Optional: persist the stack across opens during a session.

## Files Touched

| File | Change |
| --- | --- |
| `src/components/AIQuickEntry.tsx` | New — overlay, composer, chat stack, mock submit flow |
| `src/components/AIEntrySkeleton.tsx` | New — skeleton matching `ExpenseListItem` |
| `src/stores/<ai-quick-entry>.ts` | New — Zustand `open` slice |
| `src/components/BottomNav.tsx` | Add AI trigger button before Add; call store `open()` |
| `src/app/layout.tsx` | Mount `<AIQuickEntry />` beside `<BottomNav />` |
| `src/lib/<mock-parse-expense>.ts` | New — `mockParseExpense(input)` helper (the swap seam) |
| `src/components/AIQuickEntry.test.tsx` | New tests |
| `src/components/BottomNav.test.tsx` | Extend for AI trigger |
