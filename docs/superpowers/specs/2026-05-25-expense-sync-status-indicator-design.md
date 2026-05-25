# Expense Sync Status Indicator Design

**Date:** 2026-05-25
**Status:** Approved for implementation planning

## Goal

Show a compact per-expense sync status inside each expense item so the user can tell when a visible expense is still waiting to sync or failed to sync.

The indicator must be small, low-noise, and placed directly before the existing paid-by icon in the expense item metadata area.

## Scope

In scope:

- Display only `pending` and `failed` sync states.
- Hide the indicator for `synced`, missing status, and deleted expenses.
- Keep the existing expense item layout compact.
- Source the status from the local sync/list data already used to render expense rows.
- Add focused tests for list mapping and row rendering.

Out of scope:

- Showing a global sync banner.
- Adding retry actions to the expense item.
- Changing sync queue ownership or mutation lifecycle behavior.
- Displaying text labels in the item row.
- Showing deleted expenses in the list.

## User Experience

The bottom-right metadata row of an expense item becomes:

```txt
[sync dot when needed] [paid-by icon]
```

Status display:

- `pending`: a small amber/yellow dot before the paid-by icon.
- `failed`: a small red/destructive dot before the paid-by icon.
- `synced`: no dot.

The dot should include accessible text through `aria-label` and `title`, such as `Sync pending` and `Sync failed`, without adding visible text to the compact row.

## Data Flow

The expense sync list model should carry item-level sync status into the list item data. `ExpenseListItem` should not perform its own IndexedDB/store lookup per row.

Expected flow:

```txt
IndexedDB sync records
-> buildExpenseListResultFromLocalRows(...)
-> ExpenseListResult.rows[]
-> ExpenseListItem
-> compact status dot before PaidByIcon
```

The row type should expose enough status for rendering, while keeping deleted rows filtered out by the existing list builder.

## Component Design

Add a small rendering helper or leaf component near `ExpenseListItem` for the dot. It should accept a limited display status, not the full sync record.

Rendering rules:

- Return `null` for anything except `pending` and `failed`.
- Use stable dimensions, for example a `size-2` or similar fixed dot.
- Use existing semantic tokens:
  - pending: `bg-warning` or equivalent existing warning token.
  - failed: `bg-destructive`.
- Keep the dot aligned with the `PaidByIcon` in the existing right-aligned flex row.

## Error Handling

No new error handling behavior is needed. Failed sync state is already represented by the sync engine and should be reflected as a red dot when present in the row data.

## Testing

Add or update focused tests for:

- `buildExpenseListResultFromLocalRows` includes sync status for visible rows.
- Deleted rows remain filtered out.
- `ExpenseListItem` renders no dot for synced/missing status.
- `ExpenseListItem` renders the pending dot before the paid-by icon.
- `ExpenseListItem` renders the failed dot before the paid-by icon.

Run targeted checks for modified `.ts`/`.tsx` files after implementation:

```bash
rtk bunx prettier --write <modified-files>
rtk bunx prettier --check <modified-files>
rtk bunx eslint <modified-files>
```

## Implementation Notes

Follow the existing TanStack Query and sync ownership boundaries:

- Do not add Server Actions.
- Do not fetch or mutate app-owned data directly inside components.
- Do not add a parallel sync status store for display.
- Keep sync lifecycle ownership in the existing sync engine and mutation hooks.
