import { NextResponse } from "next/server";

import dayjs from "@/configs/date";
import { db } from "@/db";
import { createExpense } from "@/db/queries";
import { expenses } from "@/db/schema";
import { CreateExpenseInput } from "@/db/type";
import { PaidBy } from "@/enums";
import { verifyInternalToken } from "@/lib/internal-auth";
import { and, desc, eq, gte, lte } from "drizzle-orm";

type InternalCreateTransactionInput = {
  amount: number;
  budgetId?: number | null;
  category: string;
  date: string;
  note?: string;
  paidBy: PaidBy;
};

const isPaidBy = (value: unknown): value is PaidBy =>
  typeof value === "string" &&
  Object.values(PaidBy).includes(value as PaidBy);

const isValidPayload = (
  payload: unknown
): payload is InternalCreateTransactionInput => {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const input = payload as Record<string, unknown>;
  const hasValidBudgetId =
    typeof input.budgetId === "undefined" ||
    input.budgetId === null ||
    typeof input.budgetId === "number";

  return (
    typeof input.date === "string" &&
    typeof input.amount === "number" &&
    typeof input.category === "string" &&
    (typeof input.note === "undefined" || typeof input.note === "string") &&
    isPaidBy(input.paidBy) &&
    hasValidBudgetId
  );
};

const isIsoDate = (value: string) => dayjs(value, "YYYY-MM-DD", true).isValid();
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

export const GET = async (request: Request) => {
  const authResult = verifyInternalToken(request);
  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  const { searchParams } = new URL(request.url);
  const exactDate = searchParams.get("date");
  const fromDate = searchParams.get("from");
  const toDate = searchParams.get("to");
  const limitParam = searchParams.get("limit");

  const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : DEFAULT_LIMIT;
  if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
    return NextResponse.json(
      { error: "Invalid limit. Use a positive integer." },
      { status: 400 }
    );
  }
  const limit = Math.min(parsedLimit, MAX_LIMIT);

  if (exactDate && !isIsoDate(exactDate)) {
    return NextResponse.json(
      { error: "Invalid date format for 'date'. Use YYYY-MM-DD" },
      { status: 400 }
    );
  }
  if (fromDate && !isIsoDate(fromDate)) {
    return NextResponse.json(
      { error: "Invalid date format for 'from'. Use YYYY-MM-DD" },
      { status: 400 }
    );
  }
  if (toDate && !isIsoDate(toDate)) {
    return NextResponse.json(
      { error: "Invalid date format for 'to'. Use YYYY-MM-DD" },
      { status: 400 }
    );
  }

  if (fromDate && toDate && dayjs(fromDate).isAfter(dayjs(toDate), "day")) {
    return NextResponse.json(
      { error: "'from' must be less than or equal to 'to'" },
      { status: 400 }
    );
  }

  const whereClause = and(
    eq(expenses.isDeleted, false),
    exactDate ? eq(expenses.date, exactDate) : undefined,
    fromDate ? gte(expenses.date, fromDate) : undefined,
    toDate ? lte(expenses.date, toDate) : undefined
  );

  try {
    const rows = await db
      .select()
      .from(expenses)
      .where(whereClause)
      .orderBy(desc(expenses.date), desc(expenses.id))
      .limit(limit);
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Failed to fetch internal transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 400 }
    );
  }
};

export const POST = async (request: Request) => {
  const authResult = verifyInternalToken(request);
  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  try {
    const payload = await request.json();
    if (!isValidPayload(payload)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const created = await createExpense(payload as CreateExpenseInput);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Failed to create internal transaction:", error);
    return NextResponse.json(
      { error: "Failed to create transaction" },
      { status: 400 }
    );
  }
};
