import { NextResponse } from "next/server";

import { getBudgetOverview } from "@/db/budget-queries";

export const GET = async () => {
  try {
    const report = await getBudgetOverview();
    return NextResponse.json(report);
  } catch (error) {
    console.error("Failed to fetch budgets:", error);
    return NextResponse.json(
      { error: "Failed to fetch budgets" },
      { status: 400 }
    );
  }
};
