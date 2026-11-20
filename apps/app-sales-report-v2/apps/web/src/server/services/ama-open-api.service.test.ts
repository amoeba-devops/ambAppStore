import { describe, expect, it, vi } from 'vitest';
import {
  AMA_TOKEN_EXPIRY_SKEW_MS,
  AmaOpenApiClient,
  AmaOpenApiError,
  readAmaOAuthConfig,
  type AmaOAuthConfig,
} from './ama-open-api.service';

const CONFIG: AmaOAuthConfig = {
  baseUrl: 'https://aworks.test/api/v1',
  clientId: 'client-x',
  clientSecret: 'secret-x',
  scope: 'users:read',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const tokenOk = (token = 'oauth-1', expiresIn = 3600) =>
  json(200, { success: true, data: { access_token: token, token_type: 'Bearer', expires_in: expiresIn } });

const usersOk = (rows: unknown[]) => json(200, { success: true, data: rows });

const ROW = {
  userId: 'u-1',
  email: 'a@example.com',
  name: 'Alice',
  role: 'MANAGER',
  levelCode: 'USER_LEVEL',
  status: 'ACTIVE',
  unit: 'Sales',
  failedLoginCount: 0,
};

describe('readAmaOAuthConfig', () => {
  it('returns null unless base url, client id and secret are all set', () => {
    expect(readAmaOAuthConfig({})).toBeNull();
    expect(readAmaOAuthConfig({ AMA_API_BASE_URL: 'https://x/api/v1', AMA_OAUTH_CLIENT_ID: 'id' })).toBeNull();
    expect(readAmaOAuthConfig({ AMA_OAUTH_CLIENT_ID: 'id', AMA_OAUTH_CLIENT_SECRET: 's' })).toBeNull();
  });

  it('trims the trailing slash and defaults scope to users:read', () => {
    expect(
      readAmaOAuthConfig({
        AMA_API_BASE_URL: 'https://x/api/v1/',
        AMA_OAUTH_CLIENT_ID: 'id',
        AMA_OAUTH_CLIENT_SECRET: 's',
      }),
    ).toEqual({ baseUrl: 'https://x/api/v1', clientId: 'id', clientSecret: 's', scope: 'users:read' });
  });
});

describe('AmaOpenApiClient.listUsers', () => {
  it('exchanges the launch token via ama_session and maps /open/users rows', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(tokenOk()).mockResolvedValueOnce(usersOk([ROW, { email: 'no-id' }]));
    const client = new AmaOpenApiClient(CONFIG, fetchImpl as unknown as typeof fetch);

    const users = await client.listUsers('ent-1', 'launch-token');

    expect(users).toEqual([
      { userId: 'u-1', email: 'a@example.com', name: 'Alice', role: 'MANAGER', levelCode: 'USER_LEVEL', status: 'ACTIVE', unit: 'Sales' },
    ]);
    const [tokenUrl, tokenInit] = fetchImpl.mock.calls[0]!;
    expect(tokenUrl).toBe('https://aworks.test/api/v1/oauth/token');
    expect(JSON.parse(tokenInit.body)).toEqual({
      grant_type: 'ama_session',
      ama_token: 'launch-token',
      client_id: 'client-x',
      client_secret: 'secret-x',
      scope: 'users:read',
    });
    const [usersUrl, usersInit] = fetchImpl.mock.calls[1]!;
    expect(usersUrl).toBe('https://aworks.test/api/v1/open/users');
    expect(usersInit.headers.Authorization).toBe('Bearer oauth-1');
  });

  it('caches the access token per entity until 60s before expiry', async () => {
    let now = 1_000_000;
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(tokenOk('oauth-1', 3600))
      .mockResolvedValueOnce(usersOk([ROW]))
      .mockResolvedValueOnce(usersOk([ROW]))
      .mockResolvedValueOnce(tokenOk('oauth-ent2'))
      .mockResolvedValueOnce(usersOk([]))
      .mockResolvedValueOnce(tokenOk('oauth-2'))
      .mockResolvedValueOnce(usersOk([ROW]));
    const client = new AmaOpenApiClient(CONFIG, fetchImpl as unknown as typeof fetch, () => now);

    await client.listUsers('ent-1', 't');
    now += 3600_000 - AMA_TOKEN_EXPIRY_SKEW_MS - 1; // still valid
    await client.listUsers('ent-1', 't');
    await client.listUsers('ent-2', 't'); // other entity → own exchange
    now += 2; // inside the 60s skew window → re-exchange
    await client.listUsers('ent-1', 't');

    const urls = fetchImpl.mock.calls.map((c) => c[0] as string);
    expect(urls.filter((u) => u.endsWith('/oauth/token'))).toHaveLength(3);
    expect(fetchImpl.mock.calls[2]![1].headers.Authorization).toBe('Bearer oauth-1');
    expect(fetchImpl.mock.calls[6]![1].headers.Authorization).toBe('Bearer oauth-2');
  });

  it('re-exchanges once on 401 from the Open API', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(tokenOk('stale'))
      .mockResolvedValueOnce(json(401, { success: false }))
      .mockResolvedValueOnce(tokenOk('fresh'))
      .mockResolvedValueOnce(usersOk([ROW]));
    const client = new AmaOpenApiClient(CONFIG, fetchImpl as unknown as typeof fetch);

    await expect(client.listUsers('ent-1', 't')).resolves.toHaveLength(1);
    expect(fetchImpl.mock.calls[3]![1].headers.Authorization).toBe('Bearer fresh');
  });

  it('reports a refused launch token as a session problem', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json(400, { success: false, error: { code: 'E9001', message: 'invalid_ama_token' } }));
    const client = new AmaOpenApiClient(CONFIG, fetchImpl as unknown as typeof fetch);

    const err = await client.listUsers('ent-1', 't').catch((e) => e);
    expect(err).toBeInstanceOf(AmaOpenApiError);
    expect(err.kind).toBe('token_exchange_rejected');
    expect(err.oauthError).toBe('invalid_ama_token');
    expect(err.isSessionProblem).toBe(true);
  });

  it('treats invalid_client as a configuration problem, and never echoes the secret', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(json(400, { message: 'invalid_client' }));
    const client = new AmaOpenApiClient(CONFIG, fetchImpl as unknown as typeof fetch);

    const err = await client.listUsers('ent-1', 't').catch((e) => e);
    expect(err.oauthError).toBe('invalid_client');
    expect(err.isSessionProblem).toBe(false);
    expect(err.message).not.toContain('secret-x');
  });

  it('maps 403 to forbidden and network errors to network', async () => {
    const forbidden = new AmaOpenApiClient(
      CONFIG,
      vi.fn().mockResolvedValueOnce(tokenOk()).mockResolvedValueOnce(json(403, {})) as unknown as typeof fetch,
    );
    await expect(forbidden.listUsers('e', 't')).rejects.toMatchObject({ kind: 'forbidden', status: 403 });

    const down = new AmaOpenApiClient(CONFIG, vi.fn().mockRejectedValueOnce(new Error('ECONNREFUSED')) as unknown as typeof fetch);
    await expect(down.listUsers('e', 't')).rejects.toMatchObject({ kind: 'network' });
  });

  it('shares one in-flight exchange between concurrent calls for the same entity', async () => {
    const fetchImpl = vi.fn(async (url: string) => (url.endsWith('/oauth/token') ? tokenOk() : usersOk([ROW])));
    const client = new AmaOpenApiClient(CONFIG, fetchImpl as unknown as typeof fetch);

    await Promise.all([client.listUsers('ent-1', 't'), client.listUsers('ent-1', 't')]);
    expect(fetchImpl.mock.calls.filter((c) => c[0].endsWith('/oauth/token'))).toHaveLength(1);
  });
});
