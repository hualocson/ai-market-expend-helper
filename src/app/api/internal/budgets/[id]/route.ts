import { NextResponse } from "next/server";

import { updateBudget } from "@/db/budget-queries";
import { verifyInternalToken } from "@/lib/internal-auth";
import { BudgetPeriod, BudgetUpdateInput } from "@/types/budget-weekly";

type InternalUpdateBudgetInput = BudgetUpdateInput;

const isBudgetPeriod = (value: unknown): value is BudgetPeriod =>
  value === "week" || value === "month" || value === "custom";

const isValidUpdatePayload = (
  payload: unknown
): payload is InternalUpdateBudgetInput => {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const input = payload as Record<string, unknown>;

  if (typeof input.name !== "undefined" && typeof input.name !== "string") {
    return false;
  }

  if (
    typeof input.amount !== "undefined" &&
    typeof input.amount !== "number"
  ) {
    return false;
  }

  if (typeof input.period !== "undefined" && !isBudgetPeriod(input.period)) {
    return false;
  }

  if (
    typeof input.periodStartDate !== "undefined" &&
    typeof input.periodStartDate !== "string"
  ) {
    return false;
  }

  if (
    typeof input.periodEndDate !== "undefined" &&
    input.periodEndDate !== null &&
    typeof input.periodEndDate !== "string"
  ) {
    return false;
  }

  return true;
};

export const PATCH = async (
  request: Request,
  { params }: { params: { id: string } }
) => {
  const authResult = verifyInternalToken(request);
  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid budget id" }, { status: 400 });
  }

  try {
    const payload = await request.json();
    if (!isValidUpdatePayload(payload)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    if (!Object.keys(payload as Record<string, unknown>).length) {
      return NextResponse.json(
        { error: "No fields provided for update" },
        { status: 400 }
      );
    }

    const updated = await updateBudget(id, payload);
    if (!updated) {
      return NextResponse.json(
        { error: "No fields provided for update" },
        { status: 400 }
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "Budget not found") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    console.error("Failed to update internal budget:", error);
    return NextResponse.json(
      { error: "Failed to update budget" },
      { status: 400 }
    );
  }
};
