# iOS Search Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert Home smart search from an inline input into a Home-only iOS-style full-screen search drawer with a small pill above the bottom nav, retained drawer state, and normal unfiltered Home results while closed.

**Architecture:** Keep `ExpenseSearch` as the local owner of search UI state. Reuse the existing `Drawer` primitive, `useKeyboardOffset()`, `SearchInput`, `SearchFilterChips`, `parseSearchRequest()`, and `ExpenseList` filtering props. The drawer renders its own filtered `ExpenseList`; the closed Home view renders a separate unfiltered `ExpenseList`.

**Tech Stack:** Next.js App Router, React 19, TypeScript, TanStack Query, Vaul/shadcn drawer, Tailwind v4, Vitest, React Testing Library.

---

## File Structure

- Modify `src/components/search/filter-chips.ts`: remove `q` from chip creation and chip field ownership.
- Modify `src/components/search/SearchFilterChips.test.tsx`: assert `q` never renders as a chip.
- Modify `src/components/search/SearchInput.tsx`: make the input optionally controlled/ref-forwarded so drawer state can preserve and refocus text.
- Modify `src/components/search/SearchInput.test.tsx`: cover controlled value and ref focus support.
- Modify `src/components/ExpenseList.tsx`: add a small presentation prop for drawer-specific scroll and bottom padding while keeping query/rendering logic shared.
- Modify `src/components/ExpenseList.test.tsx`: cover drawer presentation class without changing data behavior.
- Modify `src/components/search/ExpenseSearch.tsx`: replace inline search UI with closed Home list + fixed search pill + full-screen drawer search mode.
- Modify `src/components/search/ExpenseSearch.test.tsx`: cover open, submit, close, restore, unfiltered Home list, `q` in input only, and chip removal behavior.

## Task 1: Make Filter Chips Structured-Only

**Files:**
- Modify: `src/components/search/filter-chips.ts`
- Modify: `src/components/search/SearchFilterChips.test.tsx`

- [ ] **Step 1: Write failing tests for structured-only chips**

Update `src/components/search/SearchFilterChips.test.tsx` to include this second test:

```tsx
it("does not render raw q text as a filter chip", () => {
  render(
    <SearchFilterChips
      filter={{ q: "coffee", categories: [Category.FOOD] }}
      onRemove={vi.fn()}
    />
  );

  expect(screen.getByText(Category.FOOD)).toBeInTheDocument();
  expect(screen.queryByText(/text:/i)).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /remove text/i })
  ).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused chip tests and verify failure**

Run:

```bash
rtk bun run test src/components/search/SearchFilterChips.test.tsx
```

Expected: FAIL because `buildFilterChips()` still emits a `text: coffee` chip for `q`.

- [ ] **Step 3: Remove `q` from chip fields and chip creation**

Update `src/components/search/filter-chips.ts` so the field union and `buildFilterChips()` no longer include `q`:

```ts
import type { SearchFilter } from "@/lib/ai/search-contract";
import { formatVnd } from "@/lib/utils";

export type FilterChipField =
  | "dateRange"
  | "categories"
  | "budgetIds"
  | "hasBudget"
  | "amountMin"
  | "amountMax";

export type FilterChip = {
  field: FilterChipField;
  label: string;
};

export const buildFilterChips = (filter: SearchFilter): FilterChip[] => {
  const chips: FilterChip[] = [];

  if (filter.dateFrom || filter.dateTo) {
    const from = filter.dateFrom ?? "…";
    const to = filter.dateTo ?? "…";
    chips.push({ field: "dateRange", label: `${from} → ${to}` });
  }
  if (filter.categories && filter.categories.length > 0) {
    chips.push({ field: "categories", label: filter.categories.join(", ") });
  }
  if (filter.budgetIds && filter.budgetIds.length > 0) {
    chips.push({
      field: "budgetIds",
      label: `${filter.budgetIds.length} budget${filter.budgetIds.length > 1 ? "s" : ""}`,
    });
  }
  if (filter.hasBudget === true) {
    chips.push({ field: "hasBudget", label: "Has budget" });
  }
  if (filter.hasBudget === false) {
    chips.push({ field: "hasBudget", label: "No budget" });
  }
  if (filter.amountMin !== undefined) {
    chips.push({
      field: "amountMin",
      label: `≥ ${formatVnd(filter.amountMin)}`,
    });
  }
  if (filter.amountMax !== undefined) {
    chips.push({
      field: "amountMax",
      label: `≤ ${formatVnd(filter.amountMax)}`,
    });
  }
  return chips;
};

