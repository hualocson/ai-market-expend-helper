"use client";

import React, { useState } from "react";

import dayjs from "@/configs/date";
import { useOnlineStatus } from "@/hooks/use-online-status";
import type { SearchBudget, SearchFilter } from "@/lib/ai/search-contract";
import { queries } from "@/lib/queries";
import { parseSearchRequest } from "@/lib/queries/parse-search";
import { useMutation, useQuery } from "@tanstack/react-query";

import ExpenseList from "@/components/ExpenseList";

import SearchFilterChips from "./SearchFilterChips";
import SearchInput from "./SearchInput";
import type { FilterChipField } from "./filter-chips";
import { removeFilterField } from "./filter-chips";

const EMPTY_FILTER: SearchFilter = {};

const ExpenseSearch = () => {
  const online = useOnlineStatus();
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
    onSuccess: (response) => {
      setFilter(
        response.status === "success"
          ? response.filter
          : { q: response.prefill.q }
      );
    },
  });

  const handleRemove = (field: FilterChipField) => {
    setFilter((current) => removeFilterField(current, field));
  };

  return (
    <div className="flex flex-col gap-3">
      <SearchInput
        onSubmit={(value) => parseMutation.mutate(value)}
        isLoading={parseMutation.isPending}
        disabled={!online}
      />
      <SearchFilterChips filter={filter} onRemove={handleRemove} />
      <ExpenseList
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
  );
};

export default ExpenseSearch;
