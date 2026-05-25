import { revalidatePath } from "next/cache";

import { apiError, apiSuccess } from "@/lib/api/route-response";
import {
  budgetTransferPayloadSchema,
  parseJsonPayload,
} from "@/lib/api/route-schemas";
import { transferBudgetAmount } from "@/lib/services/budget-transfer";

export const POST = async (request: Request) => {
  try {
    const payload = await parseJsonPayload(
      request,
      budgetTransferPayloadSchema
    );
    if ("error" in payload) {
      return apiError("INVALID_PAYLOAD", payload.error, 400);
    }

    const result = await transferBudgetAmount(payload.value);
    if (!result.ok) {
      if (result.code === "NOT_FOUND") {
        return apiError("BUDGET_TRANSFER_FAILED", "Budget not found", 404);
      }

      return apiError(
        "BUDGET_TRANSFER_FAILED",
        "Insufficient source budget amount",
        400
      );
    }

    revalidatePath("/budgets");
    return apiSuccess(result);
  } catch (error) {
    console.error("Failed to transfer budget amount:", error);
    return apiError(
      "BUDGET_TRANSFER_FAILED",
      "Failed to transfer budget amount",
      400
    );
  }
};
