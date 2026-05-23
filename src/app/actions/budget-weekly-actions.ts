"use server";

import { revalidatePath } from "next/cache";

import {
  createBudget,
  deleteBudget,
  getTransferCandidates as getTransferCandidatesQuery,
  setExpenseBudget,
  updateBudget,
} from "@/db/budget-queries";
import {
  budgetTransferPayloadSchema,
  positiveIntParamSchema,
} from "@/lib/api/route-schemas";
import {
  type TransferBudgetInput,
  type TransferBudgetResult,
  transferBudgetAmount as transferBudgetAmountService,
} from "@/lib/services/budget-transfer";
import {
  BudgetCreateInput,
  BudgetListItem,
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

export async function transferBudgetAmount(
  input: TransferBudgetInput
): Promise<TransferBudgetResult> {
  const payload = budgetTransferPayloadSchema.parse(input);

  try {
    const result = await transferBudgetAmountService(payload);
    if (result.ok) {
      revalidatePath("/budgets");
    }

    return result;
  } catch (error) {
    console.error("Error transferring budget amount:", error);
    throw new Error("Failed to transfer budget amount");
  }
}

export type GetTransferCandidatesInput = {
  destinationBudgetId: number;
};

export async function getTransferCandidates(
  input: GetTransferCandidatesInput
): Promise<BudgetListItem[]> {
  const destinationBudgetId = positiveIntParamSchema.parse(
    input.destinationBudgetId
  );

  try {
    return await getTransferCandidatesQuery(destinationBudgetId);
  } catch (error) {
    console.error("Error loading transfer candidates:", error);
    throw new Error("Failed to load transfer candidates");
  }
}
