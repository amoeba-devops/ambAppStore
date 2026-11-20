import 'server-only';

/**
 * aWorks (AMA) Open API client for member sync — OAuth path.
 *
 * Flow (server-side only — client id/secret never reach the browser):
 *   1. `POST {AMA_API_BASE_URL}/oauth/token` grant `ama_session`
 *      — exchanges the embed launch token (`amb_session` cookie) for an OAuth
 *      access token scoped to the token's OWN entity (aWorks decides the
 *      entity from the launch token, not from this app).
 *   2. `GET {AMA_API_BASE_URL}/open/users` with scope `users:read`
 *      — the entity's ACTIVE members.
 *
 * Access tokens are cached per entity until 60s before expiry. A 401 from the
 * Open API evicts the cached token and retries once with a fresh exchange.
 *
 * Kept free of Next.js APIs (cookies etc.) so it can be unit-tested with an
 * injected `fetch`.
 */

export interface AmaOAuthConfig {
  /** e.g. https://host/api/v1 — same value as AMA_API_BASE_URL. */
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  scope: string;
}

export const AMA_OPEN_API_DEFAULT_SCOPE = 'users:read';
/** Refresh the cached access token this long before it actually expires. */
export const AMA_TOKEN_EXPIRY_SKEW_MS = 60_000;

/**
 * Read OAuth config from env. Returns null unless base URL, client id and
 * client secret are ALL set — callers then use the legacy path.
 */
export function readAmaOAuthConfig(
  env: Record<string, string | undefined> = process.env,
): AmaOAuthConfig | null {
  const baseUrl = env.AMA_API_BASE_URL?.trim();
  const clientId = env.AMA_OAUTH_CLIENT_ID?.trim();
  const clientSecret = env.AMA_OAUTH_CLIENT_SECRET?.trim();
  if (!baseUrl || !clientId || !clientSecret) return null;
  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    clientId,
    clientSecret,
    scope: env.AMA_OAUTH_SCOPE?.trim() || AMA_OPEN_API_DEFAULT_SCOPE,
  };
}

export type AmaOpenApiErrorKind =
  /** OAuth token endpoint refused the exchange (bad client, expired/invalid launch token, scope not granted…). */
  | 'token_exchange_rejected'
  /** Open API returned 401 even after a fresh exchange. */
  | 'unauthorized'
  /** Open API returned 403 (scope missing / app or install disabled). */
  | 'forbidden'
  /** Any other non-2xx from aWorks. */
  | 'upstream'
  /** aWorks unreachable. */
  | 'network'
  /** 2xx with an unexpected body. */
  | 'bad_response';

export class AmaOpenApiError extends Error {
  constructor(
    public readonly kind: AmaOpenApiErrorKind,
    message: string,
    public readonly status?: number,
    /** OAuth error code from the token endpoint, e.g. `invalid_client`, `invalid_ama_token`. */
    public readonly oauthError?: string,
  ) {
    super(message);
    this.name = 'AmaOpenApiError';
  }

  /**
   * True when the user's own launch token was refused (expired / revoked / user
   * inactive) — i.e. re-opening the app fixes it. Everything else is an aWorks
   * or app configuration problem.
   */
  get isSessionProblem(): boolean {
    return this.oauthError === 'invalid_ama_token' || this.oauthError === 'user_inactive';
  }
}

/** One row of `GET /open/users` (fields this app may use). */
export interface AmaOpenUser {
  userId: string;
  email: string | null;
  name: string | null;
  role: string | null;
  levelCode: string | null;
  status: string | null;
  unit: string | null;
}

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

type FetchFn = typeof fetch;

export class AmaOpenApiClient {
  private readonly cache = new Map<string, CachedToken>();
  private readonly inflight = new Map<string, Promise<string>>();

  constructor(
    private readonly config: AmaOAuthConfig,
    private readonly fetchImpl: FetchFn = (...args) => fetch(...args),
    private readonly now: () => number = Date.now,
  ) {}

  /** List the ACTIVE members of the entity the launch token belongs to. */
  async listUsers(entId: string, amaToken: string): Promise<AmaOpenUser[]> {
    let accessToken = await this.getAccessToken(entId, amaToken);
    let res = await this.callOpenUsers(accessToken);
    if (res.status === 401) {
      this.cache.delete(entId);
      accessToken = await this.getAccessToken(entId, amaToken);
      res = await this.callOpenUsers(accessToken);
      if (res.status === 401) {
        throw new AmaOpenApiError('unauthorized', 'aWorks Open API rejected the access token (HTTP 401)', 401);
      }
    }
    if (res.status === 403) {
      throw new AmaOpenApiError('forbidden', 'aWorks Open API denied access (HTTP 403) — check users:read scope / app install', 403);
    }
    if (!res.ok) {
      throw new AmaOpenApiError('upstream', `aWorks Open API failed (HTTP ${res.status})`, res.status);
    }

    const body = (await res.json().catch(() => null)) as { data?: unknown } | null;
    if (!body || !Array.isArray(body.data)) {
      throw new AmaOpenApiError('bad_response', 'aWorks Open API returned an unexpected body');
    }
    return body.data.map(toOpenUser).filter((u): u is AmaOpenUser => u !== null);
  }

