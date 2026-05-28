# Normalize Optional Query Keys Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize optional TanStack Query key segments from `undefined` to `null` for the scoped query factories.

**Architecture:** Keep the fix inside existing query factories and tests. Do not change fetchers, consumers, mutation invalidation, optimistic updates, or unrelated query families.

**Tech Stack:** Next.js App Router, TypeScript, TanStack Query, `@lukemorales/query-key-factory`, Vitest, Prettier, ESLint.

---

## File Structure

- Modify `src/lib/queries/read-fetchers.test.ts`
  - Add regression coverage for `dashboardQueries.monthlySummary()` and `reportQueries.monthly()` raw `queryKey` arrays.
  - Keep these assertions near the existing query factory tests.
- Modify `src/lib/queries/dashboard.ts`
  - Normalize the optional `month` key segment with `month ?? null`.
- Modify `src/lib/queries/reports.ts`
  - Normalize the optional monthly report `month` key segment with `month ?? null`.
  - Leave daily report keys unchanged because `date` is required.
- Modify `src/lib/queries/budget-weekly.test.ts`
  - Add regression coverage for `budgetWeeklyOptionsQueryKey(...)` when `targetDate` is omitted or passed as `undefined`.
  - Preserve the existing assertion that concrete target dates produce distinct keys.
- Modify `src/lib/queries/budget-weekly.ts`
  - Normalize the optional `targetDate` key segment with `targetDate ?? null`.

---

### Task 1: Add Monthly Query-Key Regression Tests

**Files:**
- Modify: `src/lib/queries/read-fetchers.test.ts`

- [ ] **Step 1: Add the failing dashboard and report key tests**

Insert these tests in `describe("read query fetchers", () => { ... })`, immediately before the existing test named `"adds queryFns to read query factory entries"`:

```ts
  it("normalizes omitted dashboard month query keys to null", () => {
    expect(dashboardQueries.monthlySummary().queryKey).toEqual([
      "dashboard",
      "monthlySummary",
      null,
    ]);
    expect(dashboardQueries.monthlySummary(undefined).queryKey).toEqual([
      "dashboard",
      "monthlySummary",
      null,
    ]);
    expect(dashboardQueries.monthlySummary("2026-05").queryKey).toEqual([
      "dashboard",
      "monthlySummary",
      "2026-05",
    ]);
  });

  it("normalizes omitted monthly report query keys to null", () => {
    expect(reportQueries.monthly().queryKey).toEqual([
      "reports",
      "monthly",
      null,
    ]);
    expect(reportQueries.monthly(undefined).queryKey).toEqual([
      "reports",
      "monthly",
      null,
    ]);
    expect(reportQueries.monthly("2026-05").queryKey).toEqual([
      "reports",
      "monthly",
      "2026-05",
    ]);
  });
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```bash
rtk bunx vitest run src/lib/queries/read-fetchers.test.ts -t "normalizes omitted"
```

Expected: FAIL because the raw `queryKey` arrays contain `undefined` instead of `null` for omitted optional month values.

- [ ] **Step 3: Commit the failing tests**

Run:

```bash
rtk git add src/lib/queries/read-fetchers.test.ts
rtk git commit -m "test: cover optional monthly query key normalization"
```

---

### Task 2: Normalize Dashboard and Report Monthly Keys

**Files:**
- Modify: `src/lib/queries/dashboard.ts`
- Modify: `src/lib/queries/reports.ts`
- Test: `src/lib/queries/read-fetchers.test.ts`

- [ ] **Step 1: Update the dashboard query factory**

In `src/lib/queries/dashboard.ts`, replace:

```ts
export const dashboardQueries = createQueryKeys("dashboard", {
  monthlySummary: (month?: string) => ({
    queryKey: [month],
    queryFn: () => fetchDashboardMonthlySummary(month),
  }),
});
```

with:

```ts
export const dashboardQueries = createQueryKeys("dashboard", {
  monthlySummary: (month?: string) => ({
    queryKey: [month ?? null],
    queryFn: () => fetchDashboardMonthlySummary(month),
  }),
});
```

- [ ] **Step 2: Update the monthly report query factory**

In `src/lib/queries/reports.ts`, replace only the `monthly` entry:

```ts
  monthly: (month?: string) => ({
    queryKey: [month],
    queryFn: () => fetchMonthlyReport(month),
  }),
```

with:

```ts
  monthly: (month?: string) => ({
    queryKey: [month ?? null],
    queryFn: () => fetchMonthlyReport(month),
  }),
```

- [ ] **Step 3: Run the focused monthly key tests**

Run:

```bash
rtk bunx vitest run src/lib/queries/read-fetchers.test.ts -t "normalizes omitted"
```

Expected: PASS for the dashboard and monthly report normalization tests.

- [ ] **Step 4: Run the full read fetchers test file**

Run:

```bash
rtk bunx vitest run src/lib/queries/read-fetchers.test.ts
```

Expected: PASS for all tests in `src/lib/queries/read-fetchers.test.ts`.

- [ ] **Step 5: Commit the monthly key fix**

Run:

```bash
rtk git add src/lib/queries/dashboard.ts src/lib/queries/reports.ts src/lib/queries/read-fetchers.test.ts
rtk git commit -m "fix: normalize optional monthly query keys"
```

---

### Task 3: Add Weekly Budget Query-Key Regression Test

**Files:**
- Modify: `src/lib/queries/budget-weekly.test.ts`

- [ ] **Step 1: Add the failing weekly budget key test**

Insert this test in `describe("budget weekly query helpers", () => { ... })`, immediately after the existing test named `"includes target date in option query keys"`:

```ts
  it("normalizes omitted target date in option query keys to null", () => {
    expect(budgetWeeklyOptionsQueryKey("2026-05-17")).toEqual([
      "budgetWeekly",
      "options",
      "2026-05-17",
      null,
    ]);
    expect(budgetWeeklyOptionsQueryKey("2026-05-17", undefined)).toEqual([
      "budgetWeekly",
      "options",
      "2026-05-17",
      null,
    ]);
    expect(budgetWeeklyOptionsQueryKey("2026-05-17", "2026-05-20")).toEqual([
      "budgetWeekly",
      "options",
      "2026-05-17",
      "2026-05-20",
    ]);
  });
