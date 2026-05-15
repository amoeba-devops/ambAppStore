CREATE TABLE "sal_period_snapshots" (
	"psp_id" char(36) PRIMARY KEY NOT NULL,
	"ent_id" char(36) NOT NULL,
	"psp_period_start" date NOT NULL,
	"psp_period_end" date NOT NULL,
	"psp_granularity" "sal_upload_granularity" NOT NULL,
	"psp_week_num" integer,
	"psp_month_idx" integer,
	"psp_year" integer NOT NULL,
	"psp_created_by" char(36) NOT NULL,
	"psp_metrics" jsonb NOT NULL,
	"psp_created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"psp_updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_sal_psp_ent_period" ON "sal_period_snapshots" USING btree ("ent_id","psp_period_start","psp_period_end","psp_granularity");