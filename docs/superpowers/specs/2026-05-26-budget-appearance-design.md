# Budget Appearance

**Date:** 2026-05-26
**Branch:** `main`
**Status:** Approved for implementation planning

## Problem

Budgets are currently identified only by name and period. This makes budget lists,
pickers, transfers, and expense rows harder to scan, especially on mobile where
several budgets can have similar names or amounts.

We want each budget to have a stable visual identity: an emoji icon and one color
from a fixed app palette. The appearance should be visible not only on the budget
screens, but also anywhere an expense references a budget.

## Goals

- Add an emoji icon to each budget.
- Add a budget color selected from a fixed 12-color palette.
- Use the native iOS emoji keyboard naturally by storing the icon as Unicode text.
- Render budget appearance in budget-owned surfaces, budget pickers, and expense
  rows that show an assigned budget.
- Server-loaded expenses always show the latest budget appearance after refetch.
- Pending/offline local expenses keep a copied appearance snapshot so optimistic
  rows remain visually complete before sync finishes.
- Preserve older persisted local/recovery records that do not have appearance
  fields.

## Non-Goals

- No arbitrary custom color picker.
- No app theme changes or light-mode work.
- No forced native emoji picker API. Web apps cannot force-open the iOS emoji
  picker; users will type into the emoji field and switch to the native emoji
  keyboard.
- No redesign of expense syncing ownership or mutation lifecycle behavior beyond
  carrying the new optional snapshot fields.

## Approach

Use option 3 from brainstorming: propagate budget appearance wherever a budget is
referenced.

Add `icon` and `color` columns to `budgets`. Query budget appearance alongside
budget names in the existing joins. Extend local expense payloads with optional
`budgetIcon` and `budgetColor` snapshot fields, copied from the selected budget
option when an expense is created or edited locally.

Server-loaded expense rows use the joined latest budget appearance. Local rows use
their snapshot until sync and refetch replace them with server rows.

Rejected alternatives:

- **Only render appearance on budget-owned surfaces.** Lower risk, but expense
  rows would still lose the visual identity where budget context matters most.
- **Store appearance only in budgets and never snapshot it locally.** Simpler
  schema, but pending local expense rows would render incomplete or stale-looking
  UI until sync completes.
- **Store arbitrary hex colors.** More flexible, but easier to make unreadable
  badges in a dark-mode-only finance UI.

## Data Model

### Budget table

Add two text columns:

```ts
icon: text("icon").notNull().default("💰");
color: text("color").notNull().default("lime");
```

The migration backfills existing budgets with the defaults. The `color` value is
a palette id, not a hex value.

### Budget types

Extend these shared budget types:

- `BudgetListItem`
- `BudgetCreateInput`
- `BudgetUpdateInput`
- `BudgetWeeklyOption`
- route response shapes that include budget list items

Budget list items and picker options should always include:

```ts
icon: string;
color: BudgetColorId;
```

Create input requires both fields. Update input accepts both as optional fields.

### Expense list and sync types

Extend expense list rows with nullable appearance:

```ts
budgetIcon: string | null;
budgetColor: BudgetColorId | null;
```

Extend local sync payloads with optional nullable snapshots:

```ts
budgetIcon?: string | null;
budgetColor?: BudgetColorId | null;
```

The fields are optional in local guards so older IndexedDB and recovery records
remain readable. When normalized into UI list items, missing values become `null`.

## Palette

Create a single helper module, for example `src/lib/budget-appearance.ts`, that
owns:

- `BUDGET_COLOR_OPTIONS`: 12 fixed color options.
- `DEFAULT_BUDGET_ICON`.
- `DEFAULT_BUDGET_COLOR`.
- `isBudgetColorId(value)`.
- `normalizeBudgetIcon(value)`.
- `normalizeBudgetColor(value)`.

Palette ids should be semantic enough to remain stable, such as `lime`, `sky`,
`violet`, `rose`, `amber`, `emerald`, `cyan`, `fuchsia`, `orange`, `teal`,
`indigo`, and `slate`.

Each palette entry provides a label plus Tailwind classes or CSS variables for:

- soft background
- foreground text
- border/ring
- stronger swatch fill

The user-selected color must not replace status colors. Budget progress and
financial status still use `success`, `warning`, and `destructive`.

## Validation

Budget create/update route schemas validate:

- `icon`: a non-empty string after trimming, with a maximum of 8 JavaScript
  string code units. This allows common emoji plus variation selectors while
  preventing long labels from being stored in the icon field.
- `color`: one of the 12 palette ids.

Service functions defensively normalize values from direct/internal callers:

- empty or invalid icon to `DEFAULT_BUDGET_ICON`
- empty or invalid color to `DEFAULT_BUDGET_COLOR`

