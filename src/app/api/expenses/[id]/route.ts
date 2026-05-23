import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { softDeleteExpense, updateExpense } from "@/db/queries";
import {
  expenseMutationPayloadSchema,
  parseJsonPayload,
  parsePositiveIntParam,
} from "@/lib/api/route-schemas";

export const PATCH = async (
  request: Request,
  { params }: { params: { id: string } }
) => {
  const id = parsePositiveIntParam(params.id, "Invalid expense id");
  if ("error" in id) {
    return NextResponse.json({ error: id.error }, { status: 400 });
  }

  try {
    const payload = await parseJsonPayload(
      request,
      expenseMutationPayloadSchema
    );
    if ("error" in payload) {
      return NextResponse.json({ error: payload.error }, { status: 400 });
    }

    const updated = await updateExpense(id.value, payload.value);
    revalidatePath("/");
    revalidatePath("/budgets");
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "Expense not found") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    console.error("Failed to update expense:", error);
    return NextResponse.json(
      { error: "Failed to update expense" },
      { status: 400 }
    );
  }
};

export const DELETE = async (
  _request: Request,
  { params }: { params: { id: string } }
) => {
  const id = parsePositiveIntParam(params.id, "Invalid expense id");
  if ("error" in id) {
    return NextResponse.json({ error: id.error }, { status: 400 });
  }

  try {
    const deleted = await softDeleteExpense(id.value);
    if (!deleted) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    revalidatePath("/");
    revalidatePath("/budgets");
    return NextResponse.json(deleted);
  } catch (error) {
    console.error("Failed to delete expense:", error);
    return NextResponse.json(
      { error: "Failed to delete expense" },
      { status: 400 }
    );
  }
};
