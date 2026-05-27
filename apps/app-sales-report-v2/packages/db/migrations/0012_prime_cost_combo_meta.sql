-- 0012_prime_cost_combo_meta.sql
-- Adds optional combo metadata for SKUs marked is_combo=true.
-- Shape: { ownSku?: string, componentSkus?: string[] }
-- Phase 1: reference data only — admin enters, UI displays. Calculator does NOT
-- consume yet. Phase 2 (inventory decomposition) will reuse the same field.

BEGIN;

ALTER TABLE sal_prime_costs
  ADD COLUMN IF NOT EXISTS pcs_combo_meta JSONB;

COMMIT;
