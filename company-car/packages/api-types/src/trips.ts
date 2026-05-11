import { z } from 'zod';
import { LocationSchema } from './common';
import { TripStatusEnum } from './enums';

export const TripSchema = z.object({
  id: z.string().uuid(),
  passengerId: z.string().uuid(),
  driverId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  tripDate: z.string().date(),
  tripTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM'),
  estimatedEndTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  pickupLocation: LocationSchema,
  destination: LocationSchema,
  stopovers: z.array(LocationSchema),
  mapsUrl: z.string().url().nullable(),
  note: z.string().max(1000).nullable(),
  status: TripStatusEnum,
  rejectionReason: z.string().nullable(),
  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Trip = z.infer<typeof TripSchema>;

export const CreateTripSchema = z.object({
  passengerId: z.string().uuid(),
  driverId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  tripDate: z.string().date(),
  tripTime: z.string().regex(/^\d{2}:\d{2}$/),
  pickupLocation: LocationSchema,
  destination: LocationSchema,
  stopovers: z.array(LocationSchema).default([]),
  note: z.string().max(1000).optional(),
});
export type CreateTripInput = z.infer<typeof CreateTripSchema>;

export const UpdateTripSchema = CreateTripSchema.partial();
export type UpdateTripInput = z.infer<typeof UpdateTripSchema>;

export const ConflictCheckSchema = z.object({
  vehicleId: z.string().uuid().optional(),
  driverId: z.string().uuid().optional(),
  date: z.string().date(),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  durationHours: z.coerce.number().min(0.5).max(24).default(4),
  excludeTripId: z.string().uuid().optional(),
});
export type ConflictCheckInput = z.infer<typeof ConflictCheckSchema>;

export const RejectTripSchema = z.object({
  reason: z.string().min(1).max(500),
});

export const ReassignDriverSchema = z.object({
  driverId: z.string().uuid(),
});

export const CancelTripSchema = z.object({
  reason: z.string().min(1).max(500),
});
