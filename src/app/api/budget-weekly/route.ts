import { NextResponse } from "next/server";

import dayjs from "@/configs/date";
import { getWeeklyBudgetReport } from "@/db/budget-queries";

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
    return NextResponse.json(report);
  } catch (error) {
    console.error("Failed to fetch budget report:", error);
    return NextResponse.json(
      { error: "Failed to fetch budget report" },
      { status: 400 }
    );
  }
};