```

- [ ] **Step 2: Run the focused weekly budget key test and verify it fails**

Run:

```bash
rtk bunx vitest run src/lib/queries/budget-weekly.test.ts -t "normalizes omitted target date"
```

Expected: FAIL because the raw `queryKey` array contains `undefined` instead of `null` when `targetDate` is omitted.

- [ ] **Step 3: Commit the failing test**

Run:

```bash
rtk git add src/lib/queries/budget-weekly.test.ts
rtk git commit -m "test: cover optional weekly budget key normalization"
```

---

### Task 4: Normalize Weekly Budget Option Keys

**Files:**
- Modify: `src/lib/queries/budget-weekly.ts`
- Test: `src/lib/queries/budget-weekly.test.ts`

- [ ] **Step 1: Update the weekly budget query factory**

In `src/lib/queries/budget-weekly.ts`, replace:

```ts
export const budgetWeeklyQueries = createQueryKeys("budgetWeekly", {
  options: (weekStart: string, targetDate?: string) => ({
    queryKey: [weekStart, targetDate],
    queryFn: () => fetchWeeklyBudgetOptions(weekStart, targetDate),
  }),
});
```

with:

```ts
export const budgetWeeklyQueries = createQueryKeys("budgetWeekly", {
  options: (weekStart: string, targetDate?: string) => ({
    queryKey: [weekStart, targetDate ?? null],
    queryFn: () => fetchWeeklyBudgetOptions(weekStart, targetDate),
  }),
});
```

- [ ] **Step 2: Run the focused weekly budget key tests**

Run:

```bash
rtk bunx vitest run src/lib/queries/budget-weekly.test.ts -t "option query keys|normalizes omitted target date"
```

Expected: PASS for the existing distinct target-date test and the new null-normalization test.

- [ ] **Step 3: Run the full weekly budget query helper test file**

Run:

```bash
rtk bunx vitest run src/lib/queries/budget-weekly.test.ts
```

Expected: PASS for all tests in `src/lib/queries/budget-weekly.test.ts`.

- [ ] **Step 4: Commit the weekly budget key fix**

Run:

```bash
rtk git add src/lib/queries/budget-weekly.ts src/lib/queries/budget-weekly.test.ts
rtk git commit -m "fix: normalize optional weekly budget query keys"
```

---

### Task 5: Run Required Targeted Checks

**Files:**
- Check: `src/lib/queries/dashboard.ts`
- Check: `src/lib/queries/reports.ts`
- Check: `src/lib/queries/budget-weekly.ts`
- Check: `src/lib/queries/read-fetchers.test.ts`
- Check: `src/lib/queries/budget-weekly.test.ts`

- [ ] **Step 1: Format modified TypeScript files**

Run:

```bash
rtk bunx prettier --write src/lib/queries/dashboard.ts src/lib/queries/reports.ts src/lib/queries/budget-weekly.ts src/lib/queries/read-fetchers.test.ts src/lib/queries/budget-weekly.test.ts
```

Expected: Prettier completes successfully and reports each file as written or unchanged.

- [ ] **Step 2: Check formatting for modified TypeScript files**

Run:

```bash
rtk bunx prettier --check src/lib/queries/dashboard.ts src/lib/queries/reports.ts src/lib/queries/budget-weekly.ts src/lib/queries/read-fetchers.test.ts src/lib/queries/budget-weekly.test.ts
```

Expected: PASS with `All matched files use Prettier code style!`.

- [ ] **Step 3: Run ESLint for modified TypeScript files**

Run:

```bash
rtk bunx eslint src/lib/queries/dashboard.ts src/lib/queries/reports.ts src/lib/queries/budget-weekly.ts src/lib/queries/read-fetchers.test.ts src/lib/queries/budget-weekly.test.ts
```

Expected: PASS with no lint errors.

- [ ] **Step 4: Re-run both targeted test files**

Run:

```bash
rtk bunx vitest run src/lib/queries/read-fetchers.test.ts src/lib/queries/budget-weekly.test.ts
```

Expected: PASS for both targeted test files.

- [ ] **Step 5: Commit formatting or lint follow-ups if needed**

If Step 1 changed files after Task 4, run:

```bash
rtk git add src/lib/queries/dashboard.ts src/lib/queries/reports.ts src/lib/queries/budget-weekly.ts src/lib/queries/read-fetchers.test.ts src/lib/queries/budget-weekly.test.ts
rtk git commit -m "chore: format query key normalization changes"
```

Expected: A commit is created only when formatting changed files after the prior implementation commits.

---

## Final Verification

- [ ] **Step 1: Confirm the branch is clean**

Run:

```bash
rtk git status --short --branch
```

Expected: current branch is `dev-normalize-query-keys-null` and there are no unstaged or uncommitted files except intentional planning artifacts if they have not been committed yet.

- [ ] **Step 2: Review the final diff against `main`**

Run:

```bash
rtk git diff main...HEAD -- src/lib/queries/dashboard.ts src/lib/queries/reports.ts src/lib/queries/budget-weekly.ts src/lib/queries/read-fetchers.test.ts src/lib/queries/budget-weekly.test.ts
```

Expected: diff only contains the three `?? null` key normalizations and focused regression tests.
