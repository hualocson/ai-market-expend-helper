import dayjs from "@/configs/date";
import type { CreateExpenseInput } from "@/db/type";
import { PaidBy } from "@/enums";
import { BUDGET_COLOR_IDS } from "@/lib/budget-appearance";
import type {
  BudgetCreateInput,
  BudgetUpdateInput,
  ExpenseBudgetInput,
} from "@/types/budget-weekly";
import { z } from "zod";

export type ValidationResult<T> =
  | {
      error: string;
    }
  | {
      value: T;
    };

const isoDateSchema = z
  .string()
  .refine(
    (value) => dayjs(value, "YYYY-MM-DD", true).isValid(),
    "Invalid date"
  );

const optionalBudgetIdSchema = z
  .number()
  .int()
  .positive()
  .nullable()
  .optional();

export const positiveIntParamSchema = z.number().int().positive();

export const expenseMutationPayloadSchema: z.ZodType<CreateExpenseInput> =
  z.object({
    clientId: z.string().min(1).nullable().optional(),
    date: z.string().min(1),
    note: z.string().optional().default(""),
    amount: z.number().finite(),
    category: z.string().min(1),
    paidBy: z.enum([PaidBy.CUBI, PaidBy.EMBE, PaidBy.OTHER]),
    budgetId: optionalBudgetIdSchema,
  });

export const budgetPeriodSchema = z.enum(["week", "month", "custom"]);
const budgetIconSchema = z.string().trim().min(1).max(8);
const budgetColorSchema = z.enum(BUDGET_COLOR_IDS);

export const budgetCreatePayloadSchema: z.ZodType<BudgetCreateInput> = z
  .object({
    name: z.string().min(1),
    icon: budgetIconSchema,
    color: budgetColorSchema,
    amount: z.number().finite(),
    period: budgetPeriodSchema,
    periodStartDate: isoDateSchema,
    periodEndDate: isoDateSchema.nullable().optional(),
  })
  .refine((input) => input.period !== "custom" || input.periodEndDate, {
    message: "Invalid date",
  });

export const budgetUpdatePayloadSchema: z.ZodType<BudgetUpdateInput> = z.object(
  {
    name: z.string().min(1).optional(),
    icon: budgetIconSchema.optional(),
    color: budgetColorSchema.optional(),
    amount: z.number().finite().optional(),
    period: budgetPeriodSchema.optional(),
    periodStartDate: isoDateSchema.optional(),
    periodEndDate: isoDateSchema.nullable().optional(),
  }
);

export const expenseBudgetPayloadSchema: z.ZodType<ExpenseBudgetInput> =
  z.object({
    expenseId: z.number().int().positive(),
    budgetId: z.number().int().positive().nullable(),
  });

export const budgetTransferPayloadSchema = z
  .object({
    fromBudgetId: z.number().int().positive(),
    toBudgetId: z.number().int().positive(),
    amount: z.number().int().positive(),
  })
  .refine((input) => input.fromBudgetId !== input.toBudgetId, {
    message: "Source and destination must be different budgets",
  });

export type BudgetTransferPayload = z.infer<typeof budgetTransferPayloadSchema>;

export const parseJsonPayload = async <T>(
  request: Request,
  schema: z.ZodType<T>
): Promise<ValidationResult<T>> => {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return { error: "Invalid payload" };
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return { error: "Invalid payload" };
  }

  return { value: parsed.data };
};

export const parsePositiveIntParam = (
  value: string,
  error: string
): ValidationResult<number> => {
  const parsed = Number(value);
  if (!positiveIntParamSchema.safeParse(parsed).success) {
    return { error };
  }

  return { value: parsed };
};

export const parsePaginationParams = (
  searchParams: URLSearchParams,
  {
    defaultLimit,
    maxLimit,
  }: {
    defaultLimit: number;
    maxLimit: number;
  }
): ValidationResult<{ limit: number; offset: number }> => {
  const rawLimit = searchParams.get("limit");
  const rawOffset = searchParams.get("offset");
  const limit = rawLimit ? Number(rawLimit) : defaultLimit;
  const offset = rawOffset ? Number(rawOffset) : 0;

  if (!Number.isInteger(limit) || limit <= 0) {
    return { error: "Invalid limit" };
  }
  if (!Number.isInteger(offset) || offset < 0) {
    return { error: "Invalid offset" };
  }

  return { value: { limit: Math.min(limit, maxLimit), offset } };
};
