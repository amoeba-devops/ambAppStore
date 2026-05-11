import { z } from 'zod';
import { CostStatusEnum, CostTypeEnum } from './enums';

export const FuelMetadataSchema = z.object({
  liters: z.number().positive(),
  unitPrice: z.number().positive(),
  gasStation: z.string().max(200).optional(),
  currentKm: z.number().int().min(0).optional(),
});

export const OilChangeMetadataSchema = z.object({
  oilType: z.string().max(100),
  currentKm: z.number().int().min(0),
});

export const AccidentMetadataSchema = z.object({
  description: z.string().min(1).max(2000),
});

export const MealMetadataSchema = z.object({
  numberOfPeople: z.number().int().min(1),
});

export const RepairMaintenanceMetadataSchema = z.object({
  itemDescription: z.string().min(1).max(2000),
  provider: z.string().max(200).optional(),
});

export const CostMetadataSchema = z.union([
  FuelMetadataSchema,
  OilChangeMetadataSchema,
  AccidentMetadataSchema,
  MealMetadataSchema,
  RepairMaintenanceMetadataSchema,
  z.record(z.unknown()),
]);

export const CostAttachmentSchema = z.object({
  id: z.string().uuid(),
  costId: z.string().uuid(),
  fileUrl: z.string().url(),
  fileKey: z.string(),
  fileType: z.string(),
  uploadedBy: z.string().uuid(),
  createdAt: z.string().datetime(),
});
export type CostAttachment = z.infer<typeof CostAttachmentSchema>;

export const CostSchema = z.object({
  id: z.string().uuid(),
  type: CostTypeEnum,
  vehicleId: z.string().uuid(),
  tripId: z.string().uuid().nullable(),
  costDate: z.string().date(),
  amount: z.string(),
  currency: z.string().default('VND'),
  description: z.string().nullable(),
  metadata: z.record(z.unknown()),
  status: CostStatusEnum,
  rejectionReason: z.string().nullable(),
  submittedBy: z.string().uuid(),
  approvedBy: z.string().uuid().nullable(),
  approvedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  attachments: z.array(CostAttachmentSchema).optional(),
});
export type Cost = z.infer<typeof CostSchema>;

export const CreateCostBaseSchema = z.object({
  type: CostTypeEnum,
  vehicleId: z.string().uuid(),
  tripId: z.string().uuid().optional(),
  costDate: z.string().date(),
  amount: z.coerce.number().positive(),
  currency: z.string().default('VND'),
  description: z.string().max(2000).optional(),
  metadata: z.record(z.unknown()),
});
export type CreateCostInput = z.infer<typeof CreateCostBaseSchema>;

export const UpdateCostSchema = CreateCostBaseSchema.partial();
export type UpdateCostInput = z.infer<typeof UpdateCostSchema>;

export const RejectCostSchema = z.object({
  reason: z.string().min(1).max(500),
});

export const PresignedUploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileType: z.enum(['image/jpeg', 'image/png', 'application/pdf']),
  fileSize: z.number().int().positive().max(10 * 1024 * 1024),
});
export type PresignedUploadInput = z.infer<typeof PresignedUploadSchema>;
