-- Custom SQL migration file, put your code below! --
ALTER TABLE "budgets" ADD COLUMN IF NOT EXISTS "legacy_weekly_budget_id" integer;
--> statement-breakpoint
ALTER TABLE "budgets"
ADD CONSTRAINT "budgets_legacy_weekly_budget_id_uniq"
UNIQUE ("legacy_weekly_budget_id");
--> statement-breakpoint
INSERT INTO "budgets"
  ("name", "amount", "period", "period_start_date", "period_end_date", "created_at", "updated_at", "legacy_weekly_budget_id")
SELECT
  wb."name",
  wb."amount",
  'week'::budget_period,
  wb."week_start_date",
  (wb."week_start_date" + INTERVAL '6 days')::date,
  now(),
  now(),
  wb."id"
FROM "weekly_budgets" wb
ON CONFLICT ("legacy_weekly_budget_id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "expense_budgets" ("expense_id", "budget_id", "assigned_at")
SELECT
  tb."transaction_id" AS expense_id,
  b."id" AS budget_id,
  tb."assigned_at"
FROM "transaction_budgets" tb
JOIN "budgets" b
  ON b."legacy_weekly_budget_id" = tb."budget_id"
ON CONFLICT ("expense_id") DO NOTHING;
--> statement-breakpoint