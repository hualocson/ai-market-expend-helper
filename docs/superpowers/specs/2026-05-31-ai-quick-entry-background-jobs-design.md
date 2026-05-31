# AI Quick Entry Background Jobs - Design

Date: 2026-05-31
Branch: `dev-polish-chat`

## Problem

AI quick entry currently treats drawer close as a session invalidation. When the
user submits an expense and then closes the drawer while parsing is pending, the
late parse result is ignored. Reopening the drawer clears the entry list. If the
entry has already reached local save, the local expense can still be created, but
the AI quick-entry UI no longer records that completion.

For a quick-entry surface, tapping send should mean the user accepted that work.
Closing the drawer should hide the UI, not silently discard submitted entries.

## Goal

Make AI quick entry continue submitted parse/save work after the drawer closes.
Reopening the drawer should show the same active, saved, and needs-review entries
instead of starting from an empty session.

## Scope

This applies to the AI quick-entry drawer and its submitted entry queue:

- Continue active `parsing` and `saving` entries after close.
- Preserve saved and needs-review entries across close/reopen within the current
  app runtime.
- Keep the existing local-first expense create mutation and sync/outbox behavior.
- Keep the existing nested `QuickExpenseDrawer` review/edit flow.

This design does not add reload persistence, server-side job tracking, or a new
batch submit model.

## Decisions

- **Close behavior:** close means hide only. It does not cancel submitted entries.
- **Persistence:** in-memory runtime state only. Reload clears the AI quick-entry
  queue. This avoids replaying parses or local creates after hydration.
- **Save behavior:** once an entry reaches `saving`, it is not cancelable. The
  current `useCreateExpenseMutation` writes a local pending expense and enqueues
  sync work; that existing mutation boundary remains the source of truth.
- **Parse behavior:** normal close does not abort parse. Explicit cancellation can
  be added later with `AbortController`, but is not part of the first change.
- **Reopen behavior:** reopening resets only view chrome, such as `mode` back to
  `entry` and any active nested review drawer. It does not clear entries.
- **User feedback while closed:** saved entries show the existing success toast.
  Review-needed entries remain visible in the preview/status counts
  when the user reopens AI quick entry.

## Architecture

Introduce a small AI quick-entry job boundary so the drawer is no longer the owner
of submitted work.

### `src/stores/ai-quick-entry-store.ts`

Extend the current store beyond `open`:

- `open: boolean`
- `entries: QuickEntry[]`
- `setOpen(value: boolean)`
- `enqueueEntry(input: string): QuickEntry`
- `markEntryParsing(id)`
- `markEntrySaving(id, reviewDraft)`
- `markEntrySaved(id, savedExpense)`
- `markEntryForReview(id, reviewDraft, errorReason)`
- `clearEntries()`

The store remains non-persisted. It owns runtime queue state only. It does not call
REST routes, TanStack Query APIs, or local expense mutations.

### `src/components/AIQuickEntry.tsx`

Keep this component as the stable controller and renderer:

- Reads `open`, `setOpen`, and `entries` from the store.
- Owns the async `runEntry` orchestration because it needs React hooks:
  `useQueryClient`, `useCreateExpenseMutation`, settings, haptics, and toasts.
- Renders entry mode, preview mode, pending queue, status bar, and the nested
  `QuickExpenseDrawer`.
- No longer resets `entries` when `open` changes.

The current `sessionRef` close guard is replaced with an entry-level liveness
guard. Normal drawer close does not make an entry stale. A stale guard should only
protect truly obsolete work, such as an entry that was explicitly removed in the
future.

## Data Flow

1. User submits composer text.
2. `AIQuickEntry` enqueues a `QuickEntry` with `status: "parsing"` and clears the
   composer.
3. `runEntry(entryId, input)` loads budget options through
   `queryClient.ensureQueryData(queries.budgetWeekly.options(...))`.
4. It calls `/api/ai/parse-expense`.
5. `evaluateAIQuickEntryParse` returns either review or auto-save.
6. Review result updates the entry to `needsReview` with `reviewDraft` and
   `errorReason`.
7. Auto-save result updates the entry to `saving`, then calls
   `createExpense(decision.payload)`.
8. Successful local create updates the entry to `saved` with `savedExpense` and
   shows the existing success toast.
9. Create failure updates the entry to `needsReview` with the parsed draft.

All of these transitions continue whether the drawer is open or closed.

## Drawer Lifecycle

### On Open

- Set `mode` to `entry`.
- Clear any active nested review/edit drawer selection.
- Keep `entries` unchanged.
- Focus the composer as today.

### On Close

- Set `open` to `false`.
- Blur the composer.
- Clear active nested review/edit drawer selection.
- Keep `entries` unchanged.
- Do not invalidate active parse/save work.

### Preview

Preview continues to group entries by status:

- `parsing` and `saving` under active.
- `saved` under saved.
- `needsReview` under needs review.

Rows opened for review or edit still use one controlled nested `QuickExpenseDrawer`.
When the nested drawer succeeds, the owning entry becomes `saved`.

## Error Handling

- Budget load failure becomes `needsReview` using the original input draft.
- Parse request failure becomes `needsReview` using the original input draft.
- Parser fallback becomes `needsReview` using the safe prefill draft.
- Local create failure becomes `needsReview` using the parsed draft.
- If the drawer is closed when any of these happen, the transition is still stored.
  The user sees it after reopening.

No duplicate local create should be possible from close/reopen alone because active
jobs are not restarted on open. They continue from their original promise chain.

## Testing

Update `src/components/AIQuickEntry.test.tsx`:

- Closing and reopening while parse is pending keeps the active entry visible.
- A trusted parse submitted before close auto-saves after close; reopening shows it
  under saved.
- A fallback parse submitted before close becomes needs review after close; reopening
  shows it under needs review.
- A local create failure after close becomes needs review with the parsed draft.
- Reopening resets mode to entry but does not clear entries.
- Nested review/edit drawer selection is cleared on close without clearing entries.

Update `src/stores/ai-quick-entry-store.test.ts`:

- `setOpen` still controls drawer visibility.
- `enqueueEntry` creates a parsing entry.
- Entry transition actions update only the targeted entry.
- `clearEntries` clears the runtime queue when explicitly called.

Regression coverage:

- Existing saved-row edit and review-row create flows still use one nested
  `QuickExpenseDrawer`.
- Existing local-first expense mutation tests remain the source of truth for
  pending outbox behavior.

## Out of Scope

- Persisting AI quick-entry queue state across reloads.
- Explicit cancel buttons for active entries.
- Aborting parse fetches on ordinary drawer close.
- New global toasts for review-needed entries while the drawer is closed.
- Changes to `/api/ai/parse-expense`, `evaluateAIQuickEntryParse`, or expense sync
  outbox semantics.
