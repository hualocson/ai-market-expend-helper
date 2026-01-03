CREATE TABLE "expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"amount" integer NOT NULL,
	"note" text NOT NULL,
	"category" text NOT NULL,
	"paid_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "soft_delete_consistency" CHECK ("expenses"."is_deleted" = ("expenses"."deleted_at" IS NOT NULL))
);
