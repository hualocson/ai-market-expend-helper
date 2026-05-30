# Auto-Apply Budget Category on Budget Selection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a budget is applied to an expense draft (via AI suggestion or manual selection), automatically set the expense's category to that budget's mapped category.

**Architecture:** The DB already stores `budgets.category` and the `/api/budget-weekly` route already returns it; the value is currently dropped at the client deserialization boundary. We surface `category` on the client `BudgetWeeklyOption`, then write it onto the draft in every "apply budget" path in both `QuickExpenseDrawer` and `ManualExpenseForm`. A new per-draft "category touched by user" ref guards against clobbering a manual category pick, and edit mode in the drawer never remaps.

**Behavior rules (locked):**
- Auto-apply on **both** AI suggestion and manual budget selection.
- **Never** overwrite a category the user manually tapped (tracked via `categoryUserEditedRef`).
- Apply **unconditionally**, including when the budget maps to `Other`.
- **Skip entirely in edit mode** (`QuickExpenseDrawer` `mode === "edit"`). `ManualExpenseForm` is add-only, so its gate only checks the user-edit flag.

**Tech Stack:** Next.js 15 (App Router) · React 19 · TanStack Query · `@lukemorales/query-key-factory` · Vitest + Testing Library · TypeScript.

---

## Tooling notes for the implementer

- Branch is already `dev-budget-category-mapping` (correct `dev-` prefix). Do not branch again.
- After editing any `.ts`/`.tsx` file, run, scoped to the files you touched:
  - `rtk bunx prettier --write <files>` then `rtk bunx prettier --check <files>`
  - `rtk bunx eslint <files>`
- Run tests with `bun run test <pattern>` (NOT `npm`). `npm` is only for `npm run build`.
- Do **not** run `npm run build` between tasks. Run it once at the very end (Task 4) before any push.
- `Category` enum values (string): `Food`, `Shopping`, `Housing`, `Transport`, `Badminton`, `Entertainment`, `Giving`, `Other` — defined in `src/enums/index.ts`.

---

## Task 1: Surface budget `category` on the client `BudgetWeeklyOption`

**Files:**
- Modify: `src/lib/queries/budget-weekly.ts`
- Test: `src/lib/queries/budget-weekly.test.ts`
- Fix fixtures (compilation): `src/lib/budget-options.test.ts`, `src/components/QuickExpenseDrawer.test.tsx`, `src/components/BudgetPickerSheet.test.tsx`

Adding a **required** `category` field to `BudgetWeeklyOption` will break every test that constructs the object literal. Those fixes are part of this task so the suite compiles.

- [ ] **Step 1: Write the failing fetcher test**

Add this `it` block inside the `describe("budget weekly query helpers", ...)` in `src/lib/queries/budget-weekly.test.ts` (e.g. right after the existing "maps budget appearance into weekly options" test, before the final `"returns all fetched budget options..."` test). Also add the `Category` import at the top of the file.

At the top, add to the import section:

```ts
import { Category } from "@/enums";
```

New test:

```ts
  it("maps budget category and falls back to Other for unknown values", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(
        successEnvelope({
          budgets: [
            {
              id: 1,
              name: "Coffee week",
              category: "Entertainment",
              period: "week",
              periodStartDate: "2026-05-18",
              periodEndDate: "2026-05-24",
              amount: 100,
              spent: 0,
              remaining: 100,
            },
            {
              id: 2,
              name: "Mystery month",
              category: "NotARealCategory",
              period: "month",
              periodStartDate: "2026-05-01",
              periodEndDate: "2026-05-31",
              amount: 200,
              spent: 0,
              remaining: 200,
            },
          ],
        })
      ),
    } as unknown as Response);

    const options = await fetchWeeklyBudgetOptions("2026-05-18");

    expect(options[0]).toMatchObject({ category: Category.ENTERTAINMENT });
    expect(options[1]).toMatchObject({ category: Category.OTHER });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/lib/queries/budget-weekly.test.ts`
