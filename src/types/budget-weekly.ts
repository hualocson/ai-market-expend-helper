export type WeeklyBudgetSummary = {
  totalBudget: number;
  totalSpentAssigned: number;
  unassignedSpent: number;
  totalRemaining: number;
};

export type WeeklyBudgetListItem = {
  id: number;
  name: string;
  amount: number;
  spent: number;
  remaining: number;
};

export type WeeklyBudgetTransaction = {
  id: number;
  date: string;
  note: string;
  amount: number;
  category: string;
  budgetId: number | null;
  budgetName: string | null;
};

export type WeeklyBudgetReport = {
  weekStartDate: string;
  weekEndDate: string;
  summary: WeeklyBudgetSummary;
  budgets: WeeklyBudgetListItem[];
  transactions: WeeklyBudgetTransaction[];
};

export type WeeklyBudgetCreateInput = {
  weekStartDate: string;
  name: string;
  amount: number;
};

export type WeeklyBudgetUpdateInput = {
  name?: string;
  amount?: number;
};

export type TransactionBudgetInput = {
  transactionId: number;
  budgetId: number | null;
  weekStartDate: string;
};
