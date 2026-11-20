import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AmaJwtPayload } from './interfaces/ama-jwt-payload.interface';
import { getJwtSecret } from './jwt-secret';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    });
  }

  async validate(payload: Record<string, any>): Promise<AmaJwtPayload> {
    return {
      sub: payload.sub,
      userId: payload.sub || payload.userId,
      entityId: payload.ent_id || payload.entityId || '',
      entityCode: payload.ent_code || payload.entityCode || '',
      email: payload.email || '',
      name: payload.name || '',
      level: payload.level,
      role: payload.role,
      roles: payload.roles || [],
      iat: payload.iat,
      exp: payload.exp,
    };
  }
}
