import { z } from 'zod';

export const createTripSchema = z.object({
  passenger_id: z.string().uuid().optional(),
  pickup_address: z.string().trim().min(1).max(2000),
  dropoff_address: z.string().trim().min(1).max(2000),
  scheduled_at: z.string().datetime({ offset: true }),
  duration_minutes: z.number().int().min(5).max(1440).optional(),
  purpose: z.string().trim().max(255).optional(),
  notes: z.string().trim().max(2000).optional(),
  driver_id: z.string().uuid().optional(),
  vehicle_id: z.string().uuid().optional(),
  /* PRD FR-1.1 row 6: "Có thể thêm nhiều điểm ghé". Cap at 10 to keep the
   * gmaps URL under ~2KB and avoid unreasonable trips. */
  stopovers: z.array(z.string().trim().min(1).max(2000)).max(10).optional(),
});
export type CreateTripInput = z.infer<typeof createTripSchema>;

export const updateTripSchema = z.object({
  passenger_id: z.string().uuid().nullable().optional(),
  pickup_address: z.string().trim().min(1).max(2000).optional(),
  dropoff_address: z.string().trim().min(1).max(2000).optional(),
  scheduled_at: z.string().datetime({ offset: true }).optional(),
  duration_minutes: z.number().int().min(5).max(1440).nullable().optional(),
  purpose: z.string().trim().max(255).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});
export type UpdateTripInput = z.infer<typeof updateTripSchema>;

export const assignTripSchema = z.object({
  driver_id: z.string().uuid(),
  vehicle_id: z.string().uuid(),
});
export type AssignTripInput = z.infer<typeof assignTripSchema>;

export const rejectTripSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});
export type RejectTripInput = z.infer<typeof rejectTripSchema>;

export const startTripSchema = z.object({
  start_odometer: z.number().int().nonnegative().optional(),
});
export type StartTripInput = z.infer<typeof startTripSchema>;

export const endTripSchema = z.object({
  end_odometer: z.number().int().nonnegative().optional(),
});
export type EndTripInput = z.infer<typeof endTripSchema>;

export const cancelTripSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});
export type CancelTripInput = z.infer<typeof cancelTripSchema>;

export const fetchCalendarRangeSchema = z.object({
  range_start: z.string().datetime({ offset: true }),
  range_end: z.string().datetime({ offset: true }),
});
export type FetchCalendarRangeInput = z.infer<typeof fetchCalendarRangeSchema>;
