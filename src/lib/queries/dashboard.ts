import { createQueryKeys } from "@lukemorales/query-key-factory";

export const dashboardQueries = createQueryKeys("dashboard", {
  monthlySummary: (month: string) => [month],
});
