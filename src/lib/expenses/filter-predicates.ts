import type { ExpenseListQueryParams } from "./list-model";

type FilterableRow = {
  date: string;
  amount: number;
  category: string;
  budgetId: number | null;
};

type ExpenseFilterFields = Pick<
  ExpenseListQueryParams,
  | "dateFrom"
  | "dateTo"
  | "categories"
  | "budgetIds"
  | "hasBudget"
  | "amountMin"
  | "amountMax"
>;

const matchesBudget = (
  budgetId: number | null,
  params: ExpenseFilterFields
) => {
  if (params.budgetIds && params.budgetIds.length > 0) {
    return budgetId !== null && params.budgetIds.includes(budgetId);
  }
  if (params.hasBudget === true) {
    return budgetId !== null;
  }
  if (params.hasBudget === false) {
    return budgetId === null;
  }
  return true;
};

export const expenseRowMatchesFilters = (
  row: FilterableRow,
  params: ExpenseFilterFields
): boolean => {
  if (params.dateFrom && row.date < params.dateFrom) {
    return false;
  }
  if (params.dateTo && row.date > params.dateTo) {
    return false;
  }
  if (
    params.categories &&
    params.categories.length > 0 &&
    !params.categories.some((category) => category === row.category)
  ) {
    return false;
  }
  if (!matchesBudget(row.budgetId, params)) {
    return false;
  }
  if (params.amountMin !== undefined && row.amount < params.amountMin) {
    return false;
  }
  if (params.amountMax !== undefined && row.amount > params.amountMax) {
    return false;
  }
  return true;
};
