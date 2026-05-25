import { revalidatePath } from "next/cache";

import { createBudget } from "@/db/budget-queries";
import { apiError, apiSuccess } from "@/lib/api/route-response";
import {
  budgetCreatePayloadSchema,
  parseJsonPayload,
} from "@/lib/api/route-schemas";

export const POST = async (request: Request) => {
  try {
    const payload = await parseJsonPayload(request, budgetCreatePayloadSchema);
    if ("error" in payload) {
      return apiError("INVALID_PAYLOAD", payload.error, 400);
    }

    const created = await createBudget(payload.value);
    revalidatePath("/budgets");
    return apiSuccess(created, { status: 201 });
  } catch (error) {
    console.error("Failed to create budget:", error);
    return apiError("CREATE_BUDGET_FAILED", "Failed to create budget", 400);
  }
};
