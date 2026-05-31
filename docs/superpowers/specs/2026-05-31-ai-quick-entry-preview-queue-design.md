# AI Quick Entry Preview Queue — Design

**Date:** 2026-05-31
**Branch:** `dev-polish-chat`
**Status:** Approved for implementation planning

## Summary

Refine AI Quick Entry so the keyboard-open entry surface stays compact on
iPhone 13/14 viewports. The current expandable pending stack/list competes with
the software keyboard and leaves too little usable space. Replace it with one
plain pending queue above the composer and move inspection into a dedicated
Preview Mode inside the same drawer.

The entry surface has only one pending display style:

```txt
[pulse] Cơm trưa 60k        --
[pulse] Bánh mì 25k         --
+3 more parsing

[ Cà phê 35k sáng nay    ↑ ]
```

Resolved entries do not appear in this pending queue. When parsing completes,
the pending row is removed and a toast-style confirmation appears. The status
bar remains the global summary and entry point into Preview Mode.

## Goals

- Keep AI Quick Entry compact while the iOS keyboard is open.
- Remove inline expanded pending-list behavior from Entry Mode.
- Show active pending work with predictable height.
- Let users inspect the whole session from Preview Mode.
- Keep Preview Mode inspection-only for this version.
- Preserve local-only mocked parse behavior until real parse/persistence work is
  specified separately.
- Prioritize mobile layout quality over desktop-specific optimization.

## Non-Goals

- No real expense persistence.
- No real AI parse integration.
- No row edit/review action in Preview Mode.
- No automatic switch to Preview Mode when pending count grows.
- No stack-card pending presentation.
- No scrollable pending list above the composer in Entry Mode.
- No change to the full `/ai` chat page.

## Existing Context

`AIQuickEntry.tsx` owns local composer state, local session entries, mocked parse
timers, resolved visibility, completed visibility, and pending stack expansion.
`AIQuickEntryPendingStack.tsx` currently renders either a collapsed stacked
pending presentation or an expanded scrollable pending list. That expanded list
is the main UX issue: when the virtual keyboard is open, the leftover viewport
is too small for a useful list.

This design keeps `AIQuickEntry.tsx` as the local session owner but replaces the
pending stack state with a simpler view mode:

```ts
type AIQuickEntryMode = "entry" | "preview";
```

## Entry Mode

Entry Mode is the default mode when the drawer opens. It keeps the composer
focused and optimized for rapid expense entry.

### Layout

From top to bottom:

1. Status bar in the drawer header.
2. Plain pending queue above the composer.
3. Composer fixed above the keyboard.

The pending queue is not a stack, not expandable inline, and not scrollable.

### Pending Queue Rules

- If there are no pending entries, hide the pending queue.
- If there is one pending entry, show one compact pending row.
- If there are two pending entries, show two compact pending rows.
- If there are more than two pending entries, show the two newest pending rows
  plus one overflow row.
- The overflow row text is `+N more parsing`, where `N = pendingCount - 2`.
- Pending rows are ordered newest first.
- The queue contains pending entries only.
- Completed, resolved, and failed entries are not shown in the Entry Mode queue.
- The queue has no internal scroll.
- Tapping any pending row or the overflow row opens Preview Mode.

### Row Shape

Pending rows reuse the compact one-line row style:

```txt
[pulse] submitted input        --
```

Rules:

- Left: pending indicator.
- Middle: submitted input, one line, truncated if needed.
- Right: muted pending amount placeholder.
- Row height stays around `44-48px`.
- Hit target is at least `44px`.

### Resolution Behavior

When a pending entry resolves:

1. Remove that entry from the pending queue.
2. Show a toast-style resolved confirmation.
3. Update status bar counts.
4. Keep the resolved entry in local session state for Preview Mode.

Resolved entries should not remain in the Entry Mode queue. The queue represents
active work only.

### Status Bar

The status bar remains the global session summary and should not be duplicated
inside the pending queue.

Examples:

- `1 parsing`
- `3 parsing · 2 done`
- `2 done`
- `1 failed`

Tapping the status bar opens Preview Mode.

