"use server";

import { revalidatePath } from "next/cache";

import { and, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import {
  createBudget,
  deleteBudget,
  setExpenseBudget,
  updateBudget,
} from "@/db/budget-queries";
import { budgets } from "@/db/schema";
import {
  BudgetCreateInput,
  BudgetUpdateInput,
  ExpenseBudgetInput,
} from "@/types/budget-weekly";

export async function createWeeklyBudgetEntry(input: BudgetCreateInput) {
  try {
    const created = await createBudget(input);
    revalidatePath("/budgets");
    return created;
  } catch (error) {
    console.error("Error creating budget:", error);
    throw new Error("Failed to create budget");
  }
}

export async function updateWeeklyBudgetEntry(
  id: number,
  input: BudgetUpdateInput
) {
  try {
    const updated = await updateBudget(id, input);
    revalidatePath("/budgets");
    return updated;
  } catch (error) {
    console.error("Error updating budget:", error);
    throw new Error("Failed to update budget");
  }
}

export async function deleteWeeklyBudgetEntry(id: number) {
  try {
    const deleted = await deleteBudget(id);
    revalidatePath("/budgets");
    return deleted;
  } catch (error) {
    console.error("Error deleting budget:", error);
    throw new Error("Failed to delete budget");
  }
}

export async function setTransactionBudgetEntry(input: ExpenseBudgetInput) {
  try {
    const assigned = await setExpenseBudget(input);
    revalidatePath("/budgets");
    return assigned;
  } catch (error) {
    console.error("Error setting transaction budget:", error);
    throw new Error("Failed to update transaction budget");
  }
}

const transferBudgetSchema = z
  .object({
    fromBudgetId: z.number().int().positive(),
    toBudgetId: z.number().int().positive(),
    amount: z.number().int().positive(),
  })
  .refine((d) => d.fromBudgetId !== d.toBudgetId, {
    message: "Source and destination must be different budgets",
  });

export type TransferBudgetInput = z.infer<typeof transferBudgetSchema>;

export type TransferBudgetResult =
  | { ok: true }
  | { ok: false; code: "INSUFFICIENT_CAP" | "NOT_FOUND" };

export async function transferBudgetAmount(
  input: TransferBudgetInput
): Promise<TransferBudgetResult> {
  const parsed = transferBudgetSchema.parse(input);
  const { fromBudgetId, toBudgetId, amount } = parsed;

  try {
    const updated = await db
      .update(budgets)
      .set({
        amount: sql`CASE ${budgets.id}
          WHEN ${fromBudgetId} THEN ${budgets.amount} - ${amount}
          WHEN ${toBudgetId} THEN ${budgets.amount} + ${amount}
          ELSE ${budgets.amount}
        END`,
        updatedAt: new Date(),
      })
      .where(
        and(
          inArray(budgets.id, [fromBudgetId, toBudgetId]),
          sql`(SELECT ${budgets.amount} FROM ${budgets} WHERE ${budgets.id} = ${fromBudgetId}) >= ${amount}`,
          sql`(SELECT COUNT(*) FROM ${budgets} WHERE ${budgets.id} IN (${fromBudgetId}, ${toBudgetId})) = 2`
        )
      )
      .returning({ id: budgets.id });

    if (updated.length === 2) {
      revalidatePath("/budgets");
      return { ok: true };
    }

    const present = await db
      .select({ id: budgets.id })
      .from(budgets)
      .where(inArray(budgets.id, [fromBudgetId, toBudgetId]));

    if (present.length < 2) {
      return { ok: false, code: "NOT_FOUND" };
    }
    return { ok: false, code: "INSUFFICIENT_CAP" };
  } catch (error) {
    console.error("Error transferring budget amount:", error);
    throw new Error("Failed to transfer budget amount");
  }
}
