# Budget Clone Next Period - Design

Date: 2026-06-09
Branch: `dev-budget-clone-next-period-design`

## Summary

Add a fast mobile-first flow on the Budgets page for cloning the selected weekly
budget list to the next week, or the selected monthly budget list to the next
month. The flow copies budget definitions only. It does not copy transactions,
assigned transaction links, spent totals, or recovery state.

The first version uses a period-level action, skips conflicts by normalized
budget name in the target period, switches the UI to the target period after a
successful clone, and reports created/skipped counts in a toast.

Custom budgets are out of scope.

## Current Context

The app stores all budget types in one `budgets` table with:

- `period`: `week`, `month`, or `custom`
- `periodStartDate`
- `periodEndDate`
- definition fields: `name`, `amount`, `icon`, `color`, `category`

`src/db/budget-queries.ts` already normalizes weekly and monthly dates when
creating or updating budgets:

- weekly budgets normalize to the week range from `getWeekRange`
- monthly budgets normalize to the first and last day of the month

`src/components/BudgetWeeklyBudgetsClient.tsx` owns the hydrated Budgets page
client UI. It groups `queries.budgets.overview` locally into weekly, monthly,
and custom tabs. Weekly groups use Sunday-starting weeks from `src/lib/week.ts`.
Monthly groups use `YYYY-MM` keys from each budget start date.

Project rules require app-owned writes to use REST routes plus TanStack Query
mutation hooks, not Server Actions.

## UX

### Entry Point

Use a compact period-level action for Weekly and Monthly tabs:

- Weekly selected period: `Clone to next week`
- Monthly selected period: `Clone to next month`
- Custom tab: no clone action

The action should sit near the selected period's active content, close to the
summary/list rather than hidden in the add-budget drawer. It should be usable on
iPhone 13/14 viewports without forcing a separate setup screen.

The empty state may reuse the same action when it is clear what source period
will be cloned, but the feature is not empty-state-only.

### Behavior

When the user taps the action:

1. The app clones the selected weekly or monthly group to the immediate next
   period.
2. The app skips target budgets that already have the same normalized name.
3. The app invalidates budget caches.
4. The Budgets page switches to the target period so the user immediately sees
   the cloned list.
5. A toast reports the result.

Example toast strings:

- `5 budgets cloned to next week.`
- `5 budgets cloned to next week. 1 already existed.`
- `All 6 budgets already existed next week.`
- `No budgets to clone from this week.`

### Copied Fields

Each cloned budget copies only:

- `name`
- `amount`
- `icon`
- `color`
- `category`
- `period`

The clone assigns new normalized target dates:

- weekly: source week start + 7 days
- monthly: source month start + 1 month

Transactions, `expense_budgets`, spent totals, remaining totals, and transaction
history are not copied. The target period starts fresh and spending is computed
from transactions assigned in that new period.

## API And Data Flow

### Service

Add a dedicated clone service in `src/db/budget-queries.ts`.

Input shape:

```ts
type BudgetCloneNextPeriodInput = {
  period: "week" | "month";
  sourceStartDate: string;
};
```

Return shape:

```ts
type BudgetCloneNextPeriodResult = {
  period: "week" | "month";
  sourceStartDate: string;
  sourceEndDate: string;
  targetStartDate: string;
  targetEndDate: string;
  sourceCount: number;
  createdCount: number;
  skippedCount: number;
  createdBudgetIds: number[];
};
```

The service should:

1. Validate/normalize `sourceStartDate` for the requested period.
2. Derive the immediate target period.
3. Fetch source budgets matching the exact normalized period type and source
   range.
4. Fetch target budgets matching the exact normalized period type and target
   range.
5. Build a set of existing target names using trimmed, lowercased names.
6. Insert only source budgets whose normalized name does not exist in the target.
7. Return counts and target period metadata.

This route does not need to touch linked expense timestamps because cloned
budgets have no linked expenses yet.

### Route

Add a REST mutation route:

```txt
POST /api/budgets/clone-next-period
```

Validate the payload with Zod in `src/lib/api/route-schemas.ts`.

Payload:

