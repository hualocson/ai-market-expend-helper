import { NextResponse } from "next/server";

import { setExpenseBudget } from "@/db/budget-queries";
import {
  expenseBudgetPayloadSchema,
  parseJsonPayload,
} from "@/lib/api/route-schemas";

export const POST = async (request: Request) => {
  try {
    const payload = await parseJsonPayload(request, expenseBudgetPayloadSchema);
    if ("error" in payload) {
      return NextResponse.json({ error: payload.error }, { status: 400 });
    }

    const updated = await setExpenseBudget(payload.value);
    return NextResponse.json(updated);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Expense not found" ||
        error.message === "Budget not found")
    ) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    console.error("Failed to set expense budget:", error);
    return NextResponse.json(
      { error: "Failed to set expense budget" },
      { status: 400 }
    );
  }
};
