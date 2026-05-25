import dayjs from "@/configs/date";
import { getWeeklyBudgetReport } from "@/db/budget-queries";
import { apiError, apiSuccess } from "@/lib/api/route-response";

export const GET = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const weekStart = searchParams.get("weekStart");
  const query = searchParams.get("q");
  const resolvedWeekStart =
    typeof weekStart === "string" && weekStart.length
      ? weekStart
      : dayjs().format("YYYY-MM-DD");
  const searchQuery =
    typeof query === "string" && query.trim().length ? query : undefined;

  try {
    const report = await getWeeklyBudgetReport(resolvedWeekStart, searchQuery);
    return apiSuccess(report);
  } catch (error) {
    console.error("Failed to fetch budget report:", error);
    return apiError(
      "FETCH_BUDGETS_FAILED",
      "Failed to fetch budget report",
      400
    );
  }
};
