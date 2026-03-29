import { Body, Controller, Post, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { successResponse, errorResponse } from '../common/dto/base-response.dto';

interface LoginDto {
  email: string;
  password: string;
}

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  private readonly amaApiBaseUrl =
    process.env.AMA_API_BASE_URL || 'https://stg-ama.amoeba.site';

  constructor(private readonly jwtService: JwtService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    const { email, password } = dto;

    if (!email || !password) {
      return errorResponse('PLT-E1001', 'Email and password are required');
    }

    try {
      // AMA 로그인 API로 프록시
      const amaRes = await fetch(`${this.amaApiBaseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const amaData = await amaRes.json();

      if (!amaRes.ok || !amaData?.success) {
        this.logger.warn(`AMA login failed for ${email}: ${amaData?.error?.message || amaRes.status}`);
        return errorResponse(
          'PLT-E1002',
          amaData?.error?.message || 'Invalid credentials',
        );
      }

      // AMA 응답에서 토큰 추출
      const amaToken = amaData.data?.token || amaData.data?.accessToken || amaData.data?.access_token;
      if (!amaToken) {
        this.logger.error('AMA login response missing token');
        return errorResponse('PLT-E1003', 'Authentication failed: no token received');
      }

      // AMA 토큰 디코드하여 사용자 정보 추출
      const amaPayload = this.decodeJwt(amaToken);
      if (!amaPayload) {
        return errorResponse('PLT-E1004', 'Failed to decode AMA token');
      }

      // 플랫폼 로컬 JWT 발행
      const payload = {
        sub: amaPayload.sub || amaPayload.userId || amaPayload.user_id,
        ent_id: amaPayload.ent_id || amaPayload.entityId || amaPayload.entity_id || '',
        ent_code: amaPayload.ent_code || amaPayload.entityCode || amaPayload.entity_code || '',
        email: amaPayload.email || email,
        name: amaPayload.name || amaPayload.usr_name || email.split('@')[0],
        level: amaPayload.level || (amaPayload.role === 'ADMIN' ? 'ADMIN_LEVEL' : 'USER_LEVEL'),
        role: amaPayload.role || 'USER',
        roles: amaPayload.roles || [amaPayload.role || 'USER'],
      };

      const token = this.jwtService.sign(payload);

      return successResponse({
        token,
        amaToken,
        user: {
          userId: payload.sub,
          entityId: payload.ent_id,
          entityCode: payload.ent_code,
          email: payload.email,
          name: payload.name,
          level: payload.level,
          roles: payload.roles,
        },
      });
    } catch (err) {
      this.logger.error(`AMA login proxy error: ${(err as Error).message}`, (err as Error).stack);
      return errorResponse('PLT-E1005', 'Failed to connect to AMA authentication server');
    }
  }

  private decodeJwt(token: string): Record<string, any> | null {
    try {
      const base64Url = token.split('.')[1];
      if (!base64Url) return null;
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
      return payload;
    } catch {
      return null;
    }
  }
}
