import { db } from "@/db";
import { budgets } from "@/db/schema";
import {
  type BudgetTransferPayload,
  budgetTransferPayloadSchema,
} from "@/lib/api/route-schemas";
import { and, inArray, sql } from "drizzle-orm";

export type TransferBudgetInput = BudgetTransferPayload;

export type TransferBudgetResult =
  | { ok: true }
  | { ok: false; code: "INSUFFICIENT_CAP" | "NOT_FOUND" };

export async function transferBudgetAmount(
  input: TransferBudgetInput
): Promise<TransferBudgetResult> {
  const parsed = budgetTransferPayloadSchema.parse(input);
  const { fromBudgetId, toBudgetId, amount } = parsed;

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
}
