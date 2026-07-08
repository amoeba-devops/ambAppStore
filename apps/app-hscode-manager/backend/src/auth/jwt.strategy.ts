import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AmaJwtPayload } from './interfaces/ama-jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'default-secret',
    });
  }

  async validate(payload: Record<string, any>): Promise<AmaJwtPayload> {
    // AMA App Store SSO 토큰(iframe-token.service)은 단일 `role` 문자열만 담고 roles[]/level은 없다.
    // 다운스트림 RoleGuard가 roles[]로 판정하므로 role을 roles에 접어 넣어 정합시킨다.
    const rawRoles: string[] = Array.isArray(payload.roles) ? payload.roles : [];
    const roles =
      payload.role && !rawRoles.includes(payload.role)
        ? [...rawRoles, payload.role]
        : rawRoles;

    return {
      sub: payload.sub,
      userId: payload.sub || payload.userId,
      entityId: payload.ent_id || payload.entityId || '',
      entityCode: payload.ent_code || payload.entityCode || '',
      email: payload.email || '',
      name: payload.name || '',
      level: payload.level,
      role: payload.role,
      roles,
      iat: payload.iat,
      exp: payload.exp,
    };
  }
}
