import { z } from 'zod';

export const createDriverSchema = z.object({
  user_id: z.string().uuid(),
  license_number: z.string().trim().min(1).max(50),
  license_class: z.enum(['A2', 'B1', 'B2', 'C', 'D', 'E', 'F']),
  license_expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
  phone: z.string().trim().max(20).optional(),
  emergency_contact: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(2000).optional(),
});
export type CreateDriverInput = z.infer<typeof createDriverSchema>;

export const updateDriverSchema = createDriverSchema.omit({ user_id: true }).partial().extend({
  status: z.enum(['AVAILABLE', 'ON_TRIP', 'OFF_DUTY', 'UNAVAILABLE']).optional(),
});
export type UpdateDriverInput = z.infer<typeof updateDriverSchema>;
