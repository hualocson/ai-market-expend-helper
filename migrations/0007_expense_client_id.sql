ALTER TABLE "expenses" ADD COLUMN "client_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "expenses_client_id_unique_idx" ON "expenses" USING btree ("client_id") WHERE "expenses"."client_id" is not null;
