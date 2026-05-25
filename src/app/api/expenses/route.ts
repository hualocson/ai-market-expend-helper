import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { createExpense } from "@/db/queries";
import { parseExpenseListParams } from "@/lib/api/read-route-params";
import { apiError, apiSuccess } from "@/lib/api/route-response";
import {
  expenseMutationPayloadSchema,
  parseJsonPayload,
} from "@/lib/api/route-schemas";
import { getExpenseList } from "@/lib/services/expenses";

export const GET = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const parsedParams = parseExpenseListParams(searchParams);
  if ("error" in parsedParams) {
    return apiError("INVALID_PARAMS", parsedParams.error, 400);
  }

  try {
    const result = await getExpenseList(parsedParams.value);
    return apiSuccess(result);
  } catch (error) {
    console.error("Failed to fetch expenses:", error);
    return apiError("FETCH_EXPENSES_FAILED", "Failed to fetch expenses", 400);
  }
};

export const POST = async (request: Request) => {
  try {
    const payload = await parseJsonPayload(
      request,
      expenseMutationPayloadSchema
    );
    if ("error" in payload) {
      return NextResponse.json({ error: payload.error }, { status: 400 });
    }

    const created = await createExpense(payload.value);
    revalidatePath("/");
    revalidatePath("/budgets");
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Failed to create expense:", error);
    return NextResponse.json(
      { error: "Failed to create expense" },
      { status: 400 }
    );
  }
};
