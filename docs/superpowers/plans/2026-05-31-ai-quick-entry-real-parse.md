# AI Quick Entry Real Parse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace AI Quick Entry's mocked parser with real parse and speed-first auto-save while keeping one controlled `QuickExpenseDrawer` for saved edits and review prefill.

**Architecture:** `AIQuickEntry` remains the session owner and coordinates row lifecycle. A focused helper module owns parse-response trust gating and draft/payload shaping. `QuickExpenseDrawer` gets a narrow controlled-create enhancement so AI Quick Entry can reuse exactly one drawer instance for both create-review and saved-edit row taps.

**Tech Stack:** Next.js 15 App Router, React 19, TanStack Query, Zustand, Vitest, React Testing Library, Tailwind v4, shadcn/vaul drawer, local expense sync mutations.

---

## Source Spec

Approved design:

- `docs/superpowers/specs/2026-05-31-ai-quick-entry-real-parse-design.md`

Read before implementation:

- `.agents/rules/nextjs-code.md`
- `.agents/rules/tanstack-query.md`
- `.agents/rules/ios-input-focus.md`
- `LEARNINGS.md`

## File Structure

- Create `src/components/ai-quick-entry/real-parse.ts`
  - Pure helpers for paid-by normalization, safe fallback drafts, trust-gate evaluation, local saved-expense shaping, and local transaction id generation.
  - No React imports. No network calls. No mutation calls.

- Create `src/components/ai-quick-entry/real-parse.test.ts`
  - Unit tests for trusted auto-save, low confidence review, fallback review, suspicious date review, missing budget review, and original-input draft fallback.

- Modify `src/components/QuickExpenseDrawer.tsx`
  - Allow controlled create mode to hydrate from `initialExpense`.
  - Refresh draft when the active item identity changes.
  - Change `onSuccess` to receive the local expense returned by create/update mutations.

- Modify `src/components/QuickExpenseDrawer.test.tsx`
  - Add controlled-create hydration and active item switching tests.
  - Add `onSuccess` result test.
  - Keep global `EXPENSE_PREFILL_EVENT` tests passing.

- Modify `src/components/ai-quick-entry/types.ts`
  - Replace mocked `QuickEntry` result shape with real session row states.

- Modify `src/components/ai-quick-entry/AIQuickEntryRow.tsx`
  - Render `parsing`, `saving`, `saved`, and `needsReview` states.
  - Keep compact one-line row shape and accessible labels.

- Modify `src/components/ai-quick-entry/AIQuickEntryPendingQueue.tsx`
  - Accept active rows instead of pending-only rows.
  - Continue to show at most two active rows plus overflow in Entry Mode.

- Modify `src/components/ai-quick-entry/AIQuickEntryPreview.tsx`
  - Render `Active`, `Saved`, and `Needs review` sections.
  - Make saved and review rows tappable selectors for the single drawer.

- Modify `src/components/ai-quick-entry/AIQuickEntryStatusBar.tsx`
  - Keep existing compact status bar, but rename completed count usage to saved count in the caller/tests.

- Modify `src/components/AIQuickEntry.tsx`
  - Remove `mockParseExpense` and timer ownership.
  - Use `useQueryClient`, `queries.budgetWeekly.options`, real parser fetch, `unwrapApiResponse`, and `useCreateExpenseMutation`.
  - Own `activeDrawerItem` and render exactly one controlled `QuickExpenseDrawer`.

- Modify `src/components/AIQuickEntry.test.tsx`
  - Replace fake timer tests with async parser/mutation tests.
  - Mock parser fetch, weekly budgets, create mutation, and `QuickExpenseDrawer`.
  - Assert trusted rows auto-save, review rows open the one drawer, and tapping different rows changes the drawer props.

## Task 1: Add Pure Real-Parse Helpers

**Files:**
- Create: `src/components/ai-quick-entry/real-parse.ts`
- Create: `src/components/ai-quick-entry/real-parse.test.ts`

- [ ] **Step 1: Write failing helper tests**

Create `src/components/ai-quick-entry/real-parse.test.ts`:

