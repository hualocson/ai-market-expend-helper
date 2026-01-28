export type CreateExpenseInput = TExpense & {
  paidBy: PaidBy;
  budgetId?: number | null;
};
