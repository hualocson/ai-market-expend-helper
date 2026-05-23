import { NextResponse } from "next/server";

import { parseOptionalMonthParam } from "@/lib/api/read-route-params";
import { getDashboardMonthlySummary } from "@/lib/services/dashboard";

export const GET = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const month = parseOptionalMonthParam(searchParams);
  if ("error" in month) {
    return NextResponse.json({ error: month.error }, { status: 400 });
  }

  try {
    const summary = await getDashboardMonthlySummary(month.value);
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Failed to fetch dashboard monthly summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard monthly summary" },
      { status: 400 }
    );
  }
};
