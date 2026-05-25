import { getBudgetOverview } from "@/db/budget-queries";
import { apiError, apiSuccess } from "@/lib/api/route-response";

export const GET = async () => {
  try {
    const report = await getBudgetOverview();
    return apiSuccess(report);
  } catch (error) {
    console.error("Failed to fetch budgets:", error);
    return apiError("FETCH_BUDGETS_FAILED", "Failed to fetch budgets", 400);
  }
};
