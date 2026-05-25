import { revalidatePath } from "next/cache";

import { PaidBy } from "@/enums";
import { apiError, apiSuccess } from "@/lib/api/route-response";
import {
  getExpenseChangesSince,
  pushExpenseOperations,
} from "@/lib/services/expense-sync";
import { z } from "zod";

const expenseSyncCursorSchema = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid cursor")
  .nullable();

const localExpensePayloadSchema = z.object({
  clientId: z.string().min(1),
  date: z.string().min(1),
  amount: z.number().finite(),
  note: z.string(),
  category: z.string().min(1),
  paidBy: z.enum([PaidBy.CUBI, PaidBy.EMBE, PaidBy.OTHER]),
  budgetId: z.number().int().positive().nullable(),
});

const expenseSyncOperationSchema = z.object({
  operationId: z.string().min(1),
  type: z.enum(["create", "update", "delete"]),
  clientId: z.string().min(1),
  serverId: z.number().int().positive().nullable().optional().default(null),
  payload: localExpensePayloadSchema.nullable().optional().default(null),
});

const expenseSyncPushSchema = z.object({
  operations: z.array(expenseSyncOperationSchema),
});

export const GET = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const parsedCursor = expenseSyncCursorSchema.safeParse(cursor);
  if (!parsedCursor.success) {
    return apiError("INVALID_CURSOR", "Invalid cursor", 400);
  }

  try {
    return apiSuccess(await getExpenseChangesSince(parsedCursor.data));
  } catch (error) {
    console.error("Failed to pull expense sync changes:", error);
    return apiError("SYNC_EXPENSES_FAILED", "Failed to sync expenses", 400);
  }
};

export const POST = async (request: Request) => {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return apiError("INVALID_PAYLOAD", "Invalid payload", 400);
  }

  const payload = expenseSyncPushSchema.safeParse(body);
  if (!payload.success) {
    return apiError("INVALID_PAYLOAD", "Invalid payload", 400);
  }

  try {
    const result = await pushExpenseOperations(payload.data.operations);
    if (result.results.some((operationResult) => operationResult.ok)) {
      revalidatePath("/");
      revalidatePath("/budgets");
    }

    return apiSuccess(result);
  } catch (error) {
    console.error("Failed to push expense sync operations:", error);
    return apiError("SYNC_EXPENSES_FAILED", "Failed to sync expenses", 400);
  }
};
