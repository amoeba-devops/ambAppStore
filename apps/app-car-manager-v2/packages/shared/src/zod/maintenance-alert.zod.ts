import { z } from 'zod';

/**
 * Maintenance Alert Zod schemas — REQ-20260519 §3.7.
 */

export const acknowledgeAlertSchema = z.object({
  alert_id: z.string().uuid(),
});
export type AcknowledgeAlertInput = z.infer<typeof acknowledgeAlertSchema>;

export const resetOilChangeSchema = z.object({
  vehicle_id: z.string().uuid(),
  odometer_km: z.number().int().nonnegative().max(2_000_000),
  changed_at: z.string().datetime({ offset: true }),
  note: z.string().trim().max(500).optional(),
});
export type ResetOilChangeInput = z.infer<typeof resetOilChangeSchema>;

export const listMaintenanceAlertsQuerySchema = z.object({
  vehicle_id: z.string().uuid().optional(),
  status: z.enum(['UNRESOLVED', 'RESOLVED', 'ALL']).optional().default('UNRESOLVED'),
  limit: z.number().int().min(1).max(100).optional().default(20),
});
export type ListMaintenanceAlertsQuery = z.infer<typeof listMaintenanceAlertsQuerySchema>;
