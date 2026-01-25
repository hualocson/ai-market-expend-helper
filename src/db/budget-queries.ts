import dayjs from "@/configs/date";
import { db } from "@/db";
import { expenses, transactionBudgets, weeklyBudgets } from "@/db/schema";
import { getWeekRange } from "@/lib/week";
import {
  TransactionBudgetInput,
  WeeklyBudgetCreateInput,
  WeeklyBudgetReport,
  WeeklyBudgetUpdateInput,
} from "@/types/budget-weekly";
import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";

const getWeekBounds = (value: string) => {
  const parsed = dayjs(value, "YYYY-MM-DD", true);
  const { weekStartDate, weekEndDate } = getWeekRange(
    parsed.isValid() ? parsed : dayjs()
  );
  const weekStart = weekStartDate.format("YYYY-MM-DD");
  const weekEnd = weekEndDate.format("YYYY-MM-DD");
  const weekEndExclusive = weekStartDate.add(7, "day").format("YYYY-MM-DD");

  return { weekStartDate, weekEndDate, weekStart, weekEnd, weekEndExclusive };
};

export const getWeeklyBudgetReport = async (
  weekStartDate: string,
  searchQuery?: string
): Promise<WeeklyBudgetReport> => {
  const { weekStart, weekEnd, weekEndExclusive } =
    getWeekBounds(weekStartDate);

  const budgets = await db
    .select({
      id: weeklyBudgets.id,
      name: weeklyBudgets.name,
      amount: weeklyBudgets.amount,
    })
    .from(weeklyBudgets)
    .where(eq(weeklyBudgets.weekStartDate, weekStart))
    .orderBy(asc(weeklyBudgets.name), asc(weeklyBudgets.id));

  const baseWhere = and(
    eq(expenses.isDeleted, false),
    gte(expenses.date, weekStart),
    lt(expenses.date, weekEndExclusive)
  );

  const buildTransactionsQuery = (whereClause: ReturnType<typeof and>) =>
    db
      .select({
        id: expenses.id,
        date: expenses.date,
        note: expenses.note,
        amount: expenses.amount,
        category: expenses.category,
        budgetId: transactionBudgets.budgetId,
        budgetName: weeklyBudgets.name,
      })
      .from(expenses)
      .leftJoin(
        transactionBudgets,
        eq(transactionBudgets.transactionId, expenses.id)
      )
      .leftJoin(
        weeklyBudgets,
        eq(weeklyBudgets.id, transactionBudgets.budgetId)
      )
      .where(whereClause)
      .orderBy(
        desc(sql`(${transactionBudgets.budgetId} IS NULL)`),
        desc(expenses.date),
        desc(expenses.id)
      );

  const rows = await buildTransactionsQuery(baseWhere);
  const trimmedSearch = searchQuery?.trim();
  const filteredRows = trimmedSearch
    ? await buildTransactionsQuery(
        and(
          baseWhere,
          sql`to_tsvector('simple', f_unaccent(${expenses.note}) || ' ' || f_unaccent(${expenses.category}))
              @@ websearch_to_tsquery('simple', f_unaccent(${trimmedSearch}))`
        )
      )
    : rows;

  const spentByBudget = new Map<number, number>();
  let totalSpentAssigned = 0;
  let unassignedSpent = 0;

  rows.forEach((row) => {
    const amount = Number(row.amount ?? 0);
    const budgetId = row.budgetId === null ? null : Number(row.budgetId);

    if (budgetId) {
      spentByBudget.set(budgetId, (spentByBudget.get(budgetId) ?? 0) + amount);
      totalSpentAssigned += amount;
    } else {
      unassignedSpent += amount;
    }
  });

  const transactions = filteredRows.map((row) => {
    const amount = Number(row.amount ?? 0);
    const budgetId = row.budgetId === null ? null : Number(row.budgetId);

    return {
      id: Number(row.id),
      date: String(row.date),
      note: row.note ?? "",
      amount,
      category: row.category ?? "",
      budgetId,
      budgetName: row.budgetName ?? null,
    };
  });

  const budgetsWithTotals = budgets.map((budget) => {
    const amount = Number(budget.amount ?? 0);
    const spent = spentByBudget.get(budget.id) ?? 0;
    return {
      id: budget.id,
      name: budget.name,
      amount,
      spent,
      remaining: amount - spent,
    };
  });

  const totalBudget = budgetsWithTotals.reduce(
    (sum, budget) => sum + budget.amount,
    0
  );
  const totalRemaining = totalBudget - totalSpentAssigned;

  return {
    weekStartDate: weekStart,
    weekEndDate: weekEnd,
    summary: {
      totalBudget,
      totalSpentAssigned,
      unassignedSpent,
      totalRemaining,
    },
    budgets: budgetsWithTotals,
    transactions,
  };
};

