"use server";

import { revalidatePath } from "next/cache";

import { eq, inArray } from "drizzle-orm";
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

export async function transferBudgetAmount(input: TransferBudgetInput) {
  const parsed = transferBudgetSchema.parse(input);

  try {
    await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(budgets)
        .where(inArray(budgets.id, [parsed.fromBudgetId, parsed.toBudgetId]));

      const source = rows.find((r) => r.id === parsed.fromBudgetId);
      const dest = rows.find((r) => r.id === parsed.toBudgetId);

      if (!source || !dest) {
        throw new Error("Budget not found");
      }
      if (parsed.amount > source.amount) {
        throw new Error("Source has insufficient cap");
      }

      await tx
        .update(budgets)
        .set({ amount: source.amount - parsed.amount })
        .where(eq(budgets.id, parsed.fromBudgetId));

      await tx
        .update(budgets)
        .set({ amount: dest.amount + parsed.amount })
        .where(eq(budgets.id, parsed.toBudgetId));
    });

    revalidatePath("/budgets");
  } catch (error) {
    console.error("Error transferring budget amount:", error);
    if (
      error instanceof Error &&
      (error.message === "Source has insufficient cap" ||
        error.message === "Budget not found")
    ) {
      throw error;
    }
    throw new Error("Failed to transfer budget amount");
  }
}
