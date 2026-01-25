CREATE TABLE "transaction_budgets" (
	"transaction_id" integer PRIMARY KEY NOT NULL,
	"budget_id" integer NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_budgets" (
	"id" serial PRIMARY KEY NOT NULL,
	"week_start_date" date NOT NULL,
	"name" text NOT NULL,
	"amount" integer NOT NULL
);
--> statement-breakpoint
DROP INDEX "search_idx";--> statement-breakpoint
ALTER TABLE "transaction_budgets" ADD CONSTRAINT "transaction_budgets_transaction_id_expenses_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_budgets" ADD CONSTRAINT "transaction_budgets_budget_id_weekly_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."weekly_budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transaction_budgets_budget_id_idx" ON "transaction_budgets" USING btree ("budget_id");--> statement-breakpoint
CREATE INDEX "transaction_budgets_transaction_id_idx" ON "transaction_budgets" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "weekly_budgets_week_start_date_idx" ON "weekly_budgets" USING btree ("week_start_date");--> statement-breakpoint
CREATE INDEX "search_idx" ON "expenses" USING gin (to_tsvector('simple', f_unaccent("note") || ' ' || f_unaccent("category")));