```ts
import { Category, PaidBy } from "@/enums";
import type { ParseExpenseResponse } from "@/lib/ai/parse-expense-contract";
import type { TBudgetOption } from "@/lib/budget-options";
import { describe, expect, it } from "vitest";

import {
  buildOriginalInputReviewDraft,
  evaluateAIQuickEntryParse,
  localExpenseToSavedExpense,
} from "./real-parse";

const budgetOption = (
  overrides: Partial<TBudgetOption> = {}
): TBudgetOption => ({
  id: 2,
  name: "Cà phê",
  icon: "☕",
  color: "lime",
  period: "week",
  periodStartDate: "2026-05-24",
  periodEndDate: "2026-05-30",
  amount: 100000,
  spent: 0,
  remaining: 100000,
  category: Category.FOOD,
  ...overrides,
});

const successResponse = (
  overrides: Partial<Extract<ParseExpenseResponse, { status: "success" }>["expense"]> = {}
): ParseExpenseResponse => ({
  status: "success",
  originalInput: "cf 35k",
  expense: {
    date: "30/05/2026",
    amount: 35000,
    note: "Cà phê sữa đá",
    budgetId: 2,
    confidence: "high",
    reason: "Matched coffee budget.",
    ...overrides,
  },
});

describe("evaluateAIQuickEntryParse", () => {
  it("returns an auto-save payload for a trusted high-confidence parse", () => {
    const result = evaluateAIQuickEntryParse({
      input: "cf 35k",
      parseResult: successResponse(),
      budgetOptions: [budgetOption()],
      paidBy: PaidBy.CUBI,
      todayIso: "2026-05-30",
    });

    expect(result).toStrictEqual({
      kind: "autoSave",
      payload: {
        date: "2026-05-30",
        amount: 35000,
        note: "Cà phê sữa đá",
        category: Category.FOOD,
        paidBy: PaidBy.CUBI,
        budgetId: 2,
        budgetName: "Cà phê",
        budgetIcon: "☕",
        budgetColor: "lime",
      },
      initialExpense: {
        date: "30/05/2026",
        amount: 35000,
        note: "Cà phê sữa đá",
        category: Category.FOOD,
        paidBy: PaidBy.CUBI,
        budgetId: 2,
        budgetName: "Cà phê",
        budgetIcon: "☕",
        budgetColor: "lime",
      },
    });
  });

  it("returns review for a low-confidence parse", () => {
    const result = evaluateAIQuickEntryParse({
      input: "cf 35k",
      parseResult: successResponse({ confidence: "medium" }),
      budgetOptions: [budgetOption()],
      paidBy: PaidBy.CUBI,
      todayIso: "2026-05-30",
    });

    expect(result).toMatchObject({
      kind: "review",
      reason: "low_confidence",
      initialExpense: {
        date: "30/05/2026",
        amount: 35000,
        note: "Cà phê sữa đá",
        budgetId: 2,
      },
    });
  });

  it("returns review and clears the budget when the budget id is missing", () => {
    const result = evaluateAIQuickEntryParse({
      input: "cf 35k",
      parseResult: successResponse({ budgetId: null }),
      budgetOptions: [budgetOption()],
      paidBy: PaidBy.CUBI,
      todayIso: "2026-05-30",
    });

    expect(result).toMatchObject({
      kind: "review",
      reason: "missing_budget",
      initialExpense: {
        amount: 35000,
        note: "Cà phê sữa đá",
        budgetId: null,
        budgetName: null,
        budgetIcon: null,
        budgetColor: null,
      },
    });
  });

  it("returns review with today's date when the parsed date is suspicious", () => {
    const result = evaluateAIQuickEntryParse({
      input: "cf 35k",
      parseResult: successResponse({ date: "01/01/2025" }),
      budgetOptions: [budgetOption()],
      paidBy: PaidBy.CUBI,
      todayIso: "2026-05-30",
    });

    expect(result).toMatchObject({
      kind: "review",
      reason: "suspicious_date",
      initialExpense: {
        date: "30/05/2026",
        amount: 35000,
        note: "Cà phê sữa đá",
      },
    });
  });

  it("returns review for a parser fallback and preserves safe prefill", () => {
    const result = evaluateAIQuickEntryParse({
      input: "??? 35k",
      parseResult: {
        status: "fallback",
        originalInput: "??? 35k",
        reason: "schema_mismatch",
        prefill: {
          note: "??? 35k",
          amount: 35000,
        },
      },
      budgetOptions: [budgetOption()],
      paidBy: PaidBy.EMBE,
      todayIso: "2026-05-30",
    });

    expect(result).toStrictEqual({
      kind: "review",
      reason: "schema_mismatch",
      initialExpense: {
        date: "30/05/2026",
        amount: 35000,
        note: "??? 35k",
        category: Category.FOOD,
        paidBy: PaidBy.EMBE,
        budgetId: null,
        budgetName: null,
        budgetIcon: null,
        budgetColor: null,
      },
    });
  });
});

describe("buildOriginalInputReviewDraft", () => {
  it("extracts a VND shorthand amount from the original input", () => {
    expect(
      buildOriginalInputReviewDraft({
        input: "banh mi 25k",
        paidBy: "Unexpected",
        todayDisplay: "30/05/2026",
      })
    ).toStrictEqual({
      date: "30/05/2026",
      amount: 25000,
      note: "banh mi 25k",
      category: Category.FOOD,
      paidBy: PaidBy.OTHER,
      budgetId: null,
      budgetName: null,
      budgetIcon: null,
      budgetColor: null,
    });
  });
});

describe("localExpenseToSavedExpense", () => {
  it("shapes a local unsynced expense for saved-row editing", () => {
    const saved = localExpenseToSavedExpense({
      entity: "expenses",
      clientId: "client-abc",
      serverId: null,
      date: "2026-05-30",
      amount: 35000,
      note: "Cà phê",
      category: Category.FOOD,
      paidBy: PaidBy.CUBI,
      budgetId: 2,
      budgetName: "Cà phê",
      budgetIcon: "☕",
      budgetColor: "lime",
      syncStatus: "pending",
      lastError: null,
      updatedAt: "2026-05-30T00:00:00.000Z",
      serverUpdatedAt: null,
    });

    expect(saved).toMatchObject({
      id: expect.any(Number),
      clientId: "client-abc",
      date: "30/05/2026",
      amount: 35000,
      note: "Cà phê",
      syncStatus: "pending",
    });
    expect(saved.id).toBeLessThan(0);
  });
});
```

- [ ] **Step 2: Run helper tests and verify they fail**

Run:

```bash
rtk bun run test src/components/ai-quick-entry/real-parse.test.ts
```

Expected: FAIL because `src/components/ai-quick-entry/real-parse.ts` does not exist.

- [ ] **Step 3: Implement pure helpers**

Create `src/components/ai-quick-entry/real-parse.ts`:

```ts
import dayjs from "@/configs/date";
import type { CreateExpenseInput } from "@/db/type";
import { Category, PaidBy } from "@/enums";
import type { ParseExpenseResponse } from "@/lib/ai/parse-expense-contract";
import type { TBudgetOption } from "@/lib/budget-options";
import { isDateWithinBudgetPeriod, isExpenseDateSuspicious } from "@/lib/budget-options";
import type { LocalExpense } from "@/lib/sync/expenses/types";

import type { TQuickExpenseDrawerInitialExpense } from "@/components/QuickExpenseDrawer";

const ALLOWED_PAID_BY = [PaidBy.CUBI, PaidBy.EMBE, PaidBy.OTHER] as const;

export type AIQuickEntryReviewReason =
  | "invalid_json"
  | "schema_mismatch"
  | "empty_response"
  | "request_failed"
  | "no_budget_match"
  | "low_confidence"
  | "missing_budget"
  | "invalid_date"
  | "suspicious_date"
  | "budget_out_of_period"
  | "parse_error"
  | "budget_load_error"
  | "create_error";

export type AIQuickEntryParseDecision =
  | {
      kind: "autoSave";
      payload: CreateExpenseInput;
      initialExpense: TQuickExpenseDrawerInitialExpense;
    }
  | {
      kind: "review";
      reason: AIQuickEntryReviewReason;
      initialExpense: TQuickExpenseDrawerInitialExpense;
    };

export type SavedQuickEntryExpense = TQuickExpenseDrawerInitialExpense & {
  id: number;
  clientId?: string;
  syncStatus?: "pending" | "failed" | "synced";
};

export const resolveQuickEntryPaidBy = (value: string | undefined): PaidBy =>
  ALLOWED_PAID_BY.find((option) => option === value) ?? PaidBy.OTHER;

export const parseQuickEntryDisplayDate = (value: string): string | null => {
  const parsed = dayjs(value, "DD/MM/YYYY", true);
  return parsed.isValid() ? parsed.format("YYYY-MM-DD") : null;
};

const formatDisplayDate = (isoDate: string): string => {
  const parsed = dayjs(isoDate, "YYYY-MM-DD", true);
  return parsed.isValid() ? parsed.format("DD/MM/YYYY") : dayjs().format("DD/MM/YYYY");
};

const extractAmountFromInput = (input: string): number => {
  const match = input.match(/(\d+(?:\.\d+)?)(k|tr)?/i);
  if (!match) {
    return 0;
  }

  const numeric = Number(match[1]);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  const suffix = match[2]?.toLowerCase();
  if (suffix === "k") {
    return numeric * 1000;
  }
  if (suffix === "tr") {
    return numeric * 1000000;
  }
  return numeric;
};

const emptyBudgetFields = {
  budgetId: null,
  budgetName: null,
  budgetIcon: null,
  budgetColor: null,
} as const;

export const buildOriginalInputReviewDraft = ({
  input,
  paidBy,
  todayDisplay,
}: {
  input: string;
  paidBy: string | undefined;
  todayDisplay: string;
}): TQuickExpenseDrawerInitialExpense => ({
  date: todayDisplay,
  amount: extractAmountFromInput(input),
  note: input.trim(),
  category: Category.FOOD,
  paidBy: resolveQuickEntryPaidBy(paidBy),
  ...emptyBudgetFields,
});

const buildSuccessDraft = ({
  date,
  amount,
  note,
  paidBy,
  budget,
}: {
  date: string;
  amount: number;
  note: string;
  paidBy: PaidBy;
  budget: TBudgetOption | null;
}): TQuickExpenseDrawerInitialExpense => ({
  date,
  amount,
  note,
  category: budget?.category ?? Category.FOOD,
  paidBy,
  budgetId: budget?.id ?? null,
  budgetName: budget?.name ?? null,
  budgetIcon: budget?.icon ?? null,
  budgetColor: budget?.color ?? null,
});

const buildPayload = ({
  isoDate,
  amount,
  note,
  paidBy,
  budget,
}: {
  isoDate: string;
  amount: number;
  note: string;
  paidBy: PaidBy;
  budget: TBudgetOption;
}): CreateExpenseInput => ({
  date: isoDate,
  amount,
  note,
  category: budget.category,
  paidBy,
  budgetId: budget.id,
  budgetName: budget.name,
  budgetIcon: budget.icon,
  budgetColor: budget.color,
});

export const evaluateAIQuickEntryParse = ({
  input,
  parseResult,
  budgetOptions,
  paidBy,
  todayIso,
}: {
  input: string;
  parseResult: ParseExpenseResponse;
  budgetOptions: TBudgetOption[];
  paidBy: string | undefined;
  todayIso: string;
}): AIQuickEntryParseDecision => {
  const todayDisplay = formatDisplayDate(todayIso);
  const normalizedPaidBy = resolveQuickEntryPaidBy(paidBy);

  if (parseResult.status === "fallback") {
    return {
      kind: "review",
      reason: parseResult.reason,
      initialExpense: {
        ...buildOriginalInputReviewDraft({
          input: parseResult.prefill.note ?? parseResult.originalInput ?? input,
          paidBy,
          todayDisplay,
        }),
        amount:
          typeof parseResult.prefill.amount === "number"
            ? parseResult.prefill.amount
            : extractAmountFromInput(input),
        date: parseResult.prefill.date ?? todayDisplay,
        budgetId: parseResult.prefill.budgetId ?? null,
      },
    };
  }

  const { expense } = parseResult;
  const isoDate = parseQuickEntryDisplayDate(expense.date);
  const budget =
    expense.budgetId === null
      ? null
      : (budgetOptions.find((option) => option.id === expense.budgetId) ?? null);
  const safeDraft = buildSuccessDraft({
    date: isoDate ? expense.date : todayDisplay,
    amount: expense.amount,
    note: expense.note,
    paidBy: normalizedPaidBy,
    budget,
  });

  if (expense.confidence !== "high") {
    return { kind: "review", reason: "low_confidence", initialExpense: safeDraft };
  }
  if (!isoDate) {
    return {
      kind: "review",
      reason: "invalid_date",
      initialExpense: { ...safeDraft, date: todayDisplay },
    };
  }
  if (isExpenseDateSuspicious(isoDate, todayIso)) {
    return {
      kind: "review",
      reason: "suspicious_date",
      initialExpense: { ...safeDraft, date: todayDisplay },
    };
  }
  if (!budget) {
    return {
      kind: "review",
      reason: "missing_budget",
      initialExpense: { ...safeDraft, ...emptyBudgetFields },
    };
  }
  if (!isDateWithinBudgetPeriod(budget, isoDate)) {
    return { kind: "review", reason: "budget_out_of_period", initialExpense: safeDraft };
  }

  return {
    kind: "autoSave",
    payload: buildPayload({
      isoDate,
      amount: expense.amount,
      note: expense.note,
      paidBy: normalizedPaidBy,
      budget,
    }),
    initialExpense: safeDraft,
  };
};

const localExpenseClientIdToListId = (clientId: string): number => {
  const hash = [...clientId].reduce(
    (acc, character) => (acc * 31 + character.charCodeAt(0)) >>> 0,
    0
  );

  return -Math.max(1, hash);
};

export const localExpenseToSavedExpense = (
  expense: LocalExpense
): SavedQuickEntryExpense => ({
  id: expense.serverId ?? localExpenseClientIdToListId(expense.clientId),
  clientId: expense.clientId,
  date: formatDisplayDate(expense.date),
  amount: expense.amount,
  note: expense.note,
  category: expense.category,
  paidBy: expense.paidBy,
  budgetId: expense.budgetId,
  budgetName: expense.budgetName,
  budgetIcon: expense.budgetIcon ?? null,
  budgetColor: expense.budgetColor ?? null,
  syncStatus: expense.syncStatus === "deleted" ? undefined : expense.syncStatus,
});
```

- [ ] **Step 4: Run helper tests and verify they pass**

Run:

```bash
rtk bun run test src/components/ai-quick-entry/real-parse.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit helper module**

Run:

```bash
rtk git add src/components/ai-quick-entry/real-parse.ts src/components/ai-quick-entry/real-parse.test.ts
rtk git commit -m "feat(ai-quick-entry): add real parse trust gate"
```

Expected: commit succeeds.

## Task 2: Enhance QuickExpenseDrawer For Controlled Create And Success Results

**Files:**
- Modify: `src/components/QuickExpenseDrawer.tsx`
- Modify: `src/components/QuickExpenseDrawer.test.tsx`

- [ ] **Step 1: Write failing controlled-create tests**

Append these tests to `src/components/QuickExpenseDrawer.test.tsx`:

```ts
describe("QuickExpenseDrawer — controlled create initial expense", () => {
  it("hydrates create mode from initialExpense when controlled open", async () => {
    renderDrawer({
      showTrigger: false,
      open: true,
      onOpenChange: vi.fn(),
      initialExpense: {
        date: "30/05/2026",
        amount: 35000,
        note: "Cà phê sữa đá",
        category: Category.FOOD,
        paidBy: PaidBy.CUBI,
        budgetId: 2,
        budgetName: "Cà phê",
        budgetIcon: "☕",
        budgetColor: "lime",
      },
    });

    expect(await screen.findByPlaceholderText(/what did you spend on/i)).toHaveValue(
      "Cà phê sữa đá"
    );
    expect((screen.getByPlaceholderText("0") as HTMLInputElement).value).toMatch(
      /35[.,]?000/
    );
  });

  it("refreshes the controlled create draft when initialExpense changes", async () => {
    const { rerenderDrawer } = renderDrawer({
      showTrigger: false,
      open: true,
      onOpenChange: vi.fn(),
      initialExpense: {
        id: 1,
        date: "30/05/2026",
        amount: 35000,
        note: "Cà phê",
        category: Category.FOOD,
        paidBy: PaidBy.CUBI,
        budgetId: null,
      },
    });

    expect(await screen.findByPlaceholderText(/what did you spend on/i)).toHaveValue(
      "Cà phê"
    );

    rerenderDrawer({
      showTrigger: false,
      open: true,
      onOpenChange: vi.fn(),
      initialExpense: {
        id: 2,
        date: "30/05/2026",
        amount: 25000,
        note: "Bánh mì",
        category: Category.FOOD,
        paidBy: PaidBy.EMBE,
        budgetId: null,
      },
    });

    expect(await screen.findByPlaceholderText(/what did you spend on/i)).toHaveValue(
      "Bánh mì"
    );
    expect((screen.getByPlaceholderText("0") as HTMLInputElement).value).toMatch(
      /25[.,]?000/
    );
  });

  it("calls onSuccess with the local expense returned by create", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    const localExpense = {
      entity: "expenses",
      clientId: "client-created",
      serverId: null,
      date: "2026-05-30",
      amount: 35000,
      note: "Cà phê",
      category: Category.FOOD,
      paidBy: PaidBy.CUBI,
      budgetId: null,
      budgetName: null,
      budgetIcon: null,
      budgetColor: null,
      syncStatus: "pending",
      lastError: null,
      updatedAt: "2026-05-30T00:00:00.000Z",
      serverUpdatedAt: null,
    };
    mutationMocks.createMutateAsync.mockResolvedValueOnce(localExpense);

    renderDrawer({
      showTrigger: false,
      open: true,
      onOpenChange: vi.fn(),
      onSuccess,
      initialExpense: {
        date: "30/05/2026",
        amount: 35000,
        note: "Cà phê",
        category: Category.FOOD,
        paidBy: PaidBy.CUBI,
        budgetId: null,
      },
    });

    await user.click(await screen.findByRole("button", { name: /add expense/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(localExpense));
  });
});
```

- [ ] **Step 2: Run drawer tests and verify they fail**

Run:

```bash
rtk bun run test src/components/QuickExpenseDrawer.test.tsx
```

Expected: FAIL because controlled create mode does not hydrate from `initialExpense` and `onSuccess` does not receive the local mutation result.

- [ ] **Step 3: Update QuickExpenseDrawer props and controlled-create hydration**

In `src/components/QuickExpenseDrawer.tsx`, add the import:

```ts
import type { LocalExpense } from "@/lib/sync/expenses/types";
```

Change the prop type:

```ts
export type TQuickExpenseDrawerProps = {
  compact?: boolean;
  onTriggerClick?: () => void;
  mode?: "create" | "edit";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialExpense?: TQuickExpenseDrawerInitialExpense | null;
  recoveryDraft?: TQuickExpenseDraft | null;
  recoveryOperationId?: string;
  transactionId?: number;
  onSuccess?: (expense: LocalExpense) => void;
  onConfirmDelete?: () => void | Promise<void>;
  showTrigger?: boolean;
};
```

Add this key near the other memoized values and effects:

```ts
const initialExpenseIdentity = useMemo(() => {
  if (!initialExpense) {
    return "";
  }

  return [
    initialExpense.id ?? "",
    initialExpense.clientId ?? "",
    initialExpense.date,
    initialExpense.amount,
    initialExpense.note ?? "",
    initialExpense.category,
    initialExpense.paidBy ?? "",
    initialExpense.budgetId ?? "",
    initialExpense.budgetName ?? "",
    initialExpense.budgetIcon ?? "",
    initialExpense.budgetColor ?? "",
  ].join("|");
}, [initialExpense]);
```

Add this effect after the existing edit/recovery open hydration effect:

```ts
useEffect(() => {
  if (!drawerOpen || recoveryDraft || isEditMode || !initialExpense) {
    return;
  }

  const nextDraft = buildDraftFromExpense(initialExpense, fallbackPaidBy);
  setDraft(nextDraft);
  resetSuggestionTracking(
    nextDraft,
    nextDraft.budgetId === null ? "none" : "ai-prefill"
  );
}, [
  drawerOpen,
  fallbackPaidBy,
  initialExpense,
  initialExpenseIdentity,
  isEditMode,
  recoveryDraft,
]);
```

- [ ] **Step 4: Pass mutation result into onSuccess**

In `handleSubmit`, change the `localWrite.then` block from:

```ts
void localWrite
  .then(() => {
    if (isEditMode) {
      toast.success("Expense updated.");
      return;
    }
    toast.success(
      <QuickExpenseSuccessToast draft={submittedDraft} />,
      QUICK_EXPENSE_SUCCESS_TOAST_OPTIONS
    );
  })
```

to:

```ts
void localWrite
  .then((expense) => {
    onSuccess?.(expense);
    if (isEditMode) {
      toast.success("Expense updated.");
      return;
    }
    toast.success(
      <QuickExpenseSuccessToast draft={submittedDraft} />,
      QUICK_EXPENSE_SUCCESS_TOAST_OPTIONS
    );
  })
```

- [ ] **Step 5: Run drawer tests and verify they pass**

Run:

```bash
rtk bun run test src/components/QuickExpenseDrawer.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit drawer enhancement**

Run:

```bash
rtk git add src/components/QuickExpenseDrawer.tsx src/components/QuickExpenseDrawer.test.tsx
rtk git commit -m "feat(expense): support controlled create prefill"
```

Expected: commit succeeds.

## Task 3: Convert AI Quick Entry Types And Presentational Rows

**Files:**
- Modify: `src/components/ai-quick-entry/types.ts`
- Modify: `src/components/ai-quick-entry/AIQuickEntryRow.tsx`
- Modify: `src/components/ai-quick-entry/AIQuickEntryPendingQueue.tsx`
- Modify: `src/components/ai-quick-entry/AIQuickEntryPreview.tsx`

- [ ] **Step 1: Update session row types**

Replace `src/components/ai-quick-entry/types.ts` with:

```ts
import type {
  AIQuickEntryReviewReason,
  SavedQuickEntryExpense,
} from "@/components/ai-quick-entry/real-parse";
import type { TQuickExpenseDrawerInitialExpense } from "@/components/QuickExpenseDrawer";

export type QuickEntryStatus = "parsing" | "saving" | "saved" | "needsReview";

export type QuickEntry = {
  id: string;
  input: string;
  status: QuickEntryStatus;
  createdAt: number;
  reviewDraft?: TQuickExpenseDrawerInitialExpense;
  savedExpense?: SavedQuickEntryExpense;
  errorReason?: AIQuickEntryReviewReason;
};
```

- [ ] **Step 2: Update row rendering**

In `src/components/ai-quick-entry/AIQuickEntryRow.tsx`, change the prop variant to:

```ts
type AIQuickEntryRowProps = {
  entry: QuickEntry;
  variant: "active" | "saved" | "needsReview";
  className?: string;
};
```

Use these display helpers inside the component:

```ts
const getEntryNote = (entry: QuickEntry) =>
  entry.savedExpense?.note?.trim() ||
  entry.reviewDraft?.note?.trim() ||
  entry.input;

const getEntryAmount = (entry: QuickEntry) =>
  entry.savedExpense?.amount ?? entry.reviewDraft?.amount ?? 0;

const getEntryCategory = (entry: QuickEntry) =>
  entry.savedExpense?.category ?? entry.reviewDraft?.category ?? Category.OTHER;
```

Replace the variant checks with these rules:

```tsx
const note = getEntryNote(entry);
const amount = getEntryAmount(entry);
const isActive = variant === "active";
const isSaved = variant === "saved";

return (
  <div
    data-ai-quick-entry-row
    data-testid="ai-quick-entry-row"
    data-variant={variant}
    aria-label={
      isActive
        ? `${entry.status === "saving" ? "Saving" : "Parsing"} expense: ${entry.input}`
        : isSaved
          ? `Saved expense: ${note}, ${formatVnd(amount)}`
          : `Expense needs review: ${note}`
    }
    className={cn(rowClassName, className)}
  >
    {isSaved ? (
      <ExpenseItemIcon
        category={getEntryCategory(entry) as Category}
        size="sm"
        className="size-8 shrink-0 [&_svg]:size-4"
      />
    ) : variant === "needsReview" ? (
      <FailedIndicator />
    ) : (
      <PendingIndicator />
    )}

    <p className="text-foreground/90 min-w-0 grow truncate text-sm font-semibold">
      {note}
    </p>

    {isSaved ? (
      <CompactAmount amount={amount} />
    ) : variant === "needsReview" ? (
      <span className="text-destructive shrink-0 text-xs font-semibold">
        Review
      </span>
    ) : entry.status === "saving" ? (
      <span className="text-muted-foreground shrink-0 text-xs font-semibold">
        Saving
      </span>
    ) : (
      <PendingAmountSkeleton />
    )}
  </div>
);
```

- [ ] **Step 3: Update Entry Mode active queue**

In `src/components/ai-quick-entry/AIQuickEntryPendingQueue.tsx`, rename props to active rows:

```ts
type AIQuickEntryPendingQueueProps = {
  activeEntries: QuickEntry[];
  onOpenPreview: () => void;
};
```

Change the body to use `activeEntries` and render active rows:

```tsx
if (activeEntries.length === 0) {
  return null;
}

const orderedEntries = newestFirst(activeEntries);
const visibleEntries = orderedEntries.slice(0, 2);
const hiddenCount = Math.max(activeEntries.length - visibleEntries.length, 0);

return (
  <div className="space-y-2" data-testid="ai-quick-entry-pending-queue">
    {visibleEntries.map((entry) => (
      <button
        key={entry.id}
        type="button"
        aria-label={`Preview active expense: ${entry.input}`}
        onClick={onOpenPreview}
        onPointerDown={(event) => event.preventDefault()}
        className="block w-full text-left"
      >
        <AIQuickEntryRow entry={entry} variant="active" />
      </button>
    ))}

    {hiddenCount > 0 ? (
      <button
        type="button"
        aria-label={`Preview ${hiddenCount} more active expense${
          hiddenCount === 1 ? "" : "s"
        }`}
        onClick={onOpenPreview}
        onPointerDown={(event) => event.preventDefault()}
        className={cn(
          "text-muted-foreground bg-surface-3/55 ds-glass glass-border flex min-h-11 w-full items-center rounded-[18px] px-4 text-left text-xs font-semibold"
        )}
      >
        +{hiddenCount} more active
      </button>
    ) : null}
  </div>
);
```

- [ ] **Step 4: Update Preview Mode sections**

In `src/components/ai-quick-entry/AIQuickEntryPreview.tsx`, change props:

```ts
type AIQuickEntryPreviewProps = {
  activeEntries: QuickEntry[];
  savedEntries: QuickEntry[];
  reviewEntries: QuickEntry[];
  onDone: () => void;
  onSelectSavedEntry: (entry: QuickEntry) => void;
  onSelectReviewEntry: (entry: QuickEntry) => void;
};
```

Update `PreviewSectionProps`:

```ts
type PreviewSectionProps = {
  title: string;
  entries: QuickEntry[];
  variant: "active" | "saved" | "needsReview";
  onSelectEntry?: (entry: QuickEntry) => void;
};
```

Render tappable rows only when a selection callback exists:

```tsx
{entries.map((entry) => {
  const row = <AIQuickEntryRow entry={entry} variant={variant} />;
  if (!onSelectEntry) {
    return <div key={entry.id}>{row}</div>;
  }

  return (
    <button
      key={entry.id}
      type="button"
      onClick={() => onSelectEntry(entry)}
      className="block min-h-11 w-full text-left transition-transform active:scale-[0.99]"
    >
      {row}
    </button>
  );
})}
```

Use these sections in `AIQuickEntryPreview`:

```tsx
<PreviewSection title="Active" entries={activeEntries} variant="active" />
<PreviewSection
  title="Saved"
  entries={savedEntries}
  variant="saved"
  onSelectEntry={onSelectSavedEntry}
/>
<PreviewSection
  title="Needs review"
  entries={reviewEntries}
  variant="needsReview"
  onSelectEntry={onSelectReviewEntry}
/>
```

- [ ] **Step 5: Run affected TypeScript tests**

Run:

```bash
rtk bun run test src/components/AIQuickEntry.test.tsx
```

Expected: FAIL because `AIQuickEntry.tsx` still passes the old prop names and old row states.

- [ ] **Step 6: Commit presentational type changes after AIQuickEntry wiring**

Do not commit at this point if the test suite is broken. Continue to Task 4, then commit the presentational and container changes together.

## Task 4: Wire AIQuickEntry To Real Parser And Auto-Save

**Files:**
- Modify: `src/components/AIQuickEntry.tsx`
- Modify: `src/components/AIQuickEntry.test.tsx`
- Modify: `src/components/ai-quick-entry/types.ts`
- Modify: `src/components/ai-quick-entry/AIQuickEntryRow.tsx`
- Modify: `src/components/ai-quick-entry/AIQuickEntryPendingQueue.tsx`
- Modify: `src/components/ai-quick-entry/AIQuickEntryPreview.tsx`

- [ ] **Step 1: Replace AIQuickEntry test mocks**

In `src/components/AIQuickEntry.test.tsx`, remove the `mockParseExpense` import and mock. Add these imports:

```ts
import { Category, PaidBy } from "@/enums";
import { queries } from "@/lib/queries";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
```

Add `waitFor` to the React Testing Library import:

```ts
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
```

Add hoisted mocks:

```ts
const { createExpenseMock, quickExpenseDrawerMock } = vi.hoisted(() => ({
  createExpenseMock: vi.fn(),
  quickExpenseDrawerMock: vi.fn(),
}));
```

Add mutation and drawer mocks:

```ts
vi.mock("@/lib/mutations", () => ({
  useCreateExpenseMutation: () => ({ mutateAsync: createExpenseMock }),
}));

vi.mock("@/components/QuickExpenseDrawer", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    quickExpenseDrawerMock(props);
    return (
      <div
        data-testid="quick-expense-drawer"
        data-open={String(props.open)}
        data-mode={String(props.mode)}
      />
    );
  },
}));
```

Replace the `render(<AIQuickEntry />)` pattern with a wrapper:

```ts
const TODAY = "2026-05-30";
const WEEK_START = "2026-05-24";

const budgetOption = {
  id: 2,
  name: "Cà phê",
  icon: "☕",
  color: "lime" as const,
  period: "week" as const,
  periodStartDate: "2026-05-24",
  periodEndDate: "2026-05-30",
  amount: 100000,
  spent: 0,
  remaining: 100000,
  category: Category.FOOD,
};

const renderQuickEntry = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData(
    queries.budgetWeekly.options(WEEK_START, TODAY).queryKey,
    [budgetOption]
  );

  return render(
    <QueryClientProvider client={queryClient}>
      <AIQuickEntry />
    </QueryClientProvider>
  );
};
```

Add parse response helper:

```ts
const mockParseResponse = (data: unknown, status = 200) => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      status,
      json: vi.fn().mockResolvedValue({ success: true, data }),
    })
  );
};
```

Update `beforeEach`:

```ts
beforeEach(() => {
  vi.setSystemTime(new Date(`${TODAY}T08:00:00.000Z`));
  mockPathname = "/";
  toastSuccessMock.mockClear();
  createExpenseMock.mockReset().mockResolvedValue({
    entity: "expenses",
    clientId: "client-created",
    serverId: null,
    date: "2026-05-30",
    amount: 35000,
    note: "Cà phê sữa đá",
    category: Category.FOOD,
    paidBy: PaidBy.CUBI,
    budgetId: 2,
    budgetName: "Cà phê",
    budgetIcon: "☕",
    budgetColor: "lime",
    syncStatus: "pending",
    lastError: null,
    updatedAt: "2026-05-30T00:00:00.000Z",
    serverUpdatedAt: null,
  });
  quickExpenseDrawerMock.mockClear();
  useAIQuickEntryStore.getState().setOpen(false);
});
```

Add global cleanup:

```ts
afterEach(() => {
  act(() => {
    useAIQuickEntryStore.getState().setOpen(false);
  });
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
```

- [ ] **Step 2: Write AIQuickEntry real parse tests**

Replace timer-specific tests with these behavior tests:

```ts
it("auto-saves a trusted parse and keeps the composer usable", async () => {
  mockParseResponse({
    status: "success",
    originalInput: "cf 35k",
    expense: {
      date: "30/05/2026",
      amount: 35000,
      note: "Cà phê sữa đá",
      budgetId: 2,
      confidence: "high",
      reason: "Matched coffee.",
    },
  });
  renderQuickEntry();
  openOverlay();

  act(() => {
    typeAndSend("cf 35k");
  });

  expect(screen.getByLabelText("Describe your expense")).toHaveValue("");
  expect(screen.getByText("cf 35k")).toBeInTheDocument();

  await waitFor(() =>
    expect(createExpenseMock).toHaveBeenCalledWith(
      expect.objectContaining({
        date: "2026-05-30",
        amount: 35000,
        note: "Cà phê sữa đá",
        category: Category.FOOD,
        paidBy: PaidBy.CUBI,
        budgetId: 2,
      })
    )
  );

  await waitFor(() =>
    expect(screen.queryByTestId("ai-quick-entry-pending-queue")).not.toBeInTheDocument()
  );
  fireEvent.click(screen.getByLabelText(/Open preview/));
  expect(screen.getByText("Saved")).toBeInTheDocument();
  expect(screen.getByText("Cà phê sữa đá")).toBeInTheDocument();
});

it("moves fallback parses to Needs review", async () => {
  mockParseResponse({
    status: "fallback",
    originalInput: "??? 35k",
    prefill: { note: "??? 35k", amount: 35000 },
    reason: "schema_mismatch",
  });
  renderQuickEntry();
  openOverlay();

  act(() => {
    typeAndSend("??? 35k");
  });

  await waitFor(() => expect(screen.queryByText("??? 35k")).not.toBeInTheDocument());
  fireEvent.click(screen.getByLabelText(/Open preview/));
  expect(screen.getByText("Needs review")).toBeInTheDocument();
  expect(screen.getByText("??? 35k")).toBeInTheDocument();
  expect(createExpenseMock).not.toHaveBeenCalled();
});

it("moves create failures to Needs review with the parsed draft", async () => {
  createExpenseMock.mockRejectedValueOnce(new Error("offline"));
  mockParseResponse({
    status: "success",
    originalInput: "cf 35k",
    expense: {
      date: "30/05/2026",
      amount: 35000,
      note: "Cà phê sữa đá",
      budgetId: 2,
      confidence: "high",
      reason: "Matched coffee.",
    },
  });
  renderQuickEntry();
  openOverlay();

  act(() => {
    typeAndSend("cf 35k");
  });

  await waitFor(() => expect(createExpenseMock).toHaveBeenCalled());
  fireEvent.click(screen.getByLabelText(/Open preview/));
  expect(await screen.findByText("Needs review")).toBeInTheDocument();
  expect(screen.getByText("Cà phê sữa đá")).toBeInTheDocument();
});
```

- [ ] **Step 3: Update AIQuickEntry imports and state**

In `src/components/AIQuickEntry.tsx`, remove:

```ts
import { Category, PaidBy } from "@/enums";
import { mockParseExpense } from "@/lib/ai/mock-parse-expense";
```

Add:

```ts
import dayjs from "@/configs/date";
import type { ParseExpenseResponse } from "@/lib/ai/parse-expense-contract";
import { unwrapApiResponse } from "@/lib/api/api-response";
import {
  buildOriginalInputReviewDraft,
  evaluateAIQuickEntryParse,
  localExpenseToSavedExpense,
  type SavedQuickEntryExpense,
} from "@/components/ai-quick-entry/real-parse";
import QuickExpenseDrawer, {
  type TQuickExpenseDrawerInitialExpense,
} from "@/components/QuickExpenseDrawer";
import { useCreateExpenseMutation } from "@/lib/mutations";
import { queries } from "@/lib/queries";
import { getWeekRange } from "@/lib/week";
import { useQueryClient } from "@tanstack/react-query";
```

Remove timer refs and timer cleanup. Remove `RESOLVE_DELAY_MS`.

Add active drawer type near `AIQuickEntryMode`:

```ts
type ActiveQuickEntryDrawerItem =
  | {
      kind: "review";
      entryId: string;
      initialExpense: TQuickExpenseDrawerInitialExpense;
    }
  | {
      kind: "saved";
      entryId: string;
      transactionId: number;
      initialExpense: SavedQuickEntryExpense;
    }
  | null;
```

Inside the component, add:

```ts
const queryClient = useQueryClient();
const { mutateAsync: createExpense } = useCreateExpenseMutation();
const [activeDrawerItem, setActiveDrawerItem] =
  useState<ActiveQuickEntryDrawerItem>(null);
```

- [ ] **Step 4: Add parser and row lifecycle helpers in AIQuickEntry**

Add these helpers inside `AIQuickEntry`:

```ts
const updateEntry = (
  id: string,
  updater: (entry: QuickEntry) => QuickEntry
) => {
  setEntries((current) =>
    current.map((entry) => (entry.id === id ? updater(entry) : entry))
  );
};

const loadTodayBudgets = async () => {
  const today = dayjs().format("YYYY-MM-DD");
  const weekStart = getWeekRange(dayjs()).weekStartDate.format("YYYY-MM-DD");
  return queryClient.ensureQueryData(
    queries.budgetWeekly.options(weekStart, today)
  );
};

const parseExpenseInput = async (
  input: string,
  budgets: Awaited<ReturnType<typeof loadTodayBudgets>>
): Promise<ParseExpenseResponse> => {
  const response = await fetch("/api/ai/parse-expense", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input,
      today: dayjs().format("DD/MM/YYYY"),
      budgets: budgets.map((budget) => ({
        id: budget.id,
        name: budget.name,
        category: budget.category,
      })),
    }),
  });

  return unwrapApiResponse<ParseExpenseResponse>(
    await response.json(),
    response.status
  );
};

const runEntry = async (id: string, input: string) => {
  const todayIso = dayjs().format("YYYY-MM-DD");
  const todayDisplay = dayjs().format("DD/MM/YYYY");

  try {
    const budgetOptions = await loadTodayBudgets();
    const parseResult = await parseExpenseInput(input, budgetOptions);
    const decision = evaluateAIQuickEntryParse({
      input,
      parseResult,
      budgetOptions,
      paidBy,
      todayIso,
    });

    if (decision.kind === "review") {
      updateEntry(id, (entry) => ({
        ...entry,
        status: "needsReview",
        reviewDraft: decision.initialExpense,
        errorReason: decision.reason,
      }));
      haptics.warning();
      return;
    }

    updateEntry(id, (entry) => ({
      ...entry,
      status: "saving",
      reviewDraft: decision.initialExpense,
    }));

    const savedExpense = await createExpense(decision.payload);
    updateEntry(id, (entry) => ({
      ...entry,
      status: "saved",
      savedExpense: localExpenseToSavedExpense(savedExpense),
      reviewDraft: undefined,
      errorReason: undefined,
    }));
    toast.success(
      <QuickExpenseSuccessToast draft={decision.payload} />,
      QUICK_EXPENSE_SUCCESS_TOAST_OPTIONS
    );
    haptics.success();
  } catch (error) {
    console.error(error);
    updateEntry(id, (entry) => ({
      ...entry,
      status: "needsReview",
      reviewDraft:
        entry.reviewDraft ??
        buildOriginalInputReviewDraft({
          input,
          paidBy,
          todayDisplay,
        }),
      errorReason: "parse_error",
    }));
    haptics.error();
  }
};
```

- [ ] **Step 5: Replace submit lifecycle**

Replace `submit` with:

```ts
const submit = () => {
  const input = composer.trim();
  if (!input) {
    return;
  }

  const id = createEntryId();
  setEntries((current) => [
    ...current,
    {
      id,
      input,
      status: "parsing",
      createdAt: Date.now(),
    },
  ]);
  setComposer("");
  haptics.impact("medium");
  void runEntry(id, input);
};
```

- [ ] **Step 6: Update derived row groups and render props**

Replace pending/completed/failed derivations with:

```ts
const activeEntries = useMemo(
  () =>
    entries.filter(
      (entry) => entry.status === "parsing" || entry.status === "saving"
    ),
  [entries]
);
const savedEntries = useMemo(
  () => newestFirst(entries.filter((entry) => entry.status === "saved")),
  [entries]
);
const reviewEntries = useMemo(
  () => newestFirst(entries.filter((entry) => entry.status === "needsReview")),
  [entries]
);
const savedCount = savedEntries.length;
const reviewCount = reviewEntries.length;
```

Update `AIQuickEntryStatusBar` call:

```tsx
<AIQuickEntryStatusBar
  totalCount={entries.length}
  pendingCount={activeEntries.length}
  completedCount={savedCount}
  failedCount={reviewCount}
  onOpenPreview={openPreview}
/>
```

Update preview:

```tsx
<AIQuickEntryPreview
  activeEntries={newestFirst(activeEntries)}
  savedEntries={savedEntries}
  reviewEntries={reviewEntries}
  onDone={returnToEntry}
  onSelectSavedEntry={openSavedEntry}
  onSelectReviewEntry={openReviewEntry}
/>
```

Update Entry Mode queue:

```tsx
<AIQuickEntryPendingQueue
  activeEntries={activeEntries}
  onOpenPreview={openPreview}
/>
```

- [ ] **Step 7: Add single drawer selectors and drawer render**

Add these callbacks inside `AIQuickEntry`:

```ts
const openReviewEntry = (entry: QuickEntry) => {
  if (!entry.reviewDraft) {
    return;
  }
  setActiveDrawerItem({
    kind: "review",
    entryId: entry.id,
    initialExpense: entry.reviewDraft,
  });
};

const openSavedEntry = (entry: QuickEntry) => {
  if (!entry.savedExpense) {
    return;
  }
  setActiveDrawerItem({
    kind: "saved",
    entryId: entry.id,
    transactionId: entry.savedExpense.id,
    initialExpense: entry.savedExpense,
  });
};

const handleQuickExpenseDrawerOpenChange = (nextOpen: boolean) => {
  if (!nextOpen) {
    setActiveDrawerItem(null);
  }
};

const handleQuickExpenseDrawerSuccess = (expense: Parameters<typeof localExpenseToSavedExpense>[0]) => {
  const activeItem = activeDrawerItem;
  if (!activeItem) {
    return;
  }
  const savedExpense = localExpenseToSavedExpense(expense);
  updateEntry(activeItem.entryId, (entry) => ({
    ...entry,
    status: "saved",
    savedExpense,
    reviewDraft: undefined,
    errorReason: undefined,
  }));
};
```

Render the single drawer inside `DrawerContent`, after the mode-specific content:

```tsx
<QuickExpenseDrawer
  showTrigger={false}
  open={activeDrawerItem !== null}
  onOpenChange={handleQuickExpenseDrawerOpenChange}
  mode={activeDrawerItem?.kind === "saved" ? "edit" : "create"}
  transactionId={
    activeDrawerItem?.kind === "saved"
      ? activeDrawerItem.transactionId
      : undefined
  }
  initialExpense={activeDrawerItem?.initialExpense ?? null}
  onSuccess={handleQuickExpenseDrawerSuccess}
/>
```

- [ ] **Step 8: Run AIQuickEntry tests**

Run:

```bash
rtk bun run test src/components/AIQuickEntry.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit real parser integration**

Run:

```bash
rtk git add src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx src/components/ai-quick-entry/types.ts src/components/ai-quick-entry/AIQuickEntryRow.tsx src/components/ai-quick-entry/AIQuickEntryPendingQueue.tsx src/components/ai-quick-entry/AIQuickEntryPreview.tsx
rtk git commit -m "feat(ai-quick-entry): integrate real parse auto save"
```

Expected: commit succeeds.

## Task 5: Cover Single Drawer Preview Row Selection

**Files:**
- Modify: `src/components/AIQuickEntry.test.tsx`
- Modify: `src/components/AIQuickEntry.tsx`
- Modify: `src/components/ai-quick-entry/AIQuickEntryPreview.tsx`

- [ ] **Step 1: Add saved-row single drawer test**

Add this test to `src/components/AIQuickEntry.test.tsx`:

```ts
it("opens the one quick expense drawer in edit mode for a saved row", async () => {
  mockParseResponse({
    status: "success",
    originalInput: "cf 35k",
    expense: {
      date: "30/05/2026",
      amount: 35000,
      note: "Cà phê sữa đá",
      budgetId: 2,
      confidence: "high",
      reason: "Matched coffee.",
    },
  });
  renderQuickEntry();
  openOverlay();

  act(() => {
    typeAndSend("cf 35k");
  });

  await waitFor(() => expect(createExpenseMock).toHaveBeenCalled());
  fireEvent.click(screen.getByLabelText(/Open preview/));
  fireEvent.click(await screen.findByRole("button", { name: /Cà phê sữa đá/i }));

  const lastDrawerProps = quickExpenseDrawerMock.mock.calls.at(-1)?.[0] as
    | Record<string, unknown>
    | undefined;
  expect(screen.getByTestId("quick-expense-drawer")).toHaveAttribute("data-open", "true");
  expect(screen.getByTestId("quick-expense-drawer")).toHaveAttribute("data-mode", "edit");
  expect(lastDrawerProps?.initialExpense).toMatchObject({
    clientId: "client-created",
    note: "Cà phê sữa đá",
    amount: 35000,
  });
});
```

- [ ] **Step 2: Add review-row single drawer switching test**

Add this test:

```ts
it("reuses the same quick expense drawer and changes prefill for review rows", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce({
        status: 200,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: {
            status: "fallback",
            originalInput: "first 25k",
            prefill: { note: "first 25k", amount: 25000 },
            reason: "schema_mismatch",
          },
        }),
      })
      .mockResolvedValueOnce({
        status: 200,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: {
            status: "fallback",
            originalInput: "second 40k",
            prefill: { note: "second 40k", amount: 40000 },
            reason: "schema_mismatch",
          },
        }),
      })
  );
  renderQuickEntry();
  openOverlay();

  act(() => {
    typeAndSend("first 25k");
    typeAndSend("second 40k");
  });

  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  fireEvent.click(screen.getByLabelText(/Open preview/));

  fireEvent.click(await screen.findByRole("button", { name: /first 25k/i }));
  let lastDrawerProps = quickExpenseDrawerMock.mock.calls.at(-1)?.[0] as
    | Record<string, unknown>
    | undefined;
  expect(lastDrawerProps?.initialExpense).toMatchObject({ note: "first 25k" });

  fireEvent.click(screen.getByRole("button", { name: /second 40k/i }));
  lastDrawerProps = quickExpenseDrawerMock.mock.calls.at(-1)?.[0] as
    | Record<string, unknown>
    | undefined;
  expect(lastDrawerProps?.initialExpense).toMatchObject({ note: "second 40k" });
  expect(screen.getAllByTestId("quick-expense-drawer")).toHaveLength(1);
});
```

- [ ] **Step 3: Add row accessible names and run tests**

Update the row selector button in `src/components/ai-quick-entry/AIQuickEntryPreview.tsx`:

```tsx
<button
  key={entry.id}
  type="button"
  aria-label={
    variant === "saved"
      ? `Edit saved expense ${entry.savedExpense?.note ?? entry.input}`
      : `Review expense ${entry.reviewDraft?.note ?? entry.input}`
  }
  onClick={() => onSelectEntry(entry)}
  className="block min-h-11 w-full text-left transition-transform active:scale-[0.99]"
