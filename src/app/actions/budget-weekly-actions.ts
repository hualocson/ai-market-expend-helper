"use server";

import { revalidatePath } from "next/cache";

import {
  createBudget,
  deleteBudget,
  setExpenseBudget,
  updateBudget,
} from "@/db/budget-queries";
import {
  BudgetCreateInput,
  BudgetUpdateInput,
  ExpenseBudgetInput,
} from "@/types/budget-weekly";

export async function createWeeklyBudgetEntry(input: BudgetCreateInput) {
  try {
    const created = await createBudget(input);
    revalidatePath("/budget-weekly");
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
    revalidatePath("/budget-weekly");
    return updated;
  } catch (error) {
    console.error("Error updating budget:", error);
    throw new Error("Failed to update budget");
  }
}

export async function deleteWeeklyBudgetEntry(id: number) {
  try {
    const deleted = await deleteBudget(id);
    revalidatePath("/budget-weekly");
    return deleted;
  } catch (error) {
    console.error("Error deleting budget:", error);
    throw new Error("Failed to delete budget");
  }
}

export async function setTransactionBudgetEntry(input: ExpenseBudgetInput) {
  try {
    const assigned = await setExpenseBudget(input);
    revalidatePath("/budget-weekly");
    return assigned;
  } catch (error) {
    console.error("Error setting transaction budget:", error);
    throw new Error("Failed to update transaction budget");
  }
}
