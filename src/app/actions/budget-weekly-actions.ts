"use server";

import { revalidatePath } from "next/cache";

import {
  createWeeklyBudget,
  deleteWeeklyBudget,
  setTransactionBudget,
  updateWeeklyBudget,
} from "@/db/budget-queries";
import {
  TransactionBudgetInput,
  WeeklyBudgetCreateInput,
  WeeklyBudgetUpdateInput,
} from "@/types/budget-weekly";

export async function createWeeklyBudgetEntry(input: WeeklyBudgetCreateInput) {
  try {
    const created = await createWeeklyBudget(input);
    revalidatePath("/budget-weekly");
    return created;
  } catch (error) {
    console.error("Error creating weekly budget:", error);
    throw new Error("Failed to create weekly budget");
  }
}

export async function updateWeeklyBudgetEntry(
  id: number,
  input: WeeklyBudgetUpdateInput
) {
  try {
    const updated = await updateWeeklyBudget(id, input);
    revalidatePath("/budget-weekly");
    return updated;
  } catch (error) {
    console.error("Error updating weekly budget:", error);
    throw new Error("Failed to update weekly budget");
  }
}

export async function deleteWeeklyBudgetEntry(id: number) {
  try {
    const deleted = await deleteWeeklyBudget(id);
    revalidatePath("/budget-weekly");
    return deleted;
  } catch (error) {
    console.error("Error deleting weekly budget:", error);
    throw new Error("Failed to delete weekly budget");
  }
}

export async function setTransactionBudgetEntry(input: TransactionBudgetInput) {
  try {
    const assigned = await setTransactionBudget(input);
    revalidatePath("/budget-weekly");
    return assigned;
  } catch (error) {
    console.error("Error setting transaction budget:", error);
    throw new Error("Failed to update transaction budget");
  }
}
