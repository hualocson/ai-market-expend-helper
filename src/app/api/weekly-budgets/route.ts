import { NextResponse } from "next/server";

import { createBudget } from "@/db/budget-queries";
import { BudgetCreateInput } from "@/types/budget-weekly";

export const POST = async (request: Request) => {
  try {
    const payload = (await request.json()) as BudgetCreateInput;
    if (
      typeof payload?.periodStartDate !== "string" ||
      typeof payload.period !== "string" ||
      typeof payload.name !== "string" ||
      typeof payload.amount !== "number"
    ) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const created = await createBudget(payload);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Failed to create budget:", error);
    return NextResponse.json(
      { error: "Failed to create budget" },
      { status: 400 }
    );
  }
};
