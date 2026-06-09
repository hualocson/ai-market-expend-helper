import dayjs from "@/configs/date";
import { db } from "@/db";
import { budgets, expenseBudgets, expenses } from "@/db/schema";
import {
  normalizeBudgetColor,
  normalizeBudgetIcon,
} from "@/lib/budget-appearance";
import { getWeekRange } from "@/lib/week";
import {
  BudgetCloneNextPeriodInput,
  BudgetCloneNextPeriodResult,
  BudgetCreateInput,
  BudgetListItem,
  BudgetOverviewReport,
  BudgetPeriod,
  BudgetReport,
  BudgetTransactionsResponse,
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
  ne,
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

const normalizeCloneName = (name: string) => name.trim().toLowerCase();

const normalizeClonePeriodBounds = (
  period: BudgetCloneNextPeriodInput["period"],
  sourceStartDate: string
) => {
  const source = normalizeBudgetDates(period, sourceStartDate, null);
  const targetBase =
    period === "week"
      ? dayjs(source.periodStartDate).add(7, "day")
      : dayjs(source.periodStartDate).add(1, "month");
  const target = normalizeBudgetDates(
    period,
    targetBase.format("YYYY-MM-DD"),
    null
  );

  return {
    sourceStartDate: source.periodStartDate,
    sourceEndDate: source.periodEndDate,
    targetStartDate: target.periodStartDate,
    targetEndDate: target.periodEndDate,
  };
};

const touchExpenseUpdatedAt = async (expenseId: number) => {
  await db
    .update(expenses)
    .set({ updatedAt: new Date() })
    .where(eq(expenses.id, expenseId));
};

const touchExpensesForBudget = async (budgetId: number) => {
  await db
    .update(expenses)
    .set({ updatedAt: new Date() })
    .where(
      sql`exists (
        select 1
        from ${expenseBudgets}
        where ${expenseBudgets.expenseId} = ${expenses.id}
          and ${expenseBudgets.budgetId} = ${budgetId}
      )`
    );
};

export const getWeeklyBudgetReport = async (
  weekStartDate: string,
  searchQuery?: string
): Promise<BudgetReport> => {
  const { weekStart, weekEnd, weekEndExclusive } = getWeekBounds(weekStartDate);

  const budgetRows = await db
    .select({
      id: budgets.id,
      name: budgets.name,
      icon: budgets.icon,
      color: budgets.color,
      category: budgets.category,
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
        budgetIcon: budgets.icon,
        budgetColor: budgets.color,
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
      budgetIcon:
        budgetId === null ? null : normalizeBudgetIcon(row.budgetIcon),
      budgetColor:
        budgetId === null ? null : normalizeBudgetColor(row.budgetColor),
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
      icon: normalizeBudgetIcon(budget.icon),
      color: normalizeBudgetColor(budget.color),
      category: budget.category,
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
      icon: budgets.icon,
      color: budgets.color,
      category: budgets.category,
      amount: budgets.amount,
      period: budgets.period,
      periodStartDate: budgets.periodStartDate,
      periodEndDate: budgets.periodEndDate,
      spent: sql<number>`coalesce(sum(${expenses.amount}), 0)`.mapWith(Number),
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
      budgets.icon,
      budgets.color,
      budgets.category,
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
      icon: normalizeBudgetIcon(budget.icon),
      color: normalizeBudgetColor(budget.color),
      category: budget.category,
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

export const getTransferCandidates = async (
  destinationBudgetId: number,
  limit = 100
): Promise<BudgetListItem[]> => {
  const budgetRows = await db
    .select({
      id: budgets.id,
      name: budgets.name,
      icon: budgets.icon,
      color: budgets.color,
      category: budgets.category,
      amount: budgets.amount,
      period: budgets.period,
      periodStartDate: budgets.periodStartDate,
      periodEndDate: budgets.periodEndDate,
      spent: sql<number>`coalesce(sum(${expenses.amount}), 0)`.mapWith(Number),
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
    .where(and(ne(budgets.id, destinationBudgetId), sql`${budgets.amount} > 0`))
    .groupBy(
      budgets.id,
      budgets.name,
      budgets.icon,
      budgets.color,
      budgets.category,
      budgets.amount,
      budgets.period,
      budgets.periodStartDate,
      budgets.periodEndDate
    )
    .orderBy(desc(budgets.periodStartDate), asc(budgets.id))
    .limit(limit);

  return budgetRows.map((budget) => {
    const amount = Number(budget.amount ?? 0);
    const spent = Number(budget.spent ?? 0);
    return {
      id: budget.id,
      name: budget.name,
      icon: normalizeBudgetIcon(budget.icon),
      color: normalizeBudgetColor(budget.color),
      category: budget.category,
      amount,
      spent,
      remaining: amount - spent,
      period: budget.period,
      periodStartDate: dayjs(budget.periodStartDate).format("YYYY-MM-DD"),
      periodEndDate: budget.periodEndDate
        ? dayjs(budget.periodEndDate).format("YYYY-MM-DD")
        : null,
    };
  });
};

export const cloneBudgetsToNextPeriod = async (
  input: BudgetCloneNextPeriodInput
): Promise<BudgetCloneNextPeriodResult> => {
  const bounds = normalizeClonePeriodBounds(
    input.period,
    input.sourceStartDate
  );

  const sourceRows = await db
    .select({
      id: budgets.id,
      name: budgets.name,
      icon: budgets.icon,
      color: budgets.color,
      category: budgets.category,
      amount: budgets.amount,
      period: budgets.period,
      periodStartDate: budgets.periodStartDate,
      periodEndDate: budgets.periodEndDate,
    })
    .from(budgets)
    .where(
      and(
        eq(budgets.period, input.period),
        eq(budgets.periodStartDate, bounds.sourceStartDate),
        eq(budgets.periodEndDate, bounds.sourceEndDate)
      )
    )
    .orderBy(asc(budgets.name), asc(budgets.id));

  const targetRows = await db
    .select({
      name: budgets.name,
    })
    .from(budgets)
    .where(
      and(
        eq(budgets.period, input.period),
        eq(budgets.periodStartDate, bounds.targetStartDate),
        eq(budgets.periodEndDate, bounds.targetEndDate)
      )
    )
    .orderBy(asc(budgets.name), asc(budgets.id));

  const targetNames = new Set(
    targetRows.map((budget) => normalizeCloneName(budget.name))
  );
  const amountOverrides = new Map(
    (input.budgets ?? []).map((budget) => [
      budget.sourceBudgetId,
      budget.amount,
    ])
  );
  const cloneValues = sourceRows
    .filter((budget) => !targetNames.has(normalizeCloneName(budget.name)))
    .map((budget) => ({
      name: budget.name.trim(),
      icon: normalizeBudgetIcon(budget.icon),
      color: normalizeBudgetColor(budget.color),
      category: budget.category,
      amount:
        amountOverrides.get(Number(budget.id)) ?? Number(budget.amount ?? 0),
      period: input.period,
      periodStartDate: bounds.targetStartDate,
      periodEndDate: bounds.targetEndDate,
    }));

  const created = cloneValues.length
    ? await db.insert(budgets).values(cloneValues).returning({ id: budgets.id })
    : [];

  return {
    period: input.period,
    sourceStartDate: bounds.sourceStartDate,
    sourceEndDate: bounds.sourceEndDate,
    targetStartDate: bounds.targetStartDate,
    targetEndDate: bounds.targetEndDate,
    sourceCount: sourceRows.length,
    createdCount: created.length,
    skippedCount: sourceRows.length - cloneValues.length,
    createdBudgetIds: created.map((budget) => Number(budget.id)),
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
      icon: normalizeBudgetIcon(input.icon),
      color: normalizeBudgetColor(input.color),
      category: input.category,
      amount: input.amount,
      period: input.period,
      periodStartDate: normalized.periodStartDate,
      periodEndDate: normalized.periodEndDate,
    })
    .returning();

  return created;
};

export const updateBudget = async (id: number, input: BudgetUpdateInput) => {
  const updates: Partial<typeof budgets.$inferInsert> = {};
  const updatesLinkedExpenseMetadata =
    typeof input.name === "string" ||
    typeof input.icon === "string" ||
    typeof input.color === "string";

  if (typeof input.name === "string") {
    updates.name = input.name.trim();
  }
  if (typeof input.icon === "string") {
    updates.icon = normalizeBudgetIcon(input.icon);
  }
  if (typeof input.color === "string") {
    updates.color = normalizeBudgetColor(input.color);
  }
  if (typeof input.category === "string") {
    updates.category = input.category;
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

  if (updated && updatesLinkedExpenseMetadata) {
    await touchExpensesForBudget(id);
  }

  return updated;
};

export const deleteBudget = async (id: number) => {
  await touchExpensesForBudget(id);

  const [deleted] = await db
    .delete(budgets)
    .where(eq(budgets.id, id))
    .returning();

  return deleted;
};

export const getBudgetTransactions = async (
  budgetId: number,
  {
    limit = 20,
    offset = 0,
  }: {
    limit?: number;
    offset?: number;
  } = {}
): Promise<BudgetTransactionsResponse> => {
  const safeLimit = Math.min(Math.max(1, Math.trunc(limit)), 100);
  const safeOffset = Math.max(0, Math.trunc(offset));

  const [budget] = await db
    .select({
      id: budgets.id,
      periodStartDate: budgets.periodStartDate,
      periodEndDate: budgets.periodEndDate,
    })
    .from(budgets)
    .where(eq(budgets.id, budgetId))
    .limit(1);

  if (!budget) {
    throw new Error("Budget not found");
  }

  const endDate = budget.periodEndDate ?? budget.periodStartDate;
  const whereClause = and(
    eq(expenseBudgets.budgetId, budgetId),
    eq(expenses.isDeleted, false),
    gte(expenses.date, budget.periodStartDate),
    lte(expenses.date, endDate)
  );

  const [summaryRow] = await db
    .select({
      count: sql<number>`count(*)`.mapWith(Number),
      totalSpent: sql<number>`coalesce(sum(${expenses.amount}), 0)`.mapWith(
        Number
      ),
    })
    .from(expenseBudgets)
    .innerJoin(expenses, eq(expenses.id, expenseBudgets.expenseId))
    .where(whereClause);

  const rows = await db
    .select({
      id: expenses.id,
      date: expenses.date,
      note: expenses.note,
      amount: expenses.amount,
      category: expenses.category,
      paidBy: expenses.paidBy,
    })
    .from(expenseBudgets)
    .innerJoin(expenses, eq(expenses.id, expenseBudgets.expenseId))
    .where(whereClause)
    .orderBy(desc(expenses.date), desc(expenses.id))
    .limit(safeLimit)
    .offset(safeOffset);

  const items = rows.map((row) => ({
    id: Number(row.id),
    date: String(row.date),
    note: row.note ?? "",
    amount: Number(row.amount ?? 0),
    category: row.category ?? "",
    paidBy: row.paidBy ?? "",
  }));

  const count = Number(summaryRow?.count ?? 0);
  return {
    budgetId,
    summary: {
      count,
      totalSpent: Number(summaryRow?.totalSpent ?? 0),
    },
    items,
    pagination: {
      limit: safeLimit,
      offset: safeOffset,
      hasMore: safeOffset + items.length < count,
    },
  };
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
    await touchExpenseUpdatedAt(input.expenseId);
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
  await touchExpenseUpdatedAt(input.expenseId);

  return { expenseId: input.expenseId, budgetId: input.budgetId };
};
