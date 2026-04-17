import { Injectable, Logger } from '@nestjs/common';

export interface AmaMember {
  userId: string;
  name: string;
  email: string;
  department?: string;
}

interface OAuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

@Injectable()
export class AmaService {
  private readonly logger = new Logger(AmaService.name);

  private readonly amaBaseUrl = process.env.AMA_API_BASE_URL || 'https://stg-ama.amoeba.site';
  private readonly clientId = process.env.AMA_OAUTH_CLIENT_ID || '';
  private readonly clientSecret = process.env.AMA_OAUTH_CLIENT_SECRET || '';
  private readonly tokenEndpoint = `${this.amaBaseUrl}/api/v1/oauth/token`;
  private readonly openApiBase = `${this.amaBaseUrl}/api/v1/open`;

  // entity별 OAuth 토큰 캐시
  private readonly tokenCache = new Map<string, OAuthToken>();

  /**
   * ama_session grant: AMA JWT → OAuth access_token 교환
   */
  private async acquireTokenViaSession(amaJwt: string, entityId: string): Promise<boolean> {
    try {
      const res = await fetch(this.tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'ama_session',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          ama_token: amaJwt,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.warn(`AMA OAuth ama_session failed (${res.status}): ${body}`);
        return false;
      }

      const data = await res.json();
      const tokenData = data?.data || data;

      this.tokenCache.set(entityId, {
        accessToken: tokenData.access_token || tokenData.accessToken,
        refreshToken: tokenData.refresh_token || tokenData.refreshToken,
        expiresAt: Date.now() + ((tokenData.expires_in || 3600) * 1000) - 60000,
      });

      this.logger.log(`AMA OAuth token acquired via ama_session for entity ${entityId}`);
      return true;
    } catch (err) {
      this.logger.error(`AMA OAuth ama_session error: ${(err as Error).message}`);
      return false;
    }
  }

  /**
   * refresh_token grant: 토큰 갱신
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
        this.tokenCache.delete(entityId);
        return false;
      }

      const data = await res.json();
      const tokenData = data?.data || data;

      this.tokenCache.set(entityId, {
        accessToken: tokenData.access_token || tokenData.accessToken,
        refreshToken: tokenData.refresh_token || tokenData.refreshToken || cached.refreshToken,
        expiresAt: Date.now() + ((tokenData.expires_in || 3600) * 1000) - 60000,
      });
      return true;
    } catch {
      this.tokenCache.delete(entityId);
      return false;
    }
  }

  /**
   * 유효한 access_token 확보 (캐시 → refresh → ama_session)
   */
  private async ensureToken(amaJwt: string, entityId: string): Promise<string | null> {
    const cached = this.tokenCache.get(entityId);

    // 캐시된 토큰이 유효
    if (cached && cached.expiresAt > Date.now()) {
      return cached.accessToken;
    }

    // refresh 시도
    if (cached?.refreshToken) {
      const ok = await this.refreshAccessToken(entityId);
      if (ok) return this.tokenCache.get(entityId)!.accessToken;
    }

    // ama_session으로 새 토큰 발급
    const ok = await this.acquireTokenViaSession(amaJwt, entityId);
    if (ok) return this.tokenCache.get(entityId)!.accessToken;

    return null;
  }

  /**
   * OAuth 설정 여부
   */
  isConnected(): boolean {
    return !!(this.clientId && this.clientSecret);
  }

  /**
   * Open API /open/users 호출
   */
  async getMembers(amaJwt: string, entityId: string, search?: string): Promise<AmaMember[]> {
    if (!this.clientId || !this.clientSecret) return [];

    const accessToken = await this.ensureToken(amaJwt, entityId);
    if (!accessToken) return [];

    const url = new URL(`${this.openApiBase}/users`);
    if (search) url.searchParams.set('search', search);

    try {
      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.status === 401) {
        // 토큰 무효 → ama_session으로 재발급 후 재시도
        const ok = await this.acquireTokenViaSession(amaJwt, entityId);
        if (!ok) return [];
        const newToken = this.tokenCache.get(entityId)!;

        const retryRes = await fetch(url.toString(), {
          method: 'GET',
          headers: { Authorization: `Bearer ${newToken.accessToken}` },
        });
        if (!retryRes.ok) return [];
        return this.parseMembers(await retryRes.json());
      }

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.warn(`AMA /open/users returned ${res.status}: ${body}`);
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
