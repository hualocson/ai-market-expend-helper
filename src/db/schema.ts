import { PaidBy } from "@/enums";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
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
  ]
);

export type TExpense = typeof expenses.$inferSelect;
export type TNewExpense = typeof expenses.$inferInsert;
