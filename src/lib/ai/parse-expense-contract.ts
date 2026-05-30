import { Category } from "@/enums";
import { z } from "zod";

export const PARSE_EXPENSE_INPUT_MAX_LENGTH = 500;
export const PARSE_EXPENSE_MAX_BUDGETS = 100;
export const PARSE_EXPENSE_BUDGET_NAME_MAX_LENGTH = 120;
export const PARSE_EXPENSE_MIN_AMOUNT = 1000;

export const parseExpenseBudgetSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1).max(PARSE_EXPENSE_BUDGET_NAME_MAX_LENGTH),
  category: z.nativeEnum(Category),
});

export const parseExpenseRequestSchema = z.object({
  input: z.string().trim().min(1).max(PARSE_EXPENSE_INPUT_MAX_LENGTH),
  budgets: z
    .array(parseExpenseBudgetSchema)
    .max(PARSE_EXPENSE_MAX_BUDGETS)
    .default([]),
});

export type ParseExpenseBudget = z.infer<typeof parseExpenseBudgetSchema>;
export type ParseExpenseRequest = z.infer<typeof parseExpenseRequestSchema>;

export type ParseExpenseConfidence = "high" | "medium" | "low";

export type ParseExpenseSuccessResponse = {
  status: "success";
  originalInput: string;
  expense: {
    date: string;
    amount: number;
    note: string;
    budgetId: number | null;
    confidence: ParseExpenseConfidence;
    reason: string;
  };
};

export type ParseExpenseFallbackResponse = {
  status: "fallback";
  originalInput: string;
  prefill: {
    note?: string;
    amount?: number;
    date?: string;
    budgetId?: number | null;
  };
  reason:
    | "invalid_json"
    | "schema_mismatch"
    | "empty_response"
    | "request_failed"
    | "no_budget_match";
};

export type ParseExpenseResponse =
  | ParseExpenseSuccessResponse
  | ParseExpenseFallbackResponse;
