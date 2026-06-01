"use client";

import React, { useEffect, useRef, useState } from "react";

import dayjs from "@/configs/date";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useKeyboardOffset } from "@/hooks/useKeyboardOffset";
import type { SearchBudget, SearchFilter } from "@/lib/ai/search-contract";
import { queries } from "@/lib/queries";
import { parseSearchRequest } from "@/lib/queries/parse-search";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

import ExpenseList from "@/components/ExpenseList";

import ProgressiveBlur from "../ProgressiveBlur";
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
        todayDate: dayjs().format("YYYY-MM-DD"),
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

  const handleClearSearch = () => {
    setInputValue("");
    setFilter(EMPTY_FILTER);
    requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
    });
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
        className="ds-glass glass-border text-foreground fixed bottom-22 left-1/2 z-40 inline-flex h-8 -translate-x-1/2 items-center gap-2 rounded-full px-3 text-xs font-medium transition-transform active:scale-[0.97]"
      >
        <Search className="size-3.5" />
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
            overlayClassName="quick-expense-drawer-overlay"
            className="quick-expense-drawer-morph h-dvh w-full gap-0 rounded-none! p-0 data-[vaul-drawer-direction=bottom]:mt-0 data-[vaul-drawer-direction=bottom]:max-h-none"
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
              className="fixed inset-x-0 isolate z-60 mx-auto flex w-full max-w-md flex-col gap-2 px-4 pb-2"
              style={{
                bottom: `calc(${keyboardOffset}px)`,
              }}
            >
              <ProgressiveBlur
                className="absolute right-0 bottom-0 left-0"
                position="bottom"
                height="120px"
              />
              <SearchFilterChips
                filter={filter}
                onRemove={handleRemove}
                className="no-scrollbar relative max-h-20 overflow-y-auto"
              />
              <div className="relative flex items-center gap-2">
                <SearchInput
                  ref={inputRef}
                  aria-label="Search expenses"
                  value={inputValue}
                  onValueChange={setInputValue}
                  onClear={handleClearSearch}
                  onSubmit={handleSubmit}
                  isLoading={parseMutation.isPending}
                  disabled={!online}
                  className="min-w-0 flex-1"
                />
                <button
                  type="button"
                  aria-label="Close search"
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={closeSearch}
                  className={cn(
                    "bg-surface-3 glass-border grid size-12 shrink-0 place-items-center rounded-full",
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
