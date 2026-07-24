-- 0023_vehicle_fuel_price.sql
-- REQ-20260724: per-vehicle fuel unit price (VND/L). Combined with the existing
-- cvh_fuel_quota (L/100km) it drives the DEFAULT per-trip fuel cost —
-- km × (cvh_fuel_quota/100) × cvh_fuel_price — computed live (no fuel invoices)
-- when the trip's month/region has no frozen reconciliation snapshot.
-- Nullable (cars + existing trucks unaffected). Apply manually on every branch.
-- Idempotent.

ALTER TABLE car_vehicles ADD COLUMN IF NOT EXISTS cvh_fuel_price DECIMAL(14, 2);
