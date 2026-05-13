CREATE TABLE "sal_prime_costs" (
	"pcs_id" char(36) PRIMARY KEY NOT NULL,
	"ent_id" char(36) NOT NULL,
	"pcs_product_id" varchar(64),
	"pcs_variation_code" varchar(32),
	"pcs_product_name_vi" varchar(512) NOT NULL,
	"pcs_product_name_en" varchar(512),
	"pcs_sku_code" varchar(128) NOT NULL,
	"pcs_prime_cost_vnd" numeric(18, 2) NOT NULL,
	"pcs_selling_price_vnd" numeric(18, 2),
	"pcs_listing_price_vnd" numeric(18, 2),
	"pcs_created_by" char(36) NOT NULL,
	"pcs_created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"pcs_updated_at" timestamp with time zone,
	"pcs_deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_sal_pcs_ent_sku" ON "sal_prime_costs" USING btree ("ent_id","pcs_sku_code") WHERE pcs_deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_sal_pcs_ent_name" ON "sal_prime_costs" USING btree ("ent_id","pcs_product_name_vi");