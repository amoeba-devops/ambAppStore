import { z } from 'zod';
import { TRUCK_REGIONS } from './vehicle.zod.js';

/**
 * Region-access management (REQ-20260813). Server Action inputs (RPC) → camelCase.
 *
 * `regions` is the COMPLETE desired set for that user, not a delta: the action
 * grants what's missing and revokes what's absent. An empty array resets the
 * user to the default (all regions visible).
 */
export const setRegionAccessSchema = z.object({
  userId: z.string().uuid(),
  regions: z.array(z.enum(TRUCK_REGIONS)).max(TRUCK_REGIONS.length),
});
export type SetRegionAccessInput = z.infer<typeof setRegionAccessSchema>;

/** ADMIN clears every grant → user falls back to seeing all regions. */
export const revokeAllRegionAccessSchema = z.object({
  userId: z.string().uuid(),
});
export type RevokeAllRegionAccessInput = z.infer<typeof revokeAllRegionAccessSchema>;
