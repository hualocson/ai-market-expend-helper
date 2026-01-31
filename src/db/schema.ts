import { PaidBy } from "@/enums";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const expenses = pgTable(
  "expenses",
  {
    id: serial("id").primaryKey(),
    date: date("date").notNull(),
    amount: integer("amount").notNull(),
    note: text("note").notNull(),
    category: text("category").notNull(),
    paidBy: text("paid_by").$type<PaidBy>().notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    isDeleted: boolean("is_deleted").notNull().default(false),
    deletedAt: timestamp("deleted_at", {
      withTimezone: true,
    }),
  },
  (t) => [
    check(
      `soft_delete_consistency`,
      sql`${t.isDeleted} = (${t.deletedAt} IS NOT NULL)`
    ),
    index("search_idx").using(
      "gin",
      sql`to_tsvector('simple', f_unaccent(${t.note}) || ' ' || f_unaccent(${t.category}))`
    ),
  ]
);

export type TExpense = typeof expenses.$inferSelect;
export type TNewExpense = typeof expenses.$inferInsert;

export const budgetPeriod = pgEnum("budget_period", [
  "week",
  "month",
  "custom",
]);

export const budgets = pgTable(
  "budgets",
  {
    id: serial("id").primaryKey(),

    name: text("name").notNull(),
    amount: integer("amount").notNull(),

    period: budgetPeriod("period").notNull(),

    periodStartDate: date("period_start_date").notNull(),
    periodEndDate: date("period_end_date"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("budgets_period_start_idx").on(t.periodStartDate),
    index("budgets_period_idx").on(t.period),
  ]
);

export const expenseBudgets = pgTable(
  "expense_budgets",
  {
    expenseId: integer("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" })
      .primaryKey(),

    budgetId: integer("budget_id")
      .notNull()
      .references(() => budgets.id, { onDelete: "cascade" }),

    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("expense_budgets_budget_id_idx").on(t.budgetId),
    index("expense_budgets_expense_id_idx").on(t.expenseId),
  ]
);

export type TBudget = typeof budgets.$inferSelect;
export type TNewBudget = typeof budgets.$inferInsert;
export type TExpenseBudget = typeof expenseBudgets.$inferSelect;
export type TNewExpenseBudget = typeof expenseBudgets.$inferInsert;
