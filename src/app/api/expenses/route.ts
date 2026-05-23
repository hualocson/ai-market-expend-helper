import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { createExpense } from "@/db/queries";
import { parseExpenseListParams } from "@/lib/api/read-route-params";
import {
  expenseMutationPayloadSchema,
  parseJsonPayload,
} from "@/lib/api/route-schemas";
import { getExpenseList } from "@/lib/services/expenses";

export const GET = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const parsedParams = parseExpenseListParams(searchParams);
  if ("error" in parsedParams) {
    return NextResponse.json({ error: parsedParams.error }, { status: 400 });
  }

  try {
    const result = await getExpenseList(parsedParams.value);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch expenses:", error);
    return NextResponse.json(
      { error: "Failed to fetch expenses" },
      { status: 400 }
    );
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
