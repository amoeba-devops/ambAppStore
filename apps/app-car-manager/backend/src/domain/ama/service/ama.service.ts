import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

export interface AmaMember {
  userId: string;
  name: string;
  email: string;
  department?: string;
}

interface OAuthToken {
  accessToken: string;
  expiresAt: number;
}

@Injectable()
export class AmaService implements OnModuleInit {
  private readonly logger = new Logger(AmaService.name);

  private readonly amaBaseUrl = process.env.AMA_API_BASE_URL || 'https://stg-ama.amoeba.site';
  private readonly clientId = process.env.AMA_OAUTH_CLIENT_ID || '';
  private readonly clientSecret = process.env.AMA_OAUTH_CLIENT_SECRET || '';
  private readonly tokenEndpoint = `${this.amaBaseUrl}/api/v1/oauth/token`;
  private readonly openApiBase = `${this.amaBaseUrl}/api/v1/open`;

  private token: OAuthToken | null = null;

  async onModuleInit() {
    if (this.clientId && this.clientSecret) {
      await this.acquireToken();
    } else {
      this.logger.warn('AMA OAuth credentials not configured — member search disabled');
    }
  }

  /**
   * client_credentials로 Access Token 발급 (서버 간 인증)
   */
  private async acquireToken(): Promise<boolean> {
    try {
      const res = await fetch(this.tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          scope: 'users:read',
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.warn(`AMA OAuth token request failed (${res.status}): ${body}`);
        return false;
      }

      const data = await res.json();
      const tokenData = data?.data || data;

      this.token = {
        accessToken: tokenData.access_token || tokenData.accessToken,
        expiresAt: Date.now() + ((tokenData.expires_in || 3600) * 1000) - 60000, // 1분 여유
      };

      this.logger.log('AMA OAuth token acquired via client_credentials');
      return true;
    } catch (err) {
      this.logger.error(`AMA OAuth token error: ${(err as Error).message}`);
      return false;
    }
  }

  /**
   * 토큰 유효성 확인 + 자동 갱신
   */
  private async ensureToken(): Promise<string | null> {
    if (this.token && this.token.expiresAt > Date.now()) {
      return this.token.accessToken;
    }
    const ok = await this.acquireToken();
    return ok ? this.token!.accessToken : null;
  }

  /**
   * OAuth 연동 상태
   */
  isConnected(): boolean {
    return !!(this.clientId && this.clientSecret);
  }

  /**
   * Open API로 멤버 목록 조회
   */
  async getMembers(search?: string): Promise<AmaMember[]> {
    const accessToken = await this.ensureToken();
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

      // 401 → 토큰 재발급 후 재시도
      if (res.status === 401) {
        const newToken = await this.acquireToken();
        if (!newToken || !this.token) return [];

        const retryRes = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.token.accessToken}`,
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
