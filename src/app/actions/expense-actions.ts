"use server";

import { createExpense, softDeleteExpense, updateExpense } from "@/db/queries";
import { revalidatePath } from "next/cache";

export async function createExpenseEntry(data: TExpense & { paidBy: string }) {
  try {
    const created = await createExpense(data);
    revalidatePath("/");
    return created;
  } catch (error) {
    console.error("Error creating expense:", error);
    throw new Error("Failed to create expense");
  }
}

export async function updateExpenseEntry(
  id: number,
  data: TExpense & { paidBy: string }
) {
  try {
    const updated = await updateExpense(id, data);
    revalidatePath("/");
    return updated;
  } catch (error) {
    console.error("Error updating expense:", error);
    throw new Error("Failed to update expense");
  }
}

export async function deleteExpenseEntry(id: number) {
  try {
    const deleted = await softDeleteExpense(id);
    revalidatePath("/");
    return deleted;
  } catch (error) {
    console.error("Error deleting expense:", error);
    throw new Error("Failed to delete expense");
  }
}
