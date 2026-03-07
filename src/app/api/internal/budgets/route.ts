import { NextResponse } from "next/server";

import {
  createBudget,
  getBudgetOverview,
  getWeeklyBudgetReport,
} from "@/db/budget-queries";
import { verifyInternalToken } from "@/lib/internal-auth";
import { BudgetCreateInput, BudgetPeriod } from "@/types/budget-weekly";

const isBudgetPeriod = (value: unknown): value is BudgetPeriod =>
  value === "week" || value === "month" || value === "custom";

const isValidCreatePayload = (payload: unknown): payload is BudgetCreateInput => {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const input = payload as Record<string, unknown>;
  return (
    typeof input.name === "string" &&
    typeof input.amount === "number" &&
    isBudgetPeriod(input.period) &&
    typeof input.periodStartDate === "string" &&
    (typeof input.periodEndDate === "undefined" ||
      input.periodEndDate === null ||
      typeof input.periodEndDate === "string")
  );
};

export const GET = async (request: Request) => {
  const authResult = verifyInternalToken(request);
  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  const { searchParams } = new URL(request.url);
  const weekStart = searchParams.get("weekStart");
  const query = searchParams.get("q");

  try {
    if (weekStart) {
      const report = await getWeeklyBudgetReport(weekStart, query ?? undefined);
      return NextResponse.json(report);
    }

    const report = await getBudgetOverview();
    return NextResponse.json(report);
  } catch (error) {
    console.error("Failed to fetch internal budgets:", error);
    return NextResponse.json(
      { error: "Failed to fetch budgets" },
      { status: 400 }
    );
  }
};

export const POST = async (request: Request) => {
  const authResult = verifyInternalToken(request);
  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  try {
    const payload = await request.json();
    if (!isValidCreatePayload(payload)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const created = await createBudget(payload);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Failed to create internal budget:", error);
    return NextResponse.json(
      { error: "Failed to create budget" },
      { status: 400 }
    );
  }
};
