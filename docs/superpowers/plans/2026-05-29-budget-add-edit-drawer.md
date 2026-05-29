# BudgetFormDrawer Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the inline add/edit budget drawer out of the 1,505-line `BudgetWeeklyBudgetsClient.tsx` into a self-contained `src/components/budget-form/` unit (a `BudgetFormDrawer` component + a `useBudgetForm` hook + pure helpers), with new unit/component tests and a fix for the pre-existing failing mascot tests.

**Architecture:** A controlled `BudgetFormDrawer` ( `{ open, onOpenChange, budget, weekStartDate, onMoveFunds }` ) owns all form rendering and its date-picker sheets. A `useBudgetForm` hook owns field state, period/date interlocks, validation, reset-on-open, and the create/update mutations, exposing a `submit(): Promise<boolean>`. The parent keeps only `formOpen` + `editingBudget` and the unchanged detail-drawer / delete-confirm flow.

**Tech Stack:** Next.js 15 (App Router), React 19, TanStack Query mutation hooks (`src/lib/mutations`), Tailwind v4, shadcn/ui drawer (vaul), Vitest + Testing Library (jsdom), dayjs (`@/configs/date`).

---

## Reference: behavior being preserved

Source of truth is the current implementation in `src/components/BudgetWeeklyBudgetsClient.tsx`:
- Form state + derived validation: lines `293`–`327`.
- `periodRangeLabel` memo: lines `365`–`382`.
- Handlers: `resetBudgetAppearance` `669`, `handleOpenChange` `674`, `openCreate` `687`, `openEdit` `698`, `handlePeriodChange` `710`, `handleStartDateChange` `735`, `handleEndDateChange` `750`, `handleSubmit` `754`, `handleDelete` `797`.
- Drawer JSX (the block to extract): lines `1263`–`1464`.
- Pure helpers to move: `resolvePeriodStart` `207`, `formatDatePickerValue` `219`, `parseDatePickerValue` `226`, `formatStartDateLabel` `231`, and `PERIOD_OPTIONS` `112`–`120`.

Types: `BudgetListItem`, `BudgetPeriod`, `BudgetCreateInput`, `BudgetUpdateInput` in `src/types/budget-weekly.ts`. Appearance helpers: `DEFAULT_BUDGET_ICON`, `DEFAULT_BUDGET_COLOR`, `BudgetColorId`, `normalizeBudgetIcon`, `normalizeBudgetColor` in `src/lib/budget-appearance.ts`. Mutations: `useCreateBudgetMutation`, `useUpdateBudgetMutation` in `src/lib/mutations`.

## File Structure

```
src/components/budget-form/
  budget-form.helpers.ts        # PERIOD_OPTIONS + pure date/period helpers (moved from parent)
  budget-form.helpers.test.ts   # unit tests for the helpers
  useBudgetForm.ts              # field state, interlocks, validation, reset-on-open, submit
  useBudgetForm.test.ts         # hook unit tests (renderHook)
  BudgetFormDrawer.tsx          # "use client"; drawer JSX, owns date-picker sheets
  BudgetFormDrawer.test.tsx     # component tests (render + mocked mutations)
```

Modified:
- `src/components/BudgetWeeklyBudgetsClient.tsx` — remove the inline form (state, handlers, helpers, JSX); render `<BudgetFormDrawer />`.
- `src/components/BudgetWeeklyBudgetsClient.mascot.test.tsx` → renamed to `BudgetWeeklyBudgetsClient.appearance.test.tsx`; drop obsolete mascot tests; rewrite appearance tests.

Test command in this repo: `rtk bun run test -- --run <path>`. Per-file checks: `rtk bunx prettier --check <files>`, `rtk bunx eslint <files>`. Type check: `rtk bunx tsc --noEmit`.

---

### Task 1: Pure helpers module

**Files:**
- Create: `src/components/budget-form/budget-form.helpers.ts`
- Test: `src/components/budget-form/budget-form.helpers.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/components/budget-form/budget-form.helpers.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  PERIOD_OPTIONS,
  formatDatePickerValue,
  formatStartDateLabel,
  parseDatePickerValue,
  resolvePeriodStart,
} from "./budget-form.helpers";

describe("budget-form helpers", () => {
  it("exposes week/month/custom period options", () => {
    expect(PERIOD_OPTIONS.map((option) => option.value)).toEqual([
      "week",
      "month",
      "custom",
    ]);
  });

  it("resolvePeriodStart snaps month to the first of the month", () => {
    expect(resolvePeriodStart("month", "2026-05-14")).toBe("2026-05-01");
  });

  it("resolvePeriodStart snaps week to the week start", () => {
    // 2026-05-14 is a Thursday; week starts Monday 2026-05-11.
    expect(resolvePeriodStart("week", "2026-05-14")).toBe("2026-05-11");
  });

  it("resolvePeriodStart keeps the given day for custom", () => {
    expect(resolvePeriodStart("custom", "2026-05-14")).toBe("2026-05-14");
  });

  it("round-trips date picker formatting", () => {
    expect(formatDatePickerValue("2026-05-14")).toBe("14/05/2026");
    expect(parseDatePickerValue("14/05/2026")).toBe("2026-05-14");
  });

  it("labels an invalid start date as a prompt", () => {
    expect(formatStartDateLabel("")).toBe("Pick date");
    expect(formatStartDateLabel("2026-05-14")).toBe("14/05/2026");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk bun run test -- --run src/components/budget-form/budget-form.helpers.test.ts`
Expected: FAIL — cannot resolve `./budget-form.helpers`.

- [ ] **Step 3: Create the helpers module**

Create `src/components/budget-form/budget-form.helpers.ts` (logic copied verbatim from the parent):

