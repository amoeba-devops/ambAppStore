import { z } from 'zod';

/**
 * Truck trip-log inputs (REQ-20260617). Server Action inputs (RPC), camelCase
 * like the other action schemas. A manager typically logs an already-finished
 * trip (mark_completed=true with full metrics); an unassigned entry can be
 * created first and assigned/completed later.
 */
export const createTruckTripSchema = z.object({
  scheduled_at: z.string().min(1),
  vehicle_id: z.string().uuid().optional(),
  driver_id: z.string().uuid().optional(),
  customer: z.string().trim().max(255).optional(),
  pickup_address: z.string().trim().min(1).max(500),
  dropoff_address: z.string().trim().min(1).max(500),
  bol: z.string().trim().max(64).optional(),
  cdf: z.string().trim().max(64).optional(),
  fuel_price: z.number().nonnegative().optional(),
  revenue: z.number().nonnegative().optional(),
  notes: z.string().trim().max(2000).optional(),
  /* Completion metrics — present when logging a finished trip in one step. */
  mark_completed: z.boolean().optional(),
  start_odometer: z.number().int().nonnegative().optional(),
  end_odometer: z.number().int().nonnegative().optional(),
  fuel_liters: z.number().nonnegative().optional(),
  toll_fee: z.number().nonnegative().optional(),
  other_amount: z.number().nonnegative().optional(),
  other_note: z.string().trim().max(255).optional(),
});
export type CreateTruckTripInputDto = z.infer<typeof createTruckTripSchema>;

export const updateTruckTripSchema = createTruckTripSchema.extend({
  trip_id: z.string().uuid(),
});
export type UpdateTruckTripInputDto = z.infer<typeof updateTruckTripSchema>;

export const deleteTruckTripSchema = z.object({ trip_id: z.string().uuid() });

export const assignTruckTripSchema = z.object({
  trip_id: z.string().uuid(),
  driver_id: z.string().uuid(),
  vehicle_id: z.string().uuid(),
});
export type AssignTruckTripInputDto = z.infer<typeof assignTruckTripSchema>;

/** Driver completion (P-E): metrics + structured extra costs. */
export const completeTruckTripSchema = z.object({
  trip_id: z.string().uuid(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  end_odometer: z.number().int().nonnegative().optional(),
  fuel_liters: z.number().nonnegative().optional(),
  toll_fee: z.number().nonnegative().optional(),
  extra_costs: z
    .array(z.object({ name: z.string().trim().min(1).max(255), amount: z.number().nonnegative() }))
    .max(50)
    .optional(),
});
export type CompleteTruckTripInputDto = z.infer<typeof completeTruckTripSchema>;
