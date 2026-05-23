import { NextResponse } from "next/server";

import { createExpense } from "@/db/queries";
import { CreateExpenseInput } from "@/db/type";
import { parseExpenseListParams } from "@/lib/api/read-route-params";
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
    const payload = (await request.json()) as CreateExpenseInput;
    const created = await createExpense(payload);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Failed to create expense:", error);
    return NextResponse.json(
      { error: "Failed to create expense" },
      { status: 400 }
    );
  }
};