export const removeFilterField = (
  filter: SearchFilter,
  field: FilterChipField
): SearchFilter => {
  const next: SearchFilter = { ...filter };
  if (field === "dateRange") {
    delete next.dateFrom;
    delete next.dateTo;
    return next;
  }
  delete next[field];
  return next;
};
```

- [ ] **Step 4: Run chip tests and verify pass**

Run:

```bash
rtk bun run test src/components/search/SearchFilterChips.test.tsx src/components/search/filter-chips.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/components/search/filter-chips.ts src/components/search/SearchFilterChips.test.tsx
rtk git commit -m "fix(search): keep raw query out of filter chips"
```

## Task 2: Make SearchInput Preserve External Drawer State

**Files:**
- Modify: `src/components/search/SearchInput.tsx`
- Modify: `src/components/search/SearchInput.test.tsx`

- [ ] **Step 1: Write failing controlled-input tests**

Update `src/components/search/SearchInput.test.tsx` with these additional tests:

```tsx
it("supports controlled value and onValueChange", () => {
  const onValueChange = vi.fn();
  render(
    <SearchInput
      value="coffee"
      onValueChange={onValueChange}
      onSubmit={vi.fn()}
      isLoading={false}
      disabled={false}
    />
  );

  const input = screen.getByDisplayValue("coffee");
  fireEvent.change(input, { target: { value: "coffee today" } });

  expect(onValueChange).toHaveBeenCalledWith("coffee today");
});

it("forwards a ref to the search input", () => {
  const ref = React.createRef<HTMLInputElement>();
  render(
    <SearchInput
      ref={ref}
      onSubmit={vi.fn()}
      isLoading={false}
      disabled={false}
    />
  );

  expect(ref.current).toBeInstanceOf(HTMLInputElement);
  ref.current?.focus();
  expect(ref.current).toHaveFocus();
});
```

- [ ] **Step 2: Run focused SearchInput tests and verify failure**

Run:

```bash
rtk bun run test src/components/search/SearchInput.test.tsx
```

Expected: FAIL because `SearchInput` does not accept `value`, `onValueChange`, or a forwarded ref yet.

- [ ] **Step 3: Implement optional controlled value and ref forwarding**

Replace `src/components/search/SearchInput.tsx` with:

```tsx
"use client";

import React, {
  type ChangeEvent,
  type FormEvent,
  forwardRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";
import { Loader2, Search } from "lucide-react";

type SearchInputProps = {
  onSubmit: (value: string) => void;
  isLoading: boolean;
  disabled: boolean;
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
};

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      onSubmit,
      isLoading,
      disabled,
      value,
      onValueChange,
      placeholder,
      className,
      inputClassName,
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = useState("");
    const currentValue = value ?? internalValue;

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value;
      if (value === undefined) {
        setInternalValue(nextValue);
      }
      onValueChange?.(nextValue);
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = currentValue.trim();
      if (!trimmed || disabled || isLoading) {
        return;
      }
      onSubmit(trimmed);
    };

    return (
      <form
        onSubmit={handleSubmit}
        className={cn("relative flex items-center", className)}
      >
        <Search className="text-muted-foreground pointer-events-none absolute left-3 h-4 w-4" />
        <input
          ref={ref}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          value={currentValue}
          disabled={disabled}
          onChange={handleChange}
          placeholder={
            placeholder ??
            (disabled ? "Search needs a connection" : "Search expenses…")
          }
          className={cn(
            "bg-card border-border focus:border-primary w-full rounded-2xl border py-2.5 pr-10 pl-9 text-sm transition outline-none disabled:opacity-60",
            inputClassName
          )}
        />
        {isLoading ? (
          <Loader2 className="text-muted-foreground absolute right-3 h-4 w-4 animate-spin" />
        ) : null}
      </form>
    );
  }
);

SearchInput.displayName = "SearchInput";

