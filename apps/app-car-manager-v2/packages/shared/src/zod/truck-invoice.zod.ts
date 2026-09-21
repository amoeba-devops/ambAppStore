import { z } from 'zod';
import { TRUCK_REGIONS } from './vehicle.zod.js';
import type { TripCostKind } from './truck-trip.zod.js';

/**
 * Truck Invoice module (REQ-20260921) — read-only aggregate of every
 * hóa đơn/chứng từ uploaded across 4 sources. Query filter input (RPC,
 * snake_case) + the unified "loại hóa đơn" taxonomy (REQ §3.3).
 */

export const TRUCK_INVOICE_SOURCES = ['TRIP_COST', 'MAINTENANCE', 'EXPENSE', 'FUEL_INVOICE'] as const;
export type TruckInvoiceSource = (typeof TRUCK_INVOICE_SOURCES)[number];

/**
 * Unified "loại hóa đơn" codes across all 4 sources. Kept per-source rather
 * than merged when names collide (e.g. REPAIR exists as both a trip cost
 * bucket and an Expense type, but they're different business flows) — see
 * REQ-20260921 §3.3 / Decision Log D7. i18n label lives at
 * `screens.truckInvoices.typeVal.<code>`.
 */
export const TRUCK_INVOICE_TYPE_CODES = [
  'TRIP_FUEL',
  'TRIP_TOLL',
  'TRIP_CLEANING',
  'TRIP_REPAIR',
  'TRIP_FERRY',
  'TRIP_LOADING',
  'TRIP_EXTRA',
  'MAINTENANCE',
  'EXPENSE_FUEL',
  'EXPENSE_OIL',
  'EXPENSE_MEAL',
  'EXPENSE_REPAIR',
  'EXPENSE_PARKING',
  'EXPENSE_TOLL',
  'EXPENSE_ACCIDENT',
  'EXPENSE_INSPECTION',
  'FUEL_INVOICE',
] as const;
export type TruckInvoiceTypeCode = (typeof TRUCK_INVOICE_TYPE_CODES)[number];

/** Trip-cost bucket (FUEL/TOLL/…) → unified type code. */
export function tripCostInvoiceType(costKind: TripCostKind): TruckInvoiceTypeCode {
  return `TRIP_${costKind}` as TruckInvoiceTypeCode;
}

/** car_expenses.exp_type (FUEL/OIL/MEAL/…) → unified type code. */
export function expenseInvoiceType(expType: string): TruckInvoiceTypeCode {
  return `EXPENSE_${expType}` as TruckInvoiceTypeCode;
}

export const truckInvoiceFilterSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  region: z.enum(TRUCK_REGIONS).optional(),
  vehicle_id: z.string().uuid().optional(),
  type: z.enum(TRUCK_INVOICE_TYPE_CODES).optional(),
  /** Free-text search on "Tên hóa đơn" — same `?q=` convention as
   * DebouncedSearchInput elsewhere in the app (truck/fleet, truck/trips, …). */
  q: z.string().optional(),
  page: z.number().int().min(1).optional(),
});
export type TruckInvoiceFilterInput = z.infer<typeof truckInvoiceFilterSchema>;

export const TRUCK_INVOICE_PAGE_SIZE = 20;
