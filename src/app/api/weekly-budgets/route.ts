import { NextResponse } from "next/server";

import { createBudget } from "@/db/budget-queries";
import {
  budgetCreatePayloadSchema,
  parseJsonPayload,
} from "@/lib/api/route-schemas";

export const POST = async (request: Request) => {
  try {
    const payload = await parseJsonPayload(request, budgetCreatePayloadSchema);
    if ("error" in payload) {
      return NextResponse.json({ error: payload.error }, { status: 400 });
    }

    const created = await createBudget(payload.value);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Failed to create budget:", error);
    return NextResponse.json(
      { error: "Failed to create budget" },
      { status: 400 }
    );
  }
};
