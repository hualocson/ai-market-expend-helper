import { NextResponse } from "next/server";

import {
  createBudget,
  getBudgetOverview,
  getWeeklyBudgetReport,
} from "@/db/budget-queries";
import {
  budgetCreatePayloadSchema,
  parseJsonPayload,
} from "@/lib/api/route-schemas";
import { verifyInternalToken } from "@/lib/internal-auth";

export const GET = async (request: Request) => {
  const authResult = verifyInternalToken(request);
  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  const { searchParams } = new URL(request.url);
  const weekStartParam = searchParams.get("weekStart");
  const queryParam = searchParams.get("q");
  const weekStart =
    typeof weekStartParam === "string" && weekStartParam.trim().length
      ? weekStartParam
      : null;
  const searchQuery =
    typeof queryParam === "string" && queryParam.trim().length
      ? queryParam
      : undefined;

  try {
    if (weekStart) {
      const report = await getWeeklyBudgetReport(weekStart, searchQuery);
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
    const payload = await parseJsonPayload(request, budgetCreatePayloadSchema);
    if ("error" in payload) {
      return NextResponse.json({ error: payload.error }, { status: 400 });
    }

    const created = await createBudget(payload.value);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Failed to create internal budget:", error);
    return NextResponse.json(
      { error: "Failed to create budget" },
      { status: 400 }
    );
  }
};
