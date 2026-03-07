import { NextResponse } from "next/server";

import { updateExpense } from "@/db/queries";
import { CreateExpenseInput } from "@/db/type";
import { PaidBy } from "@/enums";
import { verifyInternalToken } from "@/lib/internal-auth";

type InternalUpdateTransactionInput = {
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
): payload is InternalUpdateTransactionInput => {
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

export const PATCH = async (
  request: Request,
  { params }: { params: { id: string } }
) => {
  const authResult = verifyInternalToken(request);
  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json(
      { error: "Invalid transaction id" },
      { status: 400 }
    );
  }

  try {
    const payload = await request.json();
    if (!isValidPayload(payload)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const updated = await updateExpense(id, payload as CreateExpenseInput);
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "Expense not found") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    console.error("Failed to update internal transaction:", error);
    return NextResponse.json(
      { error: "Failed to update transaction" },
      { status: 400 }
    );
  }
};
