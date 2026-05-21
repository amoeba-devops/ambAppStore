CREATE TYPE "sal_archive_channel" AS ENUM ('SHOPEE', 'TIKTOK');
--> statement-breakpoint
CREATE TYPE "sal_archive_file_type" AS ENUM ('SALES', 'ADS', 'BRAND_ADS', 'OFF_PLATFORM_ADS', 'TRAFFIC', 'AFFILIATE');
--> statement-breakpoint
CREATE TABLE "sal_archive_files" (
	"arf_id" char(36) PRIMARY KEY NOT NULL,
	"ent_id" char(36) NOT NULL,
	"arf_period_start" date NOT NULL,
	"arf_period_end" date NOT NULL,
	"arf_granularity" "sal_upload_granularity" NOT NULL,
	"arf_week_num" integer,
	"arf_month_idx" integer,
	"arf_year" integer NOT NULL,
	"arf_channel" "sal_archive_channel" NOT NULL,
	"arf_file_type" "sal_archive_file_type" NOT NULL,
	"arf_filename" varchar(512) NOT NULL,
	"arf_s3_key" varchar(1024),
	"arf_size_bytes" bigint NOT NULL,
	"arf_sha256" char(64),
	"arf_mime_type" varchar(255),
	"arf_row_count" integer,
	"arf_revision" integer DEFAULT 1 NOT NULL,
	"arf_replaced_at" timestamp with time zone,
	"arf_uploaded_by" char(36) NOT NULL,
	"arf_uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_sal_arf_ent_period" ON "sal_archive_files" USING btree ("ent_id","arf_period_start","arf_period_end","arf_granularity");
--> statement-breakpoint
CREATE INDEX "idx_sal_arf_ent_current" ON "sal_archive_files" USING btree ("ent_id","arf_replaced_at");
