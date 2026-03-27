import { SetMetadata, applyDecorators, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RoleGuard } from '../guards/role.guard';

export const AUTH_KEY = 'isAuthenticated';

export function Auth() {
  return applyDecorators(
    SetMetadata(AUTH_KEY, true),
    UseGuards(JwtAuthGuard, RoleGuard),
  );
}
