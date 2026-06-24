import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

export const HscodeRole = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  EXPERT_LOCAL: 'EXPERT_LOCAL',
  EXPERT_INTERNAL: 'EXPERT_INTERNAL',
  VIEWER: 'VIEWER',
} as const;

export type HscodeRoleType = (typeof HscodeRole)[keyof typeof HscodeRole];

export const Roles = (...roles: HscodeRoleType[]) => SetMetadata(ROLES_KEY, roles);
