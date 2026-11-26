import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { DrdJwtPayload } from './interfaces/jwt-payload.interface';
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

  async validate(payload: DrdJwtPayload): Promise<DrdJwtPayload> {
    return {
      sub: payload.sub,
      ent_id: payload.ent_id,
      crp_code: payload.crp_code,
      role: payload.role,
      name: payload.name,
      temp_password: payload.temp_password,
      source: payload.source,
    };
  }
}
