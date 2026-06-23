import { z } from 'zod';

/* Request bodies are snake_case per CLAUDE.md §4.4. */

export const createVehicleSchema = z.object({
  plate_number: z.string().trim().min(1).max(20),
  model: z.string().trim().min(1).max(100),
  make: z.string().trim().max(50).optional(),
  year: z.number().int().min(1990).max(2100).optional(),
  color: z.string().trim().max(50).optional(),
  fuel_type: z.enum(['PETROL', 'DIESEL', 'HYBRID', 'EV']).optional(),
  odometer_km: z.number().int().nonnegative().optional(),
  oil_interval_km: z.number().int().min(1000).max(30000).optional(),
  oil_interval_months: z.number().int().min(1).max(24).optional(),
  /* Odometer (km) at the last oil change — makes the "next oil due" figure a
   * real configured value instead of a default-derived guess. */
  last_oil_change_km: z.number().int().nonnegative().max(10000000).optional(),
  home_base: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(2000).optional(),
  /* Fleet department (REQ-20260617). Defaults to CAR server-side when omitted,
   * so the existing car create form needs no change. */
  vehicle_type: z.enum(['CAR', 'TRUCK']).optional(),
  /* Truck-only attributes (tonnage in tons, fuel quota in L/100km). */
  tonnage: z.number().nonnegative().max(100).optional(),
  fuel_quota: z.number().nonnegative().max(200).optional(),
});
export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;

export const updateVehicleSchema = createVehicleSchema.partial().extend({
  status: z.enum(['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'RETIRED']).optional(),
});
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
