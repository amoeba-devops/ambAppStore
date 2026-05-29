-- 0014_prime_cost_gtin_hscode.sql
-- Adds `pcs_gtin` (Global Trade Item Number — EAN/UPC barcode) and
-- `pcs_hs_code` (Harmonized System tariff code) to sal_prime_costs.
-- Both nullable, free-text — Product List page surfaces them for export
-- to customs / barcode systems but the app itself doesn't validate format.

BEGIN;

ALTER TABLE sal_prime_costs
  ADD COLUMN IF NOT EXISTS pcs_gtin VARCHAR(64),
  ADD COLUMN IF NOT EXISTS pcs_hs_code VARCHAR(32);

COMMIT;