>
  {row}
</button>
```

Run:

```bash
rtk bun run test src/components/AIQuickEntry.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit drawer selection coverage**

Run:

```bash
rtk git add src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx src/components/ai-quick-entry/AIQuickEntryPreview.tsx
rtk git commit -m "test(ai-quick-entry): cover single drawer row selection"
```

Expected: commit succeeds.

## Task 6: Final Formatting, Linting, And Targeted Tests

**Files:**
- Check all modified `.ts` and `.tsx` files.

- [ ] **Step 1: Format modified files**

Run:

```bash
rtk bunx prettier --write src/components/ai-quick-entry/real-parse.ts src/components/ai-quick-entry/real-parse.test.ts src/components/ai-quick-entry/types.ts src/components/ai-quick-entry/AIQuickEntryRow.tsx src/components/ai-quick-entry/AIQuickEntryPendingQueue.tsx src/components/ai-quick-entry/AIQuickEntryPreview.tsx src/components/ai-quick-entry/AIQuickEntryStatusBar.tsx src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx src/components/QuickExpenseDrawer.tsx src/components/QuickExpenseDrawer.test.tsx
```

Expected: files are formatted.

- [ ] **Step 2: Check formatting**

Run:

```bash
rtk bunx prettier --check src/components/ai-quick-entry/real-parse.ts src/components/ai-quick-entry/real-parse.test.ts src/components/ai-quick-entry/types.ts src/components/ai-quick-entry/AIQuickEntryRow.tsx src/components/ai-quick-entry/AIQuickEntryPendingQueue.tsx src/components/ai-quick-entry/AIQuickEntryPreview.tsx src/components/ai-quick-entry/AIQuickEntryStatusBar.tsx src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx src/components/QuickExpenseDrawer.tsx src/components/QuickExpenseDrawer.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run ESLint on modified scope**

Run:

```bash
rtk bunx eslint src/components/ai-quick-entry/real-parse.ts src/components/ai-quick-entry/real-parse.test.ts src/components/ai-quick-entry/types.ts src/components/ai-quick-entry/AIQuickEntryRow.tsx src/components/ai-quick-entry/AIQuickEntryPendingQueue.tsx src/components/ai-quick-entry/AIQuickEntryPreview.tsx src/components/ai-quick-entry/AIQuickEntryStatusBar.tsx src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx src/components/QuickExpenseDrawer.tsx src/components/QuickExpenseDrawer.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Run targeted tests**