## Preview Mode

Preview Mode is an inspection-only state inside the same AI Quick Entry drawer.
It exists so users can review the full session without squeezing a list above
the keyboard.

### Entering Preview Mode

Open Preview Mode when the user taps:

- The status bar.
- Any pending row in Entry Mode.
- The `+N more parsing` overflow row.

Entering Preview Mode dismisses the keyboard. The composer is hidden or inactive
while Preview Mode is active.

### Layout

Preview Mode shows a scrollable session list with a fixed bottom control:

```txt
AI Quick Entry

Parsing
[row]
[row]
[row]

Completed
[row]
[row]

Needs review
[row]

        (bottom blur/fade)
              X
```

Rules:

- The list is scrollable.
- Content can scroll behind the bottom control.
- A bottom blur/fade overlay sits behind the fixed circular `X` button.
- The `X` button is the Done control for Preview Mode.
- Tapping `X` returns to Entry Mode and focuses the composer.
- Row taps do nothing in this version.
- The existing drawer close/scrim behavior still closes the whole AI Quick Entry
  drawer and clears the local session on next open.

### Sections

Preview Mode groups entries into sections:

- `Parsing`: pending entries, newest first.
- `Completed`: resolved entries, newest first.
- `Needs review`: failed entries, newest first.

Hide empty sections. Keep section headers compact and subdued.

## State And Components

### `AIQuickEntry.tsx`

Responsibilities:

- Own `mode: "entry" | "preview"`.
- Own local `composer`.
- Own local `entries`.
- Own mock parse timers.
- Own resolved confirmation behavior.
- Derive pending, completed, and failed lists.
- Open Preview Mode from status bar or Entry Mode pending queue.
- Return to Entry Mode from the Preview Mode bottom `X`.
- Refocus composer when returning to Entry Mode.

### Pending Queue Component

Replace `AIQuickEntryPendingStack` with a plain capped queue component, or
rewrite it so its public behavior is no longer stack-based.

Responsibilities:

- Accept pending entries.
- Render at most two pending rows.
- Render one overflow row when `pendingCount > 2`.
- Open Preview Mode on row or overflow tap.
- Avoid internal scrolling.

### Preview Mode Component

Create a small internal component if it keeps `AIQuickEntry.tsx` readable.

Responsibilities:

- Render sectioned session rows.
- Own the scrollable list layout.
- Render bottom blur/fade overlay.
- Render fixed circular `X` Done control.
- Call back to Entry Mode on Done.

## Accessibility

- The drawer keeps `role="dialog"` and `aria-label="AI quick entry"`.
- Entry Mode pending rows and overflow row are buttons because they open Preview
  Mode.
- Overflow row aria-label includes the hidden pending count.
- Preview Mode bottom `X` has an accessible label such as
  `Return to quick entry`.
- Status bar aria-label explains that it opens Preview Mode.
- Do not rely on color alone for failed/review state.
- Preserve at least `44px` touch targets.

## Testing

Update focused component tests:

- Entry Mode renders no queue when there are no pending entries.
- Entry Mode renders one pending row for one pending entry.
- Entry Mode renders two pending rows for two pending entries.
- Entry Mode renders two newest pending rows plus `+N more parsing` for more
  than two pending entries.
- Entry Mode does not render completed/resolved rows in the pending queue.
- Resolved entries are removed from the pending queue and remain available in
  Preview Mode.
- Tapping status bar opens Preview Mode.
- Tapping a pending row opens Preview Mode.
- Tapping the overflow row opens Preview Mode.
- Preview Mode shows pending, completed, and failed sections.
- Preview Mode hides empty sections.
- Preview Mode bottom `X` returns to Entry Mode and refocuses the composer.
- Existing expanded pending stack behavior is removed.

## Implementation Notes

- Keep the scope UI-only and local-session only.
- Do not add Server Actions, API routes, persistence, or real mutation logic.
- Do not change optimistic mutation or recovery ownership.
- Do not optimize desktop beyond keeping it coherent.
- Use targeted tests and file-scoped formatter/lint checks when implementing
  `.ts` or `.tsx` changes later.
