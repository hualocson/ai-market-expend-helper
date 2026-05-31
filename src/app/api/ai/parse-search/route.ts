import { parseSearchWithOpenRouter } from "@/lib/ai/parse-search";
import { parseSearchRequestSchema } from "@/lib/ai/search-contract";
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

    const parsedRequest = parseSearchRequestSchema.safeParse(payload);
    if (!parsedRequest.success) {
      return invalidPayloadResponse();
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return apiError("PARSE_SEARCH_FAILED", "Missing OPENROUTER_API_KEY", 500);
    }

    const result = await parseSearchWithOpenRouter({
      input: parsedRequest.data.input,
      todayMonth: parsedRequest.data.todayMonth,
      budgets: parsedRequest.data.budgets,
      apiKey,
    });

    return apiSuccess(result);
  } catch (error) {
    console.error("Failed to parse search with OpenRouter:", error);
    return apiError("PARSE_SEARCH_FAILED", "Failed to parse search", 500);
  }
};
