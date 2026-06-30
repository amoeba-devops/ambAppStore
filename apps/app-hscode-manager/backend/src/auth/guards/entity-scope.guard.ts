import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { AmaJwtPayload } from '../interfaces/ama-jwt-payload.interface';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ERROR_CODES } from '../../common/error-codes';
import { HttpStatus } from '@nestjs/common';

/**
 * 멀티테넌시 격리 전제 가드: JWT에 ent_id가 없으면 차단한다. (POL-005, NFR-007)
 * 서비스 계층은 항상 user.entityId 로 데이터를 스코핑한다.
 */
@Injectable()
export class EntityScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AmaJwtPayload | undefined;
    if (!user?.entityId) {
      throw new BusinessException(
        ERROR_CODES.ENTITY_SCOPE_MISSING,
        'Entity (ent_id) context is required',
        HttpStatus.FORBIDDEN,
      );
    }
    return true;
  }
}
