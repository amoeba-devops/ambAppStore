import { SetMetadata, applyDecorators, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RoleGuard } from '../guards/role.guard';

export const AUTH_KEY = 'isAuthenticated';

export function Auth(...roles: string[]) {
  return applyDecorators(
    SetMetadata(AUTH_KEY, true),
    SetMetadata('roles', roles.length ? roles : undefined),
    UseGuards(JwtAuthGuard, RoleGuard),
  );
}
