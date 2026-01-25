import { PaidBy } from "@/enums";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
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
  )
  ]
);

export type TExpense = typeof expenses.$inferSelect;
export type TNewExpense = typeof expenses.$inferInsert;

export const weeklyBudgets = pgTable(
  "weekly_budgets",
  {
    id: serial("id").primaryKey(),
    weekStartDate: date("week_start_date").notNull(),
    name: text("name").notNull(),
    amount: integer("amount").notNull(),
  },
  (t) => [index("weekly_budgets_week_start_date_idx").on(t.weekStartDate)]
);

export const transactionBudgets = pgTable(
  "transaction_budgets",
  {
    transactionId: integer("transaction_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" })
      .primaryKey(),
    budgetId: integer("budget_id")
      .notNull()
      .references(() => weeklyBudgets.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("transaction_budgets_budget_id_idx").on(t.budgetId),
    index("transaction_budgets_transaction_id_idx").on(t.transactionId),
  ]
);

export type TWeeklyBudget = typeof weeklyBudgets.$inferSelect;
export type TNewWeeklyBudget = typeof weeklyBudgets.$inferInsert;
export type TTransactionBudget = typeof transactionBudgets.$inferSelect;
export type TNewTransactionBudget = typeof transactionBudgets.$inferInsert;
