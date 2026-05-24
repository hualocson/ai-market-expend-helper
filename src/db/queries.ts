import dayjs from "@/configs/date";
import { and, eq, sql } from "drizzle-orm";

import { setExpenseBudget } from "./budget-queries";
import { db } from "./index";
import { expenses } from "./schema";
import { CreateExpenseInput } from "./type";

export const createExpense = async (input: CreateExpenseInput) => {
  const parsedDate = dayjs(input.date, "DD/MM/YYYY", true);
  if (!parsedDate.isValid()) {
    throw new Error("Invalid date format");
  }

  const values = {
    clientId: input.clientId ?? null,
    date: parsedDate.toDate().toDateString(),
    amount: input.amount,
    note: input.note?.trim() || "",
    category: input.category,
    paidBy: input.paidBy,
  };

  const [created] = input.clientId
    ? await db
        .insert(expenses)
        .values(values)
        .onConflictDoUpdate({
          target: expenses.clientId,
          targetWhere: sql`${expenses.clientId} is not null`,
          set: values,
        })
        .returning()
    : await db.insert(expenses).values(values).returning();

  if (typeof input.budgetId !== "undefined") {
    await setExpenseBudget({
      expenseId: created.id,
      budgetId: input.budgetId ?? null,
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

  if (!updated) {
    throw new Error("Expense not found");
  }

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
    .where(and(eq(expenses.id, id), eq(expenses.isDeleted, false)))
    .returning();

  return deleted;
};
