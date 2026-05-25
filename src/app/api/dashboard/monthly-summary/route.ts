import { parseOptionalMonthParam } from "@/lib/api/read-route-params";
import { apiError, apiSuccess } from "@/lib/api/route-response";
import { getDashboardMonthlySummary } from "@/lib/services/dashboard";

export const GET = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const month = parseOptionalMonthParam(searchParams);
  if ("error" in month) {
    return apiError("INVALID_PARAMS", month.error, 400);
  }

  try {
    const summary = await getDashboardMonthlySummary(month.value);
    return apiSuccess(summary);
  } catch (error) {
    console.error("Failed to fetch dashboard monthly summary:", error);
    return apiError(
      "FETCH_REPORT_FAILED",
      "Failed to fetch dashboard monthly summary",
      400
    );
  }
};
