import { z } from "zod";

export const suggestBudgetCandidateSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1),
  amount: z.number().finite(),
  spent: z.number().finite(),
  remaining: z.number().finite(),
  period: z.enum(["week", "month", "custom"]),
  periodStartDate: z.string().optional(),
  periodEndDate: z.string().nullable().optional(),
});

export const suggestBudgetRequestSchema = z.object({
  note: z.string().trim().min(1),
  budgets: z.array(suggestBudgetCandidateSchema),
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
