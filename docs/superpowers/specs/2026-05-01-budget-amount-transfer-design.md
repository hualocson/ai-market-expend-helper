# Budget Amount Transfer — Design

**Date:** 2026-05-01
**Status:** Draft (awaiting implementation plan)

## Summary

Allow a user to increase one budget's `amount` by pulling cap from another budget, in a single atomic operation. Pure cap reallocation — no transactions are reassigned, no history is recorded.

## Goals

- Move an integer VND amount from a chosen **source** budget to a fixed **destination** budget.
- Atomic: both budgets update together or neither does.
- Allow the user to override a "source goes over budget" situation deliberately, with a clear warning.

## Non-goals

- Reassigning expenses between budgets (a separate concept).
- Transfer history / audit log / undo.
- Restricting source by period type, period range, or remaining amount.
- Bidirectional flow (sending from the opened budget). Opened budget is always the destination.

## Decisions (from brainstorming)

| # | Decision | Choice |
|---|---|---|
| 1 | Mental model | Reallocate cap only (mutate `amount` on both sides) |
| 2 | Source eligibility | Any budget — no restrictions on period or remaining |
| 3 | Source-goes-over-budget | Warn but allow (user confirms) |
| 4 | Entry points | Detail drawer button **and** Edit drawer link |
| 5 | Direction | Destination-only (opened budget receives) |
| 6 | History | None — fire and forget |

## Architecture

One Server Action mutates two `budgets` rows inside a single Drizzle transaction. A new client Drawer drives the UI; existing UI state in `BudgetWeeklyBudgetsClient` opens it from two entry points. No schema changes.

### Data layer

`src/app/actions/budget-weekly-actions.ts` — add:

```ts
const transferInputSchema = z.object({
  fromBudgetId: z.number().int().positive(),
  toBudgetId: z.number().int().positive(),
  amount: z.number().int().positive(),
}).refine(d => d.fromBudgetId !== d.toBudgetId, "Source and destination must differ");

export async function transferBudgetAmount(input: TransferInput) {
  const parsed = transferInputSchema.parse(input);
  await db.transaction(async (tx) => {
    const rows = await tx.select()
      .from(budgets)
      .where(inArray(budgets.id, [parsed.fromBudgetId, parsed.toBudgetId]));
    const source = rows.find(r => r.id === parsed.fromBudgetId);
    const dest   = rows.find(r => r.id === parsed.toBudgetId);
    if (!source || !dest) throw new Error("Budget not found");
    if (parsed.amount > source.amount) throw new Error("Source has insufficient cap");

    await tx.update(budgets)
      .set({ amount: source.amount - parsed.amount })
      .where(eq(budgets.id, parsed.fromBudgetId));
    await tx.update(budgets)
      .set({ amount: dest.amount + parsed.amount })
      .where(eq(budgets.id, parsed.toBudgetId));
  });
  revalidatePath("/budgets");
}
```

Notes:
- The "source goes below `spent`" check is **client-only** — it's a UX warning, not a constraint. The server only enforces the hard floor (`amount ≥ requested transfer`).
- Postgres default isolation (`READ COMMITTED`) is sufficient: the second concurrent transfer reads the first's committed result and re-validates.
- Returns `void` on success; throws on failure (matches existing actions like `updateWeeklyBudgetEntry`).

### UI: `<BudgetTransferDrawer />`

New file: `src/components/BudgetTransferDrawer.tsx` (`"use client"`).

```ts
type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destination: BudgetListItem;     // pre-selected, not editable
  budgets: BudgetListItem[];       // full list; component filters out destination
};
```

**Layout (top → bottom):**

1. `DrawerHeader` — title `Move funds to "{destination.name}"`, description `Pull cap from another budget into this one`.
2. **Destination summary card** — read-only: name + current `formatVnd(destination.amount)`. Reuses `border-border/45 bg-card/70 rounded-2xl` styling.
3. **Source picker** — labeled "From". Tap to open an inline scrollable list of all other budgets (name, period range, current amount, remaining). Each row `h-11`. Selecting collapses the picker.
4. **Amount input** — same `Input` + VND suffix as the existing Edit drawer's amount field. `inputMode="numeric"`, formatted via `formatVnd` / `parseVndInput`.
5. **Preview block** — two-column "After transfer" grid:
   - Source: `formatVnd(source.amount - amount)` (red if `< source.spent`)
   - Destination: `formatVnd(destination.amount + amount)`
6. **Warning banner** — only when `(source.amount - amount) < source.spent`. Reuses the destructive-tinted banner pattern from the Edit drawer (`AlertCircle` + `border-destructive/40 bg-destructive/10`). Copy: `"{source.name} will go {formatVnd(over)} over budget."`
7. `DrawerFooter` — single primary button `Move funds`. Spinner + `Moving...` while pending. Label flips to `Move funds anyway` when the warning banner is showing.

