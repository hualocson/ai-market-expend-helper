import { parseRequiredDateParam } from "@/lib/api/read-route-params";
import { apiError, apiSuccess } from "@/lib/api/route-response";
import { getDailyReport } from "@/lib/services/reports";

export const GET = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const date = parseRequiredDateParam(searchParams);
  if ("error" in date) {
    return apiError("INVALID_PARAMS", date.error, 400);
  }

  try {
    const report = await getDailyReport(date.value);
    return apiSuccess(report);
  } catch (error) {
    console.error("Failed to fetch daily report:", error);
    return apiError("FETCH_REPORT_FAILED", "Failed to fetch daily report", 400);
  }
};
