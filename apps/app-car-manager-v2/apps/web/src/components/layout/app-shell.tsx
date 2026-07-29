import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { resolveFleetAccess } from '@/lib/auth/fleet-access';
import { driverDept, type FleetDept } from './nav-items';
import { countTodayExpenses } from '@/server/queries/expenses.queries';
import { countUnreadNotifications } from '@/server/queries/notifications.queries';
import { getCriticalUnresolvedAlerts } from '@/server/queries/maintenance-alerts.queries';
import { getTenantSettings } from '@/server/queries/tenant-settings.queries';
import { countPendingTrips } from '@/server/queries/trips.queries';
import { countNewTruckReports } from '@/server/queries/truck-report.queries';
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
  /* Today expense badge only matters for STAFF (sidebar/bottom-tab "Chi phí"
   * entry is STAFF-only). Skip the query entirely for DRIVER to save a
   * round-trip on every page render. */
  const wantsTodayCost = user.role === 'ADMIN' || user.role === 'MANAGER';
  const [pendingTripCount, todayExpenseCount, unreadNotificationCount, settings, fleetAccess, tCo, tRoot] = await Promise.all([
    /* Badge sits on the `trips` nav item, which is fleet:'CAR' — so it must
     * count dispatch trips only. (Truck LOG trips are auto-CONFIRMED on assign
     * and never enter a PENDING_* status, so this is a no-op today; it stops the
     * badge drifting if the truck flow ever gains a pending state.) */
    countPendingTrips({ entId: user.entId, role: user.role, userId: user.userId, kind: 'DISPATCH' }),
    wantsTodayCost ? countTodayExpenses(user.entId) : Promise.resolve(0),
    /* In-app inbox badge — all roles see it. Index on (ntfUserId, ntfReadAt)
     * keeps this lookup index-only even at high volume. */
    countUnreadNotifications(user.entId, user.userId),
    getTenantSettings(user.entId),
    /* Fleet departments this user may enter — drives the dept switch +
     * department-scoped nav. ADMIN → both; others → membership rows. */
    resolveFleetAccess(user),
    getTranslations('company'),
    /* Root namespace — `appName` is a top-level i18n key (vi: "Fleet"). */
    getTranslations(),
  ]);

  /* "Mới" badge on the truck Reports nav — only for staff who can enter the
   * truck workspace, so non-truck users never pay for the query. Depends on
   * resolved fleetAccess, so it runs after the parallel batch. */
  const newReportCount =
    (user.role === 'ADMIN' || user.role === 'MANAGER') && fleetAccess.includes('TRUCK')
      ? await countNewTruckReports(user.entId, user.userId)
      : 0;

  /* CRITICAL maintenance alerts for the sticky banner (Module 2, REQ-20260519
   * Q7). STAFF only — the nav entry and the page are STAFF-scoped and a driver
   * has no way to act on one.
   *
   * Also CAR-access only. The alerts themselves are CAR-only
   * (`getCriticalUnresolvedAlerts` joins on cvh_type='CAR'), but the banner
   * rides above EVERY page — so a TRUCK-only manager was being shown a car's
   * overdue oil change, and the banner's link bounced off /maintenance's CAR
   * fleet gate straight back to /truck/dashboard. A dead-end warning about a
   * vehicle they cannot even open. */
  const criticalAlerts = wantsTodayCost && fleetAccess.includes('CAR')
    ? (await getCriticalUnresolvedAlerts(user.entId))
        .filter((r) => r.alert.malType === 'OIL_OVERDUE' || r.alert.malType === 'INSPECTION_OVERDUE')
        .map((r) => ({
          alertId: r.alert.malId,
          vehiclePlate: r.vehiclePlate ?? '—',
          type: r.alert.malType as 'OIL_OVERDUE' | 'INSPECTION_OVERDUE',
        }))
    : [];

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

  /* Sticky workspace seed: remembered cookie clamped to what the user may
   * enter; drivers are locked to their single membership. The client
   * DeptProvider takes over from here, syncing as the user navigates. */
  const cookieDept = (await cookies()).get('ccms.fleet.dept')?.value;
  const initialDept: FleetDept =
    user.role === 'DRIVER'
      ? driverDept(fleetAccess)
      : cookieDept === 'TRUCK' && fleetAccess.includes('TRUCK')
        ? 'TRUCK'
        : cookieDept === 'CAR' && fleetAccess.includes('CAR')
          ? 'CAR'
          : (fleetAccess[0] ?? 'CAR');

  return (
    <AppShellClient
      role={user.role}
      fleetAccess={fleetAccess}
      initialDept={initialDept}
      userName={user.name}
      userEmail={user.email}
      pendingTripCount={pendingTripCount}
      todayExpenseCount={todayExpenseCount}
      newReportCount={newReportCount}
      unreadNotificationCount={unreadNotificationCount}
      vapidPublicKey={process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC}
      basePath={process.env.NEXT_PUBLIC_BASE_PATH ?? ''}
      tenantName={resolvedName}
      tenantDefaultName={defaultTenantName}
      appName={resolvedAppName}
      appDefaultName={defaultAppName}
      criticalAlerts={criticalAlerts}
    >
      {children}
    </AppShellClient>
  );
}