Expected: FAIL — TypeScript/runtime error that `category` does not exist on the mapped option (and the `toMatchObject` assertions fail).

- [ ] **Step 3: Add `category` to the fetcher type, response type, normalizer, and mapping**

In `src/lib/queries/budget-weekly.ts`:

Add the `Category` import alongside the existing imports at the top:

```ts
import { Category } from "@/enums";
```

In `BudgetWeeklyOptionsResponse.budgets[]` (the inline array element type), add `category` after `remaining`:

```ts
type BudgetWeeklyOptionsResponse = {
  budgets?: Array<{
    id: number;
    name: string;
    icon?: string;
    color?: string | null;
    period?: BudgetPeriod;
    periodStartDate?: string;
    periodEndDate?: string | null;
    amount?: number;
    spent?: number;
    remaining?: number;
    category?: string;
  }>;
};
```

In the exported `BudgetWeeklyOption` type, add `category` after `remaining`:

```ts
export type BudgetWeeklyOption = {
  id: number;
  name: string;
  icon: string;
  color: BudgetColorId;
  period: BudgetPeriod;
  periodStartDate: string | null;
  periodEndDate: string | null;
  amount: number;
  spent: number;
  remaining: number;
  category: Category;
};
```

Add the normalizer just below the imports (above `fetchWeeklyBudgetOptions`):

```ts
const ALLOWED_CATEGORIES = Object.values(Category) as Category[];

const normalizeBudgetCategory = (value: unknown): Category =>
  ALLOWED_CATEGORIES.find((option) => option === value) ?? Category.OTHER;
```

In the `.map((budget) => ({ ... }))` return object, add `category` after the `remaining` line:

```ts
      remaining: Number(budget.remaining ?? 0),
      category: normalizeBudgetCategory(budget.category),
    }));
```

- [ ] **Step 4: Fix the `toEqual` assertions in the fetcher test**

The two existing tests that use full-object `toEqual` (the "filters budget options to the selected date within the fetched week" and "returns all fetched budget options when no target date is provided" tests) now need `category: Category.OTHER` on each expected option (the input omits `category`, so it normalizes to `OTHER`).

In `src/lib/queries/budget-weekly.test.ts`, in the "filters budget options..." test, update the expected array to:

```ts
    expect(options).toEqual([
      {
        id: 2,
        name: "Monthly April",
        icon: "💰",
        color: "lime",
        period: "month",
        periodStartDate: "2026-04-01",
        periodEndDate: "2026-04-30",
        amount: 1500,
        spent: 1700,
        remaining: -200,
        category: Category.OTHER,
      },
      {
        id: 3,
        name: "Week 30/03-05/04",
        icon: "💰",
        color: "lime",
        period: "week",
        periodStartDate: "2026-03-30",
        periodEndDate: "2026-04-05",
        amount: 500,
        spent: 0,
        remaining: 500,
        category: Category.OTHER,
      },
    ]);
```

In the "returns all fetched budget options when no target date is provided" test, update the expected array to:

```ts
    expect(options).toEqual([
      {
        id: 1,
        name: "Monthly March",
        icon: "💰",
        color: "lime",
        period: "month",
        periodStartDate: "2026-03-01",
        periodEndDate: "2026-03-31",
        amount: 800,
        spent: 100,
        remaining: 700,
        category: Category.OTHER,
      },
      {
        id: 2,
        name: "Monthly April",
        icon: "💰",
        color: "lime",
        period: "month",
        periodStartDate: "2026-04-01",
        periodEndDate: "2026-04-30",
        amount: 0,
        spent: 0,
        remaining: 0,
        category: Category.OTHER,
      },
    ]);
```

- [ ] **Step 5: Fix the `BudgetWeeklyOption` fixture builders so the suite compiles**

`src/lib/budget-options.test.ts` — add the `Category` import and `category` to the `opt()` defaults:

Add import:

```ts
import { Category } from "@/enums";
```

Update `opt()`:

