import { NextResponse } from "next/server";

import { createWeeklyBudget } from "@/db/budget-queries";
import { WeeklyBudgetCreateInput } from "@/types/budget-weekly";

export const POST = async (request: Request) => {
  try {
    const payload = (await request.json()) as WeeklyBudgetCreateInput;
    if (
      !payload?.weekStartDate ||
      typeof payload.name !== "string" ||
      typeof payload.amount !== "number"
    ) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const created = await createWeeklyBudget(payload);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Failed to create weekly budget:", error);
    return NextResponse.json(
      { error: "Failed to create weekly budget" },
      { status: 400 }
    );
  }
};
