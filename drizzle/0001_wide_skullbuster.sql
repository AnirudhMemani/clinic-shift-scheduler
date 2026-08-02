CREATE TYPE "public"."import_action" AS ENUM('repaired', 'merged', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."import_entity" AS ENUM('staff', 'shift');--> statement-breakpoint
CREATE TYPE "public"."import_source" AS ENUM('seed', 'upload');--> statement-breakpoint
CREATE TABLE "import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "import_source" NOT NULL,
	"filename" text,
	"summary" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"entity" "import_entity" NOT NULL,
	"action" "import_action" NOT NULL,
	"raw" text NOT NULL,
	"reason" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "import_issues" ADD CONSTRAINT "import_issues_batch_id_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."import_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "import_issues_batch_idx" ON "import_issues" USING btree ("batch_id");--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_external_id_unique" UNIQUE("external_id");