**Local state (no Zustand):**

```ts
const [sourceId, setSourceId] = useState<number | null>(null);
const [amount, setAmount]     = useState(0);
const [isSaving, setIsSaving] = useState(false);
```

**On submit:** call `transferBudgetAmount(...)`, then invalidate `budgetOverviewQueryKey`, `budgetTransactionsQueryKey(destination.id)`, and `budgetTransactionsQueryKey(sourceId)`. Toast success and close drawer. On error, toast (see error mapping below).

### Wiring into `BudgetWeeklyBudgetsClient`

Add state:

```ts
const [transferOpen, setTransferOpen] = useState(false);
const [transferDestination, setTransferDestination] = useState<BudgetListItem | null>(null);
```

**Entry point 1 — Detail drawer footer:** add a ghost `Move funds` button between `Edit budget` and `Delete budget`. Sets `transferDestination = detailBudget`, opens transfer drawer.

**Entry point 2 — Edit drawer:** small text link under the Amount field: `"Move from another budget →"`. Closes the edit drawer, opens transfer drawer with `transferDestination = activeBudget`.

Render `<BudgetTransferDrawer open={transferOpen} onOpenChange={setTransferOpen} destination={transferDestination!} budgets={budgets} />` near the existing drawers.

## Validation & error states

### Client-side (in the drawer)

| Condition | Behavior |
|---|---|
| No source picked | Submit disabled. Picker shows hint placeholder. |
| `amount === 0` | Submit disabled. |
| `amount > source.amount` | Submit disabled. Inline error under input: `"Cannot move more than {formatVnd(source.amount)} from {source.name}."` |
| `(source.amount - amount) < source.spent` | Submit **enabled**. Warning banner shows. Submit label: `Move funds anyway`. |
| Source list empty (only one budget exists) | Empty state: `"No other budgets to pull from yet."` Submit hidden. |
| Source has `amount === 0` | Row rendered disabled in picker (visible but unselectable). |

### Server error → toast mapping

| Server throws | Toast |
|---|---|
| `Source has insufficient cap` (race: source mutated between fetch and submit) | `"That budget no longer has enough to move. Try a smaller amount."` |
| `Budget not found` (race: source deleted) | `"Source budget no longer exists."` and auto-invalidate overview |
| Anything else | `"Failed to move funds."` |

### Edge cases (resolved, not open)

- **Stale picker data** — picker reads from cached `BudgetListItem`. The transaction's own `SELECT` re-validates, so we cannot debit more than exists; we surface a clear toast and re-invalidate.
- **Concurrent transfers** — Postgres `READ COMMITTED` is sufficient; no row locks needed.
- **Cross-period transfers** — explicitly allowed (Q2 = A). Picker shows period range so the user knows what they're picking; no special UI.

## Files touched

| File | Change |
|---|---|
| `src/app/actions/budget-weekly-actions.ts` | + `transferBudgetAmount` Server Action + Zod schema |
| `src/components/BudgetTransferDrawer.tsx` | **NEW** — the drawer component |
| `src/components/BudgetWeeklyBudgetsClient.tsx` | + transfer state, + detail-drawer button, + edit-drawer link, + render `<BudgetTransferDrawer />` |

No schema migration. No new query files.

## Testing

**`src/app/actions/budget-weekly-actions.test.ts`** (new or extended) — Vitest, real DB:

1. Happy path — transfer 30k from A (100k, 0 spent) to B (50k, 0 spent) → A=70k, B=80k.
2. Atomicity — when destination doesn't exist, source is unchanged (transaction rollback).
3. Insufficient cap — `amount > source.amount` throws; both rows unchanged.
4. Same source/dest — Zod refine rejects.
5. Negative or zero amount — Zod rejects.

**`src/components/BudgetTransferDrawer.test.tsx`** (new) — React Testing Library:

1. Submit disabled until source picked AND amount > 0 AND amount ≤ source.amount.
2. Warning banner appears when source would go below `spent`; submit label becomes `Move funds anyway`.
3. Source list excludes the destination.
4. Source with `amount === 0` is rendered but disabled.

No e2e — consistent with the rest of the budgets feature.

## Validation gates before claiming done

Per `CLAUDE.md`:

- `tsc --noEmit` on touched files (no full `npm run build`)
- `vitest run` on the two new test files
- Manual UI check via dev server: open detail drawer → `Move funds` → transfer → confirm both budgets update + warning banner behavior + empty/disabled-source edge cases