The route layer should still reject invalid create/update payloads so browser
submits fail early and tests can assert the contract.

## UI

### Shared badge

Add a shared `BudgetBadge` component or equivalent helper that renders:

- emoji icon in a small colored chip
- budget name text when provided
- accessible label containing the budget name
- default icon/color when data is missing

The badge must support compact contexts:

- budget card heading
- picker row
- transfer drawer row
- expense row pill

### Budget create/edit drawer

In `BudgetWeeklyBudgetsClient`, add appearance controls to the existing budget
form:

- emoji text input with max length and a compact live preview
- 12-color swatch grid using buttons with accessible labels
- selected swatch state with visible ring/check

On iOS, users tap the icon input and use the native emoji keyboard. On desktop,
users type or paste an emoji.

Form reset/open behavior must include defaults:

- create: default icon and default color
- edit: current budget icon and color
- close/reset: return to defaults

Submit payloads include `icon` and `color` for both create and update.

### Budget surfaces

Render the badge in:

- `/budgets` list cards
- budget detail drawer title/summary area
- `BudgetTransferDrawer`
- `BudgetPickerSheet`

### Expense surfaces

Render the badge where `ExpenseListItem` currently shows `budgetName`. If an
expense has a `budgetId` but no appearance fields, render the fallback badge with
the budget label.

Quick/manual expense flows should copy the selected budget option appearance into
draft state and mutation payloads so local optimistic rows have snapshots.

## Data Flow

1. User creates or edits a budget with name, amount, period, icon, and color.
2. Budget mutation route validates and writes `icon` and `color`.
3. Budget queries return appearance fields in overview, weekly options, reports,
   transfer candidates, and transactions where applicable.
4. Expense read services join `budgets.icon` and `budgets.color` alongside
   `budgets.name`.
5. Budget picker options expose appearance fields.
6. Expense create/edit UI stores selected budget name/icon/color in local draft
   state.
7. Local expense mutations persist `budgetIcon` and `budgetColor` snapshots.
8. After sync/refetch, server-loaded rows replace snapshots with latest joined
   budget appearance.

## Compatibility

Older local IndexedDB and recovery records may not have `budgetIcon` or
`budgetColor`. Runtime guards must accept those records and normalize the missing
fields to `null`.

Existing budgets are backfilled through the migration, so server budget rows
always have appearance values after the migration runs.

If a deleted or missing budget leaves an expense with only `budgetId`, the UI uses
the default appearance and the existing fallback label.

## Files To Touch

Likely schema and type files:

- `src/db/schema.ts`
- `src/types/budget-weekly.ts`
- `src/lib/expenses/list-model.ts`
- `src/lib/sync/expenses/types.ts`
- a new migration under `migrations/`

Likely server/data files:

- `src/db/budget-queries.ts`
- `src/lib/services/expenses.ts`
- `src/lib/services/reports.ts`
- `src/lib/services/expense-sync.ts`
- `src/lib/api/route-schemas.ts`
- budget and expense query fetchers/mappers

Likely UI files:

- `src/components/BudgetWeeklyBudgetsClient.tsx`
- `src/components/BudgetPickerSheet.tsx`
- `src/components/BudgetTransferDrawer.tsx`
- `src/components/ExpenseListItem.tsx`
- `src/components/QuickExpenseSheet.tsx`
- `src/components/ManualExpenseForm.tsx`
- recovery/edit sheet host files if they carry budget draft metadata

## Error Handling

- Invalid palette id in create/update payload returns the existing invalid payload
  route response.
- Save failures keep the drawer open with the user's selected icon/color intact.
- Missing appearance on old local records renders fallback badge state.
- Missing or invalid budget option appearance is normalized before entering draft
  state.

## Testing

Focused tests should cover:

- route schemas accept valid icon/color and reject invalid palette ids
- budget create/update routes pass icon/color to service functions
- budget query mappers include icon/color fields
- expense server list joins and returns latest budget icon/color
- local expense payload guards accept older records without appearance fields
- local expense list rows preserve budget appearance snapshots when present
- budget create/edit form submits icon/color
- `BudgetPickerSheet` renders budget badges
- `ExpenseListItem` renders the budget badge from row appearance fields
- quick/manual expense flows copy selected budget appearance into local payloads
- recovery/local snapshot tests preserve budget appearance where drafts already
  persist budget metadata

## Verification

After implementation, run targeted tests for the modified scope. Do not run
`npm run build` for this individual change.

For every edited `.ts` or `.tsx` file, run:

```bash
rtk bunx prettier --write <modified-files>
rtk bunx prettier --check <modified-files>
rtk bunx eslint <modified-files>
```
