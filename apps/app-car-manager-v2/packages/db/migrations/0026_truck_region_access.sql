-- REQ-20260813 region-access-control: per-user operating-region allow-list.
--
-- Model is an OVERRIDE list, not a grant list: zero rows for a user means they
-- see every region (so this migration needs no backfill and changes nothing on
-- rollout). Rows NARROW a user down to exactly the listed regions. ADMIN is
-- always all-regions and never needs a row.
--
-- ura_region is varchar(40), matching how regions are already stored on
-- cvh_region / trr_region / tfi_region / tmc_region — deliberately not a pg enum.
--
-- Manual migration (same pattern as 0011/0018): NOT in the drizzle journal.
-- Dev syncs schema via `db:push`; staging/prod apply this file via psql.
-- Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS "car_user_region_access" (
  "ura_id"         char(36) PRIMARY KEY NOT NULL,
  "ent_id"         char(36) NOT NULL,
  "usr_id"         char(36) NOT NULL,
  "ura_region"     varchar(40) NOT NULL,
  "ura_granted_by" char(36),
  "ura_granted_at" timestamptz NOT NULL DEFAULT now(),
  "ura_deleted_at" timestamptz
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "car_user_region_access"
    ADD CONSTRAINT "car_user_region_access_usr_id_car_users_usr_id_fk"
    FOREIGN KEY ("usr_id") REFERENCES "public"."car_users"("usr_id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_car_user_region_access_ent_usr_region"
  ON "car_user_region_access" USING btree ("ent_id", "usr_id", "ura_region")
  WHERE "ura_deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_car_user_region_access_ent_usr"
  ON "car_user_region_access" USING btree ("ent_id", "usr_id");
