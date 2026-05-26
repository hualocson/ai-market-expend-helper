import type { PaidBy } from "@/enums";
import type { BudgetColorId } from "@/lib/budget-appearance";

import type { TExpense } from "./schema";

export type CreateExpenseInput = Pick<
  TExpense,
  "date" | "amount" | "category"
> & {
  clientId?: string | null;
  note?: string;
  paidBy: PaidBy;
  budgetId?: number | null;
  budgetName?: string | null;
  budgetIcon?: string | null;
  budgetColor?: BudgetColorId | null;
};
