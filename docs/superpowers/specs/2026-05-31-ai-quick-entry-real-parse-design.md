# AI Quick Entry Real Parse And Auto-Save — Design

**Date:** 2026-05-31
**Branch:** `dev-polish-chat`
**Status:** Approved design, pending user review of written spec

## Summary

Integrate bottom-nav AI Quick Entry with the real
`POST /api/ai/parse-expense` route and make the flow speed-first.

AI Quick Entry should behave like a fast capture inbox:

- The composer clears immediately after submit and stays focused.
- Each submitted row parses independently.
- Trusted high-confidence parses auto-create a real local expense.
- Saved entries remain visible in Preview Mode so the user can edit them later.
- Untrusted parses become `Needs review` rows instead of blocking the composer.
- Preview Mode owns inspection and correction.
- The feature renders exactly one controlled `QuickExpenseDrawer` instance.

## Goals

- Replace mocked parse timers in `AIQuickEntry` with real parser calls.
- Auto-save trusted parses using the existing expense mutation and local sync
  engine.
- Keep rapid entry ergonomic on iPhone 13/14 viewports.
- Preserve saved rows in Preview Mode for later edit.
- Route uncertain rows to review without interrupting typing.
- Use a single `QuickExpenseDrawer` instance for both saved-row edit and
  review-row create flows.
- Reuse existing parser, budget query, mutation, and quick expense drawer
  boundaries.

## Non-Goals

- No new AI parser endpoint.
- No Server Actions.
- No bulk save flow.
- No persistent AI session history after closing AI Quick Entry.
- No separate edit sheet host inside AI Quick Entry.
- No second hidden `QuickExpenseDrawer`.
- No change to the full `/ai` chat page.

## UX Model

Entry Mode stays compact and optimized for fast input.

Flow:

1. User submits natural-language text.
2. A session row appears as `Parsing`.
3. The composer clears and remains focused.
4. The real parser route runs for that row.
5. If the parse is trusted, the row moves through `Saving` and then `Saved`.
6. If the parse is not trusted, the row becomes `Needs review`.
7. The user can continue entering expenses throughout the lifecycle.

Entry Mode shows only active work above the composer:

- `Parsing`
- `Saving`

Saved and review rows do not crowd the keyboard area. They live in Preview Mode.
The status bar shows aggregate counts for active, saved, and review rows.

Preview Mode is the session ledger:

- `Active`: parsing and saving rows, newest first.
- `Saved`: successfully created rows, newest first.
- `Needs review`: rows that require manual confirmation or correction.

Saved rows are tappable and open the single drawer in edit mode. Review rows are
tappable and open the same drawer in create mode with that row's AI prefill.

## Trust Gate

A parse can auto-save only when every condition is true:

- Parser response status is `success`.
- `expense.confidence` is `high`.
- `expense.amount` is valid.
- `expense.note` is non-empty after trimming.
- `expense.date` converts from `DD/MM/YYYY` to a valid ISO date.
- The date is not suspicious according to `isExpenseDateSuspicious`.
- `expense.budgetId` matches one of the loaded budget options.
- The date is inside the matched budget period.

Any failed condition sends the row to `Needs review`.

## Data Flow

`AIQuickEntry` remains the session owner.

Per submit:

1. Append a local row with `status: "parsing"`, the raw `input`, and a stable
   `entryId`.
2. Load today's budget options through
   `queryClient.ensureQueryData(queries.budgetWeekly.options(...))`.
3. Call `POST /api/ai/parse-expense` with:
   - `input`
   - `today: dayjs().format("DD/MM/YYYY")`
   - `budgets: [{ id, name, category }]`
4. Unwrap the API response with the existing API response helper.
5. Run the trust gate.
6. If trusted, build the create payload and call `useCreateExpenseMutation`.
7. On create success, store the returned local expense identity and display data
   on the row, then mark it `saved`.
8. On fallback, untrusted parse, parse error, or create error, store a safe
   review draft on the row and mark it `needsReview`.

The create payload uses the matched budget option for budget metadata and
category:

- `date`: ISO date
- `amount`
- `note`
- `category`: matched budget category
- `paidBy`: settings paid-by normalized to the allowed enum
- `budgetId`
- `budgetName`
- `budgetIcon`
- `budgetColor`

## Session Row Model

Use a local session row type shaped around UI lifecycle rather than parser
internals:

```ts
type AIQuickEntrySessionStatus =
  | "parsing"
  | "saving"
  | "saved"
  | "needsReview";

type AIQuickEntrySessionRow = {
  entryId: string;
  input: string;
  status: AIQuickEntrySessionStatus;
  createdAt: number;
  reviewDraft?: TQuickExpenseDrawerInitialExpense;
  savedExpense?: TQuickExpenseDrawerInitialExpense & {
    id: number;
    clientId?: string;
    syncStatus?: "pending" | "failed" | "synced";
  };
  errorReason?: string;
};
```

The exact names can change during implementation, but the boundaries should not:
rows own session status, saved display data, and review prefill data.

State transitions:

```txt
parsing -> saving -> saved
parsing -> needsReview
saving  -> needsReview
```

## Single Drawer Ownership

