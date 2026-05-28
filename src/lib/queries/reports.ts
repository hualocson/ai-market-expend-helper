import type { DailyReport, MonthlyReport } from "@/lib/services/reports";
import { createQueryKeys } from "@lukemorales/query-key-factory";

import { fetchJson } from "./http";

export const fetchMonthlyReport = async (
  month?: string
): Promise<MonthlyReport> => {
  const query = new URLSearchParams();
  if (month !== undefined) {
    query.set("month", month);
  }

  const queryString = query.toString();
  return fetchJson<MonthlyReport>(
    `/api/reports/monthly${queryString ? `?${queryString}` : ""}`,
    {
      method: "GET",
      cache: "no-store",
    }
  );
};

export const fetchDailyReport = async (date: string): Promise<DailyReport> => {
  const query = new URLSearchParams({ date });

  return fetchJson<DailyReport>(`/api/reports/daily?${query}`, {
    method: "GET",
    cache: "no-store",
  });
};

export const reportQueries = createQueryKeys("reports", {
  monthly: (month?: string) => ({
    queryKey: [month ?? null],
    queryFn: () => fetchMonthlyReport(month),
  }),
  daily: (date: string) => ({
    queryKey: [date],
    queryFn: () => fetchDailyReport(date),
  }),
});
