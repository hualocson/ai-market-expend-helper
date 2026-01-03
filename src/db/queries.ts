import dayjs from "@/configs/date";

import { eq } from "drizzle-orm";

import { db } from "./index";
import { expenses } from "./schema";

export type CreateExpenseInput = TExpense & { paidBy: string };

export const createExpense = async (input: CreateExpenseInput) => {
  const parsedDate = dayjs(input.date, "DD/MM/YYYY", true);
  if (!parsedDate.isValid()) {
    throw new Error("Invalid date format");
  }
  const paidBy = input.paidBy?.trim();
  if (!paidBy) {
    throw new Error("Paid by is required");
  }

  const [created] = await db
    .insert(expenses)
    .values({
      date: parsedDate.toDate().toDateString(),
      amount: input.amount,
      note: input.note?.trim() || "",
      category: input.category,
      paidBy,
    })
    .returning();

  return created;
};

export const updateExpense = async (id: number, input: CreateExpenseInput) => {
  const parsedDate = dayjs(input.date, "DD/MM/YYYY", true);
  if (!parsedDate.isValid()) {
    throw new Error("Invalid date format");
  }
  const paidBy = input.paidBy?.trim();
  if (!paidBy) {
    throw new Error("Paid by is required");
  }

  const [updated] = await db
    .update(expenses)
    .set({
      date: parsedDate.toDate().toDateString(),
      amount: input.amount,
      note: input.note?.trim() || "",
      category: input.category,
      paidBy,
    })
    .where(eq(expenses.id, id))
    .returning();

  return updated;
};

export const softDeleteExpense = async (id: number) => {
  const [deleted] = await db
    .update(expenses)
    .set({
      isDeleted: true,
      deletedAt: new Date(),
    })
    .where(eq(expenses.id, id))
    .returning();

  return deleted;
};
