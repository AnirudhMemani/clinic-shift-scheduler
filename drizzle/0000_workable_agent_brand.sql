CREATE TYPE "public"."profession" AS ENUM('doctor', 'nurse', 'receptionist');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('manager', 'staff');--> statement-breakpoint
CREATE TABLE "claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shift_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"assigned_by_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "claims_shift_user_uq" UNIQUE("shift_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "shift_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shift_id" uuid NOT NULL,
	"profession" "profession" NOT NULL,
	"required_count" integer NOT NULL,
	CONSTRAINT "shift_requirements_shift_profession_uq" UNIQUE("shift_id","profession"),
	CONSTRAINT "shift_requirements_count_positive_ck" CHECK ("shift_requirements"."required_count" > 0)
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shifts_time_order_ck" CHECK ("shifts"."ends_at" > "shifts"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" NOT NULL,
	"profession" "profession",
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_role_profession_ck" CHECK (("users"."role" = 'staff' AND "users"."profession" IS NOT NULL) OR ("users"."role" = 'manager' AND "users"."profession" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_assigned_by_id_users_id_fk" FOREIGN KEY ("assigned_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_requirements" ADD CONSTRAINT "shift_requirements_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "claims_user_idx" ON "claims" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "claims_shift_idx" ON "claims" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "shifts_starts_at_idx" ON "shifts" USING btree ("starts_at");