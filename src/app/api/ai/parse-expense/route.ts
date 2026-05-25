import { parseExpenseWithOpenRouter } from "@/lib/ai/parse-expense";
import type { ParseExpenseRequest } from "@/lib/ai/parse-expense-contract";
import { apiError, apiSuccess } from "@/lib/api/route-response";

const invalidPayloadResponse = () =>
  apiError("INVALID_PAYLOAD", "Invalid payload", 400);

const readTrimmedInput = (payload: unknown) => {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const input = (payload as Partial<ParseExpenseRequest>).input;
  if (typeof input !== "string") {
    return null;
  }

  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const POST = async (request: Request) => {
  try {
    let payload: unknown;

    try {
      payload = await request.json();
    } catch {
      return invalidPayloadResponse();
    }

    const input = readTrimmedInput(payload);

    if (!input) {
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
      input,
      apiKey,
    });

    return apiSuccess(result);
  } catch (error) {
    console.error("Failed to parse expense with OpenRouter:", error);
    return apiError("PARSE_EXPENSE_FAILED", "Failed to parse expense", 500);
  }
};
