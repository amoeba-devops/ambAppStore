import { Injectable, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { BusinessException } from '../common/exceptions/business.exception';
import { DrdJwtPayload } from './interfaces/jwt-payload.interface';
import { UserRole } from '../common/constants/enums';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  async amaSsoExchange(amaToken: string) {
    let amaPayload: any;
    try {
      amaPayload = this.jwtService.decode(amaToken);
    } catch {
      throw new BusinessException('DRD-E1011', 'Invalid AMA token', HttpStatus.UNAUTHORIZED);
    }
    if (!amaPayload?.entityId || !amaPayload?.email) {
      throw new BusinessException('DRD-E1011', 'Invalid AMA token payload', HttpStatus.UNAUTHORIZED);
    }

    const { sub, entityId, email, role, appCode } = amaPayload;

    const validAppCodes = ['app-sales-report', 'sales-report', 'apps-sales'];
    if (appCode && !validAppCodes.includes(appCode)) {
      throw new BusinessException('DRD-E1012', 'Invalid app code', HttpStatus.FORBIDDEN);
    }

    const payload: DrdJwtPayload = {
      sub: sub || entityId,
      ent_id: entityId,
      crp_code: amaPayload.entityCode || null,
      role: role === 'MASTER' ? UserRole.ADMIN : UserRole.OPERATOR,
      name: amaPayload.name || email.split('@')[0],
      temp_password: false,
      source: 'AMA_SSO',
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '4h' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    return {
      accessToken,
      refreshToken,
      user: {
        userId: payload.sub,
        entId: payload.ent_id,
        crpCode: payload.crp_code,
        role: payload.role,
        name: payload.name,
        tempPassword: false,
      },
    };
  }

  async amaEntryLogin(entId: string, entCode: string, entName: string, email: string) {
    const payload: DrdJwtPayload = {
      sub: entId,
      ent_id: entId,
      crp_code: entCode,
      role: UserRole.ADMIN,
      name: email.split('@')[0],
      temp_password: false,
      source: 'AMA_SSO',
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '4h' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    return {
      accessToken,
      refreshToken,
      user: {
        userId: payload.sub,
        entId: payload.ent_id,
        crpCode: payload.crp_code,
        role: payload.role,
        name: payload.name,
        tempPassword: false,
      },
    };
  }
}
