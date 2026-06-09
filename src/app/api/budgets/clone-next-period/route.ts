import { revalidatePath } from "next/cache";

import { cloneBudgetsToNextPeriod } from "@/db/budget-queries";
import { apiError, apiSuccess } from "@/lib/api/route-response";
import {
  budgetCloneNextPeriodPayloadSchema,
  parseJsonPayload,
} from "@/lib/api/route-schemas";

export const POST = async (request: Request) => {
  try {
    const payload = await parseJsonPayload(
      request,
      budgetCloneNextPeriodPayloadSchema
    );
    if ("error" in payload) {
      return apiError("INVALID_PAYLOAD", payload.error, 400);
    }

    const result = await cloneBudgetsToNextPeriod(payload.value);
    revalidatePath("/budgets");

    return apiSuccess(result, { status: result.createdCount > 0 ? 201 : 200 });
  } catch (error) {
    console.error("Failed to clone budgets:", error);
    return apiError("CLONE_BUDGETS_FAILED", "Failed to clone budgets", 500);
  }
};
