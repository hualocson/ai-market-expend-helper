# Create Transaction UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing `ExpenseEntryDrawer`/`ManualExpenseForm` create-expense flow with a focused full-screen `QuickExpenseSheet`: small top row (date · budget · paid-by), borderless single-line note, large borderless amount, suggestion chips, category chips, and footer submit.

**Architecture:** New `QuickExpenseSheet` owns its own draft state and submission; `ManualExpenseForm` stays untouched for its other consumers (AIExpenseChat, AIInput, ExpenseListItem) except that its inline budget picker is extracted into a reusable `BudgetPickerSheet`. A small `PaidByPickerSheet` and a `useAutoShrinkFont` hook are also added.

**Tech Stack:** Next.js 15 App Router · React 19 · TanStack Query · Zustand · shadcn `Sheet` primitive · Tailwind v4 · Vitest + Testing Library · `createExpenseEntry` Server Action.

**Spec:** `docs/superpowers/specs/2026-05-22-create-transaction-ui-redesign-design.md`

---

## Conventions

- All new declared types use the `T` prefix (project convention — see `TExpense`).
- Test files live next to the source: `Foo.test.tsx` beside `Foo.tsx`.
- Run targeted checks only:
  - Tests: `bun run test <path>` (or `npm run test -- <path>`)
  - Typecheck (file scope): `npx tsc --noEmit -p tsconfig.json` (full project — fast enough; do not use `bun run build`)
- Commit after every Task. Conventional commits (`feat:`, `refactor:`, `test:`).

## File Map

**Create:**
- `src/lib/budget-options.ts` — pure helpers extracted from `ManualExpenseForm` (`parseBudgetDate`, `formatBudgetRange`, `sortBudgetOptions`, `groupBudgetOptions`, `pickDefaultBudget`, label/empty-state constants).
- `src/lib/budget-options.test.ts` — unit tests for the helpers above.
- `src/hooks/useAutoShrinkFont.ts` — keeps an input's font size shrinking to fit on a single line.
- `src/hooks/useAutoShrinkFont.test.ts`
- `src/components/BudgetPickerSheet.tsx` — extracted grouped budget picker.
- `src/components/BudgetPickerSheet.test.tsx`
- `src/components/PaidByPickerSheet.tsx` — small chooser for CUBI / EMBE / OTHER.
- `src/components/PaidByPickerSheet.test.tsx`
- `src/components/QuickExpenseSheet.tsx` — replaces `ExpenseEntryDrawer`.
- `src/components/QuickExpenseSheet.test.tsx`

**Modify:**
- `src/components/ManualExpenseForm.tsx` — import helpers from `src/lib/budget-options.ts`; replace inline budget sub-sheet with `<BudgetPickerSheet />`. Behavior unchanged.
- `src/components/BottomNav.tsx` — swap `<ExpenseEntryDrawer compact />` for `<QuickExpenseSheet compact />`.

**Delete:**
- `src/components/ExpenseEntryDrawer.tsx`
- `src/components/ExpenseEntryDrawer.mascot.test.tsx`

---

## Task 1: Extract budget-option helpers to `src/lib/budget-options.ts`

**Files:**
- Create: `src/lib/budget-options.ts`
- Create: `src/lib/budget-options.test.ts`
- Modify: `src/components/ManualExpenseForm.tsx` (imports + remove now-duplicated locals)

