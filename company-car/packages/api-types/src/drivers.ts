import { z } from 'zod';
import { DriverStatusEnum } from './enums';

export const DriverSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  fullName: z.string().min(1).max(200),
  licenseNumber: z.string().min(1).max(50),
  licenseClass: z.string().max(20).nullable(),
  licenseExpiryDate: z.string().date(),
  phone: z.string().max(30).nullable(),
  avatarUrl: z.string().url().nullable(),
  status: DriverStatusEnum,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Driver = z.infer<typeof DriverSchema>;

export const CreateDriverSchema = z.object({
  userId: z.string().uuid().optional(),
  fullName: z.string().min(1).max(200),
  licenseNumber: z.string().min(1).max(50),
  licenseClass: z.string().max(20).optional(),
  licenseExpiryDate: z.string().date(),
  phone: z.string().max(30).optional(),
  avatarUrl: z.string().url().optional(),
  status: DriverStatusEnum.default('ACTIVE'),
});
export type CreateDriverInput = z.infer<typeof CreateDriverSchema>;

export const UpdateDriverSchema = CreateDriverSchema.partial();
export type UpdateDriverInput = z.infer<typeof UpdateDriverSchema>;
