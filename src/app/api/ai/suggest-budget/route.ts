import {
  MissingOpenRouterApiKeyError,
  suggestBudget,
} from "@/lib/ai/suggest-budget";
import { suggestBudgetRequestSchema } from "@/lib/ai/suggest-budget-contract";
import { apiError, apiSuccess } from "@/lib/api/route-response";

const invalidPayloadResponse = () =>
  apiError("INVALID_PAYLOAD", "Invalid payload", 400);

export const POST = async (request: Request) => {
  try {
    let payload: unknown;

    try {
      payload = await request.json();
    } catch {
      return invalidPayloadResponse();
    }

    const parsed = suggestBudgetRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return invalidPayloadResponse();
    }

    const result = await suggestBudget({
      note: parsed.data.note,
      budgets: parsed.data.budgets,
      apiKey: process.env.OPENROUTER_API_KEY,
    });

    return apiSuccess(result);
  } catch (error) {
    if (error instanceof MissingOpenRouterApiKeyError) {
      return apiError(
        "SUGGEST_BUDGET_FAILED",
        "Missing OPENROUTER_API_KEY",
        500
      );
    }

    console.error("Failed to suggest budget:", error);
    return apiError("SUGGEST_BUDGET_FAILED", "Failed to suggest budget", 500);
  }
};
