import dayjs from "@/configs/date";
import { getWeekRange } from "@/lib/week";
import { eq } from "drizzle-orm";

import { db } from "./index";
import { setTransactionBudget } from "./budget-queries";
import { expenses } from "./schema";
import { CreateExpenseInput } from "./type";

export const createExpense = async (input: CreateExpenseInput) => {
  const parsedDate = dayjs(input.date, "DD/MM/YYYY", true);
  if (!parsedDate.isValid()) {
    throw new Error("Invalid date format");
  }

  const [created] = await db
    .insert(expenses)
    .values({
      date: parsedDate.toDate().toDateString(),
      amount: input.amount,
      note: input.note?.trim() || "",
      category: input.category,
      paidBy: input.paidBy,
    })
    .returning();

  if (Number.isFinite(input.budgetId)) {
    const weekStartDate = getWeekRange(parsedDate).weekStartDate.format(
      "YYYY-MM-DD"
    );
    await setTransactionBudget({
      transactionId: created.id,
      budgetId: Number(input.budgetId),
      weekStartDate,
    });
  }

  return created;
};

export const updateExpense = async (id: number, input: CreateExpenseInput) => {
  const parsedDate = dayjs(input.date, "DD/MM/YYYY", true);
  if (!parsedDate.isValid()) {
    throw new Error("Invalid date format");
  }
  const [updated] = await db
    .update(expenses)
    .set({
      date: parsedDate.toDate().toDateString(),
      amount: input.amount,
      note: input.note?.trim() || "",
      category: input.category,
      paidBy: input.paidBy,
    })
    .where(eq(expenses.id, id))
    .returning();

  if (typeof input.budgetId !== "undefined") {
    const weekStartDate = getWeekRange(parsedDate).weekStartDate.format(
      "YYYY-MM-DD"
    );
    await setTransactionBudget({
      transactionId: updated.id,
      budgetId: input.budgetId,
      weekStartDate,
    });
  }

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
