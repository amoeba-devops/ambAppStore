import { z } from 'zod';

/**
 * Fleet-access requests (REQ-20260617). These are Server Action inputs (RPC),
 * so they use camelCase like the other member-management actions
 * (update-member.action.ts), not the snake_case REST convention.
 */

export const fleetDepartmentValues = ['CAR', 'TRUCK'] as const;

/** MANAGER asks for access to a second department. */
export const requestFleetAccessSchema = z.object({
  vehicleType: z.enum(fleetDepartmentValues),
  reason: z.string().trim().max(1000).optional(),
});
export type RequestFleetAccessInput = z.infer<typeof requestFleetAccessSchema>;

/** ADMIN approves/rejects a pending request. */
export const decideFleetAccessSchema = z.object({
  requestId: z.string().uuid(),
  decision: z.enum(['APPROVED', 'REJECTED']),
  note: z.string().trim().max(1000).optional(),
});
export type DecideFleetAccessInput = z.infer<typeof decideFleetAccessSchema>;

/** ADMIN directly grants a department to a user (driver onboarding, manager setup). */
export const grantFleetAccessSchema = z.object({
  userId: z.string().uuid(),
  vehicleType: z.enum(fleetDepartmentValues),
});
export type GrantFleetAccessInput = z.infer<typeof grantFleetAccessSchema>;

/** ADMIN revokes a department from a user. */
export const revokeFleetAccessSchema = z.object({
  userId: z.string().uuid(),
  vehicleType: z.enum(fleetDepartmentValues),
});
export type RevokeFleetAccessInput = z.infer<typeof revokeFleetAccessSchema>;
