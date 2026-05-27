-- 0009_selling_price_versions.sql
-- Adds versioned selling-price support per the Phase 1.2 versioning plan.
-- Backfills 1 sentinel version (effective_from = 2020-01-01) per existing SKU
-- whose pcs_selling_price_vnd is NOT NULL.
--
-- See REQ-20260526-price-versioning + PLAN-20260526-price-versioning.

BEGIN;

CREATE TABLE IF NOT EXISTS sal_selling_price_versions (
  spv_id                CHAR(36) PRIMARY KEY,
  ent_id                CHAR(36) NOT NULL,
  pcs_id                CHAR(36) NOT NULL REFERENCES sal_prime_costs(pcs_id) ON DELETE CASCADE,
  spv_effective_from    DATE NOT NULL,
  spv_selling_price_vnd NUMERIC(18, 2) NOT NULL CHECK (spv_selling_price_vnd >= 0),
  spv_source_note       VARCHAR(255),
  spv_created_by        CHAR(36) NOT NULL,
  spv_created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  spv_updated_at        TIMESTAMPTZ,
  spv_deleted_at        TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_sal_spv_ent_sku_date
  ON sal_selling_price_versions (ent_id, pcs_id, spv_effective_from)
  WHERE spv_deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sal_spv_ent_sku_date
  ON sal_selling_price_versions (ent_id, pcs_id, spv_effective_from);

CREATE INDEX IF NOT EXISTS idx_sal_spv_ent_eff
  ON sal_selling_price_versions (ent_id, spv_effective_from);

INSERT INTO sal_selling_price_versions
  (spv_id, ent_id, pcs_id, spv_effective_from, spv_selling_price_vnd,
   spv_source_note, spv_created_by, spv_created_at)
SELECT
  gen_random_uuid()::TEXT,
  pc.ent_id,
  pc.pcs_id,
  DATE '2020-01-01',
  pc.pcs_selling_price_vnd,
  'Backfilled from sal_prime_costs migration 0009',
  pc.pcs_created_by,
  pc.pcs_created_at
FROM sal_prime_costs pc
WHERE pc.pcs_deleted_at IS NULL
  AND pc.pcs_selling_price_vnd IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sal_selling_price_versions v
    WHERE v.pcs_id = pc.pcs_id AND v.spv_deleted_at IS NULL
  );

COMMIT;

-- Verification (run separately):
--   SELECT
--     (SELECT COUNT(*) FROM sal_prime_costs WHERE pcs_deleted_at IS NULL AND pcs_selling_price_vnd IS NOT NULL) AS master_with_selling,
--     (SELECT COUNT(*) FROM sal_selling_price_versions WHERE spv_deleted_at IS NULL) AS versions_total;
