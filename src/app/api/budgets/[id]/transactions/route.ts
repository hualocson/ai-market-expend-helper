import { getBudgetTransactions } from "@/db/budget-queries";
import { apiError, apiSuccess } from "@/lib/api/route-response";
import {
  parsePaginationParams,
  parsePositiveIntParam,
} from "@/lib/api/route-schemas";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const budgetId = parsePositiveIntParam(id, "Invalid budget id");
  if ("error" in budgetId) {
    return apiError("INVALID_PARAMS", budgetId.error, 400);
  }

  const { searchParams } = new URL(request.url);
  const pagination = parsePaginationParams(searchParams, {
    defaultLimit: DEFAULT_LIMIT,
    maxLimit: MAX_LIMIT,
  });
  if ("error" in pagination) {
    return apiError("INVALID_PARAMS", pagination.error, 400);
  }

  try {
    const report = await getBudgetTransactions(
      budgetId.value,
      pagination.value
    );
    return apiSuccess(report);
  } catch (error) {
    if (error instanceof Error && error.message === "Budget not found") {
      return apiError("FETCH_BUDGETS_FAILED", error.message, 404);
    }

    console.error("Failed to fetch budget transactions:", error);
    return apiError(
      "FETCH_BUDGETS_FAILED",
      "Failed to fetch budget transactions",
      400
    );
  }
};
