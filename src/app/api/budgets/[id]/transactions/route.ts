import { NextResponse } from "next/server";

import { getBudgetTransactions } from "@/db/budget-queries";
import {
  parsePaginationParams,
  parsePositiveIntParam,
} from "@/lib/api/route-schemas";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const budgetId = parsePositiveIntParam(id, "Invalid budget id");
  if ("error" in budgetId) {
    return NextResponse.json({ error: budgetId.error }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const pagination = parsePaginationParams(searchParams, {
    defaultLimit: DEFAULT_LIMIT,
    maxLimit: MAX_LIMIT,
  });
  if ("error" in pagination) {
    return NextResponse.json({ error: pagination.error }, { status: 400 });
  }

  try {
    const report = await getBudgetTransactions(
      budgetId.value,
      pagination.value
    );
    return NextResponse.json(report);
  } catch (error) {
    if (error instanceof Error && error.message === "Budget not found") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    console.error("Failed to fetch budget transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch budget transactions" },
      { status: 400 }
    );
  }
};
