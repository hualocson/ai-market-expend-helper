import dayjs from "@/configs/date";
import { Category } from "@/enums";
import { parsePaginationParams } from "@/lib/api/route-schemas";
import type { ExpenseListQueryParams } from "@/lib/queries/expenses";

type ParamResult<T> =
  | {
      error: string;
    }
  | {
      value: T;
    };

const parseOptionalDateParam = (
  searchParams: URLSearchParams,
  name: string,
  format: string,
  error: string
): ParamResult<string | undefined> => {
  const value = searchParams.get(name);

  if (!value) {
    return { value: undefined };
  }

  if (!dayjs(value, format, true).isValid()) {
    return { error };
  }

  return { value };
};

export const parseOptionalMonthParam = (
  searchParams: URLSearchParams,
  name = "month"
) => parseOptionalDateParam(searchParams, name, "YYYY-MM", "Invalid month");

export const parseRequiredDateParam = (
  searchParams: URLSearchParams,
  name = "date"
): ParamResult<string> => {
  const parsed = parseOptionalDateParam(
    searchParams,
    name,
    "YYYY-MM-DD",
    "Invalid date"
  );

  if ("error" in parsed) {
    return parsed;
  }

  if (!parsed.value) {
    return { error: "Invalid date" };
  }

  return { value: parsed.value };
};

const CATEGORY_VALUES = new Set<string>(Object.values(Category));

const parseCategoriesParam = (
  searchParams: URLSearchParams
): ParamResult<Category[] | undefined> => {
  const raw = searchParams.get("categories");
  if (!raw) {
    return { value: undefined };
  }
  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  for (const part of parts) {
    if (!CATEGORY_VALUES.has(part)) {
      return { error: "Invalid category" };
    }
  }
  return { value: parts.length ? (parts as Category[]) : undefined };
};

const parseIntListParam = (
  searchParams: URLSearchParams,
  name: string,
  error: string
): ParamResult<number[] | undefined> => {
  const raw = searchParams.get(name);
  if (!raw) {
    return { value: undefined };
  }
  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const numbers: number[] = [];
  for (const part of parts) {
    const value = Number(part);
    if (!Number.isInteger(value) || value <= 0) {
      return { error };
    }
    numbers.push(value);
  }
  return { value: numbers.length ? numbers : undefined };
};

const parseOptionalAmountParam = (
  searchParams: URLSearchParams,
  name: string,
  error: string
): ParamResult<number | undefined> => {
  const raw = searchParams.get(name);
  if (!raw) {
    return { value: undefined };
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    return { error };
  }
  return { value };
};

const parseOptionalBooleanParam = (
  searchParams: URLSearchParams,
  name: string,
  error: string
): ParamResult<boolean | undefined> => {
  const raw = searchParams.get(name);
  if (raw === null) {
    return { value: undefined };
  }
  if (raw === "true") {
    return { value: true };
  }
  if (raw === "false") {
    return { value: false };
  }
  return { error };
};

export const parseExpenseListParams = (
  searchParams: URLSearchParams
): ParamResult<ExpenseListQueryParams> => {
  const month = parseOptionalMonthParam(searchParams);
  if ("error" in month) {
    return month;
  }

  const rawMode = searchParams.get("mode");
  if (rawMode && rawMode !== "full" && rawMode !== "recent") {
    return { error: "Invalid mode" };
  }
  const mode = rawMode === "full" || rawMode === "recent" ? rawMode : undefined;

  const rawRecentDays = searchParams.get("recentDays");
  let recentDays: number | undefined;
  if (rawRecentDays) {
    recentDays = Number(rawRecentDays);
    if (!Number.isInteger(recentDays) || recentDays <= 0) {
      return { error: "Invalid recentDays" };
    }
  }

  const pagination = parsePaginationParams(searchParams, {
    defaultLimit: 30,
    maxLimit: 100,
  });
  if ("error" in pagination) {
    return pagination;
  }

  const dateFrom = parseOptionalDateParam(
    searchParams,
    "dateFrom",
    "YYYY-MM-DD",
    "Invalid dateFrom"
  );
  if ("error" in dateFrom) {
    return dateFrom;
  }
  const dateTo = parseOptionalDateParam(
    searchParams,
    "dateTo",
    "YYYY-MM-DD",
    "Invalid dateTo"
  );
  if ("error" in dateTo) {
    return dateTo;
  }
  const categories = parseCategoriesParam(searchParams);
  if ("error" in categories) {
    return categories;
  }
  const budgetIds = parseIntListParam(
    searchParams,
    "budgetIds",
    "Invalid budgetIds"
  );
  if ("error" in budgetIds) {
    return budgetIds;
  }
  const hasBudget = parseOptionalBooleanParam(
    searchParams,
    "hasBudget",
    "Invalid hasBudget"
  );
  if ("error" in hasBudget) {
    return hasBudget;
  }
  const amountMin = parseOptionalAmountParam(
    searchParams,
    "amountMin",
    "Invalid amountMin"
  );
  if ("error" in amountMin) {
    return amountMin;
  }
  const amountMax = parseOptionalAmountParam(
    searchParams,
    "amountMax",
    "Invalid amountMax"
  );
  if ("error" in amountMax) {
    return amountMax;
  }

  return {
    value: {
      month: month.value,
      q: searchParams.get("q") ?? undefined,
      mode,
      recentDays,
      limit: pagination.value.limit,
      offset: pagination.value.offset,
      dateFrom: dateFrom.value,
      dateTo: dateTo.value,
      categories: categories.value,
      budgetIds: budgetIds.value,
      hasBudget: hasBudget.value,
      amountMin: amountMin.value,
      amountMax: amountMax.value,
    },
  };
};