These helpers will be used by both `ManualExpenseForm` (today's flow) and the new `BudgetPickerSheet`. Pure functions, easy to TDD.

- [ ] **Step 1.1: Write the failing test file**

Create `src/lib/budget-options.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import type { BudgetWeeklyOption } from "@/lib/queries/budget-weekly";
import {
  formatBudgetRange,
  groupBudgetOptions,
  pickDefaultBudget,
  sortBudgetOptions,
} from "./budget-options";

const opt = (over: Partial<BudgetWeeklyOption> = {}): BudgetWeeklyOption => ({
  id: 1,
  name: "Food",
  period: "week",
  periodStartDate: "2026-05-18",
  periodEndDate: "2026-05-24",
  amount: 100,
  spent: 0,
  remaining: 100,
  ...over,
});

describe("formatBudgetRange", () => {
  it("returns single date when start equals end", () => {
    expect(
      formatBudgetRange(opt({ periodStartDate: "2026-05-18", periodEndDate: "2026-05-18" }))
    ).toMatch(/18 May 2026/);
  });

  it("returns short range when same year", () => {
    expect(
      formatBudgetRange(opt({ periodStartDate: "2026-05-18", periodEndDate: "2026-05-24" }))
    ).toMatch(/18 May - 24 May 2026/);
  });

  it("falls back to period label when start date is missing", () => {
    expect(
      formatBudgetRange(opt({ periodStartDate: null, periodEndDate: null, period: "month" }))
    ).toBe("Month budget");
  });
});

describe("sortBudgetOptions", () => {
  it("sorts by start date desc, then by name", () => {
    const a = opt({ id: 1, name: "Bravo", periodStartDate: "2026-05-11" });
    const b = opt({ id: 2, name: "Alpha", periodStartDate: "2026-05-18" });
    const c = opt({ id: 3, name: "Charlie", periodStartDate: "2026-05-18" });
    expect(sortBudgetOptions([a, b, c]).map((o) => o.id)).toEqual([2, 3, 1]);
  });
});

describe("groupBudgetOptions", () => {
  it("groups by period and sorts each group", () => {
    const w = opt({ id: 1, period: "week", periodStartDate: "2026-05-11" });
    const m = opt({ id: 2, period: "month", periodStartDate: "2026-05-01" });
    const c = opt({ id: 3, period: "custom", periodStartDate: "2026-05-20" });
    const result = groupBudgetOptions([w, m, c]);
    expect(result.week.map((o) => o.id)).toEqual([1]);
    expect(result.month.map((o) => o.id)).toEqual([2]);
    expect(result.custom.map((o) => o.id)).toEqual([3]);
  });
});

describe("pickDefaultBudget", () => {
  it("prefers week, then month, then custom", () => {
    expect(pickDefaultBudget({ week: [opt({ id: 1 })], month: [], custom: [] })?.id).toBe(1);
    expect(pickDefaultBudget({ week: [], month: [opt({ id: 2 })], custom: [] })?.id).toBe(2);
    expect(pickDefaultBudget({ week: [], month: [], custom: [opt({ id: 3 })] })?.id).toBe(3);
    expect(pickDefaultBudget({ week: [], month: [], custom: [] })).toBeNull();
  });
});
```

- [ ] **Step 1.2: Run test and verify it fails**

Run: `bun run test src/lib/budget-options.test.ts`
Expected: FAIL with `Cannot find module './budget-options'`.

- [ ] **Step 1.3: Create the helper module**

Create `src/lib/budget-options.ts`:

```ts
import dayjs from "@/configs/date";
import type { BudgetWeeklyOption } from "@/lib/queries/budget-weekly";

export type TBudgetOption = BudgetWeeklyOption;
export type TBudgetOptionGroupKey = "week" | "month" | "custom";

export type TBudgetOptionGroups = Record<TBudgetOptionGroupKey, TBudgetOption[]>;

export const budgetGroupLabels: Record<TBudgetOptionGroupKey, string> = {
  week: "Weekly budgets",
  month: "Monthly budgets",
  custom: "Other budgets",
};

export const budgetGroupEmptyLabel: Record<TBudgetOptionGroupKey, string> = {
  week: "No weekly budgets for this date.",
  month: "No monthly budgets for this date.",
  custom: "No additional budgets for this date.",
};

const fallbackBudgetPeriodLabel: Record<TBudgetOptionGroupKey, string> = {
  week: "Week budget",
  month: "Month budget",
  custom: "Custom budget",
};

export const parseBudgetDate = (value?: string | null) => {
  if (!value) {
    return null;
  }
  const parsed = dayjs(value, "YYYY-MM-DD", true);
  return parsed.isValid() ? parsed : null;
};

export const formatBudgetRange = (budget: TBudgetOption) => {
  const start = parseBudgetDate(budget.periodStartDate);
  if (!start) {
    return fallbackBudgetPeriodLabel[budget.period];
  }
  const end = parseBudgetDate(budget.periodEndDate) ?? start;
  if (start.isSame(end, "day")) {
    return start.format("DD MMM YYYY");
  }
  if (start.isSame(end, "year")) {
    return `${start.format("DD MMM")} - ${end.format("DD MMM YYYY")}`;
  }
  return `${start.format("DD MMM YYYY")} - ${end.format("DD MMM YYYY")}`;
};

export const sortBudgetOptions = (items: TBudgetOption[]) =>
  [...items].sort((left, right) => {
    const leftDate = parseBudgetDate(left.periodStartDate);
    const rightDate = parseBudgetDate(right.periodStartDate);
    if (leftDate && rightDate && !leftDate.isSame(rightDate, "day")) {
      return rightDate.valueOf() - leftDate.valueOf();
    }
    if (leftDate && !rightDate) return -1;
    if (!leftDate && rightDate) return 1;
    return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
  });

export const groupBudgetOptions = (items: TBudgetOption[]): TBudgetOptionGroups => {
  const groups: TBudgetOptionGroups = { week: [], month: [], custom: [] };
  items.forEach((budget) => {
    if (budget.period === "week" || budget.period === "month") {
      groups[budget.period].push(budget);
      return;
    }
    groups.custom.push(budget);
  });
  return {
    week: sortBudgetOptions(groups.week),
    month: sortBudgetOptions(groups.month),
    custom: sortBudgetOptions(groups.custom),
  };
};

export const pickDefaultBudget = (groups: TBudgetOptionGroups) =>
  groups.week[0] ?? groups.month[0] ?? groups.custom[0] ?? null;

export const hasAnyBudgetOption = (groups: TBudgetOptionGroups) =>
  groups.week.length > 0 || groups.month.length > 0 || groups.custom.length > 0;
```

- [ ] **Step 1.4: Run test and verify it passes**

Run: `bun run test src/lib/budget-options.test.ts`
Expected: PASS (all 7+ test cases).

- [ ] **Step 1.5: Update `ManualExpenseForm` to import from the new module**

In `src/components/ManualExpenseForm.tsx`:
1. Add import after the existing budget-weekly import:
   ```ts
   import {
     budgetGroupEmptyLabel,
     budgetGroupLabels,
     formatBudgetRange,
     groupBudgetOptions,
     pickDefaultBudget,
     type TBudgetOption,
     type TBudgetOptionGroupKey,
   } from "@/lib/budget-options";
   ```
2. Delete the local declarations (search for and remove): `budgetGroupLabels`, `budgetGroupEmptyLabel`, `fallbackBudgetPeriodLabel`, `parseBudgetDate`, `formatBudgetRange`, `sortBudgetOptions`, the local `pickDefaultBudget`, and `type BudgetOption = BudgetWeeklyOption;` / `type BudgetOptionGroupKey = ...`.
3. Replace `BudgetOption`/`BudgetOptionGroupKey` references with `TBudgetOption`/`TBudgetOptionGroupKey`.
4. Replace the inline `budgetGroups` `useMemo` body with `groupBudgetOptions(budgetOptions)`:
   ```ts
   const budgetGroups = useMemo(() => groupBudgetOptions(budgetOptions), [budgetOptions]);
   ```

- [ ] **Step 1.6: Verify existing tests still pass**

Run: `bun run test src/components/ManualExpenseForm.quick-mode.test.tsx src/components/BudgetTransferDrawer.test.tsx`
Expected: PASS (no behavior change).

Run typecheck: `npx tsc --noEmit`
Expected: no errors in modified files.

- [ ] **Step 1.7: Commit**

```bash
git add src/lib/budget-options.ts src/lib/budget-options.test.ts src/components/ManualExpenseForm.tsx
git commit -m "refactor(budget): extract option grouping helpers into src/lib/budget-options"
```

---

## Task 2: `useAutoShrinkFont` hook

**Files:**
- Create: `src/hooks/useAutoShrinkFont.ts`
- Create: `src/hooks/useAutoShrinkFont.test.ts`

Keeps a single-line input's font size shrinking by step (px) until `scrollWidth <= clientWidth`, with a min floor. Restores to max when content fits again.

- [ ] **Step 2.1: Write the failing test**

Create `src/hooks/useAutoShrinkFont.test.ts`:

```ts
import { renderHook } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it } from "vitest";

import { useAutoShrinkFont } from "./useAutoShrinkFont";

const setup = (scrollWidth: number, clientWidth: number) => {
  const input = document.createElement("input");
  Object.defineProperty(input, "scrollWidth", { value: scrollWidth, configurable: true });
  Object.defineProperty(input, "clientWidth", { value: clientWidth, configurable: true });
  document.body.appendChild(input);
  return input;
};

describe("useAutoShrinkFont", () => {
  it("does nothing when content fits", () => {
    const input = setup(100, 200);
    renderHook(() => {
      const ref = useRef(input);
      useAutoShrinkFont(ref, { max: 16, min: 11, step: 1 });
      return null;
    });
    expect(input.style.fontSize).toBe("16px");
  });

  it("shrinks step-by-step until content fits or floor reached", () => {
    const input = setup(400, 100);
    renderHook(() => {
      const ref = useRef(input);
      useAutoShrinkFont(ref, { max: 16, min: 11, step: 1 });
      return null;
    });
    expect(input.style.fontSize).toBe("11px");
  });

  it("re-applies on input event", () => {
    const input = setup(400, 100);
    renderHook(() => {
      const ref = useRef(input);
      useAutoShrinkFont(ref, { max: 16, min: 11, step: 1 });
      return null;
    });
    expect(input.style.fontSize).toBe("11px");

    // Content shortens — make it fit at 16
    Object.defineProperty(input, "scrollWidth", { value: 50, configurable: true });
    input.dispatchEvent(new Event("input"));
    expect(input.style.fontSize).toBe("16px");
  });
});
```

- [ ] **Step 2.2: Run test and verify it fails**

Run: `bun run test src/hooks/useAutoShrinkFont.test.ts`
Expected: FAIL with `Cannot find module './useAutoShrinkFont'`.

- [ ] **Step 2.3: Implement the hook**

Create `src/hooks/useAutoShrinkFont.ts`:

```ts
"use client";

import { useEffect, type RefObject } from "react";

type TAutoShrinkFontOptions = {
  max?: number;
  min?: number;
  step?: number;
};

export const useAutoShrinkFont = (
  ref: RefObject<HTMLInputElement | null>,
  options: TAutoShrinkFontOptions = {}
) => {
  const { max = 16, min = 11, step = 1 } = options;

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }

    const fit = () => {
      node.style.fontSize = `${max}px`;
      let current = max;
      while (current > min && node.scrollWidth > node.clientWidth) {
        current -= step;
        node.style.fontSize = `${current}px`;
      }
    };

    fit();
    node.addEventListener("input", fit);
    return () => node.removeEventListener("input", fit);
  }, [ref, max, min, step]);
};
```

- [ ] **Step 2.4: Run test and verify it passes**

Run: `bun run test src/hooks/useAutoShrinkFont.test.ts`
Expected: PASS (3 cases).

- [ ] **Step 2.5: Commit**

```bash
git add src/hooks/useAutoShrinkFont.ts src/hooks/useAutoShrinkFont.test.ts
git commit -m "feat(hooks): add useAutoShrinkFont for single-line auto-resizing inputs"
```

---

## Task 3: `BudgetPickerSheet` extraction

**Files:**
- Create: `src/components/BudgetPickerSheet.tsx`
- Create: `src/components/BudgetPickerSheet.test.tsx`
- Modify: `src/components/ManualExpenseForm.tsx` (replace inline sub-sheet)

Self-contained bottom Sheet that renders the grouped picker (week/month/custom) plus a "No budget" row. Fetches options via TanStack Query — same query key as today, no behavior change.

- [ ] **Step 3.1: Write the failing test**

Create `src/components/BudgetPickerSheet.test.tsx`:

```tsx
import React from "react";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { BudgetWeeklyOption } from "@/lib/queries/budget-weekly";
import BudgetPickerSheet from "./BudgetPickerSheet";

vi.mock("@/lib/queries/budget-weekly", async () => {
  const actual = await vi.importActual<typeof import("@/lib/queries/budget-weekly")>(
    "@/lib/queries/budget-weekly"
  );
  return {
    ...actual,
    fetchWeeklyBudgetOptions: vi.fn(async (): Promise<BudgetWeeklyOption[]> => [
      {
        id: 1, name: "Food week", period: "week",
        periodStartDate: "2026-05-18", periodEndDate: "2026-05-24",
        amount: 100, spent: 0, remaining: 100,
      },
      {
        id: 2, name: "Rent month", period: "month",
        periodStartDate: "2026-05-01", periodEndDate: "2026-05-31",
        amount: 500, spent: 200, remaining: 300,
      },
    ]),
  };
});

const renderSheet = (override: Partial<React.ComponentProps<typeof BudgetPickerSheet>> = {}) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onChange = vi.fn();
  const onOpenChange = vi.fn();
  const utils = render(
    <QueryClientProvider client={client}>
      <BudgetPickerSheet
        open
        onOpenChange={onOpenChange}
        value={null}
        onChange={onChange}
        weekStart="2026-05-18"
        targetDate="2026-05-22"
        {...override}
      />
    </QueryClientProvider>
  );
  return { ...utils, onChange, onOpenChange };
};

describe("BudgetPickerSheet", () => {
  it("renders week and month groups for fetched budgets", async () => {
    renderSheet();
    expect(await screen.findByText("Food week")).toBeInTheDocument();
    expect(screen.getByText("Rent month")).toBeInTheDocument();
  });

  it("calls onChange(id) and closes when a budget is selected", async () => {
    const user = userEvent.setup();
    const { onChange, onOpenChange } = renderSheet();
    await user.click(await screen.findByRole("button", { name: /Food week/i }));
    expect(onChange).toHaveBeenCalledWith(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("calls onChange(null) when 'No budget' is selected", async () => {
    const user = userEvent.setup();
    const { onChange } = renderSheet({ value: 1 });
    await user.click(await screen.findByRole("button", { name: /no budget/i }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
```

- [ ] **Step 3.2: Run test and verify it fails**

Run: `bun run test src/components/BudgetPickerSheet.test.tsx`
Expected: FAIL with `Cannot find module './BudgetPickerSheet'`.

- [ ] **Step 3.3: Implement `BudgetPickerSheet`**

Create `src/components/BudgetPickerSheet.tsx`:

```tsx
"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  budgetGroupEmptyLabel,
  budgetGroupLabels,
  formatBudgetRange,
  groupBudgetOptions,
  hasAnyBudgetOption,
  type TBudgetOption,
  type TBudgetOptionGroupKey,
} from "@/lib/budget-options";
import {
  budgetWeeklyOptionsQueryKey,
  fetchWeeklyBudgetOptions,
} from "@/lib/queries/budget-weekly";
import { cn, formatVndSigned } from "@/lib/utils";
import { CheckIcon, Loader2 } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export type TBudgetPickerSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: number | null;
  onChange: (id: number | null) => void;
  weekStart: string;          // "YYYY-MM-DD"
  targetDate?: string;        // "YYYY-MM-DD"
  isParentOpen?: boolean;     // default true; pass parent sheet state for query gating
};

const BudgetPickerSheet = ({
  open,
  onOpenChange,
  value,
  onChange,
  weekStart,
  targetDate,
  isParentOpen = true,
}: TBudgetPickerSheetProps) => {
  const query = useQuery<TBudgetOption[]>({
    queryKey: budgetWeeklyOptionsQueryKey(weekStart),
    queryFn: () => fetchWeeklyBudgetOptions(weekStart, targetDate),
    enabled: isParentOpen && Boolean(weekStart),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
  });

  const groups = useMemo(() => groupBudgetOptions(query.data ?? []), [query.data]);
  const hasOptions = hasAnyBudgetOption(groups);

  const handleSelect = (id: number | null) => {
    onChange(id);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showCloseButton={false} className="rounded-t-3xl">
        <SheetHeader className="text-left">
          <SheetTitle>Budget</SheetTitle>
          <SheetDescription>
            Choose a weekly or monthly budget for this expense.
          </SheetDescription>
        </SheetHeader>
        <div className="no-scrollbar max-h-[50svh] flex-1 space-y-3 overflow-y-auto px-4 sm:px-6">
          <button
            type="button"
            onClick={() => handleSelect(null)}
            aria-pressed={value === null}
            className={cn(
              "group flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-sm font-medium transition",
              value === null
                ? "border-success/40 bg-success/10"
                : "border-border bg-card/80 hover:bg-card"
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  value === null ? "bg-success" : "bg-warning/80"
                )}
              />
              <span className="truncate">No budget</span>
            </span>
            {value === null ? (
              <CheckIcon className="text-success h-4 w-4" />
            ) : (
              <span className="text-muted-foreground text-xs">Clear</span>
            )}
          </button>

          {query.isPending ? (
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading budgets...
            </div>
          ) : hasOptions ? (
            <div className="space-y-3">
              {(["week", "month", "custom"] as const).map((groupKey: TBudgetOptionGroupKey) => {
                const items = groups[groupKey];
                if (groupKey === "custom" && !items.length) {
                  return null;
                }
                return (
                  <section key={groupKey} className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.08em]">
                        {budgetGroupLabels[groupKey]}
                      </p>
                      <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-medium">
                        {items.length}
                      </span>
                    </div>
                    {items.length ? (
                      <div className="bg-muted/30 border-border/60 space-y-1 rounded-2xl border p-1">
                        {items.map((budget) => {
                          const isActive = budget.id === value;
                          return (
                            <button
                              key={budget.id}
                              type="button"
                              onClick={() => handleSelect(budget.id)}
                              aria-pressed={isActive}
                              className={cn(
                                "group flex min-h-11 w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition",
                                isActive
                                  ? "border-success/40 bg-success/10"
                                  : "border-transparent bg-card/80 hover:bg-card"
                              )}
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                <span
                                  className={cn(
                                    "size-2 shrink-0 rounded-full",
                                    isActive ? "bg-success" : "bg-foreground/40"
                                  )}
                                />
                                <span className="flex min-w-0 flex-col">
                                  <span className="truncate text-sm font-medium">
                                    {budget.name}
                                  </span>
                                  <span className="text-muted-foreground text-xs">
                                    {formatBudgetRange(budget)}
                                  </span>
                                </span>
                              </span>
                              <span className="ml-2 flex shrink-0 items-center gap-2">
                                <span
                                  className={cn(
                                    "text-xs font-semibold tabular-nums",
                                    budget.remaining < 0 ? "text-destructive" : "text-success"
                                  )}
                                >
                                  {formatVndSigned(budget.remaining)}
                                </span>
                                {isActive ? (
                                  <CheckIcon className="text-success h-4 w-4 shrink-0" />
                                ) : null}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="bg-card/70 border-border rounded-2xl border border-dashed px-3 py-4">
                        <p className="text-muted-foreground text-xs">
                          {budgetGroupEmptyLabel[groupKey]}
                        </p>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="bg-card/70 border-border rounded-2xl border border-dashed px-3 py-4">
              <p className="text-muted-foreground text-xs">
                No budgets for this date yet.
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default BudgetPickerSheet;
```

- [ ] **Step 3.4: Run test and verify it passes**

Run: `bun run test src/components/BudgetPickerSheet.test.tsx`
Expected: PASS (3 cases).

- [ ] **Step 3.5: Replace inline picker in `ManualExpenseForm`**

In `src/components/ManualExpenseForm.tsx`:

1. Add import: `import BudgetPickerSheet from "./BudgetPickerSheet";`
2. Remove imports no longer used: the aliased `Sheet as Root, SheetContent as Content, SheetTrigger as Trigger, …` imports used solely for the budget picker (`Root`, `Content`, `Description`, `Footer`, `Header`, `Title`, `Trigger`, `Close`). Leave any that are still used elsewhere in the file (keep the date/paid-by sub-sheets if they use the same aliases — if so, leave the imports).
3. Replace the JSX block under `{!isQuickMode && showBudgetSelect && ( ... )}` (the inline `<Root open={budgetDrawerOpen}…>…</Root>`) with:
   ```tsx
   {!isQuickMode && showBudgetSelect && (
     <>
       <Button
         type="button"
         variant="outline"
         className="h-12 w-full justify-between rounded-xl"
         onClick={() => setBudgetDrawerOpen(true)}
       >
         <span className="flex items-center gap-2 text-sm font-medium">
           <Wallet className="text-muted-foreground h-4 w-4" />
           Budget
         </span>
         <span className="text-muted-foreground text-xs font-medium">
           {budgetLabel}
         </span>
       </Button>
       <BudgetPickerSheet
         open={budgetDrawerOpen}
         onOpenChange={setBudgetDrawerOpen}
         value={budgetId}
         onChange={handleBudgetChange}
         weekStart={budgetWeekStart ?? ""}
         targetDate={budgetTargetDate ?? undefined}
         isParentOpen={isSheetOpen}
       />
     </>
   )}
   ```
4. Delete the now-unused local memos/queries that are duplicated in `BudgetPickerSheet`: `budgetOptionsQuery`, `budgetOptions`, `budgetLoading`, `budgetLoaded`, `budgetGroups`, `hasBudgetOptions`. BUT keep them — `ManualExpenseForm` still uses `budgetOptions` for "clear budgetId when no longer in options" and `pickDefaultBudget` autoselect. Verify by searching the file before deleting.

  Recommended minimal change: keep the local query for the autoselect/clear-id effects, and let `BudgetPickerSheet` also fetch — TanStack Query dedupes by key, so a duplicate `useQuery` with the same key is a single network call. This is the simplest, lowest-risk path.

- [ ] **Step 3.6: Verify existing form tests pass**

Run: `bun run test src/components/ManualExpenseForm.quick-mode.test.tsx`
Expected: PASS.

- [ ] **Step 3.7: Commit**

```bash
git add src/components/BudgetPickerSheet.tsx src/components/BudgetPickerSheet.test.tsx src/components/ManualExpenseForm.tsx
git commit -m "refactor(expense): extract budget picker into BudgetPickerSheet"
```

---

## Task 4: `PaidByPickerSheet`

**Files:**
- Create: `src/components/PaidByPickerSheet.tsx`
- Create: `src/components/PaidByPickerSheet.test.tsx`

Small bottom sheet with one button per `PaidBy` value (CUBI / EMBE / OTHER), active row has a check.

- [ ] **Step 4.1: Write the failing test**

Create `src/components/PaidByPickerSheet.test.tsx`:

```tsx
import React from "react";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PaidBy } from "@/enums";
import PaidByPickerSheet from "./PaidByPickerSheet";

const renderSheet = (
  override: Partial<React.ComponentProps<typeof PaidByPickerSheet>> = {}
) => {
  const onChange = vi.fn();
  const onOpenChange = vi.fn();
  const utils = render(
    <PaidByPickerSheet
      open
      onOpenChange={onOpenChange}
      value={PaidBy.CUBI}
      onChange={onChange}
      {...override}
    />
  );
  return { ...utils, onChange, onOpenChange };
};

describe("PaidByPickerSheet", () => {
  it("renders all paid-by options", () => {
    renderSheet();
    expect(screen.getByRole("button", { name: /Cubi/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Embe/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Other/ })).toBeInTheDocument();
  });

  it("calls onChange and closes on select", async () => {
    const user = userEvent.setup();
    const { onChange, onOpenChange } = renderSheet();
    await user.click(screen.getByRole("button", { name: /Embe/ }));
    expect(onChange).toHaveBeenCalledWith(PaidBy.EMBE);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("marks active row with aria-pressed", () => {
    renderSheet({ value: PaidBy.OTHER });
    expect(screen.getByRole("button", { name: /Other/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: /Cubi/ })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });
});
```

- [ ] **Step 4.2: Run test and verify it fails**

Run: `bun run test src/components/PaidByPickerSheet.test.tsx`
Expected: FAIL with `Cannot find module './PaidByPickerSheet'`.

- [ ] **Step 4.3: Implement `PaidByPickerSheet`**

Create `src/components/PaidByPickerSheet.tsx`:

```tsx
"use client";

import { PaidBy } from "@/enums";
import { cn } from "@/lib/utils";
import { CheckIcon } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export type TPaidByPickerSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: PaidBy;
  onChange: (next: PaidBy) => void;
};

const PAID_BY_OPTIONS: PaidBy[] = [PaidBy.CUBI, PaidBy.EMBE, PaidBy.OTHER];

const PaidByPickerSheet = ({
  open,
  onOpenChange,
  value,
  onChange,
}: TPaidByPickerSheetProps) => {
  const handleSelect = (next: PaidBy) => {
    onChange(next);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showCloseButton={false} className="rounded-t-3xl">
        <SheetHeader className="text-left">
          <SheetTitle>Paid by</SheetTitle>
        </SheetHeader>
        <div className="space-y-2 px-4 pb-4 sm:px-6">
          {PAID_BY_OPTIONS.map((option) => {
            const isActive = option === value;
            return (
              <button
                key={option}
                type="button"
                onClick={() => handleSelect(option)}
                aria-pressed={isActive}
                className={cn(
                  "flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-sm font-medium transition",
                  isActive
                    ? "border-success/40 bg-success/10"
                    : "border-border bg-card/80 hover:bg-card"
                )}
              >
                <span>{option}</span>
                {isActive ? <CheckIcon className="text-success h-4 w-4" /> : null}
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default PaidByPickerSheet;
```

- [ ] **Step 4.4: Run test and verify it passes**

Run: `bun run test src/components/PaidByPickerSheet.test.tsx`
Expected: PASS (3 cases).

- [ ] **Step 4.5: Commit**

```bash
git add src/components/PaidByPickerSheet.tsx src/components/PaidByPickerSheet.test.tsx
git commit -m "feat(expense): add PaidByPickerSheet"
```

---

## Task 5: `QuickExpenseSheet` — open/close + trigger

**Files:**
- Create: `src/components/QuickExpenseSheet.tsx`
- Create: `src/components/QuickExpenseSheet.test.tsx`

Start with just the Sheet opening from the `+` trigger and the note input autofocusing. Each subsequent task layers on a feature.

- [ ] **Step 5.1: Write the failing test**

Create `src/components/QuickExpenseSheet.test.tsx`:

```tsx
import React from "react";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { SettingsStoreProvider } from "@/components/providers/StoreProvider";
import QuickExpenseSheet from "./QuickExpenseSheet";

vi.mock("@/app/actions/expense-actions", () => ({
  createExpenseEntry: vi.fn().mockResolvedValue({ id: 1 }),
}));

vi.mock("@/lib/queries/budget-weekly", async () => {
  const actual = await vi.importActual<typeof import("@/lib/queries/budget-weekly")>(
    "@/lib/queries/budget-weekly"
  );
  return {
    ...actual,
    fetchWeeklyBudgetOptions: vi.fn().mockResolvedValue([]),
  };
});

const renderSheet = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SettingsStoreProvider>
        <QuickExpenseSheet />
      </SettingsStoreProvider>
    </QueryClientProvider>
  );
};

describe("QuickExpenseSheet — open/close", () => {
  it("opens when the trigger is clicked and focuses the note input", async () => {
    const user = userEvent.setup();
    renderSheet();

    expect(screen.queryByPlaceholderText(/what did you spend on/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /add expense/i }));

    const note = await screen.findByPlaceholderText(/what did you spend on/i);
    await waitFor(() => expect(note).toHaveFocus());
  });
});
```

- [ ] **Step 5.2: Run test and verify it fails**

Run: `bun run test src/components/QuickExpenseSheet.test.tsx`
Expected: FAIL with `Cannot find module './QuickExpenseSheet'`.

- [ ] **Step 5.3: Implement minimal QuickExpenseSheet**

Create `src/components/QuickExpenseSheet.tsx`:

```tsx
"use client";

import { useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export type TQuickExpenseSheetProps = {
  compact?: boolean;
};

const QuickExpenseSheet = ({ compact = false }: TQuickExpenseSheetProps) => {
  const [open, setOpen] = useState(false);
  const noteRef = useRef<HTMLInputElement>(null);

  return (
    <Sheet open={open} onOpenChange={setOpen} modal>
      <SheetTrigger asChild>
        <Button
          size={compact ? "icon-lg" : "default"}
          aria-label={compact ? "Add expense" : undefined}
          className={cn(
            "rounded-full shadow-[0_25px_60px_color-mix(in_srgb,var(--background)_60%,transparent)] active:scale-[0.97]",
            compact && "size-12"
          )}
        >
          <Plus className={compact ? "h-5 w-5" : "h-4 w-4"} />
          {compact ? null : "Add expense"}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="h-full w-full gap-0 rounded-none p-0"
      >
        <div className="flex h-full flex-col px-4 pt-4">
          <input
            ref={noteRef}
            autoFocus
            placeholder="What did you spend on?"
            className="w-full whitespace-nowrap overflow-hidden border-0 bg-transparent px-0 py-2 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0"
          />
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default QuickExpenseSheet;
```

- [ ] **Step 5.4: Run test and verify it passes**

Run: `bun run test src/components/QuickExpenseSheet.test.tsx`
Expected: PASS (1 case).

- [ ] **Step 5.5: Commit**

```bash
git add src/components/QuickExpenseSheet.tsx src/components/QuickExpenseSheet.test.tsx
git commit -m "feat(expense): scaffold QuickExpenseSheet with trigger and note input"
```

---

## Task 6: `QuickExpenseSheet` — full layout & fields

**Files:**
- Modify: `src/components/QuickExpenseSheet.tsx`
- Modify: `src/components/QuickExpenseSheet.test.tsx`

Add draft state, top row (date · budget · paid-by buttons opening their respective sheets), amount input, suggestion chips, category chip row. No submit yet.

- [ ] **Step 6.1: Add tests for the new fields**

Append to `src/components/QuickExpenseSheet.test.tsx`:

```tsx
describe("QuickExpenseSheet — fields", () => {
  const openSheet = async () => {
    const user = userEvent.setup();
    renderSheet();
    await user.click(screen.getByRole("button", { name: /add expense/i }));
    return user;
  };

  it("renders the date / budget / paid-by trigger buttons", async () => {
    await openSheet();
    expect(screen.getByRole("button", { name: /^date:/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^budget:/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^paid by:/i })).toBeInTheDocument();
  });

  it("shows suggestion chips when amount > 0", async () => {
    const user = await openSheet();
    const amount = screen.getByPlaceholderText("0");
    await user.click(amount);
    await user.keyboard("5");
    expect(screen.getByRole("button", { name: /50$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /500$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /5,?000$/ })).toBeInTheDocument();
  });

  it("applies a suggestion chip to the amount input", async () => {
    const user = await openSheet();
    const amount = screen.getByPlaceholderText("0") as HTMLInputElement;
    await user.click(amount);
    await user.keyboard("5");
    await user.click(screen.getByRole("button", { name: /5,?000$/ }));
    expect(amount.value).toMatch(/5,?000/);
  });

  it("renders the category chip row and toggles active chip", async () => {
    const user = await openSheet();
    const foodChip = screen.getByRole("button", { name: /food/i, pressed: true });
    expect(foodChip).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /transport/i }));
    expect(screen.getByRole("button", { name: /transport/i, pressed: true })).toBeInTheDocument();
  });
});
```

- [ ] **Step 6.2: Run test and verify it fails**

Run: `bun run test src/components/QuickExpenseSheet.test.tsx`
Expected: FAIL — none of the new selectors exist yet.

- [ ] **Step 6.3: Implement the full layout**

Replace `src/components/QuickExpenseSheet.tsx` with:

```tsx
"use client";

import { useMemo, useRef, useState } from "react";

import dayjs from "@/configs/date";
import { Category, PaidBy } from "@/enums";
import { useAutoShrinkFont } from "@/hooks/useAutoShrinkFont";
import { cn, formatVnd, parseVndInput } from "@/lib/utils";
import { getWeekRange } from "@/lib/week";
import { Calendar, Plus, UserRound, Wallet } from "lucide-react";

import { useSettingsStore } from "@/components/providers/StoreProvider";
import { Button } from "@/components/ui/button";
import DatePicker from "@/components/ui/date-picker";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import BudgetPickerSheet from "./BudgetPickerSheet";
import ExpenseItemIcon from "./ExpenseItemIcon";
import PaidByPickerSheet from "./PaidByPickerSheet";

export type TQuickExpenseSheetProps = {
  compact?: boolean;
};

type TExpenseDraft = {
  date: string;       // "DD/MM/YYYY"
  amount: number;
  note: string;
  category: Category;
  budgetId: number | null;
  paidBy: PaidBy;
};

const SUGGESTION_MULTIPLIERS = [10, 100, 1000];

const buildDefaultDraft = (paidBy: PaidBy): TExpenseDraft => ({
  date: dayjs().format("DD/MM/YYYY"),
  amount: 0,
  note: "",
  category: Category.FOOD,
  budgetId: null,
  paidBy,
});

const normalizePaidBy = (value: string | undefined): PaidBy => {
  const allowed: PaidBy[] = [PaidBy.CUBI, PaidBy.EMBE, PaidBy.OTHER];
  return allowed.find((option) => option === value) ?? PaidBy.OTHER;
};

const formatDateLabel = (date: string) => {
  const parsed = dayjs(date, "DD/MM/YYYY", true);
  return parsed.isValid() ? parsed.format("DD MMM") : "Today";
};

const QuickExpenseSheet = ({ compact = false }: TQuickExpenseSheetProps) => {
  const settingsPaidBy = useSettingsStore((state) => state.paidBy);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<TExpenseDraft>(() =>
    buildDefaultDraft(normalizePaidBy(settingsPaidBy))
  );
  const [dateOpen, setDateOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [paidByOpen, setPaidByOpen] = useState(false);

  const noteRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  useAutoShrinkFont(noteRef);

  const setField = <K extends keyof TExpenseDraft>(key: K, value: TExpenseDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setDraft(buildDefaultDraft(normalizePaidBy(settingsPaidBy)));
    }
  };

  const targetDate = useMemo(() => {
    const parsed = dayjs(draft.date, "DD/MM/YYYY", true);
    const resolved = parsed.isValid() ? parsed : dayjs();
    return resolved.format("YYYY-MM-DD");
  }, [draft.date]);

  const weekStart = useMemo(() => {
    const parsed = dayjs(targetDate, "YYYY-MM-DD", true);
    return getWeekRange(parsed).weekStartDate.format("YYYY-MM-DD");
  }, [targetDate]);

  const suggestions = useMemo(() => {
    if (draft.amount <= 0) return [];
    return SUGGESTION_MULTIPLIERS.map((m) => draft.amount * m).filter((v) => v > 0);
  }, [draft.amount]);

  return (
    <Sheet open={open} onOpenChange={handleOpenChange} modal>
      <SheetTrigger asChild>
        <Button
          size={compact ? "icon-lg" : "default"}
          aria-label={compact ? "Add expense" : undefined}
          className={cn(
            "rounded-full shadow-[0_25px_60px_color-mix(in_srgb,var(--background)_60%,transparent)] active:scale-[0.97]",
            compact && "size-12"
          )}
        >
          <Plus className={compact ? "h-5 w-5" : "h-4 w-4"} />
          {compact ? null : "Add expense"}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-full w-full gap-0 rounded-none p-0">
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-2 px-4 pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              aria-label={`Date: ${formatDateLabel(draft.date)}`}
              onClick={() => setDateOpen(true)}
            >
              <Calendar className="h-4 w-4" />
              <span>{formatDateLabel(draft.date)}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              aria-label={`Budget: ${draft.budgetId === null ? "No budget" : "Selected"}`}
              onClick={() => setBudgetOpen(true)}
            >
              <Wallet className="h-4 w-4" />
              <span>{draft.budgetId === null ? "No budget" : "Budget"}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              aria-label={`Paid by: ${draft.paidBy}`}
              onClick={() => setPaidByOpen(true)}
            >
              <UserRound className="h-4 w-4" />
              <span>{draft.paidBy}</span>
            </Button>
          </div>

          <div className="flex flex-1 flex-col gap-4 px-4 pt-6">
            <input
              ref={noteRef}
              autoFocus
              value={draft.note}
              onChange={(e) => setField("note", e.target.value)}
              placeholder="What did you spend on?"
              className="w-full whitespace-nowrap overflow-hidden border-0 bg-transparent px-0 py-2 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0"
            />

            <div className="relative">
              <input
                ref={amountRef}
                inputMode="numeric"
                value={draft.amount === 0 ? "" : formatVnd(draft.amount)}
                onChange={(e) => setField("amount", parseVndInput(e.target.value))}
                placeholder="0"
                className="w-full border-0 bg-transparent px-0 pr-12 text-right text-4xl font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-0"
                onFocus={() => amountRef.current?.select()}
              />
              <span className="text-muted-foreground absolute bottom-2 right-0 text-sm">
                VND
              </span>
            </div>

            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <Button
                    key={s}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => setField("amount", s)}
                  >
                    {formatVnd(s)}
                  </Button>
                ))}
              </div>
            )}

            <div className="no-scrollbar flex w-full items-center gap-2 overflow-x-auto pt-1">
              {Object.values(Category).map((category) => {
                const isActive = draft.category === category;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setField("category", category as Category)}
                    aria-pressed={isActive}
                    className={cn(
                      "flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition duration-300",
                      isActive
                        ? "border-foreground/20 bg-muted -translate-y-1"
                        : "bg-muted/50 hover:bg-muted border-transparent"
                    )}
                  >
                    <ExpenseItemIcon category={category as Category} size="sm" />
                    <span>{category}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <Sheet open={dateOpen} onOpenChange={setDateOpen}>
          <SheetContent side="bottom" showCloseButton={false} className="rounded-t-3xl">
            <SheetHeader className="text-left">
              <SheetTitle>Date</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-4 sm:px-6">
              <DatePicker
                value={dayjs(draft.date, "DD/MM/YYYY", true).toDate()}
                onChange={(d) => {
                  if (d) setField("date", dayjs(d).format("DD/MM/YYYY"));
                  setDateOpen(false);
                }}
              />
            </div>
          </SheetContent>
        </Sheet>

        <BudgetPickerSheet
          open={budgetOpen}
          onOpenChange={setBudgetOpen}
          value={draft.budgetId}
          onChange={(id) => setField("budgetId", id)}
          weekStart={weekStart}
          targetDate={targetDate}
          isParentOpen={open}
        />

        <PaidByPickerSheet
          open={paidByOpen}
          onOpenChange={setPaidByOpen}
          value={draft.paidBy}
          onChange={(next) => setField("paidBy", next)}
        />
      </SheetContent>
    </Sheet>
  );
};

export default QuickExpenseSheet;
```

- [ ] **Step 6.4: Run tests and verify they pass**

Run: `bun run test src/components/QuickExpenseSheet.test.tsx`
Expected: PASS (all cases).

- [ ] **Step 6.5: Commit**

```bash
git add src/components/QuickExpenseSheet.tsx src/components/QuickExpenseSheet.test.tsx
git commit -m "feat(expense): build QuickExpenseSheet layout, top row, amount, suggestions, categories"
```

---

## Task 7: `QuickExpenseSheet` — submit, footer, toast

**Files:**
- Modify: `src/components/QuickExpenseSheet.tsx`
- Modify: `src/components/QuickExpenseSheet.test.tsx`

Add the pinned footer button, submission via `createExpenseEntry`, toast on success/error, close on success, disabled when `amount === 0`.

- [ ] **Step 7.1: Add tests for submit behavior**

In `src/components/QuickExpenseSheet.test.tsx`:

1. Add a top-level import (with the other module imports):
   ```tsx
   import { createExpenseEntry } from "@/app/actions/expense-actions";
   ```
2. Append the describe block:

```tsx
describe("QuickExpenseSheet — submit", () => {
  const openSheet = async () => {
    const user = userEvent.setup();
    renderSheet();
    await user.click(screen.getByRole("button", { name: /add expense/i }));
    return user;
  };

  it("disables submit when amount is zero", async () => {
    await openSheet();
    expect(screen.getByRole("button", { name: /save expense/i })).toBeDisabled();
  });

  it("calls createExpenseEntry with the full draft on submit", async () => {
    const user = await openSheet();
    const amount = screen.getByPlaceholderText("0");
    await user.click(amount);
    await user.keyboard("12000");
    await user.click(screen.getByRole("button", { name: /save expense/i }));

    await waitFor(() => {
      expect(createExpenseEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 12000,
          note: "",
          category: "Food",
          paidBy: expect.any(String),
        })
      );
    });
  });

  it("closes the sheet after successful submit", async () => {
    const user = await openSheet();
    await user.click(screen.getByPlaceholderText("0"));
    await user.keyboard("5000");
    await user.click(screen.getByRole("button", { name: /save expense/i }));

    await waitFor(() =>
      expect(screen.queryByPlaceholderText(/what did you spend on/i)).not.toBeInTheDocument()
    );
  });
});
```

- [ ] **Step 7.2: Run tests and verify failure**

Run: `bun run test src/components/QuickExpenseSheet.test.tsx`
Expected: FAIL — no Save button yet.

- [ ] **Step 7.3: Add submit logic and footer to `QuickExpenseSheet.tsx`**

In `src/components/QuickExpenseSheet.tsx`:

1. Add imports near the top:
   ```ts
   import { Loader2 } from "lucide-react";
   import { toast } from "sonner";
   import { createExpenseEntry } from "@/app/actions/expense-actions";
   import { SheetFooter } from "@/components/ui/sheet";
   ```
2. Add submit state inside the component (next to other `useState` calls):
   ```ts
   const [loading, setLoading] = useState(false);
   const canSubmit = draft.amount > 0 && !loading;

   const handleSubmit = async () => {
     if (!canSubmit) return;
     try {
       setLoading(true);
       await createExpenseEntry({
         date: draft.date,
         amount: draft.amount,
         note: draft.note,
         category: draft.category,
         paidBy: draft.paidBy,
         budgetId: draft.budgetId,
       });
       toast.success("Expense added");
       handleOpenChange(false);
     } catch (error) {
       console.error(error);
       toast.error(error instanceof Error ? error.message : "Failed to add expense");
     } finally {
       setLoading(false);
     }
   };
   ```
3. Just before the closing `</SheetContent>` of the outer Sheet (right after the category chip row's wrapping `div`s close), add:
   ```tsx
   <SheetFooter className="standalone:pb-safe border-t px-4">
     <Button
       type="button"
       onClick={handleSubmit}
       disabled={!canSubmit}
       className="h-10 w-full rounded-xl text-base font-medium"
     >
       {loading ? (
         <>
           <Loader2 className="h-4 w-4 animate-spin" />
           Saving...
         </>
       ) : (
         "Save expense"
       )}
     </Button>
   </SheetFooter>
   ```

- [ ] **Step 7.4: Run tests and verify they pass**

Run: `bun run test src/components/QuickExpenseSheet.test.tsx`
Expected: PASS.

- [ ] **Step 7.5: Commit**

```bash
git add src/components/QuickExpenseSheet.tsx src/components/QuickExpenseSheet.test.tsx
git commit -m "feat(expense): add submit + footer to QuickExpenseSheet"
```

---

## Task 8: Prefill event listener

**Files:**
- Modify: `src/components/QuickExpenseSheet.tsx`
- Modify: `src/components/QuickExpenseSheet.test.tsx`

Honor the existing `EXPENSE_PREFILL_EVENT` so AI chat / other surfaces can pop the sheet with prefilled values.

- [ ] **Step 8.1: Add the failing test**

In `src/components/QuickExpenseSheet.test.tsx`:

1. Replace the existing `import { render, screen, waitFor } from "@testing-library/react";` line with:
   ```tsx
   import { act, render, screen, waitFor } from "@testing-library/react";
   ```
2. Add a top-level import (with the other module imports):
   ```tsx
   import { dispatchExpensePrefill } from "@/lib/expense-prefill";
   ```
3. Append the describe block:

```tsx
describe("QuickExpenseSheet — prefill", () => {
  it("opens and populates fields when EXPENSE_PREFILL_EVENT fires", async () => {
    renderSheet();
    expect(screen.queryByPlaceholderText(/what did you spend on/i)).not.toBeInTheDocument();

    act(() => {
      dispatchExpensePrefill({
        amount: 25000,
        note: "Lunch",
        category: "Food",
      });
    });

    const note = await screen.findByPlaceholderText(/what did you spend on/i);
    expect(note).toHaveValue("Lunch");
    const amount = screen.getByPlaceholderText("0") as HTMLInputElement;
    expect(amount.value).toMatch(/25,?000/);
  });
});
```

- [ ] **Step 8.2: Run test and verify it fails**

Run: `bun run test src/components/QuickExpenseSheet.test.tsx -t "prefill"`
Expected: FAIL — note input not in the document because Sheet stays closed.

- [ ] **Step 8.3: Implement the listener**

In `src/components/QuickExpenseSheet.tsx`:

1. Add imports:
   ```ts
   import { useEffect } from "react";
   import {
     EXPENSE_PREFILL_EVENT,
     type ExpensePrefillPayload,
   } from "@/lib/expense-prefill";
   ```
2. After the existing `useState` calls, add:
   ```ts
   useEffect(() => {
     const handle = (event: Event) => {
       const detail = (event as CustomEvent<ExpensePrefillPayload>).detail;
       if (!detail) return;
       setDraft((prev) => ({
         ...prev,
         amount: detail.amount,
         note: detail.note,
         category: (detail.category as Category) || prev.category,
       }));
       setOpen(true);
     };
     window.addEventListener(EXPENSE_PREFILL_EVENT, handle);
     return () => window.removeEventListener(EXPENSE_PREFILL_EVENT, handle);
   }, []);
   ```

- [ ] **Step 8.4: Run test and verify it passes**

Run: `bun run test src/components/QuickExpenseSheet.test.tsx`
Expected: PASS for prefill case and all previous cases.

- [ ] **Step 8.5: Commit**

```bash
git add src/components/QuickExpenseSheet.tsx src/components/QuickExpenseSheet.test.tsx
git commit -m "feat(expense): wire EXPENSE_PREFILL_EVENT into QuickExpenseSheet"
```

---

## Task 9: Swap into `BottomNav` and delete old drawer

**Files:**
- Modify: `src/components/BottomNav.tsx`
- Delete: `src/components/ExpenseEntryDrawer.tsx`
- Delete: `src/components/ExpenseEntryDrawer.mascot.test.tsx`

- [ ] **Step 9.1: Swap the import + JSX in `BottomNav.tsx`**

In `src/components/BottomNav.tsx`:
1. Replace import line:
   - From: `import ExpenseEntryDrawer from "@/components/ExpenseEntryDrawer";`
   - To:   `import QuickExpenseSheet from "@/components/QuickExpenseSheet";`
2. Replace JSX usage:
   - From: `<ExpenseEntryDrawer compact />`
   - To:   `<QuickExpenseSheet compact />`

- [ ] **Step 9.2: Delete the obsolete files**

```bash
git rm src/components/ExpenseEntryDrawer.tsx src/components/ExpenseEntryDrawer.mascot.test.tsx
```

- [ ] **Step 9.3: Verify the project typechecks**

Run: `npx tsc --noEmit`
Expected: no errors. (If anything still imports `ExpenseEntryDrawer`, fix the import to `QuickExpenseSheet` or remove the dead reference.)

- [ ] **Step 9.4: Run the full test suite for affected areas**

Run: `bun run test src/components/QuickExpenseSheet.test.tsx src/components/BudgetPickerSheet.test.tsx src/components/PaidByPickerSheet.test.tsx src/lib/budget-options.test.ts src/hooks/useAutoShrinkFont.test.ts src/components/ManualExpenseForm.quick-mode.test.tsx`
Expected: all PASS.

- [ ] **Step 9.5: Commit**

```bash
git add src/components/BottomNav.tsx
git commit -m "feat(nav): swap ExpenseEntryDrawer for QuickExpenseSheet in BottomNav"
```

---

## Task 10: Manual UI verification

**Files:** none modified.

Spec for nextjs-code rule §12 requires manual UI testing for visual changes. Run the dev server and exercise the flow.

- [ ] **Step 10.1: Start the dev server**

Run: `bun run dev` (background).

- [ ] **Step 10.2: Exercise the golden path**

In a browser:
1. Open the app.
2. Tap the floating `+` in the bottom nav. Sheet opens full-screen.
3. Confirm: note input is focused, no title/description/mascot visible.
4. Top row shows three small pill buttons (Date · Budget · Paid by).
5. Tap each button → its picker sub-sheet opens and a selection collapses it.
6. Type a long string into the note input — font shrinks, content does not wrap.
7. Type an amount → suggestion chips appear; tapping a chip updates the amount.
8. Pick a category chip — active one lifts.
9. Tap **Save expense** → toast, sheet closes, draft resets.
10. Reopen — fields are reset to defaults.

- [ ] **Step 10.3: Exercise prefill (optional, if AI chat is wired)**

From a console: `window.dispatchEvent(new CustomEvent("expense-prefill", { detail: { amount: 35000, note: "Coffee", category: "Food" } }))` — sheet should open with values prefilled.

- [ ] **Step 10.4: Note any regressions**

If anything is off, fix and re-test before the next step. If everything works, proceed.

- [ ] **Step 10.5: Stop the dev server**

(no command needed if backgrounded — kill the process)

---

## Final checks

- [ ] **Step F.1: Run all related tests one more time**

```
bun run test \
  src/lib/budget-options.test.ts \
  src/hooks/useAutoShrinkFont.test.ts \
  src/components/BudgetPickerSheet.test.tsx \
  src/components/PaidByPickerSheet.test.tsx \
  src/components/QuickExpenseSheet.test.tsx \
  src/components/ManualExpenseForm.quick-mode.test.tsx \
  src/components/BudgetTransferDrawer.test.tsx
```

Expected: all PASS.

- [ ] **Step F.2: Run typecheck**

`npx tsc --noEmit`
Expected: no errors.

- [ ] **Step F.3: Lint touched files**

```
npx eslint \
  src/lib/budget-options.ts \
  src/hooks/useAutoShrinkFont.ts \
  src/components/QuickExpenseSheet.tsx \
  src/components/BudgetPickerSheet.tsx \
  src/components/PaidByPickerSheet.tsx \
  src/components/ManualExpenseForm.tsx \
  src/components/BottomNav.tsx
```

Expected: no errors.

- [ ] **Step F.4: Push the branch**

```bash
git push -u origin feat/create-transaction-ui
```

---

## Risks & Mitigations

- **Duplicate `useQuery` for budget options.** `BudgetPickerSheet` and `ManualExpenseForm` both query `budgetWeeklyOptionsQueryKey(weekStart)`. TanStack Query dedupes by key — one network request, one cache entry. Verify by leaving the form's query in place and checking the network tab in dev: a single `/api/budget-weekly` request per week change.
- **`autoFocus` + Sheet portal.** Some Sheet portals defer focus. If `noteRef` is not focused on open, add `useEffect(() => { if (open) noteRef.current?.focus(); }, [open])` and assert that in the test.
- **`PaidBy` default.** New sheet derives default from `useSettingsStore(state => state.paidBy)`. If that store hasn't been hydrated yet in tests, `normalizePaidBy` falls back to `PaidBy.OTHER` — tests rely on that fallback when settings store has no value.
- **`createExpenseEntry` accepts `category: string`.** `CreateExpenseInput.category` is `string`. Passing `Category.FOOD` ("Food") satisfies it. No type cast needed.
- **AI chat / AIInput / ExpenseListItem.** Not touched in this plan. They will continue to render `ManualExpenseForm` exactly as today.
