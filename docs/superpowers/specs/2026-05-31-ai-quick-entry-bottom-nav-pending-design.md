# AI Quick Entry Bottom Nav Pending Indicator Design

Date: 2026-05-31
Branch: `dev-polish-chat`

## Goal

When a user submits AI quick-entry work and closes the drawer while parsing or
saving is still active, the bottom-nav AI button should show that background
work is still running.

## Scope

- Show a compact visual pending state on the existing bottom-nav AI button.
- Show it only while the AI drawer is closed.
- Show it only for active work: entries with `status` of `parsing` or `saving`.
- Keep `saved` and `needsReview` entries out of this pending indicator.
- Keep tapping the button behavior unchanged: it opens AI quick entry.

## UI Design

Use a small animated dot or ring on the AI button. The indicator should be
visible without changing the button size or shifting bottom-nav layout.

The AI button accessible label should change while the indicator is visible:

- Default: `Open AI quick entry`
- Pending while closed: `Open AI quick entry, background work in progress`

When the drawer is open, the button does not need the pending indicator because
the drawer already exposes active status.

## Architecture

`BottomNav` should derive the pending state from `useAIQuickEntryStore`:

- `open`
- `entries`

No new store field is needed because active work is derived from existing queue
state. The store remains non-persisted and side-effect free.

## Testing

Update `BottomNav.test.tsx` to cover:

- No pending indicator when active AI entries exist but the drawer is open.
- Pending indicator and accessible label are present when active AI entries
  exist and the drawer is closed.
- Saved or needs-review entries do not trigger the pending indicator.

Run targeted `BottomNav` tests plus required Prettier and ESLint checks for the
modified TypeScript files.
