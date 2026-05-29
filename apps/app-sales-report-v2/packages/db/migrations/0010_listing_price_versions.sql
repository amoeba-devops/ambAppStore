-- 0010_listing_price_versions.sql
-- Adds versioned listing-price support per the Phase 1.2 versioning plan.
-- Backfills 1 sentinel version (effective_from = 2020-01-01) per existing SKU
-- whose pcs_listing_price_vnd is NOT NULL.
--
-- See REQ-20260526-price-versioning + PLAN-20260526-price-versioning.

BEGIN;

CREATE TABLE IF NOT EXISTS sal_listing_price_versions (
  lpv_id                CHAR(36) PRIMARY KEY,
  ent_id                CHAR(36) NOT NULL,
  pcs_id                CHAR(36) NOT NULL REFERENCES sal_prime_costs(pcs_id) ON DELETE CASCADE,
  lpv_effective_from    DATE NOT NULL,
  lpv_listing_price_vnd NUMERIC(18, 2) NOT NULL CHECK (lpv_listing_price_vnd >= 0),
  lpv_source_note       VARCHAR(255),
  lpv_created_by        CHAR(36) NOT NULL,
  lpv_created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lpv_updated_at        TIMESTAMPTZ,
  lpv_deleted_at        TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_sal_lpv_ent_sku_date
  ON sal_listing_price_versions (ent_id, pcs_id, lpv_effective_from)
  WHERE lpv_deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sal_lpv_ent_sku_date
  ON sal_listing_price_versions (ent_id, pcs_id, lpv_effective_from);

CREATE INDEX IF NOT EXISTS idx_sal_lpv_ent_eff
  ON sal_listing_price_versions (ent_id, lpv_effective_from);

INSERT INTO sal_listing_price_versions
  (lpv_id, ent_id, pcs_id, lpv_effective_from, lpv_listing_price_vnd,
   lpv_source_note, lpv_created_by, lpv_created_at)
SELECT
  gen_random_uuid()::TEXT,
  pc.ent_id,
  pc.pcs_id,
  DATE '2020-01-01',
  pc.pcs_listing_price_vnd,
  'Backfilled from sal_prime_costs migration 0010',
  pc.pcs_created_by,
  pc.pcs_created_at
FROM sal_prime_costs pc
WHERE pc.pcs_deleted_at IS NULL
  AND pc.pcs_listing_price_vnd IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sal_listing_price_versions v
    WHERE v.pcs_id = pc.pcs_id AND v.lpv_deleted_at IS NULL
  );

COMMIT;

-- Verification (run separately):
--   SELECT
--     (SELECT COUNT(*) FROM sal_prime_costs WHERE pcs_deleted_at IS NULL AND pcs_listing_price_vnd IS NOT NULL) AS master_with_listing,
--     (SELECT COUNT(*) FROM sal_listing_price_versions WHERE lpv_deleted_at IS NULL) AS versions_total;
