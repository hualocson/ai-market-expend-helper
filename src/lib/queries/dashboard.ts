import type { DashboardMonthlySummary } from "@/lib/services/dashboard";
import { createQueryKeys } from "@lukemorales/query-key-factory";

import { fetchJson } from "./http";

export const fetchDashboardMonthlySummary = async (
  month?: string
): Promise<DashboardMonthlySummary> => {
  const query = new URLSearchParams();
  if (month !== undefined) {
    query.set("month", month);
  }

  const queryString = query.toString();
  return fetchJson<DashboardMonthlySummary>(
    `/api/dashboard/monthly-summary${queryString ? `?${queryString}` : ""}`,
    {
      method: "GET",
      cache: "no-store",
    }
  );
};

export const dashboardQueries = createQueryKeys("dashboard", {
  monthlySummary: (month?: string) => ({
    queryKey: [month],
    queryFn: () => fetchDashboardMonthlySummary(month),
  }),
});
