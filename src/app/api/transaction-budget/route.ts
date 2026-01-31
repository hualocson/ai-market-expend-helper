import { NextResponse } from "next/server";

import { setExpenseBudget } from "@/db/budget-queries";
import { ExpenseBudgetInput } from "@/types/budget-weekly";

export const POST = async (request: Request) => {
  try {
    const payload = (await request.json()) as ExpenseBudgetInput;
    if (
      typeof payload?.expenseId !== "number" ||
      !("budgetId" in payload)
    ) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const updated = await setExpenseBudget(payload);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to set expense budget:", error);
    return NextResponse.json(
      { error: "Failed to set expense budget" },
      { status: 400 }
    );
  }
};
