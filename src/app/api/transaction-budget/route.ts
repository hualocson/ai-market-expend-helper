import { NextResponse } from "next/server";

import { setTransactionBudget } from "@/db/budget-queries";
import { TransactionBudgetInput } from "@/types/budget-weekly";

export const POST = async (request: Request) => {
  try {
    const payload = (await request.json()) as TransactionBudgetInput;
    if (
      typeof payload?.transactionId !== "number" ||
      typeof payload?.weekStartDate !== "string" ||
      !("budgetId" in payload)
    ) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const updated = await setTransactionBudget(payload);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to set transaction budget:", error);
    return NextResponse.json(
      { error: "Failed to set transaction budget" },
      { status: 400 }
    );
  }
};
