import { revalidatePath } from "next/cache";

import { softDeleteExpense, updateExpense } from "@/db/queries";
import { apiError, apiSuccess } from "@/lib/api/route-response";
import {
  expenseMutationPayloadSchema,
  parseJsonPayload,
  parsePositiveIntParam,
} from "@/lib/api/route-schemas";

export const PATCH = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: expenseId } = await params;
  const id = parsePositiveIntParam(expenseId, "Invalid expense id");
  if ("error" in id) {
    return apiError("INVALID_PAYLOAD", id.error, 400);
  }

  try {
    const payload = await parseJsonPayload(
      request,
      expenseMutationPayloadSchema
    );
    if ("error" in payload) {
      return apiError("INVALID_PAYLOAD", payload.error, 400);
    }

    const updated = await updateExpense(id.value, payload.value);
    revalidatePath("/");
    revalidatePath("/budgets");
    return apiSuccess(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "Expense not found") {
      return apiError("NOT_FOUND", error.message, 404);
    }

    console.error("Failed to update expense:", error);
    return apiError("UPDATE_EXPENSE_FAILED", "Failed to update expense", 400);
  }
};

export const DELETE = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: expenseId } = await params;
  const id = parsePositiveIntParam(expenseId, "Invalid expense id");
  if ("error" in id) {
    return apiError("INVALID_PAYLOAD", id.error, 400);
  }

  try {
    const deleted = await softDeleteExpense(id.value);
    if (!deleted) {
      return apiError("NOT_FOUND", "Expense not found", 404);
    }

    revalidatePath("/");
    revalidatePath("/budgets");
    return apiSuccess(deleted);
  } catch (error) {
    console.error("Failed to delete expense:", error);
    return apiError("DELETE_EXPENSE_FAILED", "Failed to delete expense", 400);
  }
};
