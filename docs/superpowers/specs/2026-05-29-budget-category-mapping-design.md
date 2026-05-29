# Budget ↔ Category Mapping — Design

Date: 2026-05-29
Status: Approved (brainstorm)

## Goal

Give every budget a single owning category, so a budget always resolves to
exactly one category and a category can own many budgets (`category 1 : N
budgets`). This mapping is the foundation for a later, separate feature where an
LLM suggests a budget for an expense and the category is derived from the
budget's mapping.

This spec covers **only** the mapping data model and the management UI. The LLM
consumption flow is explicitly out of scope.

## Decisions

- **Storage:** one `category` column on the `budgets` table. No join table — a
  budget belongs to exactly one category, so a column expresses the relationship
  directly.
- **Required:** category is `NOT NULL`. Existing rows are backfilled with
  `Other`.
- **Representation:** plain `text`, storing the `Category` enum display string
  (`"Food"`, `"Shopping"`, …), consistent with how `expenses.category` is stored
  today. No Postgres enum / `CHECK` constraint.
- **Validation point:** Zod at the route layer (`z.nativeEnum(Category)`).
- **Decoupled from expenses:** `budget.category` is inert metadata. Assigning an
  expense to a budget does not read or write `expense.category`, and changing a
  budget's category does not touch linked expenses. Reports/analytics unchanged.
- **UI surfaces:** set category in add-budget form, edit category in edit-budget
  form, and show the category as an **icon only** on the budget card (no text
  label).

## Out of Scope (deferred)

- LLM "suggest budget → derive category" flow.
- Reverse "category → budgets" grouped browsing view.
- Any sync between `budget.category` and `expense.category`.

## Architecture & Components

### 1. Data model — `src/db/schema.ts`

Add to the `budgets` table:

```ts
category: text("category").notNull().default(Category.OTHER),
```

(`Category` imported from `@/enums`.) The default keeps the migration safe on a
populated table and gives new inserts a fallback.

### 2. Migration

Drizzle migration that:

- Adds `category text NOT NULL DEFAULT 'Other'` to `budgets`.
- Backfills any existing rows to `'Other'` (covered by the column default applied
  at add time).

### 3. Validation — `src/lib/api/route-schemas.ts`

- `budgetCreatePayloadSchema`: `category: z.nativeEnum(Category).default(Category.OTHER)`
- `budgetUpdatePayloadSchema`: `category: z.nativeEnum(Category).optional()`

DB column stays plain `text`; Zod is the enforcement point, matching the existing
`expenses.category` pattern.

### 4. Types — `src/types/budget-weekly.ts`

- `BudgetListItem`: add `category: Category`.
- `BudgetCreateInput`: add `category: Category`.
- `BudgetUpdateInput`: add `category?: Category`.

(Import `Category` from `@/enums`.)

### 5. DB queries — `src/db/budget-queries.ts`

- Add `category: budgets.category` to the three budget `select` blocks
  (weekly report ~L115, overview ~L256, and ~L340) and map `category` into each
  `BudgetListItem` builder (~L218, ~L300, ~L382).
- `createBudget`: add `category: input.category` to `.values({ ... })`.
- `updateBudget`: add
  `if (typeof input.category === "string") updates.category = input.category;`
  - **Decoupling:** `category` must NOT be added to the
    `updatesLinkedExpenseMetadata` condition, so a category change never calls
    `touchExpensesForBudget`. Expenses stay untouched.

### 6. Mutations — `src/lib/mutations/index.ts`

No structural change. `useCreateBudgetMutation` / `useUpdateBudgetMutation` are
plain (non-optimistic) mutations that forward the typed input to
`/api/weekly-budgets`; `category` rides along in the payload. No `LEARNINGS.md`
optimistic-path concerns.

### 7. Form — `src/components/budget-form/useBudgetForm.ts` + `BudgetFormDrawer.tsx`

- Add `category` state.
  - Create mode: default `Category.OTHER`.
  - Edit mode: seed from `budget.category` in the reset-on-open effect.
- Include `category` in the `submit()` input object.
- Render the existing `CategoryChipRow` component in the drawer
  (`value={category}`, `onChange={setCategory}`) — reused as-is.

### 8. Display — budget card

Show the budget's category as an **icon only** using the existing
`ExpenseItemIcon` component (`category={budget.category}`, small size), as a
small badge on the budget card. No text label.

The exact card component is not in an obvious single file (`BudgetListItem`
renders are not co-located); locate it during planning and add the icon there.

## Data Flow

```txt
Add/Edit Budget form
  -> CategoryChipRow (value/onChange)
  -> useBudgetForm.submit() input { ..., category }
  -> useCreate/UpdateBudgetMutation
  -> POST/PATCH /api/weekly-budgets
  -> route schema (z.nativeEnum(Category))
  -> createBudget / updateBudget (budgets.category)
  -> invalidate budget queries
  -> budget list query returns BudgetListItem.category
  -> budget card renders ExpenseItemIcon(category)
```

## Error Handling

- Invalid category value -> Zod rejection at the route, `{ error }` + 400.
- Create with no category supplied -> defaults to `Other` (schema default).
- Update with no category supplied -> field omitted, category unchanged.

## Testing

- `src/db/budget-queries.test.ts`
  - `createBudget` persists `category`.
  - `updateBudget` persists a new `category`.
  - Updating only `category` does NOT touch linked expenses
    (no `touchExpensesForBudget`).
  - Budget list builders return `category`.
- Route-schema tests
  - Create defaults missing category to `Other`.
  - Invalid category value is rejected.
- `src/components/budget-form/useBudgetForm.test.ts`
  - Create defaults to `Other`; edit seeds from `budget.category`.
  - `submit()` payload includes `category`.
- `src/components/budget-form/BudgetFormDrawer.test.tsx`
  - Category picker renders and updates the selected value.

## Validation

Targeted checks only (per `AGENTS.md`):

- `rtk bunx prettier --write` + `--check` on modified files.
- `rtk bunx eslint` on modified files.
- `vitest run` on the touched test patterns.
- `tsc --noEmit` if needed for type changes.
