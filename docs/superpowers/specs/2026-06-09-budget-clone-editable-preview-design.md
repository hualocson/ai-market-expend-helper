# Editable Budget Clone Preview Design

## Context

The budgets page already supports cloning weekly and monthly budgets into the next period. The current clone button opens a read-only preview drawer, then confirmation calls the clone mutation with only `period` and `sourceStartDate`. The server reloads source budgets, skips budgets whose normalized names already exist in the target period, and inserts the remaining budgets with their previous amounts.

The new flow keeps this clone behavior but makes the preview drawer editable. The user can adjust clone amounts before confirming. If the user does not change an amount, the cloned budget uses the previous period amount.

## Goals

- Replace the read-only clone preview drawer with one combined preview and amount-editing drawer.
- Match the supplied mobile reference: horizontal budget selector, large focused amount editor, and strong bottom confirmation area.
- Keep existing target-period budgets visible as skipped, disabled items. They are not edited or updated.
- Preserve the current weekly and monthly clone navigation behavior after success.
- Keep app-owned writes on the existing REST route and TanStack Query mutation hook.

## Non-Goals

- Do not update existing target-period budgets during clone.
- Do not add a separate second edit drawer.
- Do not support custom-period cloning.
- Do not add light-mode styling or theme switching.
- Do not introduce background submit or persisted recovery state for this action.

## User Flow

1. User taps `Clone to next week` or `Clone to next month`.
2. A single combined drawer opens.
3. The drawer shows the source period, target period, and total amount that will be cloned.
4. A horizontal budget selector lists the source budgets.
5. Budgets that already exist in the target period are shown as skipped and disabled.
6. The first cloneable budget is selected by default.
7. The main editor shows the selected budget name, icon/category context, and a large VND amount.
8. User may edit the amount or leave it unchanged.
9. User taps `Confirm clone`.
10. The client submits the clone request with the current cloneable budget amounts.
11. The server clones only non-conflicting budgets. Each cloned row uses the submitted amount for its source budget when present; otherwise it falls back to the original source amount.
12. On success, the existing flow switches to the target week or month and shows the clone toast.

## UI Design

The existing `BudgetClonePreviewDrawer` becomes an editable combined drawer.

Top section:
- Cancel/back icon button.
- Title: `Clone budgets`.
- Source and target labels in compact text.
- Total clone amount, derived from cloneable budget draft amounts.

Budget selector:
- Horizontal scroll container optimized for iPhone 13/14 width.
- Each item is a compact pill/card with the budget badge, category icon, and draft amount.
- The selected cloneable budget uses a strong active style.
- Skipped budgets are dimmed, marked `Exists`, and cannot be selected for editing.

Amount editor:
- Large amount display for the selected cloneable budget.
- Amount input is controlled by local drawer draft state.
- The displayed value uses VND formatting around the input, but the editable value remains numeric.
- Empty or invalid input disables confirmation and keeps the user in the drawer.

Footer:
- Primary `Confirm clone` button.
- Secondary cancel action.
- Pending state disables editing and shows the existing loading affordance.

If every source budget already exists in the target period, the drawer shows the skipped list, no editable amount editor, and the confirm action is disabled because there is nothing to clone.

## Data Model

Extend `BudgetCloneNextPeriodInput` with optional per-budget amounts:

```ts
type BudgetCloneNextPeriodInput = {
  period: BudgetClonePeriod;
  sourceStartDate: string;
  budgets?: Array<{
    sourceBudgetId: number;
    amount: number;
  }>;
};
```

The combined drawer sends all cloneable draft amounts on confirm, including unchanged defaults. This keeps the server behavior explicit and avoids trying to infer which local edits occurred. If another caller omits this field, the server keeps current behavior and clones using source amounts.

## Server Behavior

`cloneBudgetsToNextPeriod` should select source budget ids in addition to the existing fields. It should build an override map keyed by `sourceBudgetId`.

For each non-conflicting source budget:
- If an override exists for that source id, use the override amount.
- If no override exists, use the source row amount.
- Ignore overrides for ids that are not in the normalized source period.
- Keep name-conflict skipping exactly as it works today.

Validation:
- Route schema accepts optional `budgets`.
- Each `sourceBudgetId` must be a positive integer.
- Each `amount` must be finite and non-negative.

## Components And Boundaries

- `BudgetWeeklyBudgetsClient` continues to own clone drawer open state, target navigation, and success/error toasts.
- `BudgetClonePreviewDrawer` owns only local editable draft state, selection state, and confirm payload construction.
- `useCloneBudgetsToNextPeriodMutation` continues to own the REST call and query invalidation.
- The REST route continues to validate input and call the shared DB function.
- The DB function owns conflict detection and final inserted clone amounts.

## Error Handling

- Invalid or empty amount input disables confirm.
- Mutation pending disables drawer edits and cancel/confirm actions.
- API errors keep the drawer open and show the existing `Failed to clone budgets.` toast.
- Server-side validation failures return the existing API error envelope pattern.

## Tests

Targeted tests should cover:

- Drawer renders source/target labels, horizontal selector, skipped budgets, and selected editable budget.
- Editing the selected amount updates the selected chip and total clone amount.
- Skipped budgets cannot be selected for editing and are not submitted as updates.
- Confirm without editing submits the default source amounts for all cloneable budgets.
- Confirm after editing submits the modified amount for the source budget.
- Weekly and monthly clone confirmation still switches to the target period.
- Route schema accepts optional budget amount overrides and rejects invalid ids or amounts.
- DB clone function inserts override amounts, falls back to original amounts, skips target-name conflicts, and ignores irrelevant override ids.
- Mutation hook still posts to `/api/budgets/clone-next-period` and invalidates budget query roots.

## Verification

After implementation, run targeted checks for modified TypeScript/TSX files:

- `rtk bunx prettier --write <modified-files>`
- `rtk bunx prettier --check <modified-files>`
- `rtk bunx eslint <modified-files>`
- Relevant Vitest files for the drawer, client flow, route schema, mutation hook, and DB clone function.

Do not run `npm run build` for individual implementation validation. Run it only before pushing changes to GitHub.
