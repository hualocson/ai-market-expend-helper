import { mergeQueryKeys } from "@lukemorales/query-key-factory";

import { budgetWeeklyQueries } from "./budget-weekly";
import { budgetQueries } from "./budgets";
import { dashboardQueries } from "./dashboard";
import { expenseQueries } from "./expenses";
import { reportQueries } from "./reports";

export const queries = mergeQueryKeys(
  budgetQueries,
  budgetWeeklyQueries,
  dashboardQueries,
  expenseQueries,
  reportQueries
);
