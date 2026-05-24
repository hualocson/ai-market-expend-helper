import type { ExpenseListResult } from "@/lib/services/expenses";
import { createQueryKeys } from "@lukemorales/query-key-factory";

import { fetchJson } from "./http";

export type ExpenseListQueryParams = {
  month?: string;
  q?: string;
  mode?: "full" | "recent";
  recentDays?: number;
};

export const fetchExpenseList = async ({
  month,
  q,
  mode,
  recentDays,
}: ExpenseListQueryParams = {}): Promise<ExpenseListResult> => {
  const query = new URLSearchParams();

  if (month !== undefined) {
    query.set("month", month);
  }
  if (q !== undefined) {
    query.set("q", q);
  }
  if (mode !== undefined) {
    query.set("mode", mode);
  }
  if (recentDays !== undefined) {
    query.set("recentDays", String(recentDays));
  }

  const queryString = query.toString();
  return fetchJson<ExpenseListResult>(
    `/api/expenses${queryString ? `?${queryString}` : ""}`,
    {
      method: "GET",
      cache: "no-store",
    }
  );
};

export const expenseQueries = createQueryKeys("expenses", {
  list: (params: ExpenseListQueryParams = {}) => ({
    queryKey: [
      {
        month: params.month ?? null,
        q: params.q ?? null,
        mode: params.mode ?? null,
        recentDays: params.recentDays ?? null,
      },
    ],
    queryFn: () => fetchExpenseList(params),
  }),
});
