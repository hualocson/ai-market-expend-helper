import { NextResponse } from "next/server";

import { parseOptionalMonthParam } from "@/lib/api/read-route-params";
import { getMonthlyReport } from "@/lib/services/reports";

export const GET = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const month = parseOptionalMonthParam(searchParams);
  if ("error" in month) {
    return NextResponse.json({ error: month.error }, { status: 400 });
  }

  try {
    const report = await getMonthlyReport(month.value);
    return NextResponse.json(report);
  } catch (error) {
    console.error("Failed to fetch monthly report:", error);
    return NextResponse.json(
      { error: "Failed to fetch monthly report" },
      { status: 400 }
    );
  }
};
