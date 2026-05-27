import { z } from "zod";

export const SUGGEST_BUDGET_NOTE_MAX_LENGTH = 500;
export const SUGGEST_BUDGET_MAX_BUDGETS = 100;
export const SUGGEST_BUDGET_CANDIDATE_NAME_MAX_LENGTH = 120;
export const SUGGEST_BUDGET_DATE_MAX_LENGTH = 40;

export const suggestBudgetCandidateSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1).max(SUGGEST_BUDGET_CANDIDATE_NAME_MAX_LENGTH),
  amount: z.number().finite(),
  spent: z.number().finite(),
  remaining: z.number().finite(),
  period: z.enum(["week", "month", "custom"]),
  periodStartDate: z.string().max(SUGGEST_BUDGET_DATE_MAX_LENGTH).optional(),
  periodEndDate: z
    .string()
    .max(SUGGEST_BUDGET_DATE_MAX_LENGTH)
    .nullable()
    .optional(),
});

export const suggestBudgetRequestSchema = z.object({
  note: z.string().trim().min(1).max(SUGGEST_BUDGET_NOTE_MAX_LENGTH),
  budgets: z
    .array(suggestBudgetCandidateSchema)
    .max(SUGGEST_BUDGET_MAX_BUDGETS),
});

export const suggestBudgetModelResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("success"),
    budgetId: z.number().int().positive(),
    confidence: z.enum(["high", "medium", "low"]),
    reason: z.string().trim().min(1).max(180),
  }),
  z.object({
    status: z.literal("no_match"),
    reason: z.string().trim().min(1).max(180),
  }),
]);

export const suggestBudgetResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("success"),
    budgetId: z.number().int().positive(),
    confidence: z.enum(["high", "medium", "low"]),
    reason: z.string().trim().min(1).max(180),
  }),
  z.object({
    status: z.literal("no_match"),
    reason: z.string().trim().min(1).max(180),
  }),
  z.object({
    status: z.literal("fallback"),
    reason: z.enum(["request_failed", "invalid_response", "schema_mismatch"]),
  }),
]);

export type SuggestBudgetCandidate = z.infer<
  typeof suggestBudgetCandidateSchema
>;
export type SuggestBudgetRequest = z.infer<typeof suggestBudgetRequestSchema>;
export type SuggestBudgetModelResponse = z.infer<
  typeof suggestBudgetModelResponseSchema
>;
export type SuggestBudgetResponse = z.infer<typeof suggestBudgetResponseSchema>;