export const createWeeklyBudget = async (input: WeeklyBudgetCreateInput) => {
  const { weekStart } = getWeekBounds(input.weekStartDate);
  const [created] = await db
    .insert(weeklyBudgets)
    .values({
      weekStartDate: weekStart,
      name: input.name.trim(),
      amount: input.amount,
    })
    .returning();

  return created;
};

export const updateWeeklyBudget = async (
  id: number,
  input: WeeklyBudgetUpdateInput
) => {
  const updates: Partial<WeeklyBudgetUpdateInput> = {};

  if (typeof input.name === "string") {
    updates.name = input.name.trim();
  }
  if (typeof input.amount === "number") {
    updates.amount = input.amount;
  }

  if (!Object.keys(updates).length) {
    return null;
  }

  const [updated] = await db
    .update(weeklyBudgets)
    .set(updates)
    .where(eq(weeklyBudgets.id, id))
    .returning();

  return updated;
};

export const deleteWeeklyBudget = async (id: number) => {
  const [deleted] = await db
    .delete(weeklyBudgets)
    .where(eq(weeklyBudgets.id, id))
    .returning();

  return deleted;
};

export const setTransactionBudget = async (
  input: TransactionBudgetInput
) => {
  const { weekStart, weekEnd } = getWeekBounds(input.weekStartDate);

  const [transaction] = await db
    .select({
      id: expenses.id,
      date: expenses.date,
      isDeleted: expenses.isDeleted,
    })
    .from(expenses)
    .where(eq(expenses.id, input.transactionId))
    .limit(1);

  if (!transaction || transaction.isDeleted) {
    throw new Error("Transaction not found");
  }

  const transactionDate = dayjs(transaction.date);
  if (
    !transactionDate.isValid() ||
    transactionDate.isBefore(weekStart, "day") ||
    transactionDate.isAfter(weekEnd, "day")
  ) {
    throw new Error("Transaction is outside the selected week");
  }

  if (input.budgetId === null) {
    await db
      .delete(transactionBudgets)
      .where(eq(transactionBudgets.transactionId, input.transactionId));
    return { transactionId: input.transactionId, budgetId: null };
  }

  const [budget] = await db
    .select({
      id: weeklyBudgets.id,
      weekStartDate: weeklyBudgets.weekStartDate,
    })
    .from(weeklyBudgets)
    .where(eq(weeklyBudgets.id, input.budgetId))
    .limit(1);

  if (!budget) {
    throw new Error("Budget not found");
  }

  const budgetWeekStart = dayjs(budget.weekStartDate).format("YYYY-MM-DD");
  if (budgetWeekStart !== weekStart) {
    throw new Error("Budget does not belong to the selected week");
  }

  const assignedAt = new Date();
  await db
    .insert(transactionBudgets)
    .values({
      transactionId: input.transactionId,
      budgetId: input.budgetId,
      assignedAt,
    })
    .onConflictDoUpdate({
      target: transactionBudgets.transactionId,
      set: { budgetId: input.budgetId, assignedAt },
    });

  return { transactionId: input.transactionId, budgetId: input.budgetId };
};
