import { NextResponse } from "next/server";

import { deleteBudget, updateBudget } from "@/db/budget-queries";
import {
  budgetUpdatePayloadSchema,
  parseJsonPayload,
  parsePositiveIntParam,
} from "@/lib/api/route-schemas";

export const PATCH = async (
  request: Request,
  { params }: { params: { id: string } }
) => {
  const id = parsePositiveIntParam(params.id, "Invalid budget id");
  if ("error" in id) {
    return NextResponse.json({ error: id.error }, { status: 400 });
  }

  try {
    const payload = await parseJsonPayload(request, budgetUpdatePayloadSchema);
    if ("error" in payload) {
      return NextResponse.json({ error: payload.error }, { status: 400 });
    }

    if (!Object.keys(payload.value).length) {
      return NextResponse.json(
        { error: "No fields provided for update" },
        { status: 400 }
      );
    }

    const updated = await updateBudget(id.value, payload.value);
    if (!updated) {
      return NextResponse.json({ error: "Budget not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "Budget not found") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

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
  const id = parsePositiveIntParam(params.id, "Invalid budget id");
  if ("error" in id) {
    return NextResponse.json({ error: id.error }, { status: 400 });
  }

  try {
    const deleted = await deleteBudget(id.value);
    if (!deleted) {
      return NextResponse.json({ error: "Budget not found" }, { status: 404 });
    }

    return NextResponse.json(deleted);
  } catch (error) {
    console.error("Failed to delete budget:", error);
    return NextResponse.json(
      { error: "Failed to delete budget" },
      { status: 400 }
    );
  }
};
