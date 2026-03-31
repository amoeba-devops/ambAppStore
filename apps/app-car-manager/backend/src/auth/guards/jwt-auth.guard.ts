import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AmaJwtPayload } from '../interfaces/ama-jwt-payload.interface';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  /**
   * JWT 인증 실패 시 Entity 헤더 기반 인증으로 fallback (스테이징 전용).
   * X-Entity-Id, X-Entity-Code 헤더가 있으면 mock user로 통과.
   */
  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (user) return user;

    // ALLOW_ENTITY_HEADER_AUTH=true 일 때만 Entity 헤더 fallback 허용
    const allowEntityAuth = process.env.ALLOW_ENTITY_HEADER_AUTH === 'true';
    if (!allowEntityAuth) {
      return super.handleRequest(err, user, info, context);
    }

    const request = context.switchToHttp().getRequest();
    const entityId = request.headers['x-entity-id'];
    const entityCode = request.headers['x-entity-code'];

    if (entityId && entityCode) {
      const entityUser: AmaJwtPayload = {
        sub: entityId,
        ent_id: entityId,
        ent_code: entityCode,
        email: request.headers['x-entity-email'] || '',
        name: request.headers['x-entity-name'] || '',
        roles: [],
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400,
        userId: entityId,
        entityId: entityId,
        entityCode: entityCode,
      };
      request.user = entityUser;
      return entityUser;
    }

    return super.handleRequest(err, user, info, context);
  }
}
