import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_ADMIN_KEY } from '../decorators/admin-only.decorator';
import { AmaJwtPayload } from '../interfaces/ama-jwt-payload.interface';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isAdmin = this.reflector.getAllAndOverride<boolean>(IS_ADMIN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!isAdmin) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as AmaJwtPayload;
    const isAdminLevel = user?.level === 'ADMIN_LEVEL';
    const hasAdminRole = user?.roles?.includes('ADMIN');
    if (!user || (!isAdminLevel && !hasAdminRole)) {
      throw new ForbiddenException({ success: false, data: null, error: { code: 'PLT-E1002', message: 'Admin access required' }, timestamp: new Date().toISOString() });
    }
    return true;
  }
}
