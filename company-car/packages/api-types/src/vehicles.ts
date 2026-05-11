import { z } from 'zod';
import { VehicleStatusEnum } from './enums';

export const VehicleSchema = z.object({
  id: z.string().uuid(),
  licensePlate: z.string().min(1).max(20),
  vehicleType: z.string().min(1).max(100),
  manufactureYear: z.number().int().min(1900).max(2100).nullable(),
  color: z.string().max(50).nullable(),
  photos: z.array(z.string().url()),
  currentKm: z.number().int().min(0),
  oilChangeIntervalKm: z.number().int().min(1),
  lastOilChangeKm: z.number().int().min(0),
  assignedDriverId: z.string().uuid().nullable(),
  status: VehicleStatusEnum,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Vehicle = z.infer<typeof VehicleSchema>;

export const CreateVehicleSchema = z.object({
  licensePlate: z.string().min(1).max(20),
  vehicleType: z.string().min(1).max(100),
  manufactureYear: z.number().int().min(1900).max(2100).optional(),
  color: z.string().max(50).optional(),
  photos: z.array(z.string().url()).default([]),
  currentKm: z.number().int().min(0).default(0),
  oilChangeIntervalKm: z.number().int().min(1).default(5000),
  lastOilChangeKm: z.number().int().min(0).default(0),
  assignedDriverId: z.string().uuid().optional(),
  status: VehicleStatusEnum.default('ACTIVE'),
});
export type CreateVehicleInput = z.infer<typeof CreateVehicleSchema>;

export const UpdateVehicleSchema = CreateVehicleSchema.partial();
export type UpdateVehicleInput = z.infer<typeof UpdateVehicleSchema>;
