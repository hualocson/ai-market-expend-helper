import { revalidatePath } from "next/cache";

import { deleteBudget, updateBudget } from "@/db/budget-queries";
import { apiError, apiSuccess } from "@/lib/api/route-response";
import {
  budgetUpdatePayloadSchema,
  parseJsonPayload,
  parsePositiveIntParam,
} from "@/lib/api/route-schemas";

export const PATCH = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: rawId } = await params;
  const id = parsePositiveIntParam(rawId, "Invalid budget id");
  if ("error" in id) {
    return apiError("INVALID_PAYLOAD", id.error, 400);
  }

  try {
    const payload = await parseJsonPayload(request, budgetUpdatePayloadSchema);
    if ("error" in payload) {
      return apiError("INVALID_PAYLOAD", payload.error, 400);
    }

    if (!Object.keys(payload.value).length) {
      return apiError("INVALID_PAYLOAD", "No fields provided for update", 400);
    }

    const updated = await updateBudget(id.value, payload.value);
    if (!updated) {
      return apiError("NOT_FOUND", "Budget not found", 404);
    }

    revalidatePath("/budgets");
    return apiSuccess(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "Budget not found") {
      return apiError("NOT_FOUND", error.message, 404);
    }

    console.error("Failed to update budget:", error);
    return apiError("UPDATE_BUDGET_FAILED", "Failed to update budget", 400);
  }
};

export const DELETE = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: rawId } = await params;
  const id = parsePositiveIntParam(rawId, "Invalid budget id");
  if ("error" in id) {
    return apiError("INVALID_PAYLOAD", id.error, 400);
  }

  try {
    const deleted = await deleteBudget(id.value);
    if (!deleted) {
      return apiError("NOT_FOUND", "Budget not found", 404);
    }

    revalidatePath("/budgets");
    return apiSuccess(deleted);
  } catch (error) {
    console.error("Failed to delete budget:", error);
    return apiError("DELETE_BUDGET_FAILED", "Failed to delete budget", 400);
  }
};
