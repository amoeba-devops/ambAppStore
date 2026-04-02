import { Injectable, CanActivate, ExecutionContext, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BusinessException } from '../../common/exceptions/business.exception';
import { DrdJwtPayload } from '../interfaces/jwt-payload.interface';
import { UserRole } from '../../common/constants/enums';

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
    const user = request.user as DrdJwtPayload;
    if (!user) {
      throw new BusinessException('DRD-E1008', 'Access denied', HttpStatus.FORBIDDEN);
    }

    if (user.role === UserRole.SYSTEM_ADMIN) return true;

    if (!requiredRoles.includes(user.role)) {
      throw new BusinessException('DRD-E1008', 'Insufficient permissions', HttpStatus.FORBIDDEN);
    }
    return true;
  }
}
