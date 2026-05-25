import { getTransferCandidates } from "@/db/budget-queries";
import { apiError, apiSuccess } from "@/lib/api/route-response";
import { parsePositiveIntParam } from "@/lib/api/route-schemas";

export const GET = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const destinationId = parsePositiveIntParam(
    searchParams.get("destinationId") ?? "",
    "Invalid destination budget id"
  );

  if ("error" in destinationId) {
    return apiError("INVALID_PARAMS", destinationId.error, 400);
  }

  try {
    const candidates = await getTransferCandidates(destinationId.value);
    return apiSuccess(candidates);
  } catch (error) {
    console.error("Failed to fetch budget transfer candidates:", error);
    return apiError(
      "FETCH_BUDGETS_FAILED",
      "Failed to fetch budget transfer candidates",
      400
    );
  }
};
