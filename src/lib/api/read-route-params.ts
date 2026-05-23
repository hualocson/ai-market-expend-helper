import dayjs from "@/configs/date";
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

  return {
    value: {
      month: month.value,
      q: searchParams.get("q") ?? undefined,
      mode,
      recentDays,
    },
  };
};
