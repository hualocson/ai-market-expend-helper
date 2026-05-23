import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  budgetTransferPayloadSchema,
  parseJsonPayload,
} from "@/lib/api/route-schemas";
import { transferBudgetAmount } from "@/lib/services/budget-transfer";

export const POST = async (request: Request) => {
  try {
    const payload = await parseJsonPayload(
      request,
      budgetTransferPayloadSchema
    );
    if ("error" in payload) {
      return NextResponse.json({ error: payload.error }, { status: 400 });
    }

    const result = await transferBudgetAmount(payload.value);
    if (!result.ok) {
      if (result.code === "NOT_FOUND") {
        return NextResponse.json(
          { error: "Budget not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: "Insufficient source budget amount" },
        { status: 400 }
      );
    }

    revalidatePath("/budgets");
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to transfer budget amount:", error);
    return NextResponse.json(
      { error: "Failed to transfer budget amount" },
      { status: 400 }
    );
  }
};
