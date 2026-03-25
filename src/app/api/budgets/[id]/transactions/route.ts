import { NextResponse } from "next/server";

import { getBudgetTransactions } from "@/db/budget-queries";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const budgetId = Number(id);
  if (!Number.isInteger(budgetId) || budgetId <= 0) {
    return NextResponse.json({ error: "Invalid budget id" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const rawLimit = searchParams.get("limit");
  const rawOffset = searchParams.get("offset");
  const parsedLimit = rawLimit ? Number.parseInt(rawLimit, 10) : DEFAULT_LIMIT;
  const parsedOffset = rawOffset ? Number.parseInt(rawOffset, 10) : 0;

  if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
    return NextResponse.json({ error: "Invalid limit" }, { status: 400 });
  }
  if (!Number.isInteger(parsedOffset) || parsedOffset < 0) {
    return NextResponse.json({ error: "Invalid offset" }, { status: 400 });
  }

  try {
    const report = await getBudgetTransactions(budgetId, {
      limit: Math.min(parsedLimit, MAX_LIMIT),
      offset: parsedOffset,
    });
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
