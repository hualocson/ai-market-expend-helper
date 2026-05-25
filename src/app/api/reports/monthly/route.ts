import { parseOptionalMonthParam } from "@/lib/api/read-route-params";
import { apiError, apiSuccess } from "@/lib/api/route-response";
import { getMonthlyReport } from "@/lib/services/reports";

export const GET = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const month = parseOptionalMonthParam(searchParams);
  if ("error" in month) {
    return apiError("INVALID_PARAMS", month.error, 400);
  }

  try {
    const report = await getMonthlyReport(month.value);
    return apiSuccess(report);
  } catch (error) {
    console.error("Failed to fetch monthly report:", error);
    return apiError(
      "FETCH_REPORT_FAILED",
      "Failed to fetch monthly report",
      400
    );
  }
};
