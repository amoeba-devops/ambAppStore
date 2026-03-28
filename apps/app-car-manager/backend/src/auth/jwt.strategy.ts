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

  async validate(payload: any): Promise<AmaJwtPayload> {
    return {
      sub: payload.sub || payload.userId,
      ent_id: payload.ent_id || payload.entityId,
      ent_code: payload.ent_code || payload.entityCode,
      email: payload.email,
      name: payload.name,
      roles: payload.roles || [],
      iat: payload.iat,
      exp: payload.exp,
      userId: payload.sub || payload.userId,
      entityId: payload.ent_id || payload.entityId,
      entityCode: payload.ent_code || payload.entityCode,
    };
  }
}
