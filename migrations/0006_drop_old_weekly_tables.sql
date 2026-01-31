-- Custom SQL migration file, put your code below! --
DROP TABLE "transaction_budgets";
DROP TABLE "weekly_budgets";
--> statement-breakpoint
DROP INDEX IF EXISTS "budgets_legacy_weekly_budget_id_idx";
ALTER TABLE "budgets" DROP CONSTRAINT "budgets_legacy_weekly_budget_id_uniq";
ALTER TABLE "budgets" DROP COLUMN "legacy_weekly_budget_id";