```ts
import dayjs from "@/configs/date";
import { getWeekRange } from "@/lib/week";
import type { BudgetPeriod } from "@/types/budget-weekly";

export const PERIOD_OPTIONS: Array<{
  value: BudgetPeriod;
  label: string;
  hint: string;
}> = [
  { value: "week", label: "Weekly", hint: "Resets every week" },
  { value: "month", label: "Monthly", hint: "Best for fixed bills" },
  { value: "custom", label: "Custom", hint: "Flexible date range" },
];

export const resolvePeriodStart = (
  periodValue: BudgetPeriod,
  dateValue: string
) => {
  const parsed = dayjs(dateValue, "YYYY-MM-DD", true);
  const base = parsed.isValid() ? parsed : dayjs();
  if (periodValue === "month") {
    return base.startOf("month").format("YYYY-MM-DD");
  }
  if (periodValue === "week") {
    return getWeekRange(base).weekStartDate.format("YYYY-MM-DD");
  }
  return base.format("YYYY-MM-DD");
};

export const formatDatePickerValue = (dateValue: string) => {
  const parsed = dayjs(dateValue, "YYYY-MM-DD", true);
  return parsed.isValid()
    ? parsed.format("DD/MM/YYYY")
    : dayjs().format("DD/MM/YYYY");
};

export const parseDatePickerValue = (dateValue: string) => {
  const parsed = dayjs(dateValue, "DD/MM/YYYY", true);
  return parsed.isValid() ? parsed.format("YYYY-MM-DD") : dateValue;
};

export const formatStartDateLabel = (dateValue: string) => {
  const parsed = dayjs(dateValue, "YYYY-MM-DD", true);
  return parsed.isValid() ? parsed.format("DD/MM/YYYY") : "Pick date";
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk bun run test -- --run src/components/budget-form/budget-form.helpers.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Format, lint, commit**

```bash
rtk bunx prettier --write src/components/budget-form/budget-form.helpers.ts src/components/budget-form/budget-form.helpers.test.ts
rtk bunx eslint src/components/budget-form/budget-form.helpers.ts src/components/budget-form/budget-form.helpers.test.ts
git add src/components/budget-form/budget-form.helpers.ts src/components/budget-form/budget-form.helpers.test.ts
git commit -m "feat(budget-form): add pure period/date helpers module"
```

---

### Task 2: `useBudgetForm` hook

**Files:**
- Create: `src/components/budget-form/useBudgetForm.ts`
- Test: `src/components/budget-form/useBudgetForm.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/components/budget-form/useBudgetForm.test.ts`:

```ts
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BudgetListItem } from "@/types/budget-weekly";

import { useBudgetForm } from "./useBudgetForm";

const mutationMocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/mutations", () => ({
  useCreateBudgetMutation: () => ({ mutateAsync: mutationMocks.create }),
  useUpdateBudgetMutation: () => ({ mutateAsync: mutationMocks.update }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

const groceryBudget = (): BudgetListItem => ({
  id: 7,
  name: "Groceries",
  icon: "🛒",
  color: "emerald",
  amount: 500_000,
  spent: 120_000,
  remaining: 380_000,
  period: "custom",
  periodStartDate: "2026-05-04",
  periodEndDate: "2026-05-10",
});

beforeEach(() => {
  mutationMocks.create.mockReset().mockResolvedValue(undefined);
  mutationMocks.update.mockReset().mockResolvedValue(undefined);
  toastSuccess.mockReset();
  toastError.mockReset();
});

describe("useBudgetForm", () => {
  it("resets to create defaults when opened with no budget", () => {
    const { result } = renderHook(() =>
      useBudgetForm({ budget: null, weekStartDate: "2026-05-11", open: true })
    );

    expect(result.current.name).toBe("");
    expect(result.current.amount).toBe(0);
    expect(result.current.period).toBe("week");
    expect(result.current.periodStartDate).toBe("2026-05-11");
    expect(result.current.icon).toBe("💰");
    expect(result.current.color).toBe("lime");
    expect(result.current.isEdit).toBe(false);
    expect(result.current.canSubmit).toBe(false);
  });

  it("prefills from the budget when opened in edit mode", () => {
    const { result } = renderHook(() =>
      useBudgetForm({
        budget: groceryBudget(),
        weekStartDate: "2026-05-11",
        open: true,
      })
    );

    expect(result.current.name).toBe("Groceries");
    expect(result.current.amount).toBe(500_000);
    expect(result.current.period).toBe("custom");
    expect(result.current.periodStartDate).toBe("2026-05-04");
    expect(result.current.periodEndDate).toBe("2026-05-10");
    expect(result.current.icon).toBe("🛒");
    expect(result.current.color).toBe("emerald");
    expect(result.current.isEdit).toBe(true);
    expect(result.current.canSubmit).toBe(true);
  });

  it("requires a name, positive amount, and valid period", () => {
    const { result } = renderHook(() =>
      useBudgetForm({ budget: null, weekStartDate: "2026-05-11", open: true })
    );

    act(() => result.current.setName("Food"));
    expect(result.current.isValid).toBe(false);

    act(() => result.current.setAmount(100_000));
    expect(result.current.isValid).toBe(true);
  });

  it("seeds an end date when switching to custom and clears it otherwise", () => {
    const { result } = renderHook(() =>
      useBudgetForm({ budget: null, weekStartDate: "2026-05-11", open: true })
    );

    act(() => result.current.handlePeriodChange("custom"));
    expect(result.current.period).toBe("custom");
    expect(result.current.periodEndDate).toBe(result.current.periodStartDate);

    act(() => result.current.handlePeriodChange("week"));
    expect(result.current.periodEndDate).toBeNull();
  });

  it("pushes the end date forward when the start moves past it", () => {
    const { result } = renderHook(() =>
      useBudgetForm({ budget: null, weekStartDate: "2026-05-11", open: true })
    );

    act(() => result.current.handlePeriodChange("custom"));
    act(() => result.current.handleEndDateChange("2026-05-12"));
    act(() => result.current.handleStartDateChange("2026-05-20"));

    expect(result.current.periodEndDate).toBe("2026-05-20");
  });

  it("submits the create payload and resolves true", async () => {
    const { result } = renderHook(() =>
      useBudgetForm({ budget: null, weekStartDate: "2026-05-11", open: true })
    );

    act(() => {
      result.current.setName("Coffee");
      result.current.setAmount(200_000);
    });

    let outcome = false;
    await act(async () => {
      outcome = await result.current.submit();
    });

    expect(outcome).toBe(true);
    expect(mutationMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Coffee",
        amount: 200_000,
        period: "week",
        periodStartDate: "2026-05-11",
        periodEndDate: null,
        icon: "💰",
        color: "lime",
      })
    );
    expect(toastSuccess).toHaveBeenCalledWith("Budget created.");
  });

  it("submits the update payload with the budget id in edit mode", async () => {
    const { result } = renderHook(() =>
      useBudgetForm({
        budget: groceryBudget(),
        weekStartDate: "2026-05-11",
        open: true,
      })
    );

    await act(async () => {
      await result.current.submit();
    });

    expect(mutationMocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 7,
        input: expect.objectContaining({
          name: "Groceries",
          period: "custom",
          periodEndDate: "2026-05-10",
        }),
      })
    );
    expect(toastSuccess).toHaveBeenCalledWith("Budget updated.");
  });

  it("returns false and toasts on mutation failure", async () => {
    mutationMocks.create.mockRejectedValueOnce(new Error("boom"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() =>
      useBudgetForm({ budget: null, weekStartDate: "2026-05-11", open: true })
    );
    act(() => {
      result.current.setName("Coffee");
      result.current.setAmount(200_000);
    });

    let outcome = true;
    await act(async () => {
      outcome = await result.current.submit();
    });

    expect(outcome).toBe(false);
    expect(toastError).toHaveBeenCalledWith("Failed to save budget.");
    await waitFor(() => expect(result.current.isSaving).toBe(false));
    errorSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk bun run test -- --run src/components/budget-form/useBudgetForm.test.ts`
Expected: FAIL — cannot resolve `./useBudgetForm`.

- [ ] **Step 3: Create the hook**

Create `src/components/budget-form/useBudgetForm.ts`:

```ts
import { useEffect, useMemo, useState } from "react";

import dayjs from "@/configs/date";
import {
  type BudgetColorId,
  DEFAULT_BUDGET_COLOR,
  DEFAULT_BUDGET_ICON,
  normalizeBudgetColor,
  normalizeBudgetIcon,
} from "@/lib/budget-appearance";
import {
  useCreateBudgetMutation,
  useUpdateBudgetMutation,
} from "@/lib/mutations";
import { getWeekRange } from "@/lib/week";
import type { BudgetListItem, BudgetPeriod } from "@/types/budget-weekly";
import { toast } from "sonner";

import { resolvePeriodStart } from "./budget-form.helpers";

type UseBudgetFormArgs = {
  budget: BudgetListItem | null;
  weekStartDate: string;
  open: boolean;
};

export const useBudgetForm = ({
  budget,
  weekStartDate,
  open,
}: UseBudgetFormArgs) => {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState(0);
  const [period, setPeriod] = useState<BudgetPeriod>("week");
  const [periodStartDate, setPeriodStartDate] = useState(weekStartDate);
  const [periodEndDate, setPeriodEndDate] = useState<string | null>(null);
  const [icon, setIcon] = useState(DEFAULT_BUDGET_ICON);
  const [color, setColor] = useState<BudgetColorId>(DEFAULT_BUDGET_COLOR);
  const [isSaving, setIsSaving] = useState(false);

  const createBudgetMutation = useCreateBudgetMutation();
  const updateBudgetMutation = useUpdateBudgetMutation();

  const isEdit = budget !== null;

  // Resync fields each time the drawer opens. Matches the reset-on-open
  // convention used by BudgetTransferDrawer; the parent sets `budget` and
  // `open` together, so depending on these is safe.
  useEffect(() => {
    if (!open) {
      return;
    }
    if (budget) {
      setName(budget.name);
      setAmount(budget.amount);
      setPeriod(budget.period);
      setPeriodStartDate(budget.periodStartDate);
      setPeriodEndDate(budget.periodEndDate ?? null);
      setIcon(normalizeBudgetIcon(budget.icon));
      setColor(normalizeBudgetColor(budget.color));
    } else {
      setName("");
      setAmount(0);
      setPeriod("week");
      setPeriodStartDate(weekStartDate);
      setPeriodEndDate(null);
      setIcon(DEFAULT_BUDGET_ICON);
      setColor(DEFAULT_BUDGET_COLOR);
    }
    setIsSaving(false);
  }, [open, budget, weekStartDate]);

  const handlePeriodChange = (nextPeriod: BudgetPeriod) => {
    const nextStart = resolvePeriodStart(
      nextPeriod,
      periodStartDate || weekStartDate
    );
    setPeriod(nextPeriod);
    setPeriodStartDate(nextStart);
    if (nextPeriod === "custom") {
      setPeriodEndDate((current) => {
        if (!current) {
          return nextStart;
        }
        const parsedCurrent = dayjs(current, "YYYY-MM-DD", true);
        if (!parsedCurrent.isValid()) {
          return nextStart;
        }
        return parsedCurrent.isBefore(dayjs(nextStart), "day")
          ? nextStart
          : current;
      });
    } else {
      setPeriodEndDate(null);
    }
  };

  const handleStartDateChange = (value: string) => {
    setPeriodStartDate(value);
    if (period === "custom" && periodEndDate) {
      const parsedCurrentEnd = dayjs(periodEndDate, "YYYY-MM-DD", true);
      const parsedCurrentStart = dayjs(value, "YYYY-MM-DD", true);
      if (
        parsedCurrentEnd.isValid() &&
        parsedCurrentStart.isValid() &&
        parsedCurrentEnd.isBefore(parsedCurrentStart, "day")
      ) {
        setPeriodEndDate(value);
      }
    }
  };

  const handleEndDateChange = (value: string) => {
    setPeriodEndDate(value);
  };

  const trimmedName = name.trim();
  const parsedStart = dayjs(periodStartDate, "YYYY-MM-DD", true);
  const parsedEnd = periodEndDate
    ? dayjs(periodEndDate, "YYYY-MM-DD", true)
    : null;
  const hasValidPeriod =
    parsedStart.isValid() &&
    (period !== "custom" ||
      (parsedEnd !== null &&
        parsedEnd.isValid() &&
        !parsedEnd.isBefore(parsedStart, "day")));
  const isValid = trimmedName.length > 0 && amount > 0 && hasValidPeriod;
  const canSubmit = isValid && !isSaving;

  const periodRangeLabel = useMemo(() => {
    const start = dayjs(periodStartDate, "YYYY-MM-DD", true);
    const end = periodEndDate ? dayjs(periodEndDate, "YYYY-MM-DD", true) : null;
    if (!start.isValid()) {
      return "Select a valid start date.";
    }
    if (period === "month") {
      return `${start.startOf("month").format("DD MMM YYYY")} - ${start.endOf("month").format("DD MMM YYYY")}`;
    }
    if (period === "custom") {
      if (!end?.isValid()) {
        return "Select an end date.";
      }
      return `${start.format("DD MMM YYYY")} - ${end.format("DD MMM YYYY")}`;
    }
    const { weekStartDate: startDate, weekEndDate } = getWeekRange(start);
    return `${startDate.format("DD MMM YYYY")} - ${weekEndDate.format("DD MMM YYYY")}`;
  }, [period, periodEndDate, periodStartDate]);

  const submit = async (): Promise<boolean> => {
    if (!canSubmit) {
      return false;
    }
    try {
      setIsSaving(true);
      const input = {
        name,
        amount,
        period,
        periodStartDate,
        periodEndDate: period === "custom" ? periodEndDate : null,
        icon,
        color,
      };
      if (budget) {
        await updateBudgetMutation.mutateAsync({ id: budget.id, input });
        toast.success("Budget updated.");
      } else {
        await createBudgetMutation.mutateAsync(input);
        toast.success("Budget created.");
      }
      return true;
    } catch (submitError) {
      console.error(submitError);
      toast.error("Failed to save budget.");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    name,
    amount,
    period,
    periodStartDate,
    periodEndDate,
    icon,
    color,
    isSaving,
    isEdit,
    setName,
    setAmount,
    setIcon,
    setColor,
    handlePeriodChange,
    handleStartDateChange,
    handleEndDateChange,
    trimmedName,
    hasValidPeriod,
    isValid,
    canSubmit,
    periodRangeLabel,
    submit,
  };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk bun run test -- --run src/components/budget-form/useBudgetForm.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Format, lint, commit**

```bash
rtk bunx prettier --write src/components/budget-form/useBudgetForm.ts src/components/budget-form/useBudgetForm.test.ts
rtk bunx eslint src/components/budget-form/useBudgetForm.ts src/components/budget-form/useBudgetForm.test.ts
git add src/components/budget-form/useBudgetForm.ts src/components/budget-form/useBudgetForm.test.ts
git commit -m "feat(budget-form): add useBudgetForm hook with state, validation, submit"
```

---

### Task 3: `BudgetFormDrawer` component

**Files:**
- Create: `src/components/budget-form/BudgetFormDrawer.tsx`
- Test: `src/components/budget-form/BudgetFormDrawer.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/budget-form/BudgetFormDrawer.test.tsx`:

```tsx
import React from "react";

import type { BudgetListItem } from "@/types/budget-weekly";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import BudgetFormDrawer from "./BudgetFormDrawer";

const mutationMocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/mutations", () => ({
  useCreateBudgetMutation: () => ({ mutateAsync: mutationMocks.create }),
  useUpdateBudgetMutation: () => ({ mutateAsync: mutationMocks.update }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

const groceryBudget = (): BudgetListItem => ({
  id: 7,
  name: "Groceries",
  icon: "🛒",
  color: "emerald",
  amount: 500_000,
  spent: 120_000,
  remaining: 380_000,
  period: "week",
  periodStartDate: "2026-05-04",
  periodEndDate: null,
});

beforeEach(() => {
  mutationMocks.create.mockReset().mockResolvedValue(undefined);
  mutationMocks.update.mockReset().mockResolvedValue(undefined);
  toastSuccess.mockReset();
  toastError.mockReset();
});

describe("BudgetFormDrawer", () => {
  it("shows create defaults and disables submit until valid", () => {
    render(
      <BudgetFormDrawer
        open
        onOpenChange={vi.fn()}
        budget={null}
        weekStartDate="2026-05-11"
        onMoveFunds={vi.fn()}
      />
    );

    expect(
      screen.getByRole("heading", { name: /new budget/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create budget/i })
    ).toBeDisabled();
  });

  it("submits a create payload and closes on success", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <BudgetFormDrawer
        open
        onOpenChange={onOpenChange}
        budget={null}
        weekStartDate="2026-05-11"
        onMoveFunds={vi.fn()}
      />
    );

    await user.type(screen.getByLabelText(/budget name/i), "Coffee");
    await user.type(screen.getByLabelText(/amount/i), "200000");
    await user.click(screen.getByRole("button", { name: /create budget/i }));

    expect(mutationMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Coffee", amount: 200_000 })
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("prefills name and amount in edit mode", () => {
    render(
      <BudgetFormDrawer
        open
        onOpenChange={vi.fn()}
        budget={groceryBudget()}
        weekStartDate="2026-05-11"
        onMoveFunds={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: /edit budget/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/budget name/i)).toHaveValue("Groceries");
    expect(
      screen.getByRole("button", { name: /save changes/i })
    ).toBeEnabled();
  });

  it("invokes onMoveFunds and closes from the edit link", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onMoveFunds = vi.fn();
    const budget = groceryBudget();

    render(
      <BudgetFormDrawer
        open
        onOpenChange={onOpenChange}
        budget={budget}
        weekStartDate="2026-05-11"
        onMoveFunds={onMoveFunds}
      />
    );

    await user.click(
      screen.getByRole("button", { name: /move from another budget/i })
    );

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onMoveFunds).toHaveBeenCalledWith(budget);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk bun run test -- --run src/components/budget-form/BudgetFormDrawer.test.tsx`
Expected: FAIL — cannot resolve `./BudgetFormDrawer`.

- [ ] **Step 3: Create the component**

Create `src/components/budget-form/BudgetFormDrawer.tsx` (JSX moved from parent `1263`–`1464`, with state wired to the hook, `aria-label="Budget name"` added to the name input, and the close/submit/move-funds handlers adapted to the controlled API):

```tsx
"use client";

import React from "react";
import { useRef, useState } from "react";

import { normalizeBudgetIcon } from "@/lib/budget-appearance";
import { cn, formatVnd, parseVndInput } from "@/lib/utils";
import type { BudgetListItem } from "@/types/budget-weekly";
import { Calendar, Loader2, SaveIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

import BudgetBadge from "@/components/BudgetBadge";
import BudgetColorList from "@/components/BudgetColorList";
import BudgetEmojiPickerSheet from "@/components/BudgetEmojiPickerSheet";
import DatePickerSheet from "@/components/DatePickerSheet";
import VndSymbol from "@/components/VndSymbol";

import {
  PERIOD_OPTIONS,
  formatDatePickerValue,
  formatStartDateLabel,
  parseDatePickerValue,
} from "./budget-form.helpers";
import { useBudgetForm } from "./useBudgetForm";

type BudgetFormDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget: BudgetListItem | null;
  weekStartDate: string;
  onMoveFunds: (budget: BudgetListItem) => void;
};

const BudgetFormDrawer = ({
  open,
  onOpenChange,
  budget,
  weekStartDate,
  onMoveFunds,
}: BudgetFormDrawerProps) => {
  const amountRef = useRef<HTMLInputElement>(null);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  const form = useBudgetForm({ budget, weekStartDate, open });

  const title = form.isEdit ? "Edit budget" : "New budget";
  const submitLabel = form.isEdit ? "Save changes" : "Create budget";
  const description = form.isEdit
    ? "Adjust the limit and schedule for this budget."
    : "Set a spending cap and period to track this category.";

  const handleSubmit = async () => {
    const saved = await form.submit();
    if (saved) {
      onOpenChange(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent hideIndicator className="rounded-t-3xl! border-t-0!">
        <DrawerHeader>
          <div className="flex items-center justify-between gap-2">
            <DrawerTitle className="text-2xl">{title}</DrawerTitle>
            <DrawerClose className="quick-expense-enter-group quick-expense-enter-delay-1 ring-offset-background absolute top-4 right-4 z-60 rounded-full p-2 opacity-70 shadow-md ring-1 ring-white/10 transition-[opacity,transform,box-shadow] duration-300 hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden active:scale-95 disabled:pointer-events-none">
              <XIcon className="size-4" />
              <span className="sr-only">Close</span>
            </DrawerClose>
          </div>
          <DrawerDescription className="sr-only">
            {description}
          </DrawerDescription>
        </DrawerHeader>
        <div className="no-scrollbar flex max-h-[98svh] flex-col gap-4 overflow-x-hidden overflow-y-auto px-4 pb-4">
          <div className="flex items-center justify-between gap-2">
            <input
              id="budget-name-input"
              aria-label="Budget name"
              value={form.name}
              onChange={(event) => form.setName(event.target.value)}
              placeholder="Budget name"
              maxLength={36}
              className="placeholder:text-muted-foreground inline-flex min-h-12 w-full overflow-hidden border-none bg-transparent px-0 py-2 text-xl font-semibold whitespace-nowrap focus-visible:ring-0 focus-visible:outline-none"
              tabIndex={0}
            />
            <BudgetEmojiPickerSheet
              value={form.icon}
              color={form.color}
              onSelect={(nextIcon) => form.setIcon(normalizeBudgetIcon(nextIcon))}
            />
            <BudgetBadge
              icon={form.icon}
              color={form.color}
              name={form.trimmedName || "Budget"}
              className="h-8 shrink-0"
            />
          </div>

          <div>
            <BudgetColorList value={form.color} onChange={form.setColor} />
          </div>

          <div>
            <label htmlFor="budget-amount-input" className="sr-only">
              Amount
            </label>
            <div className="flex items-baseline gap-1 py-1">
              <VndSymbol className="text-muted-foreground text-4xl font-semibold tracking-tight" />
              <input
                ref={amountRef}
                id="budget-amount-input"
                inputMode="numeric"
                value={form.amount ? formatVnd(form.amount) : ""}
                onChange={(event) =>
                  form.setAmount(parseVndInput(event.target.value))
                }
                placeholder="0"
                className="flex-1 border-0 bg-transparent px-0 text-left text-4xl font-semibold tracking-tight focus-visible:ring-0 focus-visible:outline-none"
                onFocus={() => {
                  amountRef.current?.select();
                }}
              />
            </div>
            {budget ? (
              <button
                type="button"
                className="text-primary mt-2 text-[11px] font-medium underline-offset-2 hover:underline"
                onClick={() => {
                  onOpenChange(false);
                  onMoveFunds(budget);
                }}
              >
                Move from another budget →
              </button>
            ) : null}
          </div>

          <div>
            <label className="text-foreground text-sm font-medium">
              Period
            </label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {PERIOD_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => form.handlePeriodChange(option.value)}
                  aria-pressed={form.period === option.value}
                  className={cn(
                    "h-9 w-full rounded-full px-3 text-xs font-medium",
                    form.period === option.value
                      ? "bg-primary text-primary-foreground shadow-[0_8px_20px_color-mix(in_srgb,var(--accent)_18%,transparent)]"
                      : "text-muted-foreground bg-muted/35 hover:bg-muted/55"
                  )}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <div className="grid w-full gap-3 sm:grid-cols-2">
              <div className="flex w-full flex-col gap-2">
                <span className="text-foreground text-sm font-medium">
                  Start date
                </span>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 justify-start rounded-xl px-3 text-sm font-medium"
                  aria-label={`Start date: ${formatStartDateLabel(form.periodStartDate)}`}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    setStartDateOpen(true);
                  }}
                  onClick={() => setStartDateOpen(true)}
                >
                  <Calendar className="h-4 w-4" />
                  <span>{formatStartDateLabel(form.periodStartDate)}</span>
                </Button>
              </div>
              {form.period === "custom" ? (
                <div className="flex min-w-0 flex-col gap-2">
                  <span className="text-foreground text-sm font-medium">
                    End date
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 justify-start rounded-xl px-3 text-sm font-medium"
                    aria-label={`End date: ${formatStartDateLabel(form.periodEndDate ?? form.periodStartDate)}`}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      setEndDateOpen(true);
                    }}
                    onClick={() => setEndDateOpen(true)}
                  >
                    <Calendar className="h-4 w-4" />
                    <span>
                      {formatStartDateLabel(
                        form.periodEndDate ?? form.periodStartDate
                      )}
                    </span>
                  </Button>
                </div>
              ) : null}
            </div>
            <p
              className={cn(
                "mt-3 text-xs",
                form.hasValidPeriod
                  ? "text-muted-foreground"
                  : "text-destructive"
              )}
            >
              {form.periodRangeLabel}
            </p>
          </div>
        </div>
        <DrawerFooter className="border-border/45 gap-2 border-t">
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!form.canSubmit}
            className="h-11 rounded-2xl"
          >
            {form.isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SaveIcon />
            )}
            {form.isSaving ? "Saving..." : submitLabel}
          </Button>
        </DrawerFooter>
      </DrawerContent>
      <DatePickerSheet
        open={startDateOpen}
        onOpenChange={setStartDateOpen}
        value={formatDatePickerValue(form.periodStartDate)}
        onChange={(nextDate) =>
          form.handleStartDateChange(parseDatePickerValue(nextDate))
        }
        title="Start date"
        description="Pick the budget start date."
      />
      <DatePickerSheet
        open={endDateOpen}
        onOpenChange={setEndDateOpen}
        value={formatDatePickerValue(form.periodEndDate ?? form.periodStartDate)}
        onChange={(nextDate) =>
          form.handleEndDateChange(parseDatePickerValue(nextDate))
        }
        title="End date"
        description="Pick the budget end date."
      />
    </Drawer>
  );
};

export default BudgetFormDrawer;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk bun run test -- --run src/components/budget-form/BudgetFormDrawer.test.tsx`
Expected: PASS (4 tests). (The real shadcn `Drawer` renders its content in tests via Radix/vaul portal; the amount input echoes the VND-formatted value, so typing `200000` yields amount `200000`.)

- [ ] **Step 5: Format, lint, commit**

```bash
rtk bunx prettier --write src/components/budget-form/BudgetFormDrawer.tsx src/components/budget-form/BudgetFormDrawer.test.tsx
rtk bunx eslint src/components/budget-form/BudgetFormDrawer.tsx src/components/budget-form/BudgetFormDrawer.test.tsx
git add src/components/budget-form/BudgetFormDrawer.tsx src/components/budget-form/BudgetFormDrawer.test.tsx
git commit -m "feat(budget-form): add controlled BudgetFormDrawer component"
```

---

### Task 4: Wire `BudgetFormDrawer` into the parent and delete the inline form

**Files:**
- Modify: `src/components/BudgetWeeklyBudgetsClient.tsx`

This task is a pure refactor (no new behavior), so it is verified by the existing passing `BudgetWeeklyBudgetsClient.test.tsx`, `tsc`, and `eslint` (which flags any now-unused import). Make all edits, then run the checks in Step 9.

- [ ] **Step 1: Add the import**

In the component-imports block (around line `76`–`81`), add:

```tsx
import BudgetFormDrawer from "@/components/budget-form/BudgetFormDrawer";
```

- [ ] **Step 2: Rename the open + target state**

Replace line `271`:

```tsx
  const [sheetOpen, setSheetOpen] = useState(false);
```

with:

```tsx
  const [formOpen, setFormOpen] = useState(false);
```

Replace line `285`:

```tsx
  const [activeBudget, setActiveBudget] = useState<BudgetListItem | null>(null);
```

with:

```tsx
  // Target for the form drawer (edit) and the delete-confirm dialog.
  const [editingBudget, setEditingBudget] = useState<BudgetListItem | null>(
    null
  );
```

- [ ] **Step 3: Remove form-only state and mutations**

Delete lines `275`–`276` (`startDateOpen`, `endDateOpen`), lines `293`–`303` (`name`, `amount`, `amountRef`, `period`, `periodStartDate`, `periodEndDate`, `icon`, `color`, `isSaving`, `createBudgetMutation`, `updateBudgetMutation`) — but **keep** `const deleteBudgetMutation = useDeleteBudgetMutation();`. Delete lines `312`–`327` (`formTitle`, `submitLabel`, `formDescription`, `trimmedName`, `parsedStart`, `parsedEnd`, `hasValidPeriod`, `isValid`, `canSubmit`) and the `periodRangeLabel` memo at `365`–`382`.

- [ ] **Step 4: Remove the moved pure helpers**

Delete the top-level helpers now living in `budget-form.helpers.ts`: `PERIOD_OPTIONS` (`112`–`120`), `resolvePeriodStart` (`207`–`217`), `formatDatePickerValue` (`219`–`224`), `parseDatePickerValue` (`226`–`229`), `formatStartDateLabel` (`231`–`234`). Keep `formatBudgetPeriodRange` and `getBudgetStatus` (still used by the detail drawer).

- [ ] **Step 5: Replace the form handlers with two openers**

Delete `resetBudgetAppearance` (`669`–`672`), `handleOpenChange` (`674`–`685`), `handlePeriodChange` (`710`–`733`), `handleStartDateChange` (`735`–`748`), `handleEndDateChange` (`750`–`752`), and `handleSubmit` (`754`–`795`). Replace `openCreate` (`687`–`696`) and `openEdit` (`698`–`708`) with:

```tsx
  const openCreate = () => {
    setEditingBudget(null);
    setFormOpen(true);
  };

  const openEdit = (budget: BudgetListItem) => {
    setEditingBudget(budget);
    setFormOpen(true);
  };
```

- [ ] **Step 6: Update `handleDelete` to the renamed state**

In `handleDelete` (`797`–`818`), change `activeBudget` → `editingBudget`, `setSheetOpen(false)` → `setFormOpen(false)`, and `setActiveBudget(null)` → `setEditingBudget(null)`. Result:

```tsx
  const handleDelete = async () => {
    if (!editingBudget) {
      return;
    }

    try {
      setIsSaving(true);
      await deleteBudgetMutation.mutateAsync(editingBudget.id);
      toast.success("Budget deleted.");

      setConfirmOpen(false);
      setFormOpen(false);
      setDetailOpen(false);
      setDetailBudget(null);
      setEditingBudget(null);
    } catch (deleteError) {
      console.error(deleteError);
      toast.error("Failed to delete budget.");
    } finally {
      setIsSaving(false);
    }
  };
```

`isSaving`/`setIsSaving` for delete: keep a dedicated piece of state for the delete/confirm flow. Add near the other parent state (e.g. after `editingBudget`):

```tsx
  const [isSaving, setIsSaving] = useState(false);
```

(The form's own saving state now lives in the hook; this `isSaving` only gates the delete-confirm and the detail-drawer delete button, exactly as before.)

- [ ] **Step 7: Update the detail-drawer delete button target**

In the detail drawer footer (around `1251`), change `setActiveBudget(detailBudget)` to `setEditingBudget(detailBudget)`.

- [ ] **Step 8: Replace the inline form Drawer with the component**

Delete the entire add/edit `Drawer` block — from `<Drawer open={sheetOpen}` (line `1263`) through its closing `</Drawer>` (line `1464`), including both nested `DatePickerSheet`s — and replace it with:

```tsx
      <BudgetFormDrawer
        open={formOpen}
        onOpenChange={setFormOpen}
        budget={editingBudget}
        weekStartDate={weekStartDate}
        onMoveFunds={(budget) => {
          setFormOpen(false);
          openTransfer(budget);
        }}
      />
```

Then remove imports that are now unused (eslint in Step 9 will confirm): `BudgetColorList`, `BudgetEmojiPickerSheet`, `DatePickerSheet`, `VndSymbol`; from `lucide-react` remove `Calendar` and `XIcon` (keep `ArrowDown`, `Loader2`, `Plus`, `SaveIcon`, `Trash2`, `Wallet`); from `@/lib/utils` remove `parseVndInput` (keep `cn`, `formatVnd`, `formatVndSigned`); from `@/lib/budget-appearance` remove the whole import (`BudgetColorId`, `DEFAULT_BUDGET_COLOR`, `DEFAULT_BUDGET_ICON`, `normalizeBudgetColor`, `normalizeBudgetIcon`); from `@/lib/mutations` remove `useCreateBudgetMutation` and `useUpdateBudgetMutation` (keep `useDeleteBudgetMutation`). Keep the `Drawer`/`DrawerContent`/… imports — the detail drawer still uses them.

- [ ] **Step 9: Verify the refactor**

Run, in order:

```bash
rtk bunx tsc --noEmit
rtk bunx eslint src/components/BudgetWeeklyBudgetsClient.tsx
rtk bun run test -- --run src/components/BudgetWeeklyBudgetsClient.test.tsx
```

Expected: `tsc` clean (no unused symbols, no type errors); `eslint` clean (fix any unused-import it reports); the existing client test PASSES.

- [ ] **Step 10: Format and commit**

```bash
rtk bunx prettier --write src/components/BudgetWeeklyBudgetsClient.tsx
git add src/components/BudgetWeeklyBudgetsClient.tsx
git commit -m "refactor(budgets): render BudgetFormDrawer, remove inline add/edit form"
```

---

### Task 5: Fix the pre-existing mascot test drift

**Files:**
- Rename: `src/components/BudgetWeeklyBudgetsClient.mascot.test.tsx` → `src/components/BudgetWeeklyBudgetsClient.appearance.test.tsx`
- Modify: the renamed file

Background: the two "mascot companion" tests assert `getByTestId("dialog-companion-slot")` / `getByTestId("idle-mascot")`, which the drawer no longer renders (replaced by `BudgetEmojiPickerSheet` in commit `58e1964`). The appearance tests query a `getByLabelText(/budget icon/i)` input that no longer exists. The icon is now chosen through the emoji picker sheet (a dynamic, `ssr:false` `emoji-picker-react`), which is impractical to drive in jsdom — icon behavior is already covered by `useBudgetForm.test.ts`. So: drop the mascot tests and rewrite the appearance tests to assert the **default icon** is submitted and that **color selection** + name + amount flow through, using the new `Budget name` label.

- [ ] **Step 1: Rename the file**

```bash
git mv src/components/BudgetWeeklyBudgetsClient.mascot.test.tsx src/components/BudgetWeeklyBudgetsClient.appearance.test.tsx
```

- [ ] **Step 2: Delete the obsolete `mascot companion` describe block**

Remove the entire `describe("BudgetWeeklyBudgetsClient mascot companion", () => { ... })` block (the two `idle-mascot` / `dialog-companion-slot` tests). Leave all the `vi.mock(...)` setup, `groceryBudget`, and `openCreateDrawer` helpers intact.

- [ ] **Step 3: Replace the appearance describe block**

Replace the `describe("BudgetWeeklyBudgetsClient budget appearance controls", ...)` block with:

```tsx
describe("BudgetWeeklyBudgetsClient budget appearance controls", () => {
  it("submits the default icon and the selected color", async () => {
    const user = await openCreateDrawer();

    expect(
      screen.getByRole("button", { name: /budget color lime/i })
    ).toHaveAttribute("aria-pressed", "true");

    await user.click(
      screen.getByRole("button", { name: /budget color emerald/i })
    );
    await user.type(screen.getByLabelText(/budget name/i), "Groceries");
    await user.type(screen.getByLabelText(/amount/i), "500000");
    await user.click(screen.getByRole("button", { name: /create budget/i }));

    expect(mutationMocks.createBudgetMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Groceries",
        amount: 500000,
        icon: DEFAULT_BUDGET_ICON,
        color: "emerald",
      })
    );
  });

  it("pre-fills edit appearance from the selected budget", async () => {
    const user = userEvent.setup();

    overviewData.budgets = [groceryBudget()];

    render(<BudgetWeeklyBudgetsClient weekStartDate="2026-04-01" />);

    await user.click(screen.getByRole("button", { name: /groceries/i }));
    await user.click(screen.getByRole("button", { name: /edit budget/i }));

    expect(screen.getByLabelText(/budget name/i)).toHaveValue("Groceries");
    expect(
      screen.getByRole("button", { name: /budget color emerald/i })
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("resets create defaults after closing and reopening", async () => {
    const user = await openCreateDrawer();

    await user.click(
      screen.getByRole("button", { name: /budget color emerald/i })
    );
    await user.click(screen.getByRole("button", { name: /close drawer/i }));

    await openCreateDrawer();

    expect(
      screen.getByRole("button", { name: /budget color lime/i })
    ).toHaveAttribute("aria-pressed", "true");
  });
});
```

Notes for the executor:
- `DEFAULT_BUDGET_ICON` is already imported at the top of the file.
- The mocked `@/components/ui/drawer` renders a `Close drawer` button and shows `DrawerContent` only when `open` — closing then reopening exercises the hook's reset-on-open.
- If `getByRole("button", { name: /groceries/i })` is ambiguous (badge + list item), scope it the same way the existing edit test does, or use the budget list item; keep the click that reaches the detail drawer's `Edit budget` button.

- [ ] **Step 4: Run the file and confirm green**

Run: `rtk bun run test -- --run src/components/BudgetWeeklyBudgetsClient.appearance.test.tsx`
Expected: PASS (3 tests). If a query is off, adjust the selector to the rendered DOM (do not reintroduce `budget icon` / mascot queries).

- [ ] **Step 5: Format, lint, commit**

```bash
rtk bunx prettier --write src/components/BudgetWeeklyBudgetsClient.appearance.test.tsx
rtk bunx eslint src/components/BudgetWeeklyBudgetsClient.appearance.test.tsx
git add -A src/components/BudgetWeeklyBudgetsClient.appearance.test.tsx
git commit -m "test(budgets): realign appearance tests to emoji picker, drop dead mascot tests"
```

---

### Task 6: Full-suite verification and build

**Files:** none (verification only)

- [ ] **Step 1: Run the whole budget test surface**

Run:

```bash
rtk bun run test -- --run src/components/budget-form src/components/BudgetWeeklyBudgetsClient.test.tsx src/components/BudgetWeeklyBudgetsClient.appearance.test.tsx src/components/BudgetTransferDrawer.test.tsx
```

Expected: all PASS, zero failures.

- [ ] **Step 2: Type-check and lint the touched scope**

```bash
rtk bunx tsc --noEmit
rtk bunx eslint src/components/budget-form src/components/BudgetWeeklyBudgetsClient.tsx src/components/BudgetWeeklyBudgetsClient.appearance.test.tsx
```

Expected: both clean.

- [ ] **Step 3: Production build (required before any push, per CLAUDE.md)**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual smoke check (dev server)**

Run `bun run dev`, open the budgets page on a mobile viewport, and confirm: create a budget; edit an existing budget (fields prefilled); switch period week/month/custom (date inputs appear/snap correctly); "Move from another budget →" opens the transfer drawer; delete from the detail drawer still works. No visual change vs. before.

- [ ] **Step 5: Final commit (if Step 4 surfaced any tweaks)**

```bash
git add -A
git commit -m "chore(budget-form): verification pass for drawer extraction"
```

---

## Self-Review

**Spec coverage:**
- Architecture / `src/components/budget-form/` folder → Tasks 1–3. ✓
- Controlled API (`open`, `onOpenChange`, `budget`, `weekStartDate`, `onMoveFunds`) → Task 3 component + Task 4 wiring. ✓
- `useBudgetForm` hook owning state/interlocks/validation/reset/submit → Task 2. ✓
- Date-picker sheets move into the drawer → Task 3. ✓
- Parent keeps `formOpen`/`editingBudget`, delete + confirm unchanged → Task 4. ✓
- Accessibility: `aria-label="Budget name"` → Task 3 component + asserted in Tasks 3/5. ✓
- New hook + component tests → Tasks 2, 3. ✓
- Drift fix: drop 2 mascot tests, rewrite appearance tests, rename file → Task 5. ✓
- Green suite + build → Task 6. ✓
- YAGNI (no generic framework, no detail/confirm extraction, no client Zod, no visual change) → respected throughout. ✓

**Placeholder scan:** No TBD/TODO; every code step contains full code; every command has expected output.

**Type/name consistency:** Hook return members (`name`, `amount`, `period`, `periodStartDate`, `periodEndDate`, `icon`, `color`, `isSaving`, `isEdit`, `setName`, `setAmount`, `setIcon`, `setColor`, `handlePeriodChange`, `handleStartDateChange`, `handleEndDateChange`, `trimmedName`, `hasValidPeriod`, `isValid`, `canSubmit`, `periodRangeLabel`, `submit`) are used consistently in `BudgetFormDrawer.tsx`. Parent state renamed consistently (`formOpen`/`setFormOpen`, `editingBudget`/`setEditingBudget`) across Steps 2, 5, 6, 7, 8. Submit payload matches `BudgetCreateInput`/`BudgetUpdateInput`. Helper names (`resolvePeriodStart`, `formatDatePickerValue`, `parseDatePickerValue`, `formatStartDateLabel`, `PERIOD_OPTIONS`) consistent across Tasks 1, 2, 3.
