import dayjs from "@/configs/date";
import { db } from "@/db";
import { createExpense, softDeleteExpense, updateExpense } from "@/db/queries";
import { budgets, expenseBudgets, expenses } from "@/db/schema";
import type { PaidBy } from "@/enums";
import { and, eq, gt, isNotNull, lte, or } from "drizzle-orm";

export type ExpenseSyncCursor = string | null;

export type ExpenseSyncServerRow = {
  id: number;
  clientId: string | null;
  date: string;
  amount: number;
  note: string;
  category: string;
  paidBy: string;
  budgetId: number | null;
  budgetName: string | null;
  updatedAt: string;
  deletedAt: string | null;
  isDeleted: boolean;
};

export type ExpenseSyncPullResult = {
  cursor: string;
  changes: ExpenseSyncServerRow[];
};

export type ExpenseSyncPushOperation = {
  operationId: string;
  type: "create" | "update" | "delete";
  clientId: string;
  serverId: number | null;
  payload: {
    date: string;
    amount: number;
    note: string;
    category: string;
    paidBy: string;
    budgetId: number | null;
    clientId: string;
  } | null;
};

export type ExpenseSyncPushResult = {
  results: Array<
    | {
        operationId: string;
        ok: true;
        row: ExpenseSyncServerRow;
      }
    | {
        operationId: string;
        ok: false;
        error: string;
      }
  >;
};

type ExpenseSyncRowQueryResult = {
  id: number;
  clientId: string | null;
  date: Date | string;
  amount: number;
  note: string | null;
  category: string;
  paidBy: string;
  budgetId: number | null;
  budgetName: string | null;
  updatedAt: Date;
  deletedAt: Date | null;
  isDeleted: boolean;
};

const toExpenseSyncServerRow = (
  row: ExpenseSyncRowQueryResult
): ExpenseSyncServerRow => ({
  id: row.id,
  clientId: row.clientId,
  date: String(row.date),
  amount: Number(row.amount),
  note: row.note ?? "",
  category: row.category,
  paidBy: row.paidBy,
  budgetId: row.budgetId === null ? null : Number(row.budgetId),
  budgetName: row.budgetName ?? null,
  updatedAt: row.updatedAt.toISOString(),
  deletedAt: row.deletedAt?.toISOString() ?? null,
  isDeleted: row.isDeleted,
});

const getExpenseSyncRow = async (id: number): Promise<ExpenseSyncServerRow> => {
  const [row] = await db
    .select({
      id: expenses.id,
      clientId: expenses.clientId,
      date: expenses.date,
      amount: expenses.amount,
      note: expenses.note,
      category: expenses.category,
      paidBy: expenses.paidBy,
      budgetId: expenseBudgets.budgetId,
      budgetName: budgets.name,
      updatedAt: expenses.updatedAt,
      deletedAt: expenses.deletedAt,
      isDeleted: expenses.isDeleted,
    })
    .from(expenses)
    .leftJoin(expenseBudgets, eq(expenseBudgets.expenseId, expenses.id))
    .leftJoin(budgets, eq(budgets.id, expenseBudgets.budgetId))
    .where(eq(expenses.id, id));

  if (!row) {
    throw new Error("Expense not found");
  }

  return toExpenseSyncServerRow(row);
};

const normalizeExpenseMutationDate = (value: string) => {
  const isoDate = dayjs(value, "YYYY-MM-DD", true);
  if (isoDate.isValid()) {
    return isoDate.format("DD/MM/YYYY");
  }

  return value;
};

const toExpenseInput = (
  payload: NonNullable<ExpenseSyncPushOperation["payload"]>
) => ({
  ...payload,
  date: normalizeExpenseMutationDate(payload.date),
  paidBy: payload.paidBy as PaidBy,
});

export const getExpenseChangesSince = async (
  cursor: ExpenseSyncCursor
): Promise<ExpenseSyncPullResult> => {
  const highWaterDate = new Date();
  const cursorDate = cursor ? new Date(cursor) : null;
  const whereClause = cursorDate
    ? or(
        and(
          gt(expenses.updatedAt, cursorDate),
          lte(expenses.updatedAt, highWaterDate)
        ),
        and(
          gt(expenses.deletedAt, cursorDate),
          lte(expenses.deletedAt, highWaterDate)
        )
      )
    : or(
        lte(expenses.updatedAt, highWaterDate),
        and(
          isNotNull(expenses.deletedAt),
          lte(expenses.deletedAt, highWaterDate)
        )
      );
  const rows = await db
    .select({
      id: expenses.id,
      clientId: expenses.clientId,
      date: expenses.date,
      amount: expenses.amount,
      note: expenses.note,
      category: expenses.category,
      paidBy: expenses.paidBy,
      budgetId: expenseBudgets.budgetId,
      budgetName: budgets.name,
      updatedAt: expenses.updatedAt,
      deletedAt: expenses.deletedAt,
      isDeleted: expenses.isDeleted,
    })
    .from(expenses)
    .leftJoin(expenseBudgets, eq(expenseBudgets.expenseId, expenses.id))
    .leftJoin(budgets, eq(budgets.id, expenseBudgets.budgetId))
    .where(whereClause);

  return {
    cursor: highWaterDate.toISOString(),
    changes: rows.map(toExpenseSyncServerRow),
  };
};

export const pushExpenseOperations = async (
  operations: ExpenseSyncPushOperation[]
): Promise<ExpenseSyncPushResult> => {
  const results: ExpenseSyncPushResult["results"] = [];

  for (const operation of operations) {
    try {
      if (operation.type === "delete") {
        if (operation.serverId === null) {
          results.push({
            operationId: operation.operationId,
            ok: false,
            error: "Missing server id",
          });
          continue;
        }

        await softDeleteExpense(operation.serverId);
        results.push({
          operationId: operation.operationId,
          ok: true,
          row: await getExpenseSyncRow(operation.serverId),
        });
        continue;
      }

      if (operation.payload === null) {
        results.push({
          operationId: operation.operationId,
          ok: false,
          error: "Missing payload",
        });
        continue;
      }

      if (operation.type === "create") {
        const created = await createExpense(toExpenseInput(operation.payload));
        results.push({
          operationId: operation.operationId,
          ok: true,
          row: await getExpenseSyncRow(created.id),
        });
        continue;
      }

      if (operation.serverId === null) {
        results.push({
          operationId: operation.operationId,
          ok: false,
          error: "Missing server id",
        });
        continue;
      }

      const updated = await updateExpense(
        operation.serverId,
        toExpenseInput(operation.payload)
      );
      results.push({
        operationId: operation.operationId,
        ok: true,
        row: await getExpenseSyncRow(updated.id),
      });
    } catch (error) {
      results.push({
        operationId: operation.operationId,
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return { results };
};
