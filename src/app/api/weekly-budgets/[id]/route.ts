import { NextResponse } from "next/server";

import { deleteBudget, updateBudget } from "@/db/budget-queries";
import { BudgetUpdateInput } from "@/types/budget-weekly";

export const PATCH = async (
  request: Request,
  { params }: { params: { id: string } }
) => {
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid budget id" }, { status: 400 });
  }

  try {
    const payload = (await request.json()) as BudgetUpdateInput;
    const updated = await updateBudget(id, payload);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update budget:", error);
    return NextResponse.json(
      { error: "Failed to update budget" },
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
    const deleted = await deleteBudget(id);
    return NextResponse.json(deleted);
  } catch (error) {
    console.error("Failed to delete budget:", error);
    return NextResponse.json(
      { error: "Failed to delete budget" },
      { status: 400 }
    );
  }
};
