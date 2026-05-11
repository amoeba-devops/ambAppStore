import { z } from 'zod';

export const RoleEnum = z.enum(['ADMIN', 'MANAGER', 'DRIVER']);
export type Role = z.infer<typeof RoleEnum>;

export const UserStatusEnum = z.enum(['ACTIVE', 'DISABLED']);
export type UserStatus = z.infer<typeof UserStatusEnum>;

export const VehicleStatusEnum = z.enum(['ACTIVE', 'MAINTENANCE', 'INACTIVE']);
export type VehicleStatus = z.infer<typeof VehicleStatusEnum>;

export const DriverStatusEnum = z.enum(['ACTIVE', 'INACTIVE']);
export type DriverStatus = z.infer<typeof DriverStatusEnum>;

export const TripStatusEnum = z.enum([
  'PENDING_DRIVER_CONFIRM',
  'CONFIRMED',
  'DRIVER_REJECTED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
]);
export type TripStatus = z.infer<typeof TripStatusEnum>;

export const CostTypeEnum = z.enum([
  'FUEL',
  'OIL_CHANGE',
  'ACCIDENT',
  'MEAL',
  'REPAIR_MAINTENANCE',
]);
export type CostType = z.infer<typeof CostTypeEnum>;

export const CostStatusEnum = z.enum([
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED_TO_PROCEED',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
]);
export type CostStatus = z.infer<typeof CostStatusEnum>;

export const LanguageEnum = z.enum(['en', 'ko', 'vi']);
export type Language = z.infer<typeof LanguageEnum>;

export const PlatformEnum = z.enum(['web', 'ios', 'android']);
export type Platform = z.infer<typeof PlatformEnum>;