```ts
const opt = (over: Partial<BudgetWeeklyOption> = {}): BudgetWeeklyOption => ({
  id: 1,
  name: "Food",
  period: "week",
  periodStartDate: "2026-05-18",
  periodEndDate: "2026-05-24",
  amount: 100,
  spent: 0,
  remaining: 100,
  icon: "💰",
  color: "lime",
  category: Category.OTHER,
  ...over,
});
```

`src/components/QuickExpenseDrawer.test.tsx` — `Category` is already imported (line 2). Add `category` to the `budgetOption()` defaults:

```ts
const budgetOption = (
  override: Partial<BudgetWeeklyOption> = {}
): BudgetWeeklyOption => ({
  id: 1,
  name: "Food week",
  icon: "🍜",
  color: "rose",
  period: "week",
  periodStartDate: "2026-05-17",
  periodEndDate: "2026-05-23",
  amount: 100000,
  spent: 0,
  remaining: 100000,
  category: Category.OTHER,
  ...override,
});
```

`src/components/BudgetPickerSheet.test.tsx` — add the `Category` import and `category` to both literal options in `weeklyBudgetOptionsMock`:

Add import near the top:

```ts
import { Category } from "@/enums";
```

Update the two option literals to include `category` (after `color`):

```ts
      {
        id: 1,
        name: "Food week",
        period: "week",
        periodStartDate: "2026-05-18",
        periodEndDate: "2026-05-24",
        amount: 100,
        spent: 0,
        remaining: 100,
        icon: "🍜",
        color: "rose",
        category: Category.FOOD,
      },
      {
        id: 2,
        name: "Rent month",
        period: "month",
        periodStartDate: "2026-05-01",
        periodEndDate: "2026-05-31",
        amount: 500,
        spent: 200,
        remaining: 300,
        icon: "🏠",
        color: "sky",
        category: Category.HOUSING,
      },
```

> Note: `src/components/QuickExpenseRecoverySheetHost.test.tsx` only imports the `BudgetWeeklyOption` type for a mock signature and resolves `[]` — no literal to fix.

- [ ] **Step 6: Run the affected tests to verify they pass**

Run: `bun run test src/lib/queries/budget-weekly.test.ts src/lib/budget-options.test.ts src/components/BudgetPickerSheet.test.tsx`
Expected: PASS.

- [ ] **Step 7: Format, lint, commit**

```bash
rtk bunx prettier --write src/lib/queries/budget-weekly.ts src/lib/queries/budget-weekly.test.ts src/lib/budget-options.test.ts src/components/QuickExpenseDrawer.test.tsx src/components/BudgetPickerSheet.test.tsx
rtk bunx prettier --check src/lib/queries/budget-weekly.ts src/lib/queries/budget-weekly.test.ts src/lib/budget-options.test.ts src/components/QuickExpenseDrawer.test.tsx src/components/BudgetPickerSheet.test.tsx
rtk bunx eslint src/lib/queries/budget-weekly.ts src/lib/queries/budget-weekly.test.ts src/lib/budget-options.test.ts src/components/QuickExpenseDrawer.test.tsx src/components/BudgetPickerSheet.test.tsx
git add src/lib/queries/budget-weekly.ts src/lib/queries/budget-weekly.test.ts src/lib/budget-options.test.ts src/components/QuickExpenseDrawer.test.tsx src/components/BudgetPickerSheet.test.tsx
git commit -m "feat(budgets): surface budget category on weekly budget options

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Auto-apply category in `QuickExpenseDrawer`

**Files:**
- Modify: `src/components/QuickExpenseDrawer.tsx`
- Test: `src/components/QuickExpenseDrawer.test.tsx`

This covers the AI-suggestion path (`applySuggestedBudget`), the manual chip path (`BudgetChipRow` `onChange`), the user-edit guard (`CategoryChipRow` `onChange`), and the edit-mode skip.

- [ ] **Step 1: Write the failing behavior tests**

First, update the `suggestionBudgets` fixture inside `describe("QuickExpenseDrawer — budget suggestion", ...)` so the two budgets carry distinct categories (Coffee → Entertainment, Transport → Transport):

```ts
  const suggestionBudgets = [
    budgetOption({
      id: 7,
      name: "Coffee",
      icon: "☕",
      color: "amber",
      period: "week",
      periodStartDate: "2026-05-25",
      periodEndDate: "2026-05-31",
      amount: 300000,
      spent: 125000,
      remaining: 175000,
      category: Category.ENTERTAINMENT,
    }),
    budgetOption({
      id: 8,
      name: "Transport",
      icon: "🚕",
      color: "sky",
      period: "month",
      periodStartDate: "2026-05-01",
      periodEndDate: "2026-05-31",
      amount: 800000,
      spent: 250000,
      remaining: 550000,
      category: Category.TRANSPORT,
    }),
  ];
