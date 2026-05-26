import type { BudgetColorId } from "@/lib/budget-appearance";
import type { SyncOperation, SyncRecord } from "@/lib/sync/core/types";

export type ExpensePayload = {
  date: string;
  amount: number;
  note: string;
  category: string;
  paidBy: string;
  budgetId: number | null;
  budgetName: string | null;
  budgetIcon?: string | null;
  budgetColor?: BudgetColorId | null;
};

export type LocalExpense = Omit<
  SyncRecord<ExpensePayload>,
  "entity" | "payload"
> & {
  entity: "expenses";
} & ExpensePayload;

export type ExpenseOutboxOperation = SyncOperation<LocalExpense> & {
  entity: "expenses";
};

export const EXPENSE_SYNC_ENTITY = "expenses" as const;
