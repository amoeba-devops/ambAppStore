/**
 * Locate this app's row in AMA `GET /entity-settings/custom-apps/my`.
 *
 * AMA entities register car-v2 under two `eca_code` values in the wild:
 *   - `app-car-manager-v2` — canonical (seed scripts)
 *   - `car-manager-v2`     — registered by hand via AMA admin UI (e.g. CARGO434)
 * Matching only the canonical code made login fail with `not_installed` for
 * entities on the legacy code (FIX-261015). `amaJwtClaimsSchema` already
 * accepts both as `appCode`, so the minted token verifies either way.
 * Canonical wins if an entity somehow has both.
 */
const APP_CODES = ['app-car-manager-v2', 'car-manager-v2'] as const;

export interface AmaCustomApp {
  id?: string;
  ecaId?: string;
  code?: string;
  ecaCode?: string;
}

export function findCarAppInMyApps(body: unknown): AmaCustomApp | undefined {
  const apps: AmaCustomApp[] = Array.isArray(body)
    ? body
    : ((body as { data?: AmaCustomApp[] } | null)?.data ?? []);
  for (const code of APP_CODES) {
    const app = apps.find((a) => (a.code ?? a.ecaCode) === code);
    if (app) return app;
  }
  return undefined;
}
