import { NextResponse } from "next/server";

import { deleteWeeklyBudget, updateWeeklyBudget } from "@/db/budget-queries";
import { WeeklyBudgetUpdateInput } from "@/types/budget-weekly";

export const PATCH = async (
  request: Request,
  { params }: { params: { id: string } }
) => {
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid budget id" }, { status: 400 });
  }

  try {
    const payload = (await request.json()) as WeeklyBudgetUpdateInput;
    const updated = await updateWeeklyBudget(id, payload);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update weekly budget:", error);
    return NextResponse.json(
      { error: "Failed to update weekly budget" },
      { status: 400 }
    );
  }
};

export const DELETE = async (
  _request: Request,
  { params }: { params: { id: string } }
) => {
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid budget id" }, { status: 400 });
  }

  try {
    const deleted = await deleteWeeklyBudget(id);
    return NextResponse.json(deleted);
  } catch (error) {
    console.error("Failed to delete weekly budget:", error);
    return NextResponse.json(
      { error: "Failed to delete weekly budget" },
      { status: 400 }
    );
  }
};
