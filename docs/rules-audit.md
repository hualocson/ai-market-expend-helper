# Codebase Audit — `nextjs-code.md` Compliance

**Date:** 2026-05-01
**Scope:** `src/`
**Rules:** `[.agents/rules/nextjs-code.md](../.agents/rules/nextjs-code.md)`

---

## Summary


| Rule | Topic                   | Status    | Findings                                                                            |
| ---- | ----------------------- | --------- | ----------------------------------------------------------------------------------- |
| 1    | Server vs Client        | ✅ Pass    | 0 confirmed violations (37 `"use client"` files, all justified on review)           |
| 2    | Data fetching           | ⚠️ Review | 1 (possible `useQuery` duplication)                                                 |
| 3    | loading.tsx / error.tsx | ❌ Fail    | 4 routes missing                                                                    |
| 4    | Components / forms      | ✅ Pass    | 0                                                                                   |
| 5    | State management        | ✅ Pass    | 0                                                                                   |
| 6    | Styling                 | ✅ Pass    | All `style={{...}}` use dynamic values (compliant per Rule 6)                       |
| 7    | Performance             | ✅ Pass    | No `<img>`, no problematic barrels                                                  |
| 8    | API & Server Actions    | ❌ Fail    | No Zod validation on any handler/action; 4 mutation routes missing `revalidatePath` |
| 10   | TypeScript              | ✅ Pass    | No `any` / `as any` in `src/`                                                       |
| 11   | Testing                 | —         | Not audited (out of scope)                                                          |
| 12   | Validation cmds         | —         | Documentation rule, no code to scan                                                 |
| 13   | Anti-patterns           | ✅ Pass    | None observed                                                                       |


**Overall:** 2 high-priority, 1 medium-priority, 1 review item.

---

## High Priority

### H1 — No Zod validation on Server Actions or route handlers (Rule 2, Rule 8)

Every Server Action and route handler accepts input without schema validation. Manual `typeof` checks and `as` casts are used instead.

**Affected:**

- `src/app/actions/expense-actions.ts` — Server Action; trusts caller-shaped input.
- `src/app/actions/budget-weekly-actions.ts` — Server Action; trusts caller-shaped input.
- `src/app/api/expenses/route.ts:20` — `as CreateExpenseInput` cast on request body.
- `src/app/api/weekly-budgets/route.ts` — manual `typeof` checks (POST).
- `src/app/api/weekly-budgets/[id]/route.ts` — no validation (PATCH/DELETE).
- `src/app/api/transaction-budget/route.ts` — manual checks (POST).
- `src/app/api/budgets/[id]/transactions/route.ts` — query-param parsing without validation.
- `src/app/api/internal/transactions/route.ts` — manual validation.
- `src/app/api/internal/transactions/[id]/route.ts` — manual validation.
- `src/app/api/internal/budgets/route.ts` — manual validation.
- `src/app/api/internal/budgets/[id]/route.ts` — manual validation.
- `src/app/api/ai/parse-expense/route.ts` — verify (AI endpoint).

**Fix:** Define Zod schemas in `src/lib/schemas/` (or co-located), call `schema.parse(input)` at the top of every action / handler, return 400 on `ZodError`.

---

### H2 — Mutation route handlers don't call `revalidatePath` / `revalidateTag` (Rule 8)

Server Actions correctly revalidate (`expense-actions.ts`, `budget-weekly-actions.ts`). Route handlers do not.

**Affected:**

- `src/app/api/expenses/route.ts` — POST.
- `src/app/api/weekly-budgets/route.ts` — POST.
- `src/app/api/weekly-budgets/[id]/route.ts` — PATCH, DELETE.
- `src/app/api/transaction-budget/route.ts` — POST.
- `src/app/api/internal/transactions/route.ts` — POST.
- `src/app/api/internal/transactions/[id]/route.ts` — PATCH/DELETE.
- `src/app/api/internal/budgets/route.ts` — POST.
- `src/app/api/internal/budgets/[id]/route.ts` — PATCH/DELETE.

**Fix:** Add `revalidatePath("/")` and `revalidatePath("/budgets")` (or appropriate tag) after any successful mutation. If these endpoints are exclusively external (e.g., consumed by the iOS Shortcut described in `docs/internal-api-spec.md`), document the choice and skip — but still revalidate so a subsequent in-app load is fresh.

---

## Medium Priority

### M1 — Missing `loading.tsx` / `error.tsx` in data-fetching routes (Rule 3)

Only the root route (`src/app/loading.tsx`) has a Suspense fallback. Sub-routes that do server-side data fetching show no loading UI on slow networks.


| Route                        | `loading.tsx` | `error.tsx` | Fetches data?             |
| ---------------------------- | ------------- | ----------- | ------------------------- |
| `src/app/budgets/`           | ❌             | ❌           | yes (`getBudgetOverview`) |
| `src/app/transactions/`      | ❌             | ❌           | yes                       |
| `src/app/report/`            | ❌             | ❌           | yes                       |
| `src/app/report/day/[date]/` | ❌             | ❌           | yes                       |
| `src/app/ai/`                | ❌             | ❌           | likely                    |
| `src/app/settings/`          | ❌             | ❌           | unknown                   |


**Fix:** Add `loading.tsx` (skeleton) and `error.tsx` (client component with reset button) to each route that performs server data fetching. Start with `/budgets`, `/transactions`, `/report/day/[date]`.

---

## Review Items

### R1 — `useQuery` in `BudgetWeeklyBudgetsClient` may duplicate server-rendered data (Rule 2)

`src/components/BudgetWeeklyBudgetsClient.tsx:382-393` uses TanStack Query for weekly budget options. The parent route `src/app/budgets/page.tsx` already pre-fetches via `getBudgetOverview()`.

**Question:** Is the `useQuery` providing genuinely client-mutable state (re-fetched after a mutation), or is it a redundant cache that defeats SSR? If the latter, prefer passing server data via props and use `useQuery` only when data must refresh from a Server Action without a navigation.

**Same pattern at:** `src/components/ManualExpenseForm.tsx:382-393`.

---

## Compliant Areas (Verified)

- **Rule 1:** No `"use client"` placed mid-file. Server-by-default observed.
- **Rule 4:** Forms use `createExpenseEntry` Server Action, not hand-rolled `fetch` + `useState`.
- **Rule 6:** Every `style={{...}}` usage carries a dynamic value (progress widths, transforms, CSS variables, mascot animation params) — these cannot be expressed in static Tailwind classes and are explicitly permitted by Rule 6.
- **Rule 7:** No `<img>` tags in `src/`. `next/image` used throughout.
- **Rule 7:** `src/enums/index.ts` and `src/db/index.ts` are single-export files, not problematic barrels.
- **Rule 10:** Zero `: any` or `as any` matches in `src/`.

---

## Recommended Order of Fixes

1. **H1 — Add Zod validation** (one schema file per resource; mechanical and high-leverage).
2. **H2 — Add `revalidatePath` to mutation routes** (small change, eliminates stale UI bugs).
3. **M1 — Add `loading.tsx` to `/budgets`, `/transactions`, `/report/day/[date]`** (UX win).
4. **R1 — Decide on `useQuery` strategy** (architectural; needs a call before it spreads).

---

## Notes & Caveats

- The audit was static (grep + file inspection). Runtime behavior was not verified.
- Rule 5 (state management thresholds) was not flagged, but `src/stores/` was not deeply reviewed for derived-state-in-store violations.
- Test files were excluded from `any`/style scans.
- The `~offline` route (Serwist offline shell) was not audited — likely intentional bypass.

