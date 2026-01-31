export type BudgetPeriod = "week" | "month" | "custom";

export type BudgetSummary = {
  totalBudget: number;
  totalSpentAssigned: number;
  unassignedSpent: number;
  totalRemaining: number;
};

export type BudgetListItem = {
  id: number;
  name: string;
  amount: number;
  spent: number;
  remaining: number;
  period: BudgetPeriod;
  periodStartDate: string;
  periodEndDate: string | null;
};

export type BudgetTransaction = {
  id: number;
  date: string;
  note: string;
  amount: number;
  category: string;
  budgetId: number | null;
  budgetName: string | null;
};

export type BudgetReport = {
  weekStartDate: string;
  weekEndDate: string;
  summary: BudgetSummary;
  budgets: BudgetListItem[];
  transactions: BudgetTransaction[];
};

export type BudgetOverviewSummary = {
  totalBudget: number;
  totalSpent: number;
  totalRemaining: number;
  budgetCount: number;
};

export type BudgetOverviewReport = {
  summary: BudgetOverviewSummary;
  budgets: BudgetListItem[];
};

export type BudgetCreateInput = {
  name: string;
  amount: number;
  period: BudgetPeriod;
  periodStartDate: string;
  periodEndDate?: string | null;
};

export type BudgetUpdateInput = {
  name?: string;
  amount?: number;
  period?: BudgetPeriod;
  periodStartDate?: string;
  periodEndDate?: string | null;
};

export type ExpenseBudgetInput = {
  expenseId: number;
  budgetId: number | null;
};

// Legacy aliases for existing imports.
export type WeeklyBudgetSummary = BudgetSummary;
export type WeeklyBudgetListItem = BudgetListItem;
export type WeeklyBudgetTransaction = BudgetTransaction;
export type WeeklyBudgetReport = BudgetReport;
export type WeeklyBudgetCreateInput = BudgetCreateInput;
export type WeeklyBudgetUpdateInput = BudgetUpdateInput;
export type TransactionBudgetInput = ExpenseBudgetInput;
