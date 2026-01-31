import dayjs from "@/configs/date";
import { db } from "@/db";
import { budgets, expenseBudgets, expenses } from "@/db/schema";
import { getWeekRange } from "@/lib/week";
import {
  BudgetCreateInput,
  BudgetPeriod,
  BudgetOverviewReport,
  BudgetReport,
  BudgetUpdateInput,
  ExpenseBudgetInput,
} from "@/types/budget-weekly";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  isNull,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";

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

const normalizeBudgetDates = (
  period: BudgetPeriod,
  periodStartDate: string,
  periodEndDate?: string | null
) => {
  const parsedStart = dayjs(periodStartDate, "YYYY-MM-DD", true);
  if (!parsedStart.isValid()) {
    throw new Error("Invalid budget start date");
  }

  if (period === "week") {
    const { weekStartDate, weekEndDate } = getWeekRange(parsedStart);
    return {
      periodStartDate: weekStartDate.format("YYYY-MM-DD"),
      periodEndDate: weekEndDate.format("YYYY-MM-DD"),
    };
  }

  if (period === "month") {
    const start = parsedStart.startOf("month");
    const end = parsedStart.endOf("month");
    return {
      periodStartDate: start.format("YYYY-MM-DD"),
      periodEndDate: end.format("YYYY-MM-DD"),
    };
  }

  const parsedEnd = dayjs(periodEndDate, "YYYY-MM-DD", true);
  if (!parsedEnd.isValid()) {
    throw new Error("Invalid budget end date");
  }
  if (parsedEnd.isBefore(parsedStart, "day")) {
    throw new Error("Budget end date must be on or after start date");
  }

  return {
    periodStartDate: parsedStart.format("YYYY-MM-DD"),
    periodEndDate: parsedEnd.format("YYYY-MM-DD"),
  };
};