export default SearchInput;
```

- [ ] **Step 4: Run SearchInput tests and verify pass**

Run:

```bash
rtk bun run test src/components/search/SearchInput.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/components/search/SearchInput.tsx src/components/search/SearchInput.test.tsx
rtk git commit -m "feat(search): allow controlled search input state"
```

## Task 3: Add ExpenseList Drawer Presentation Mode

**Files:**
- Modify: `src/components/ExpenseList.tsx`
- Modify: `src/components/ExpenseList.test.tsx`

- [ ] **Step 1: Write failing presentation test**

Add this test to `src/components/ExpenseList.test.tsx`:

```tsx
it("uses drawer presentation spacing when requested", () => {
  globalThis.React = React;

  const queryClient = buildClient();
  const params = { limit: 30 };
  const payload: InfiniteData<ExpenseListResult, number> = {
    pageParams: [0],
    pages: [buildPage()],
  };

  queryClient.setQueryData(queries.expenses.list(params).queryKey, payload);

  render(
    <QueryClientProvider client={queryClient}>
      <ExpenseList presentation="search-drawer" />
    </QueryClientProvider>
  );

  expect(screen.getByTestId("expense-list-section")).toHaveAttribute(
    "data-presentation",
    "search-drawer"
  );
});
```

- [ ] **Step 2: Run focused ExpenseList test and verify failure**

Run:

```bash
rtk bun run test src/components/ExpenseList.test.tsx -- -t "uses drawer presentation spacing"
```

Expected: FAIL because `presentation` and `data-testid="expense-list-section"` do not exist yet.

- [ ] **Step 3: Add presentation prop without changing query behavior**

In `src/components/ExpenseList.tsx`, update the prop type:

```ts
type ExpenseListProps = {
  selectedMonth?: string;
  searchQuery?: string;
  mode?: "full" | "recent";
  recentDays?: number;
  pageSize?: number;
  dateFrom?: string;
  dateTo?: string;
  categories?: Category[];
  budgetIds?: number[];
  hasBudget?: boolean;
  amountMin?: number;
  amountMax?: number;
  presentation?: "default" | "search-drawer";
};
```

Update the component destructuring:

```ts
const ExpenseList = ({
  selectedMonth,
  searchQuery,
  mode,
  recentDays,
  pageSize = 30,
  dateFrom,
  dateTo,
  categories,
  budgetIds,
  hasBudget,
  amountMin,
  amountMax,
  presentation = "default",
}: ExpenseListProps) => {
```

Update the utility import near the top of the file:

```ts
import { cn, formatVnd } from "@/lib/utils";
```

Update `listContainerClassName`:

```ts
const listContainerClassName = cn(
  "no-scrollbar relative flex grow flex-col gap-6 overflow-y-auto",
  presentation === "search-drawer" && "px-4 pb-36"
);
```

Update the `<m.section>` opening tag:

```tsx
<m.section
  data-testid="expense-list-section"
  data-presentation={presentation}
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.16, ease: "easeOut", delay: 0.14 }}
  className={cn(
    "flex w-full grow flex-col gap-4 overflow-auto",
    presentation === "search-drawer" && "min-h-0 flex-1"
  )}
>
```

- [ ] **Step 4: Run ExpenseList tests and verify pass**

Run:

```bash
rtk bun run test src/components/ExpenseList.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/components/ExpenseList.tsx src/components/ExpenseList.test.tsx
rtk git commit -m "feat(expenses): add search drawer list presentation"
```

## Task 4: Build The Home Search Drawer

**Files:**
- Modify: `src/components/search/ExpenseSearch.tsx`
- Modify: `src/components/search/ExpenseSearch.test.tsx`

- [ ] **Step 1: Replace ExpenseSearch tests with drawer behavior coverage**

Replace `src/components/search/ExpenseSearch.test.tsx` with:

```tsx
import React from "react";

import { Category } from "@/enums";
import { queries } from "@/lib/queries";
import { parseSearchRequest } from "@/lib/queries/parse-search";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ExpenseSearch from "./ExpenseSearch";

vi.mock("@/lib/queries/parse-search", () => ({
  parseSearchRequest: vi.fn().mockResolvedValue({
    status: "success",
    originalInput: "coffee no budget",
    filter: { categories: [Category.FOOD], hasBudget: false },
  }),
}));

const listProps = vi.fn();
vi.mock("@/components/ExpenseList", () => ({
  default: (props: Record<string, unknown>) => {
    listProps(props);
    return (
      <div
        data-testid={
          props.presentation === "search-drawer"
            ? "drawer-expense-list"
            : "home-expense-list"
        }
      />
    );
  },
}));

const renderWithClient = (ui: React.ReactNode) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData(queries.budgets.overview.queryKey, { budgets: [] });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
};

beforeEach(() => {
  listProps.mockClear();
  vi.mocked(parseSearchRequest).mockClear();
});

