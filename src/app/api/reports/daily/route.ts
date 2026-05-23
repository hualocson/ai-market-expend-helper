import { NextResponse } from "next/server";

import { parseRequiredDateParam } from "@/lib/api/read-route-params";
import { getDailyReport } from "@/lib/services/reports";

export const GET = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const date = parseRequiredDateParam(searchParams);
  if ("error" in date) {
    return NextResponse.json({ error: date.error }, { status: 400 });
  }

  try {
    const report = await getDailyReport(date.value);
    return NextResponse.json(report);
  } catch (error) {
    console.error("Failed to fetch daily report:", error);
    return NextResponse.json(
      { error: "Failed to fetch daily report" },
      { status: 400 }
    );
  }
};
