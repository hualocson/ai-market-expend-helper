import { createQueryKeys } from "@lukemorales/query-key-factory";

export const reportQueries = createQueryKeys("reports", {
  monthly: (month: string) => [month],
  daily: (date: string) => [date],
});
