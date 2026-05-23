import { createQueryKeys } from "@lukemorales/query-key-factory";

export type ExpenseListQueryParams = {
  month?: string;
  q?: string;
  mode?: "full" | "recent";
  recentDays?: number;
};

export const expenseQueries = createQueryKeys("expenses", {
  list: ({ month, q, mode, recentDays }: ExpenseListQueryParams = {}) => ({
    queryKey: [
      {
        month: month ?? null,
        q: q ?? null,
        mode: mode ?? null,
        recentDays: recentDays ?? null,
      },
    ],
  }),
  prefills: null,
});
