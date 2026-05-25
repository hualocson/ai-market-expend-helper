import { revalidatePath } from "next/cache";

import { setExpenseBudget } from "@/db/budget-queries";
import { apiError, apiSuccess } from "@/lib/api/route-response";
import {
  expenseBudgetPayloadSchema,
  parseJsonPayload,
} from "@/lib/api/route-schemas";

export const POST = async (request: Request) => {
  try {
    const payload = await parseJsonPayload(request, expenseBudgetPayloadSchema);
    if ("error" in payload) {
      return apiError("INVALID_PAYLOAD", payload.error, 400);
    }

    const updated = await setExpenseBudget(payload.value);
    revalidatePath("/budgets");
    return apiSuccess(updated);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Expense not found" ||
        error.message === "Budget not found")
    ) {
      return apiError("NOT_FOUND", error.message, 404);
    }

    console.error("Failed to set expense budget:", error);
    return apiError(
      "UPDATE_EXPENSE_FAILED",
      "Failed to set expense budget",
      400
    );
  }
};
