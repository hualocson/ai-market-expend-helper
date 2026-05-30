import { parseExpenseWithOpenRouter } from "@/lib/ai/parse-expense";
import { parseExpenseRequestSchema } from "@/lib/ai/parse-expense-contract";
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

    const parsedRequest = parseExpenseRequestSchema.safeParse(payload);
    if (!parsedRequest.success) {
      return invalidPayloadResponse();
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return apiError(
        "PARSE_EXPENSE_FAILED",
        "Missing OPENROUTER_API_KEY",
        500
      );
    }

    const result = await parseExpenseWithOpenRouter({
      input: parsedRequest.data.input,
      budgets: parsedRequest.data.budgets,
      apiKey,
    });

    return apiSuccess(result);
  } catch (error) {
    console.error("Failed to parse expense with OpenRouter:", error);
    return apiError("PARSE_EXPENSE_FAILED", "Failed to parse expense", 500);
  }
};
