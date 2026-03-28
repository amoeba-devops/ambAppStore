import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AmaJwtPayload } from '../interfaces/ama-jwt-payload.interface';

export const ROLES_KEY = 'roles';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as AmaJwtPayload;
    if (!user || !requiredRoles.some((role) => user.roles?.includes(role))) {
      throw new ForbiddenException({
        success: false,
        data: null,
        error: { code: 'CAR-E1002', message: 'Insufficient permissions' },
        timestamp: new Date().toISOString(),
      });
    }
    return true;
  }
}
