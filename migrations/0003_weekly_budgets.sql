CREATE TABLE IF NOT EXISTS "weekly_budgets" (
	"id" serial PRIMARY KEY NOT NULL,
	"week_start_date" date NOT NULL,
	"name" text NOT NULL,
	"amount" integer NOT NULL
);

CREATE INDEX "weekly_budgets_week_start_date_idx" ON "weekly_budgets" ("week_start_date");

CREATE TABLE IF NOT EXISTS "transaction_budgets" (
	"transaction_id" integer PRIMARY KEY NOT NULL,
	"budget_id" integer NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "transaction_budgets"
	ADD CONSTRAINT "transaction_budgets_transaction_id_fkey"
	FOREIGN KEY ("transaction_id") REFERENCES "expenses"("id") ON DELETE cascade;

ALTER TABLE "transaction_budgets"
	ADD CONSTRAINT "transaction_budgets_budget_id_fkey"
	FOREIGN KEY ("budget_id") REFERENCES "weekly_budgets"("id") ON DELETE cascade;

CREATE INDEX "transaction_budgets_budget_id_idx" ON "transaction_budgets" ("budget_id");
CREATE INDEX "transaction_budgets_transaction_id_idx" ON "transaction_budgets" ("transaction_id");
