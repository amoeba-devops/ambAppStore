CREATE TYPE "public"."car_expense_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'AUTO_APPROVED');--> statement-breakpoint
CREATE TYPE "public"."car_expense_type" AS ENUM('FUEL', 'OIL', 'MEAL', 'REPAIR', 'PARKING', 'TOLL', 'ACCIDENT', 'INSPECTION');--> statement-breakpoint
CREATE TABLE "car_approval_rules" (
	"apr_id" char(36) PRIMARY KEY NOT NULL,
	"ent_id" char(36) NOT NULL,
	"apr_type" "car_expense_type" NOT NULL,
	"apr_requires_approval" integer DEFAULT 0 NOT NULL,
	"apr_auto_threshold" numeric(14, 2),
	"apr_updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "car_expense_attachments" (
	"eat_id" char(36) PRIMARY KEY NOT NULL,
	"ent_id" char(36) NOT NULL,
	"eat_expense_id" char(36) NOT NULL,
	"eat_s3_key" text NOT NULL,
	"eat_mime" varchar(64) NOT NULL,
	"eat_size_bytes" bigint NOT NULL,
	"eat_uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "car_expenses" (
	"exp_id" char(36) PRIMARY KEY NOT NULL,
	"ent_id" char(36) NOT NULL,
	"exp_type" "car_expense_type" NOT NULL,
	"exp_amount" numeric(14, 2) NOT NULL,
	"exp_currency" varchar(3) DEFAULT 'VND' NOT NULL,
	"exp_occurred_at" date NOT NULL,
	"exp_note" text,
	"exp_status" "car_expense_status" DEFAULT 'PENDING' NOT NULL,
	"exp_trip_id" char(36),
	"exp_driver_id" char(36) NOT NULL,
	"exp_submitted_by" char(36) NOT NULL,
	"exp_submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"exp_reviewed_by" char(36),
	"exp_reviewed_at" timestamp with time zone,
	"exp_review_note" text,
	"exp_locked_until" timestamp with time zone NOT NULL,
	"exp_created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"exp_updated_at" timestamp with time zone,
	"exp_deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "car_trips" ADD COLUMN "trp_passenger_phone" varchar(20);--> statement-breakpoint
ALTER TABLE "car_expense_attachments" ADD CONSTRAINT "car_expense_attachments_eat_expense_id_car_expenses_exp_id_fk" FOREIGN KEY ("eat_expense_id") REFERENCES "public"."car_expenses"("exp_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car_expenses" ADD CONSTRAINT "car_expenses_exp_trip_id_car_trips_trp_id_fk" FOREIGN KEY ("exp_trip_id") REFERENCES "public"."car_trips"("trp_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car_expenses" ADD CONSTRAINT "car_expenses_exp_driver_id_car_drivers_drv_id_fk" FOREIGN KEY ("exp_driver_id") REFERENCES "public"."car_drivers"("drv_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car_expenses" ADD CONSTRAINT "car_expenses_exp_submitted_by_car_users_usr_id_fk" FOREIGN KEY ("exp_submitted_by") REFERENCES "public"."car_users"("usr_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car_expenses" ADD CONSTRAINT "car_expenses_exp_reviewed_by_car_users_usr_id_fk" FOREIGN KEY ("exp_reviewed_by") REFERENCES "public"."car_users"("usr_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_car_approval_rules_ent_type" ON "car_approval_rules" USING btree ("ent_id","apr_type");--> statement-breakpoint
CREATE INDEX "idx_car_expense_attachments_expense" ON "car_expense_attachments" USING btree ("eat_expense_id");--> statement-breakpoint
CREATE INDEX "idx_car_expenses_ent_status" ON "car_expenses" USING btree ("ent_id","exp_status");--> statement-breakpoint
CREATE INDEX "idx_car_expenses_ent_driver" ON "car_expenses" USING btree ("ent_id","exp_driver_id");--> statement-breakpoint
CREATE INDEX "idx_car_expenses_ent_occurred" ON "car_expenses" USING btree ("ent_id","exp_occurred_at");--> statement-breakpoint
CREATE INDEX "idx_car_expenses_trip" ON "car_expenses" USING btree ("exp_trip_id");