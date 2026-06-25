-- 0015_fx_rates.sql
-- Configurable KRW→VND exchange rate per entity (multi-tenant).
-- Versioned via fxr_effective_from — calculator/UI picks the row active
-- as-of a target date (DESC sort + first row). Default seeded with 17.5430
-- (verified from FINAL REPORT.csv: 1,682,035,200 VND ÷ 95,876,006 KRW ≈ 17.544).
--
-- ent_id NULLABLE — NULL row is the global default fallback when an entity
-- has no override (rarely used; mostly here for dev / system bootstrap).

BEGIN;

CREATE TABLE IF NOT EXISTS sal_fx_rates (
  fxr_id              CHAR(36) PRIMARY KEY,
  ent_id              CHAR(36),
  fxr_vnd_per_krw     NUMERIC(10, 4) NOT NULL DEFAULT 17.5430,
  fxr_effective_from  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fxr_source_note     VARCHAR(255),
  fxr_created_by      CHAR(36),
  fxr_created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fxr_deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sal_fxr_ent_effective
  ON sal_fx_rates (ent_id, fxr_effective_from DESC)
  WHERE fxr_deleted_at IS NULL;

-- Seed a global default at the epoch so `getCurrentFxRate(entId)` always
-- returns a row (no NULL handling needed in callers).
INSERT INTO sal_fx_rates (fxr_id, ent_id, fxr_vnd_per_krw, fxr_effective_from, fxr_source_note)
VALUES (
  '00000000-0000-0000-0000-00000000fx00',
  NULL,
  17.5430,
  '1970-01-01 00:00:00+00',
  'Seeded default — SRD §5.5'
)
ON CONFLICT (fxr_id) DO NOTHING;

COMMIT;
