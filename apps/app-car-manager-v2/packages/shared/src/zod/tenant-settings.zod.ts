import { z } from 'zod';

/* Allowlist enforced both here and in service layer — never trust direct
 * action calls. Match the option set shown in the Settings page UI. */

export const updateTenantNameSchema = z.object({
  tenant_name: z.string().trim().max(120).nullable(),
});
export type UpdateTenantNameInput = z.infer<typeof updateTenantNameSchema>;

export const updateAppNameSchema = z.object({
  app_name: z.string().trim().max(120).nullable(),
});
export type UpdateAppNameInput = z.infer<typeof updateAppNameSchema>;

export const updateCurrencySchema = z.object({
  currency: z.enum(['VND', 'KRW', 'USD']),
});
export type UpdateCurrencyInput = z.infer<typeof updateCurrencySchema>;

/* Service-layer allowlist constrains further to {Asia/Ho_Chi_Minh, Asia/Seoul}.
 * Zod here just guards the wire-format envelope. */
export const updateTimezoneSchema = z.object({
  timezone: z.string().min(1).max(64),
});
export type UpdateTimezoneInput = z.infer<typeof updateTimezoneSchema>;

export const updateNotifPrefSchema = z.object({
  field: z.enum(['inapp', 'email', 'digest']),
  value: z.boolean(),
});
export type UpdateNotifPrefInput = z.infer<typeof updateNotifPrefSchema>;

export const updateRetentionSchema = z.object({
  field: z.enum(['trip', 'audit']),
  /* NULL allowed only for audit (= indefinite). Service validates per-field. */
  years: z.number().int().positive().nullable(),
});
export type UpdateRetentionInput = z.infer<typeof updateRetentionSchema>;

/** Truck depot address — default origin/return for all truck trip forms. */
export const updateDepotAddressSchema = z.object({
  depot_address: z.string().trim().max(500).nullable(),
});
export type UpdateDepotAddressInput = z.infer<typeof updateDepotAddressSchema>;
