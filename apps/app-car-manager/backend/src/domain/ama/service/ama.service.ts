import { Injectable, Logger } from '@nestjs/common';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { HttpStatus } from '@nestjs/common';

export interface AmaMember {
  userId: string;
  name: string;
  email: string;
  department?: string;
}

interface OAuthToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

@Injectable()
export class AmaService {
  private readonly logger = new Logger(AmaService.name);

  private readonly amaBaseUrl = process.env.AMA_API_BASE_URL || 'https://stg-ama.amoeba.site';
  private readonly clientId = process.env.AMA_OAUTH_CLIENT_ID || '';
  private readonly clientSecret = process.env.AMA_OAUTH_CLIENT_SECRET || '';
  private readonly redirectUri = process.env.AMA_OAUTH_REDIRECT_URI || '';
  private readonly tokenEndpoint = `${this.amaBaseUrl}/api/v1/oauth/token`;
  private readonly authorizeEndpoint = `${this.amaBaseUrl}/api/v1/oauth/authorize`;
  private readonly openApiBase = `${this.amaBaseUrl}/api/v1/open`;

  // Entity별 OAuth 토큰 캐시
  private readonly tokenCache = new Map<string, OAuthToken>();

  /**
   * OAuth 인가 URL 생성
   */
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      scope: 'users:read',
      state,
    });
    return `${this.authorizeEndpoint}?${params.toString()}`;
  }

  /**
   * Authorization Code → Access Token 교환
   */
  async exchangeCodeForToken(code: string, entityId: string): Promise<void> {
    try {
      const res = await fetch(this.tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: this.redirectUri,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.warn(`OAuth token exchange failed (${res.status}): ${body}`);
        throw new BusinessException('CAR-E9003', 'OAuth token exchange failed', HttpStatus.BAD_GATEWAY);
      }

      const data = await res.json();
      const tokenData = data?.data || data;

      this.tokenCache.set(entityId, {
        accessToken: tokenData.access_token || tokenData.accessToken,
        refreshToken: tokenData.refresh_token || tokenData.refreshToken,
        expiresAt: Date.now() + ((tokenData.expires_in || 3600) * 1000),
      });

      this.logger.log(`OAuth token cached for entity ${entityId}`);
    } catch (err) {
      if (err instanceof BusinessException) throw err;
      this.logger.error(`OAuth token exchange error: ${(err as Error).message}`);
      throw new BusinessException('CAR-E9003', 'Failed to connect to AMA OAuth server', HttpStatus.BAD_GATEWAY);
    }
  }

  /**
   * Refresh Token으로 Access Token 갱신
   */
  private async refreshAccessToken(entityId: string): Promise<boolean> {
    const cached = this.tokenCache.get(entityId);
    if (!cached?.refreshToken) return false;

    try {
      const res = await fetch(this.tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: cached.refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }),
      });

      if (!res.ok) {
        this.logger.warn(`OAuth refresh failed (${res.status}) for entity ${entityId}`);
        this.tokenCache.delete(entityId);
        return false;
      }

      const data = await res.json();
      const tokenData = data?.data || data;

      this.tokenCache.set(entityId, {
        accessToken: tokenData.access_token || tokenData.accessToken,
        refreshToken: tokenData.refresh_token || tokenData.refreshToken || cached.refreshToken,
        expiresAt: Date.now() + ((tokenData.expires_in || 3600) * 1000),
      });

      this.logger.log(`OAuth token refreshed for entity ${entityId}`);
      return true;
    } catch (err) {
      this.logger.error(`OAuth refresh error: ${(err as Error).message}`);
      this.tokenCache.delete(entityId);
      return false;
    }
  }

  /**
   * OAuth 연동 상태 확인
   */
  isConnected(entityId: string): boolean {
    return this.tokenCache.has(entityId);
  }

  /**
   * Open API로 멤버 목록 조회
   */
  async getMembers(entityId: string, search?: string): Promise<AmaMember[]> {
    let token = this.tokenCache.get(entityId);
    if (!token) return [];

    // 토큰 만료 시 갱신 시도
    if (token.expiresAt < Date.now()) {
      const refreshed = await this.refreshAccessToken(entityId);
      if (!refreshed) return [];
      token = this.tokenCache.get(entityId)!;
    }

    // Open API 호출
    const url = new URL(`${this.openApiBase}/users`);
    if (search) url.searchParams.set('search', search);

    try {
      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      // 401 → 토큰 갱신 후 재시도
      if (res.status === 401) {
        const refreshed = await this.refreshAccessToken(entityId);
        if (!refreshed) return [];
        const newToken = this.tokenCache.get(entityId)!;

        const retryRes = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${newToken.accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!retryRes.ok) return [];
        return this.parseMembers(await retryRes.json());
      }

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.warn(`AMA Open API /open/users returned ${res.status}: ${body}`);
        return [];
      }

      return this.parseMembers(await res.json());
    } catch (err) {
      this.logger.error(`AMA Open API error: ${(err as Error).message}`);
      return [];
    }
  }

  private parseMembers(body: Record<string, unknown>): AmaMember[] {
    const rawMembers = (body?.data || body || []) as Record<string, unknown>[];
    if (!Array.isArray(rawMembers)) return [];

    return rawMembers.map((m) => ({
      userId: (m.userId || m.usr_id || m.id || '') as string,
      name: (m.name || m.usr_name || m.fullName || '') as string,
      email: (m.email || m.usr_email || '') as string,
      department: (m.department || m.unit_name || '') as string,
    }));
  }
}
