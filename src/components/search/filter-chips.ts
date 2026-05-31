import type { SearchFilter } from "@/lib/ai/search-contract";
import { formatVnd } from "@/lib/utils";

export type FilterChipField =
  | "dateRange"
  | "categories"
  | "budgetIds"
  | "hasBudget"
  | "amountMin"
  | "amountMax"
  | "q";

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
  if (filter.q) {
    chips.push({ field: "q", label: `text: ${filter.q}` });
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
