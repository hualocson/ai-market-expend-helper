import { NextResponse } from "next/server";

import { db } from "@/db";
import { createExpense } from "@/db/queries";
import { expenses } from "@/db/schema";
import { desc } from "drizzle-orm";

export const GET = async () => {
  const rows = await db
    .select()
    .from(expenses)
    .orderBy(desc(expenses.date), desc(expenses.id));

  return NextResponse.json(rows);
};

export const POST = async (request: Request) => {
  try {
    const payload = (await request.json()) as TExpense & { paidBy: string };
    console.log("payload", payload);
    const created = await createExpense(payload);
    console.log("created", created);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Failed to create expense:", error);
    return NextResponse.json(
      { error: "Failed to create expense" },
      { status: 400 }
    );
  }
};