Run:

```bash
rtk bun run test src/components/ai-quick-entry/real-parse.test.ts src/components/AIQuickEntry.test.tsx src/components/QuickExpenseDrawer.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit final formatting fixes**

Run:

```bash
rtk git status --short
```

If formatting or lint fixes changed files, run:

```bash
rtk git add src/components/ai-quick-entry/real-parse.ts src/components/ai-quick-entry/real-parse.test.ts src/components/ai-quick-entry/types.ts src/components/ai-quick-entry/AIQuickEntryRow.tsx src/components/ai-quick-entry/AIQuickEntryPendingQueue.tsx src/components/ai-quick-entry/AIQuickEntryPreview.tsx src/components/ai-quick-entry/AIQuickEntryStatusBar.tsx src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx src/components/QuickExpenseDrawer.tsx src/components/QuickExpenseDrawer.test.tsx
rtk git commit -m "chore(ai-quick-entry): format real parse integration"
```

Expected: either no changes remain or commit succeeds.

## Manual QA

- Open the app on an iPhone 13/14-sized viewport.
- Open AI Quick Entry from the bottom nav.
- Submit `cf 35k`.
- Confirm the composer clears immediately and stays focused.
- Confirm active row appears while parsing/saving.
- Confirm trusted result disappears from Entry Mode and appears under `Saved` in Preview Mode.
- Tap saved row and confirm the single quick expense drawer opens in edit mode with that row's data.
- Submit an ambiguous entry such as `??? 35k`.
- Confirm it appears under `Needs review`.
- Tap review row and confirm the same drawer opens in create mode with that row's prefill.
- While drawer is open, tap a different Preview row and confirm the drawer content changes rather than a second drawer appearing.