export const getWeeklyBudgetReport = async (
  weekStartDate: string,
  searchQuery?: string
): Promise<BudgetReport> => {
  const { weekStart, weekEnd, weekEndExclusive } =
    getWeekBounds(weekStartDate);

  const budgetRows = await db
    .select({
      id: budgets.id,
      name: budgets.name,
      amount: budgets.amount,
      period: budgets.period,
      periodStartDate: budgets.periodStartDate,
      periodEndDate: budgets.periodEndDate,
    })
    .from(budgets)
    .where(
      and(
        lte(budgets.periodStartDate, weekEnd),
        or(isNull(budgets.periodEndDate), gte(budgets.periodEndDate, weekStart))
      )
    )
    .orderBy(asc(budgets.name), asc(budgets.id));

  const budgetIdSet = new Set(budgetRows.map((budget) => budget.id));

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
        budgetId: expenseBudgets.budgetId,
        budgetName: budgets.name,
      })
      .from(expenses)
      .leftJoin(expenseBudgets, eq(expenseBudgets.expenseId, expenses.id))
      .leftJoin(budgets, eq(budgets.id, expenseBudgets.budgetId))
      .where(whereClause)
      .orderBy(
        desc(sql`(${expenseBudgets.budgetId} IS NULL)`),
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

    if (budgetId && budgetIdSet.has(budgetId)) {
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

  const budgetsWithTotals = budgetRows.map((budget) => {
    const amount = Number(budget.amount ?? 0);
    const spent = spentByBudget.get(budget.id) ?? 0;
    const normalizedStart = dayjs(budget.periodStartDate).format("YYYY-MM-DD");
    const normalizedEnd = budget.periodEndDate
      ? dayjs(budget.periodEndDate).format("YYYY-MM-DD")
      : null;
    return {
      id: budget.id,
      name: budget.name,
      amount,
      spent,
      remaining: amount - spent,
      period: budget.period,
      periodStartDate: normalizedStart,
      periodEndDate: normalizedEnd,
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

export const getBudgetOverview = async (): Promise<BudgetOverviewReport> => {
  const budgetRows = await db
    .select({
      id: budgets.id,
      name: budgets.name,
      amount: budgets.amount,
      period: budgets.period,
      periodStartDate: budgets.periodStartDate,
      periodEndDate: budgets.periodEndDate,
      spent:
        sql<number>`coalesce(sum(${expenses.amount}), 0)`.mapWith(Number),
    })
    .from(budgets)
    .leftJoin(expenseBudgets, eq(expenseBudgets.budgetId, budgets.id))
    .leftJoin(
      expenses,
      and(
        eq(expenses.id, expenseBudgets.expenseId),
        eq(expenses.isDeleted, false),
        gte(expenses.date, budgets.periodStartDate),
        lte(
          expenses.date,
          sql`coalesce(${budgets.periodEndDate}, ${budgets.periodStartDate})`
        )
      )
    )
    .groupBy(
      budgets.id,
      budgets.name,
      budgets.amount,
      budgets.period,
      budgets.periodStartDate,
      budgets.periodEndDate
    )
    .orderBy(asc(budgets.name), asc(budgets.id));

  const budgetsWithTotals = budgetRows.map((budget) => {
    const amount = Number(budget.amount ?? 0);
    const spent = Number(budget.spent ?? 0);
    const normalizedStart = dayjs(budget.periodStartDate).format("YYYY-MM-DD");
    const normalizedEnd = budget.periodEndDate
      ? dayjs(budget.periodEndDate).format("YYYY-MM-DD")
      : null;
    return {
      id: budget.id,
      name: budget.name,
      amount,
      spent,
      remaining: amount - spent,
      period: budget.period,
      periodStartDate: normalizedStart,
      periodEndDate: normalizedEnd,
    };
  });

  const totalBudget = budgetsWithTotals.reduce(
    (sum, budget) => sum + budget.amount,
    0
  );
  const totalSpent = budgetsWithTotals.reduce(
    (sum, budget) => sum + budget.spent,
    0
  );
  const totalRemaining = totalBudget - totalSpent;

  return {
    summary: {
      totalBudget,
      totalSpent,
      totalRemaining,
      budgetCount: budgetsWithTotals.length,
    },
    budgets: budgetsWithTotals,
  };
};

export const createBudget = async (input: BudgetCreateInput) => {
  const normalized = normalizeBudgetDates(
    input.period,
    input.periodStartDate,
    input.periodEndDate
  );
  const [created] = await db
    .insert(budgets)
    .values({
      name: input.name.trim(),
      amount: input.amount,
      period: input.period,
      periodStartDate: normalized.periodStartDate,
      periodEndDate: normalized.periodEndDate,
    })
    .returning();

  return created;
};

export const updateBudget = async (id: number, input: BudgetUpdateInput) => {
  const updates: Partial<BudgetUpdateInput> = {};

  if (typeof input.name === "string") {
    updates.name = input.name.trim();
  }
  if (typeof input.amount === "number") {
    updates.amount = input.amount;
  }

  if (
    typeof input.period === "string" ||
    typeof input.periodStartDate === "string" ||
    typeof input.periodEndDate !== "undefined"
  ) {
    const [existing] = await db
      .select({
        period: budgets.period,
        periodStartDate: budgets.periodStartDate,
        periodEndDate: budgets.periodEndDate,
      })
      .from(budgets)
      .where(eq(budgets.id, id))
      .limit(1);

    if (!existing) {
      throw new Error("Budget not found");
    }

    const resolvedPeriod = input.period ?? existing.period;
    const resolvedStart =
      input.periodStartDate ??
      dayjs(existing.periodStartDate).format("YYYY-MM-DD");
    const resolvedEnd =
      typeof input.periodEndDate !== "undefined"
        ? input.periodEndDate
        : existing.periodEndDate
          ? dayjs(existing.periodEndDate).format("YYYY-MM-DD")
          : null;

    const normalized = normalizeBudgetDates(
      resolvedPeriod,
      resolvedStart,
      resolvedEnd
    );

    updates.period = resolvedPeriod;
    updates.periodStartDate = normalized.periodStartDate;
    updates.periodEndDate = normalized.periodEndDate;
  }

  if (!Object.keys(updates).length) {
    return null;
  }

  const [updated] = await db
    .update(budgets)
    .set(updates)
    .where(eq(budgets.id, id))
    .returning();

  return updated;
};

export const deleteBudget = async (id: number) => {
  const [deleted] = await db
    .delete(budgets)
    .where(eq(budgets.id, id))
    .returning();

  return deleted;
};

export const setExpenseBudget = async (input: ExpenseBudgetInput) => {
  const [expense] = await db
    .select({
      id: expenses.id,
      date: expenses.date,
      isDeleted: expenses.isDeleted,
    })
    .from(expenses)
    .where(eq(expenses.id, input.expenseId))
    .limit(1);

  if (!expense || expense.isDeleted) {
    throw new Error("Expense not found");
  }

  if (input.budgetId === null) {
    await db
      .delete(expenseBudgets)
      .where(eq(expenseBudgets.expenseId, input.expenseId));
    return { expenseId: input.expenseId, budgetId: null };
  }

  const [budget] = await db
    .select({
      id: budgets.id,
      periodStartDate: budgets.periodStartDate,
      periodEndDate: budgets.periodEndDate,
    })
    .from(budgets)
    .where(eq(budgets.id, input.budgetId))
    .limit(1);

  if (!budget) {
    throw new Error("Budget not found");
  }

  const expenseDate = dayjs(expense.date);
  const periodStart = dayjs(budget.periodStartDate);
  const periodEnd = budget.periodEndDate
    ? dayjs(budget.periodEndDate)
    : periodStart;

  if (!expenseDate.isValid()) {
    throw new Error("Invalid expense date");
  }

  if (
    expenseDate.isBefore(periodStart, "day") ||
    expenseDate.isAfter(periodEnd, "day")
  ) {
    throw new Error("Expense is outside the budget period");
  }

  const assignedAt = new Date();
  await db
    .insert(expenseBudgets)
    .values({
      expenseId: input.expenseId,
      budgetId: input.budgetId,
      assignedAt,
    })
    .onConflictDoUpdate({
      target: expenseBudgets.expenseId,
      set: { budgetId: input.budgetId, assignedAt },
    });

  return { expenseId: input.expenseId, budgetId: input.budgetId };
};