```

Add these tests at the end of the `describe("QuickExpenseDrawer — budget suggestion", ...)` block (they reuse `openDrawerWithBudgets` and `suggestionBudgets` from that block):

```ts
  it("applies the suggested budget's category to the expense", async () => {
    const user = await openDrawerWithBudgets();
    mutationMocks.suggestBudgetMutateAsync.mockResolvedValue({
      status: "success",
      budgetId: 7,
      confidence: "high",
      reason: "Coffee expense",
    });

    const note = screen.getByPlaceholderText(/what did you spend on/i);
    await user.type(note, "coffee with team");
    await user.tab();

    const budgetGroup = screen.getByRole("radiogroup", { name: /^budget$/i });
    expect(
      await within(budgetGroup).findByRole("button", {
        name: /coffee/i,
        pressed: true,
      })
    ).toBeInTheDocument();

    const categoryGroup = screen.getByRole("radiogroup", {
      name: /^category$/i,
    });
    expect(
      within(categoryGroup).getByRole("button", { name: /entertainment/i })
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("applies a manually selected budget's category to the expense", async () => {
    const user = await openDrawerWithBudgets();

    const budgetGroup = screen.getByRole("radiogroup", { name: /^budget$/i });
    await user.click(
      within(budgetGroup).getByRole("button", { name: /no budget/i })
    );
    await user.click(
      await within(budgetGroup).findByRole("button", { name: /coffee/i })
    );

    const categoryGroup = screen.getByRole("radiogroup", {
      name: /^category$/i,
    });
    expect(
      within(categoryGroup).getByRole("button", { name: /entertainment/i })
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("does not overwrite a user-selected category when a budget is applied", async () => {
    const user = await openDrawerWithBudgets();

    const categoryGroup = screen.getByRole("radiogroup", {
      name: /^category$/i,
    });
    await user.click(
      within(categoryGroup).getByRole("button", { name: /food/i })
    );
    await user.click(
      await within(categoryGroup).findByRole("button", { name: /giving/i })
    );

    const budgetGroup = screen.getByRole("radiogroup", { name: /^budget$/i });
    await user.click(
      within(budgetGroup).getByRole("button", { name: /no budget/i })
    );
    await user.click(
      await within(budgetGroup).findByRole("button", { name: /coffee/i })
    );

    expect(
      within(categoryGroup).getByRole("button", { name: /giving/i })
    ).toHaveAttribute("aria-pressed", "true");
  });
```

Add this test at the end of the `describe("QuickExpenseDrawer — edit mode", ...)` block (it reuses `renderEditDrawer` and `editExpense`, whose category is `"Badminton"` and `budgetId` is `2`):

```ts
  it("does not change the category when the budget changes in edit mode", async () => {
    weeklyBudgetOptionsMock.mockResolvedValue([
      budgetOption({ id: 2, name: "Sports week", category: Category.BADMINTON }),
      budgetOption({ id: 7, name: "Coffee", category: Category.ENTERTAINMENT }),
    ]);
    const user = userEvent.setup();
    renderEditDrawer();
    await screen.findByPlaceholderText(/what did you spend on/i);

    const budgetGroup = screen.getByRole("radiogroup", { name: /^budget$/i });
    await user.click(
      within(budgetGroup).getByRole("button", { name: /sports week/i })
    );
    await user.click(
      await within(budgetGroup).findByRole("button", { name: /coffee/i })
    );

    const categoryGroup = screen.getByRole("radiogroup", {
      name: /^category$/i,
    });
    expect(
      within(categoryGroup).getByRole("button", { name: /badminton/i })
    ).toHaveAttribute("aria-pressed", "true");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test src/components/QuickExpenseDrawer.test.tsx`
Expected: the four new tests FAIL — the category radiogroup still shows the default/seeded category, not the budget's category (and edit-mode currently has no category-remap behavior either way; assert it stays Badminton, which it does — but the manual/AI/guard tests fail).

- [ ] **Step 3: Add the user-edit ref, reset, and gate helper**

In `src/components/QuickExpenseDrawer.tsx`, after the existing `suggestionRequestIdRef` declaration (just below `const suggestionRequestIdRef = useRef(0);`), add:

```ts
  const categoryUserEditedRef = useRef(false);
```

Inside `resetSuggestionTracking`, after `setIsSuggestingBudget(false);`, add:

```ts
    categoryUserEditedRef.current = false;
```

Immediately after the `resetSuggestionTracking` function definition (before `handleOpenChange`), add the gate helper:

```ts
  const shouldApplyBudgetCategory = () =>
    !isEditMode && !categoryUserEditedRef.current;
```

- [ ] **Step 4: Write category in `applySuggestedBudget`**

Update the `setDraft` call inside `applySuggestedBudget` to carry `category`:

```ts
    setDraft((prev) => ({
      ...prev,
      budgetId: selected.id,
      budgetName: selected.name ?? null,
      budgetIcon: selected.icon ?? null,
      budgetColor: selected.color ?? null,
      category: shouldApplyBudgetCategory() ? selected.category : prev.category,
    }));
```

- [ ] **Step 5: Write category in the `BudgetChipRow` `onChange`**

Update the `BudgetChipRow` `onChange` handler:

```ts
                  onChange={(id) => {
                    const selected = budgetOptions.find(
                      (budget) => budget.id === id
                    );
                    budgetSelectionSourceRef.current = "manual";
                    setDraft((prev) => ({
                      ...prev,
                      budgetId: id,
                      budgetName: id === null ? null : (selected?.name ?? null),
                      budgetIcon: id === null ? null : (selected?.icon ?? null),
                      budgetColor:
                        id === null ? null : (selected?.color ?? null),
                      category:
                        id !== null && selected && shouldApplyBudgetCategory()
                          ? selected.category
                          : prev.category,
                    }));
                  }}
```

- [ ] **Step 6: Mark category as user-edited in the `CategoryChipRow` `onChange`**

Update the `CategoryChipRow` `onChange` handler:

```ts
                <CategoryChipRow
                  value={draft.category}
                  onChange={(c) => {
                    categoryUserEditedRef.current = true;
                    setField("category", c);
                  }}
                />
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `bun run test src/components/QuickExpenseDrawer.test.tsx`
Expected: PASS (all new and existing tests).

- [ ] **Step 8: Format, lint, commit**

```bash
rtk bunx prettier --write src/components/QuickExpenseDrawer.tsx src/components/QuickExpenseDrawer.test.tsx
rtk bunx prettier --check src/components/QuickExpenseDrawer.tsx src/components/QuickExpenseDrawer.test.tsx
rtk bunx eslint src/components/QuickExpenseDrawer.tsx src/components/QuickExpenseDrawer.test.tsx
git add src/components/QuickExpenseDrawer.tsx src/components/QuickExpenseDrawer.test.tsx
git commit -m "feat(expenses): auto-apply budget category in quick expense drawer

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Auto-apply category in `ManualExpenseForm`

**Files:**
- Modify: `src/components/ManualExpenseForm.tsx`
- Test: `src/components/ManualExpenseForm.quick-mode.test.tsx`

`ManualExpenseForm` is add-only (used by `AIInput`/`AIExpenseChat`), so there is no edit mode — the gate only checks the user-edit flag. The advanced-mode UI renders inline category chips and a `BudgetPickerSheet` for manual budget choice.

- [ ] **Step 1: Write the failing behavior tests**

First, give the shared `budgetSuggestionFixture` distinct categories (Coffee → Entertainment, Transport → Transport). Update both budget objects in `budgetSuggestionFixture` to add `category` (after `remaining`):

```ts
const budgetSuggestionFixture = {
  budgets: [
    {
      id: 7,
      name: "Coffee",
      icon: "☕",
      color: "amber",
      period: "week",
      periodStartDate: dayjs().startOf("week").format("YYYY-MM-DD"),
      periodEndDate: dayjs().endOf("week").format("YYYY-MM-DD"),
      amount: 300000,
      spent: 125000,
      remaining: 175000,
      category: "Entertainment",
    },
    {
      id: 8,
      name: "Transport",
      icon: "🚕",
      color: "sky",
      period: "month",
      periodStartDate: dayjs().startOf("month").format("YYYY-MM-DD"),
      periodEndDate: dayjs().endOf("month").format("YYYY-MM-DD"),
      amount: 800000,
      spent: 250000,
      remaining: 550000,
      category: "Transport",
    },
  ],
};
```

Add a new `describe` block at the end of the file (default `initialMode` is `"advanced"`, which renders the category chips inline and the budget picker button):

```ts
describe("ManualExpenseForm budget category", () => {
  it("applies the suggested budget's category to the expense", async () => {
    const user = userEvent.setup();
    suggestBudgetMutateAsync.mockResolvedValue({
      status: "success",
      budgetId: 7,
      confidence: "high",
      reason: "Coffee expense",
    });

    await renderManualExpenseForm({
      showBudgetSelect: true,
      budgetPayload: budgetSuggestionFixture,
    });

    const noteInput = screen.getByPlaceholderText(
      "Optional note about this expense"
    );
    await user.type(noteInput, "coffee with team");
    await user.tab();

    await waitFor(() => expect(suggestBudgetMutateAsync).toHaveBeenCalled());
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /entertainment/i })
      ).toHaveAttribute("aria-pressed", "true")
    );
  });

  it("applies a manually selected budget's category to the expense", async () => {
    const user = userEvent.setup();

    await renderManualExpenseForm({
      showBudgetSelect: true,
      budgetPayload: budgetSuggestionFixture,
    });

    await user.click(screen.getByRole("button", { name: /budget/i }));
    await user.click(await screen.findByRole("button", { name: /coffee/i }));

    expect(
      screen.getByRole("button", { name: /entertainment/i })
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("does not overwrite a user-selected category when a budget is applied", async () => {
    const user = userEvent.setup();

    await renderManualExpenseForm({
      showBudgetSelect: true,
      budgetPayload: budgetSuggestionFixture,
    });

    await user.click(screen.getByRole("button", { name: /giving/i }));

    await user.click(screen.getByRole("button", { name: /budget/i }));
    await user.click(await screen.findByRole("button", { name: /coffee/i }));

    expect(
      screen.getByRole("button", { name: /giving/i })
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: /entertainment/i })
    ).toHaveAttribute("aria-pressed", "false");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test src/components/ManualExpenseForm.quick-mode.test.tsx`
Expected: the three new tests FAIL — the category chip stays on the default `Food` instead of switching to the budget's category.

- [ ] **Step 3: Add the user-edit ref and gate helper**

In `src/components/ManualExpenseForm.tsx`, after the existing `suggestionRequestIdRef` declaration (just below `const suggestionRequestIdRef = useRef(0);`), add:

```ts
    const categoryUserEditedRef = useRef(false);
```

After the `setBudgetSelectionSource` `useCallback` definition, add the gate helper:

```ts
    const shouldApplyBudgetCategory = useCallback(
      () => !categoryUserEditedRef.current,
      []
    );
```

- [ ] **Step 4: Write category in `handleBudgetChange` and `applySuggestedBudget`**

Update `handleBudgetChange` to set the category when a budget is chosen and the gate allows it:

```ts
    const handleBudgetChange = useCallback(
      (value: number | null) => {
        const selected = budgetOptions.find((budget) => budget.id === value);
        setBudgetId(value);
        setBudgetName(value === null ? null : (selected?.name ?? null));
        setBudgetIcon(value === null ? null : (selected?.icon ?? null));
        setBudgetColor(value === null ? null : (selected?.color ?? null));
        setBudgetSelectionSource("manual");
        if (value !== null && selected && shouldApplyBudgetCategory()) {
          setExpense((prev) => ({ ...prev, category: selected.category }));
        }
      },
      [budgetOptions, setBudgetSelectionSource, shouldApplyBudgetCategory]
    );
```

Update `applySuggestedBudget` the same way:

```ts
    const applySuggestedBudget = useCallback(
      (suggestedBudgetId: number) => {
        const selected = budgetOptions.find(
          (budget) => budget.id === suggestedBudgetId
        );
        if (!selected) {
          return;
        }

        setBudgetId(selected.id);
        setBudgetName(selected.name ?? null);
        setBudgetIcon(selected.icon ?? null);
        setBudgetColor(selected.color ?? null);
        setBudgetSelectionSource("ai");
        if (shouldApplyBudgetCategory()) {
          setExpense((prev) => ({ ...prev, category: selected.category }));
        }
      },
      [budgetOptions, setBudgetSelectionSource, shouldApplyBudgetCategory]
    );
```

- [ ] **Step 5: Mark category as user-edited in the category chip `onClick`**

Update the category chip button `onClick` (inside the `categoryOptions.map(...)` render):

```ts
                    onClick={() => {
                      categoryUserEditedRef.current = true;
                      handleExpenseChange("category", category);
                    }}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `bun run test src/components/ManualExpenseForm.quick-mode.test.tsx`
Expected: PASS (all new and existing tests).

- [ ] **Step 7: Format, lint, commit**

```bash
rtk bunx prettier --write src/components/ManualExpenseForm.tsx src/components/ManualExpenseForm.quick-mode.test.tsx
rtk bunx prettier --check src/components/ManualExpenseForm.tsx src/components/ManualExpenseForm.quick-mode.test.tsx
rtk bunx eslint src/components/ManualExpenseForm.tsx src/components/ManualExpenseForm.quick-mode.test.tsx
git add src/components/ManualExpenseForm.tsx src/components/ManualExpenseForm.quick-mode.test.tsx
git commit -m "feat(expenses): auto-apply budget category in manual expense form

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Full validation before push

**Files:** none (verification only).

- [ ] **Step 1: Run the full affected test set**

Run:
```bash
bun run test src/lib/queries/budget-weekly.test.ts src/lib/budget-options.test.ts src/components/BudgetPickerSheet.test.tsx src/components/QuickExpenseDrawer.test.tsx src/components/ManualExpenseForm.quick-mode.test.tsx src/components/QuickExpenseRecoverySheetHost.test.tsx
```
Expected: PASS.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 3: Push**

```bash
git push -u origin dev-budget-category-mapping
```

---

## Self-Review (performed while authoring)

- **Spec coverage:** (1) surface category → Task 1. (2) apply on AI path → Task 2 Step 4 / Task 3 Step 4. (3) apply on manual path → Task 2 Step 5 / Task 3 Step 4. (4) respect user category edits → `categoryUserEditedRef` set in Task 2 Step 6 / Task 3 Step 5, read by `shouldApplyBudgetCategory`. (5) always apply incl. `Other` → gate has no category-value condition. (6) skip in edit mode → `!isEditMode` in the drawer gate (Task 2 Step 3); `ManualExpenseForm` is add-only.
- **Type consistency:** `BudgetWeeklyOption.category: Category` (Task 1) is the single source consumed by `selected.category` in both components; `normalizeBudgetCategory` and `shouldApplyBudgetCategory` names are used consistently across tasks.
- **Placeholder scan:** every code step shows complete code; no TBD/“handle edge cases”/“similar to” references.
