import { z } from 'zod';

/**
 * Truck maintenance record inputs (REQ-20260904). Server Action inputs (RPC),
 * snake_case. Dates are plain 'YYYY-MM-DD' — the window is DATE-granular, both
 * ends inclusive, matching how truck trips are scheduled (by date).
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

const maintenanceFields = {
  vehicle_id: z.string().uuid(),
  start_date: isoDate,
  end_date: isoDate,
  /* VND. 0 is allowed — a warranty job still takes the truck off the road. */
  cost: z.number().nonnegative().max(1_000_000_000_000),
};

export const createTruckMaintenanceSchema = z
  .object(maintenanceFields)
  .refine((d) => d.end_date >= d.start_date, {
    path: ['end_date'],
    message: 'end_date must be on or after start_date',
  });
export type CreateTruckMaintenanceInputDto = z.infer<typeof createTruckMaintenanceSchema>;

export const updateTruckMaintenanceSchema = z
  .object({ ...maintenanceFields, maintenance_id: z.string().uuid() })
  .refine((d) => d.end_date >= d.start_date, {
    path: ['end_date'],
    message: 'end_date must be on or after start_date',
  });
export type UpdateTruckMaintenanceInputDto = z.infer<typeof updateTruckMaintenanceSchema>;

export const deleteTruckMaintenanceSchema = z.object({ maintenance_id: z.string().uuid() });

/** Read-only conflict preview the form calls while the user picks truck/dates. */
export const previewTruckMaintenanceConflictsSchema = z
  .object({
    start_date: isoDate,
    end_date: isoDate,
    vehicle_id: z.string().uuid().optional(),
    /* When editing — ignore the record itself in the overlap list. */
    exclude_id: z.string().uuid().optional(),
  })
  .refine((d) => d.end_date >= d.start_date, { path: ['end_date'] });
export type PreviewTruckMaintenanceConflictsDto = z.infer<typeof previewTruckMaintenanceConflictsSchema>;
