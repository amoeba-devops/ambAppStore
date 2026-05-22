import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getTenantSettings } from '@/server/queries/tenant-settings.queries';
import { countPendingTrips } from '@/server/queries/trips.queries';
import { AppShellClient } from './app-shell-client';

/**
 * Server wrapper around AppShellClient. Reads the auth context once and passes
 * the role + sidebar metric counts + PWA push config down so the client shell
 * can render role-aware nav, badges, and the proactive push-enable banner
 * without exposing server helpers (or process.env) to client code.
 *
 * `pendingTripCount` runs on every page render (Neon HTTP is cheap, one SELECT
 * count) so the sidebar badge stays accurate as users navigate. No real-time
 * updates yet — refresh occurs on next route change. Caller can rely on Next.js
 * `revalidatePath('/')` from mutating actions to force a refresh when needed.
 *
 * `vapidPublicKey` + `basePath` flow through to the PushPromptStrip that
 * sits above each page's content. The strip decides whether to render
 * (hidden when the server can't push, when already subscribed, or when
 * snoozed) and which SW URL to register on enable. Both values come from
 * NEXT_PUBLIC_* envs but reading them server-side here means the client
 * never has to.
 */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  /* Settings row may not exist yet (lazy-seeded on first /settings visit by
   * Admin). `getTenantSettings` returns null in that case — we don't seed
   * here to keep the layout render cheap; the JWT/i18n fallback covers it. */
  const [pendingTripCount, settings, tCo, tRoot] = await Promise.all([
    countPendingTrips({ entId: user.entId, role: user.role, userId: user.userId }),
    getTenantSettings(user.entId),
    getTranslations('company'),
    /* Root namespace — `appName` is a top-level i18n key (vi: "Fleet"). */
    getTranslations(),
  ]);

  const defaultTenantName = tCo('tenantDefault');
  /* Resolution order: DB-stored tenant name → JWT-issued entity name →
   * i18n default. Each is checked for non-empty content so a "  " whitespace
   * row in DB doesn't override a real JWT value. */
  const resolvedName =
    settings?.tnsTenantName?.trim() ||
    user.entName?.trim() ||
    defaultTenantName;

  const defaultAppName = tRoot('appName');
  const resolvedAppName = settings?.tnsAppName?.trim() || defaultAppName;

  return (
    <AppShellClient
      role={user.role}
      pendingTripCount={pendingTripCount}
      vapidPublicKey={process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC}
      basePath={process.env.NEXT_PUBLIC_BASE_PATH ?? ''}
      tenantName={resolvedName}
      tenantDefaultName={defaultTenantName}
      appName={resolvedAppName}
      appDefaultName={defaultAppName}
    >
      {children}
    </AppShellClient>
  );
}