`AIQuickEntry` renders exactly one controlled `QuickExpenseDrawer`.

It owns one active item:

```ts
type ActiveQuickEntryDrawerItem =
  | {
      kind: "review";
      entryId: string;
      initialExpense: TQuickExpenseDrawerInitialExpense;
    }
  | {
      kind: "saved";
      entryId: string;
      transactionId: number;
      initialExpense: TQuickExpenseDrawerInitialExpense;
    }
  | null;
```

The rendered drawer follows this shape:

```tsx
<QuickExpenseDrawer
  showTrigger={false}
  open={activeDrawerItem !== null}
  onOpenChange={handleDrawerOpenChange}
  mode={activeDrawerItem?.kind === "saved" ? "edit" : "create"}
  transactionId={
    activeDrawerItem?.kind === "saved"
      ? activeDrawerItem.transactionId
      : undefined
  }
  initialExpense={activeDrawerItem?.initialExpense ?? null}
/>
```

Rules:

- Tapping a `Needs review` row sets the active item to `review`.
- Tapping a `Saved` row sets the active item to `saved`.
- Tapping another row while the drawer is open changes the active item and the
  same drawer refreshes to the new draft.
- Closing the drawer clears `activeDrawerItem`.
- AI Quick Entry does not dispatch a global prefill event to itself.

`QuickExpenseDrawer` needs one controlled-create enhancement: when controlled in
create mode with `initialExpense`, it hydrates from that value while open and
refreshes when the active item identity changes. This lets the one drawer serve
review rows without relying on `EXPENSE_PREFILL_EVENT`.

## Saved Row Editing

The local create mutation returns a local expense with a `clientId` and a
nullable `serverId`. Saved rows should store enough data to reopen the same
drawer in edit mode.

For unsynced local creates, use the same local-list numeric id approach already
used by the expense list, or a small shared helper if the implementation needs
one. The edit payload still updates through `clientId`, so the row can be edited
before server sync assigns a real id.

## Review Row Handling

Review rows should carry the safest available draft:

- Parser fallback: use fallback prefill fields.
- Low-confidence or missing-budget success: use parsed amount, note, date, and
  any safe matched budget metadata.
- Suspicious date: reset date to today before review.
- Parser request failure: use original input as note and extract amount when
  possible.
- Create failure: preserve the trusted parsed payload so the user can retry via
  the drawer.

After a review row is manually saved through the drawer, the row moves to
`saved`. To support that, `QuickExpenseDrawer` should use its existing
`onSuccess` prop surface and pass back the created or updated local expense
result. `AIQuickEntry` then updates the matching session row with the returned
identity and display data.

## Error Handling

- Parser fallback: `needsReview`.
- Parser network or server error: `needsReview` with original input draft.
- Missing OpenRouter key surfaced as route error: `needsReview`; do not block
  composer.
- Budget query failure: `needsReview` with original input draft.
- Budget no longer available: `needsReview` with budget cleared.
- Suspicious date: `needsReview` with date reset to today.
- Create mutation failure: `needsReview` with parsed payload and error reason.

Every error path keeps the composer usable.

## Accessibility And Interaction

- Entry Mode send button keeps the current iOS pointer-down focus preservation.
- Preview rows are real buttons or button-like controls with keyboard support.
- Row hit targets are at least 44px high.
- Status counts use text and icons, not color alone.
- Saved, active, and review row states have distinct accessible labels.
- Drawer switching between rows should update content without mounting multiple
  drawers.

## Testing

### `AIQuickEntry.test.tsx`

- Submitting appends an active row and keeps the composer usable.
- Trusted parse calls the real parser route mock, then create mutation, then
  marks the row `saved`.
- Entry Mode hides saved rows but status count updates.
- Preview Mode shows saved rows.
- Saved row tap opens the single drawer in edit mode.
- Fallback parse becomes `Needs review`.
- Low confidence becomes `Needs review`.
- Missing budget becomes `Needs review`.
- Suspicious date becomes `Needs review` with date reset to today.
- Parser route error becomes `Needs review`.
- Create mutation error becomes `Needs review`.
- Only one `QuickExpenseDrawer` instance is rendered.
- Tapping different Preview rows updates the one drawer's `initialExpense`.

### `QuickExpenseDrawer.test.tsx`

- Controlled create mode hydrates from `initialExpense`.
- Controlled create mode refreshes draft when the active item identity changes.
- Edit mode behavior remains unchanged.
- Existing global `EXPENSE_PREFILL_EVENT` behavior remains unchanged for other
  surfaces.

### Existing Tests

- Parser contract and route tests continue to cover `today`, fallback, and
  schema behavior.
- Mutation hook tests continue to own local write and invalidation behavior.

## Risks And Trade-Offs

- Auto-saving trusted AI results can still create a wrong expense. The trust gate
  limits this to high-confidence, budget-matched, date-valid rows, and Preview
  Mode keeps saved rows editable.
- Editing an unsynced saved row depends on preserving `clientId`. The design
  explicitly stores it on the saved row.
- `QuickExpenseDrawer` needs a narrow controlled-create enhancement. This is
  preferable to adding a second drawer or using global prefill events for this
  local row-selection flow.
