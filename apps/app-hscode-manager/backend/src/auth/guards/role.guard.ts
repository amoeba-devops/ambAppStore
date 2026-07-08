import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_ADMIN_KEY } from '../decorators/admin-only.decorator';
import { IS_SUPER_ADMIN_KEY } from '../decorators/super-admin-only.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AmaJwtPayload } from '../interfaces/ama-jwt-payload.interface';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ERROR_CODES } from '../../common/error-codes';

/**
 * AMA 엔티티 관리자 역할 (auth.decorator @MasterOrAbove 와 동일 집합).
 * App Store SSO 토큰은 단일 `role`을 담고, jwt.strategy가 이를 roles[]에 반영한다.
 */
const ADMIN_ROLES = ['ADMIN', 'MASTER', 'SUPER_ADMIN'];

/** 플랫폼 슈퍼관리자 — 전역 참조 데이터 쓰기 등 전 테넌트 공용 리소스 전용. */
const SUPER_ADMIN_ROLE = 'SUPER_ADMIN';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isSuperAdmin = this.reflector.getAllAndOverride<boolean>(
      IS_SUPER_ADMIN_KEY,
      [context.getHandler(), context.getClass()],
    );
    const isAdmin = this.reflector.getAllAndOverride<boolean>(IS_ADMIN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!isSuperAdmin && !isAdmin && (!requiredRoles || requiredRoles.length === 0)) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AmaJwtPayload | undefined;
    const isAdminLevel = user?.level === 'ADMIN_LEVEL';
    const hasAdminRole = user?.roles?.some((r) => ADMIN_ROLES.includes(r)) ?? false;

    // 슈퍼관리자 전용: 테넌트 관리자(MASTER/ADMIN)는 차단, SUPER_ADMIN role만 통과. (fail-closed)
    if (isSuperAdmin) {
      if (user?.roles?.includes(SUPER_ADMIN_ROLE)) return true;
      throw new BusinessException(
        ERROR_CODES.FORBIDDEN_ROLE,
        'Platform super-admin role required for this resource',
        HttpStatus.FORBIDDEN,
      );
    }

    if (isAdmin && (isAdminLevel || hasAdminRole)) return true;

    if (requiredRoles?.length && user?.roles?.some((r) => requiredRoles.includes(r))) {
      return true;
    }

    throw new BusinessException(
      ERROR_CODES.FORBIDDEN_ROLE,
      'Insufficient role for this resource',
      HttpStatus.FORBIDDEN,
    );
  }
}