describe("ExpenseSearch", () => {
  it("renders a home search pill and an unfiltered home list by default", () => {
    renderWithClient(<ExpenseSearch />);

    expect(
      screen.getByRole("button", { name: /open expense search/i })
    ).toBeInTheDocument();
    expect(screen.getByTestId("home-expense-list")).toBeInTheDocument();
    expect(screen.queryByTestId("drawer-expense-list")).not.toBeInTheDocument();
    expect(listProps).toHaveBeenCalledWith(
      expect.not.objectContaining({
        searchQuery: expect.any(String),
      })
    );
  });

  it("opens the drawer, parses a submitted query, and passes filters to the drawer list", async () => {
    renderWithClient(<ExpenseSearch />);

    await userEvent.click(
      screen.getByRole("button", { name: /open expense search/i })
    );

    const input = await screen.findByPlaceholderText(/search expenses/i);
    await waitFor(() => expect(input).toHaveFocus());

    fireEvent.change(input, { target: { value: "coffee no budget" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() =>
      expect(screen.getByText("No budget")).toBeInTheDocument()
    );
    await waitFor(() =>
      expect(listProps).toHaveBeenCalledWith(
        expect.objectContaining({
          presentation: "search-drawer",
          hasBudget: false,
          categories: [Category.FOOD],
        })
      )
    );
    expect(parseSearchRequest).toHaveBeenCalledTimes(1);
  });

  it("keeps q in the input instead of rendering a raw text chip", async () => {
    vi.mocked(parseSearchRequest).mockResolvedValueOnce({
      status: "fallback",
      originalInput: "coffee",
      reason: "request_failed",
      prefill: { q: "coffee" },
    });

    renderWithClient(<ExpenseSearch />);

    await userEvent.click(
      screen.getByRole("button", { name: /open expense search/i })
    );
    const input = await screen.findByPlaceholderText(/search expenses/i);
    fireEvent.change(input, { target: { value: "coffee" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() =>
      expect(listProps).toHaveBeenCalledWith(
        expect.objectContaining({
          presentation: "search-drawer",
          searchQuery: "coffee",
        })
      )
    );
    expect(screen.getByDisplayValue("coffee")).toBeInTheDocument();
    expect(screen.queryByText(/text:/i)).not.toBeInTheDocument();
  });

  it("closes to the normal Home list but restores drawer state on reopen", async () => {
    renderWithClient(<ExpenseSearch />);

    await userEvent.click(
      screen.getByRole("button", { name: /open expense search/i })
    );
    const input = await screen.findByPlaceholderText(/search expenses/i);
    fireEvent.change(input, { target: { value: "coffee no budget" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() =>
      expect(screen.getByText("No budget")).toBeInTheDocument()
    );

    await userEvent.click(screen.getByRole("button", { name: /close search/i }));
    expect(screen.queryByTestId("drawer-expense-list")).not.toBeInTheDocument();
    expect(screen.getByTestId("home-expense-list")).toBeInTheDocument();

    const latestHomeListCall = [...listProps.mock.calls]
      .reverse()
      .find(([props]) => props.presentation !== "search-drawer")?.[0];
    expect(latestHomeListCall).toEqual(
      expect.not.objectContaining({
        hasBudget: false,
        categories: [Category.FOOD],
      })
    );

    await userEvent.click(
      screen.getByRole("button", { name: /open expense search/i })
    );

    expect(screen.getByDisplayValue("coffee no budget")).toBeInTheDocument();
    expect(screen.getByText("No budget")).toBeInTheDocument();
    expect(screen.getByTestId("drawer-expense-list")).toBeInTheDocument();
  });

  it("removes structured chips without another AI parse", async () => {
    renderWithClient(<ExpenseSearch />);

    await userEvent.click(
      screen.getByRole("button", { name: /open expense search/i })
    );
    const input = await screen.findByPlaceholderText(/search expenses/i);
    fireEvent.change(input, { target: { value: "coffee no budget" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() =>
      expect(screen.getByText("No budget")).toBeInTheDocument()
    );
    await userEvent.click(
      screen.getByRole("button", { name: /remove No budget/i })
    );

    expect(parseSearchRequest).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(listProps).toHaveBeenCalledWith(
        expect.objectContaining({
          presentation: "search-drawer",
          hasBudget: undefined,
        })
      )
    );
  });
});
```

- [ ] **Step 2: Run ExpenseSearch tests and verify failure**

Run:

```bash
rtk bun run test src/components/search/ExpenseSearch.test.tsx
```

Expected: FAIL because `ExpenseSearch` still renders the inline search layout.

- [ ] **Step 3: Implement drawer search mode**

Replace `src/components/search/ExpenseSearch.tsx` with:

```tsx
"use client";

import React, { useEffect, useRef, useState } from "react";

import dayjs from "@/configs/date";
import { useKeyboardOffset } from "@/hooks/useKeyboardOffset";
import { useOnlineStatus } from "@/hooks/use-online-status";
import type { SearchBudget, SearchFilter } from "@/lib/ai/search-contract";
import { queries } from "@/lib/queries";
import { parseSearchRequest } from "@/lib/queries/parse-search";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";

import ExpenseList from "@/components/ExpenseList";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

import SearchFilterChips from "./SearchFilterChips";
import SearchInput from "./SearchInput";
import type { FilterChipField } from "./filter-chips";
import { removeFilterField } from "./filter-chips";

const EMPTY_FILTER: SearchFilter = {};

const ExpenseSearch = () => {
  const online = useOnlineStatus();
  const keyboardOffset = useKeyboardOffset();
  const inputRef = useRef<HTMLInputElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [filter, setFilter] = useState<SearchFilter>(EMPTY_FILTER);

  const budgetsQuery = useQuery(queries.budgets.overview);
  const budgets: SearchBudget[] = (budgetsQuery.data?.budgets ?? []).map(
    (budget) => ({
      id: budget.id,
      name: budget.name,
      category: budget.category,
    })
  );

  const parseMutation = useMutation({
    mutationFn: (input: string) =>
      parseSearchRequest({
        input,
        todayMonth: dayjs().format("YYYY-MM"),
        budgets,
      }),
    onSuccess: (response, submittedInput) => {
      setInputValue(submittedInput);
      setFilter(
        response.status === "success"
          ? response.filter
          : { q: response.prefill.q ?? submittedInput }
      );
      requestAnimationFrame(() => {
        inputRef.current?.focus({ preventScroll: true });
      });
    },
  });

  useEffect(() => {
    if (!drawerOpen) {
      return;
    }
    requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
    });
  }, [drawerOpen]);

  const handleRemove = (field: FilterChipField) => {
    setFilter((current) => removeFilterField(current, field));
  };

  const handleSubmit = (value: string) => {
    parseMutation.mutate(value);
  };

  const closeSearch = () => {
    setDrawerOpen(false);
  };

  return (
    <>
      <ExpenseList />

      <button
        type="button"
        aria-label="Open expense search"
        onClick={() => setDrawerOpen(true)}
        className="ds-glass glass-border fixed right-1/2 bottom-[6.25rem] z-40 inline-flex h-10 translate-x-1/2 items-center gap-2 rounded-full px-4 text-sm font-medium text-foreground shadow-[0_16px_42px_color-mix(in_srgb,#000000_48%,transparent)] backdrop-blur-2xl transition-transform active:scale-[0.97]"
      >
        <Search className="size-4 text-primary" />
        <span>Search</span>
      </button>

      <Drawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        modal
        direction="bottom"
        repositionInputs={false}
        autoFocus={false}
      >
        {drawerOpen ? (
          <DrawerContent
            hideIndicator
            className="h-dvh w-full gap-0 rounded-none p-0 data-[vaul-drawer-direction=bottom]:mt-0 data-[vaul-drawer-direction=bottom]:max-h-none"
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              inputRef.current?.focus({ preventScroll: true });
            }}
          >
            <DrawerHeader className="sr-only">
              <DrawerTitle>Search expenses</DrawerTitle>
              <DrawerDescription>
                Search and filter expenses with natural language.
              </DrawerDescription>
            </DrawerHeader>

            <div className="flex min-h-0 flex-1 flex-col pt-6">
              <ExpenseList
                presentation="search-drawer"
                dateFrom={filter.dateFrom}
                dateTo={filter.dateTo}
                categories={filter.categories}
                budgetIds={filter.budgetIds}
                hasBudget={filter.hasBudget}
                amountMin={filter.amountMin}
                amountMax={filter.amountMax}
                searchQuery={filter.q}
              />
            </div>

            <div
              className="fixed inset-x-0 z-60 mx-auto flex w-full max-w-md flex-col gap-2 px-4 pb-2"
              style={{
                bottom: `calc(${keyboardOffset}px + 8px)`,
              }}
            >
              <SearchFilterChips
                filter={filter}
                onRemove={handleRemove}
                className="no-scrollbar max-h-20 overflow-y-auto"
              />
              <div className="flex items-center gap-2">
                <SearchInput
                  ref={inputRef}
                  value={inputValue}
                  onValueChange={setInputValue}
                  onSubmit={handleSubmit}
                  isLoading={parseMutation.isPending}
                  disabled={!online}
                  className="min-w-0 flex-1"
                  inputClassName="h-12 rounded-full bg-[color-mix(in_srgb,var(--surface-3)_86%,transparent)]"
                />
                <button
                  type="button"
                  aria-label="Close search"
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={closeSearch}
                  className={cn(
                    "grid size-12 shrink-0 place-items-center rounded-full",
                    "bg-[linear-gradient(180deg,color-mix(in_srgb,#ffffff_9%,transparent),color-mix(in_srgb,#ffffff_2%,transparent)),color-mix(in_srgb,var(--surface-3)_78%,transparent)]",
                    "shadow-[inset_0_1px_0_color-mix(in_srgb,#ffffff_20%,transparent),0_16px_34px_color-mix(in_srgb,#000000_45%,transparent)]",
                    "transition-transform active:scale-[0.96]"
                  )}
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>
          </DrawerContent>
        ) : null}
      </Drawer>
    </>
  );
};

export default ExpenseSearch;
```

- [ ] **Step 4: Run ExpenseSearch tests and verify pass**

Run:

```bash
rtk bun run test src/components/search/ExpenseSearch.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/components/search/ExpenseSearch.tsx src/components/search/ExpenseSearch.test.tsx
rtk git commit -m "feat(search): move home search into full screen drawer"
```

## Task 5: Full Search Scope Verification And Formatting

**Files:**
- Check: all modified `.ts` and `.tsx` files from Tasks 1-4

- [ ] **Step 1: Run all search and list tests touched by the feature**

Run:

```bash
rtk bun run test src/components/search/SearchInput.test.tsx src/components/search/SearchFilterChips.test.tsx src/components/search/filter-chips.test.ts src/components/search/ExpenseSearch.test.tsx src/components/ExpenseList.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Format modified TypeScript and TSX files**

Run:

```bash
rtk bunx prettier --write src/components/search/filter-chips.ts src/components/search/SearchFilterChips.test.tsx src/components/search/SearchInput.tsx src/components/search/SearchInput.test.tsx src/components/ExpenseList.tsx src/components/ExpenseList.test.tsx src/components/search/ExpenseSearch.tsx src/components/search/ExpenseSearch.test.tsx
```

Expected: files are formatted.

- [ ] **Step 3: Check formatting**

Run:

```bash
rtk bunx prettier --check src/components/search/filter-chips.ts src/components/search/SearchFilterChips.test.tsx src/components/search/SearchInput.tsx src/components/search/SearchInput.test.tsx src/components/ExpenseList.tsx src/components/ExpenseList.test.tsx src/components/search/ExpenseSearch.tsx src/components/search/ExpenseSearch.test.tsx
```

Expected: PASS with all files matching Prettier.

- [ ] **Step 4: Run ESLint on modified files**

Run:

```bash
rtk bunx eslint src/components/search/filter-chips.ts src/components/search/SearchFilterChips.test.tsx src/components/search/SearchInput.tsx src/components/search/SearchInput.test.tsx src/components/ExpenseList.tsx src/components/ExpenseList.test.tsx src/components/search/ExpenseSearch.tsx src/components/search/ExpenseSearch.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Optional local mobile verification**

Run:

```bash
rtk bun run dev
```

Expected: Next dev server starts. On iPhone 13/14 viewport, Home shows the small search pill above bottom nav, tapping it opens the full-screen drawer, input focuses above keyboard, close button sits to the input's right, closing returns Home to the normal list, reopening restores the latest drawer search.

- [ ] **Step 6: Commit verification fixes if formatting or lint changed files**

```bash
rtk git add src/components/search/filter-chips.ts src/components/search/SearchFilterChips.test.tsx src/components/search/SearchInput.tsx src/components/search/SearchInput.test.tsx src/components/ExpenseList.tsx src/components/ExpenseList.test.tsx src/components/search/ExpenseSearch.tsx src/components/search/ExpenseSearch.test.tsx
rtk git commit -m "chore(search): format ios search drawer changes"
```
