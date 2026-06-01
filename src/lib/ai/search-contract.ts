import { Category } from "@/enums";
import type { OpenRouterJsonSchema } from "@/lib/ai/core/openrouter";
import { z } from "zod";

export const SEARCH_INPUT_MAX_LENGTH = 500;
export const SEARCH_MONTH_PATTERN = /^\d{4}-\d{2}$/;
export const SEARCH_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const SEARCH_MAX_BUDGETS = 100;
export const SEARCH_BUDGET_NAME_MAX_LENGTH = 120;

export const searchBudgetSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1).max(SEARCH_BUDGET_NAME_MAX_LENGTH),
  category: z.nativeEnum(Category),
});

export type SearchBudget = z.infer<typeof searchBudgetSchema>;

export const parseSearchRequestSchema = z.object({
  input: z.string().trim().min(1).max(SEARCH_INPUT_MAX_LENGTH),
  todayDate: z.string().regex(SEARCH_DATE_PATTERN),
  todayMonth: z.string().regex(SEARCH_MONTH_PATTERN),
  budgets: z.array(searchBudgetSchema).max(SEARCH_MAX_BUDGETS).default([]),
});

export type ParseSearchRequest = z.infer<typeof parseSearchRequestSchema>;

export const searchFilterSchema = z.object({
  dateFrom: z.string().regex(SEARCH_DATE_PATTERN).optional(),
  dateTo: z.string().regex(SEARCH_DATE_PATTERN).optional(),
  categories: z.array(z.nativeEnum(Category)).optional(),
  budgetIds: z.array(z.number().int().positive()).optional(),
  hasBudget: z.boolean().optional(),
  amountMin: z.number().int().nonnegative().optional(),
  amountMax: z.number().int().nonnegative().optional(),
  q: z.string().trim().min(1).optional(),
});

export type SearchFilter = z.infer<typeof searchFilterSchema>;

export type ParseSearchFallbackReason =
  | "invalid_response"
  | "schema_mismatch"
  | "request_failed";

export type ParseSearchResponse =
  | { status: "success"; originalInput: string; filter: SearchFilter }
  | {
      status: "fallback";
      originalInput: string;
      reason: ParseSearchFallbackReason;
      prefill: { q?: string };
    };

// JSON schema handed to OpenRouter response_format. Validation is enforced by
// searchFilterSchema after parse; this only steers the model.
export const SEARCH_FILTER_JSON_SCHEMA: OpenRouterJsonSchema = {
  name: "expense_search_filter",
  strict: false,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      dateFrom: { type: "string", description: "YYYY-MM-DD inclusive start" },
      dateTo: { type: "string", description: "YYYY-MM-DD inclusive end" },
      categories: {
        type: "array",
        items: { type: "string", enum: Object.values(Category) },
      },
      budgetIds: { type: "array", items: { type: "integer" } },
      hasBudget: { type: "boolean" },
      amountMin: { type: "integer" },
      amountMax: { type: "integer" },
      q: { type: "string" },
    },
  },
};
