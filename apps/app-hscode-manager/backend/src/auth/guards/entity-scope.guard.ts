import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AmaJwtPayload } from '../interfaces/ama-jwt-payload.interface';

/**
 * EntityScopeGuard — JWT에 ent_id가 부착되어 있는지 확인.
 * 실제 행 수준 필터링은 각 Service 레이어에서 user.entityId 기반으로 적용한다.
 * (RLS 또는 Repository 헬퍼 활용 — NFR-SE-01 충족)
 */
@Injectable()
export class EntityScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AmaJwtPayload | undefined;

    if (!user?.entityId) {
      throw new UnauthorizedException({
        success: false,
        data: null,
        error: {
          code: 'HSC-E0105',
          message: 'Entity scope is required for this resource',
        },
        timestamp: new Date().toISOString(),
      });
    }
    return true;
  }
}
