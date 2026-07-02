import { z } from 'zod';

/** Upsert a truck's monthly fixed costs (REQ-20260617). month = 'YYYY-MM'. */
export const upsertTruckFixedCostSchema = z.object({
  vehicle_id: z.string().uuid(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  salary: z.number().nonnegative(),
  depreciation: z.number().nonnegative(),
  insurance: z.number().nonnegative(),
});
export type UpsertTruckFixedCostInput = z.infer<typeof upsertTruckFixedCostSchema>;