  /** Drop all cached tokens (tests / config rotation). */
  clearCache(): void {
    this.cache.clear();
    this.inflight.clear();
  }

  private async getAccessToken(entId: string, amaToken: string): Promise<string> {
    const cached = this.cache.get(entId);
    if (cached && cached.expiresAt > this.now()) return cached.accessToken;
    this.cache.delete(entId);

    // Collapse concurrent exchanges for the same entity into one request.
    const pending = this.inflight.get(entId);
    if (pending) return pending;
    const p = this.exchange(entId, amaToken).finally(() => this.inflight.delete(entId));
    this.inflight.set(entId, p);
    return p;
  }

  private async exchange(entId: string, amaToken: string): Promise<string> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.config.baseUrl}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          grant_type: 'ama_session',
          ama_token: amaToken,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          scope: this.config.scope,
        }),
        cache: 'no-store',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new AmaOpenApiError('network', `aWorks OAuth token endpoint unreachable: ${msg}`);
    }

    if (!res.ok) {
      // Surface only the OAuth error code (e.g. invalid_client), never the request.
      const reason = await readOAuthErrorCode(res);
      throw new AmaOpenApiError(
        'token_exchange_rejected',
        `aWorks OAuth token exchange failed (HTTP ${res.status}${reason ? `, ${reason}` : ''})`,
        res.status,
        reason?.split(':')[0],
      );
    }

    // aWorks wraps responses as { success, data: { access_token, expires_in, … } }.
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    const data = (json?.data ?? json) as Record<string, unknown> | null;
    const accessToken = data?.access_token;
    if (typeof accessToken !== 'string' || accessToken.length === 0) {
      throw new AmaOpenApiError('bad_response', 'aWorks OAuth token response had no access_token');
    }
    const expiresInSec = typeof data?.expires_in === 'number' ? data.expires_in : 3600;
    const expiresAt = this.now() + expiresInSec * 1000 - AMA_TOKEN_EXPIRY_SKEW_MS;
    if (expiresAt > this.now()) {
      this.cache.set(entId, { accessToken, expiresAt });
    }
    return accessToken;
  }

  private async callOpenUsers(accessToken: string): Promise<Response> {
    try {
      return await this.fetchImpl(`${this.config.baseUrl}/open/users`, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
        cache: 'no-store',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new AmaOpenApiError('network', `aWorks Open API unreachable: ${msg}`);
    }
  }
}

async function readOAuthErrorCode(res: Response): Promise<string | null> {
  const body = (await res.json().catch(() => null)) as
    | { error?: unknown; message?: unknown }
    | null;
  if (!body) return null;
  const candidate =
    typeof body.message === 'string'
      ? body.message
      : typeof body.error === 'string'
        ? body.error
        : body.error && typeof (body.error as { message?: unknown }).message === 'string'
          ? ((body.error as { message: string }).message)
          : null;
  // OAuth error codes are short snake_case tokens; drop anything else.
  const match = candidate?.match(/^[a-z_]+(?::\s?[\w .-]{0,60})?/);
  return match ? match[0] : null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function toOpenUser(raw: unknown): AmaOpenUser | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  const userId = str(m.userId);
  if (!userId) return null;
  return {
    userId,
    email: str(m.email),
    name: str(m.name),
    role: str(m.role),
    levelCode: str(m.levelCode),
    status: str(m.status),
    unit: str(m.unit),
  };
}

let sharedClient: { key: string; client: AmaOpenApiClient } | null = null;

/** Process-wide client (shares the per-entity token cache). Null when OAuth env is not set. */
export function getAmaOpenApiClient(): AmaOpenApiClient | null {
  const config = readAmaOAuthConfig();
  if (!config) return null;
  const key = `${config.baseUrl}|${config.clientId}|${config.scope}`;
  if (!sharedClient || sharedClient.key !== key) {
    sharedClient = { key, client: new AmaOpenApiClient(config) };
  }
  return sharedClient.client;
}

let legacyWarned = false;

/** Log once per process that the legacy Bearer-forwarding path is in use. */
export function warnLegacyMemberSyncOnce(): void {
  if (legacyWarned) return;
  legacyWarned = true;
  console.warn(
    '[ama-member-sync] DEPRECATED: forwarding the embed session token to /entity-settings/members. ' +
      'aWorks will stop accepting app launch tokens as login sessions — set AMA_OAUTH_CLIENT_ID / ' +
      'AMA_OAUTH_CLIENT_SECRET to use the OAuth Open API (/open/users).',
  );
}
