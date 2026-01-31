import dayjs from "@/configs/date";
import { eq } from "drizzle-orm";

import { db } from "./index";
import { setExpenseBudget } from "./budget-queries";
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
    await setExpenseBudget({
      expenseId: created.id,
      budgetId: Number(input.budgetId),
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
    await setExpenseBudget({
      expenseId: updated.id,
      budgetId: input.budgetId ?? null,
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
