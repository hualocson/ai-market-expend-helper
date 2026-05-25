import type { PaidBy } from "@/enums";

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
};