```ts
{
  period: "week" | "month";
  sourceStartDate: "YYYY-MM-DD";
}
```

Responses:

- `201` when at least one budget is created
- `200` when zero budgets are created but the request succeeds
- `400` for invalid payload
- `500` with `CLONE_BUDGETS_FAILED` for unexpected database failure

Keep `revalidatePath("/budgets")` for the server-rendered Budgets page surface.

### Mutation Hook

Add `useCloneBudgetsToNextPeriodMutation` in `src/lib/mutations/index.ts`.

The hook calls `/api/budgets/clone-next-period` and centralizes invalidation:

- `queries.budgets._def`
- `queries.budgetWeekly._def`

It should not perform UI state changes. Components own switching tabs/filters and
toasts after `mutateAsync` resolves.

### Client Integration

Update `BudgetWeeklyBudgetsClient` to call the clone mutation from the active
Weekly or Monthly period.

Weekly:

- source key is `activeWeekGroup.key`
- target key is `dayjs(activeWeekGroup.key).add(7, "day").format("YYYY-MM-DD")`
- after success, set `activeTab` to `week` and `activeWeekKey` to target key

Monthly:

- source key is `activeMonthKey`
- if the monthly filter is `all`, the primary clone action is hidden because
  there is no single source month
- target key is `dayjs(`${activeMonthKey}-01`).add(1, "month").format("YYYY-MM")`
- after success, set `activeTab` to `month` and `monthFilter` to target key

The page should include the target period key in local options after a clone even
if the stale pre-clone overview did not include it yet. Once invalidation
finishes, the refetched overview will provide real rows for that period.

## Error Handling

- Invalid period or malformed date payload returns `400`.
- No source budgets is a successful result with `sourceCount: 0`,
  `createdCount: 0`, and `skippedCount: 0`.
- All target budgets already exist is a successful result with
  `createdCount: 0` and `skippedCount: sourceCount`.
- Database failures surface through the route error response and the UI shows an
  error toast.
- On failure, the UI leaves the selected period unchanged.
- Double-tap/double-submit should be prevented by disabling the clone action
  while the mutation is pending.

## Tests

### Service Tests

Add focused tests around the clone service:

- weekly source start normalizes and target derives as +7 days
- monthly source start normalizes and target derives as +1 month
- cloned rows copy name, amount, icon, color, category, and period
- cloned rows receive target start/end dates
- transaction assignments are not inserted or copied
- same-name target budgets are skipped using trimmed lowercased comparison
- no source budgets returns zero counts without error

### Route Tests

Extend mutation route tests:

- valid payload calls the clone service and returns the response envelope
- route returns `201` when `createdCount > 0`
- route returns `200` when `createdCount === 0`
- invalid payload returns `400`

### Mutation Tests

Extend `src/lib/mutations/index.test.tsx`:

- hook posts to `/api/budgets/clone-next-period`
- hook unwraps the API response
- hook invalidates `queries.budgets._def`
- hook invalidates `queries.budgetWeekly._def`
- hook surfaces API errors

### Component Tests

Extend `BudgetWeeklyBudgetsClient` tests:

- Weekly tab renders `Clone to next week` when a weekly group is selected
- Monthly tab renders `Clone to next month` when a specific month is selected
- Monthly `all months` view does not render the primary clone action
- Custom tab does not render clone action
- successful weekly clone switches to the target week
- successful monthly clone switches to the target month
- pending clone disables the action
- failure leaves the current period unchanged and shows an error toast

## Out Of Scope

- Custom budget cloning
- Review drawer with per-budget selection
- Overwriting existing target budgets
- Copying transactions or budget assignments
- Recurring budget templates
- New database uniqueness constraints
- Desktop-specific layout optimization beyond remaining coherent

## Validation

After implementation, run targeted checks for modified `.ts`/`.tsx` files:

- `rtk bunx prettier --write <modified-files>`
- `rtk bunx prettier --check <modified-files>`
- `rtk bunx eslint <modified-files>`
- focused `bunx vitest run` for service, route, mutation, and component tests

Do not run `npm run build` for ordinary local validation. Run `npm run build`
only before pushing changes to GitHub.
