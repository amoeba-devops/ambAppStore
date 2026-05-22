import { AppShell } from '@/components/layout/app-shell';
import { OilOverdueBanner } from '@/components/maintenance/oil-overdue-banner';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { ensureCarUser } from '@/server/services/user/ensure-car-user.service';
import { getCriticalUnresolvedAlerts } from '@/server/queries/maintenance-alerts.queries';

/**
 * Shared layout for all authenticated pages. The AppShell (sidebar + header
 * chrome) is rendered ONCE here — Next.js preserves it across navigations,
 * so switching sidebar items only re-renders the page segment and triggers
 * the segment-level loading.tsx (not the whole shell).
 *
 * CRITICAL maintenance alerts (REQ-20260519 Q7) surface as a sticky top banner
 * for Admin/Manager on every page until resolved or dismissed-per-session.
 */
export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  // Step 4 (D-006): Upsert car_users + audit log on first login or role change.
  // React `cache()` dedupes if multiple RSC trees in same request call this.
  await ensureCarUser({
    entId: user.entId,
    amaUserId: user.userId,
    amaRole: user.amaRole,
    email: user.email,
    name: user.name,
  });

  const showBanner = user.role === 'ADMIN' || user.role === 'MANAGER';
  const alerts = showBanner ? await getCriticalUnresolvedAlerts(user.entId) : [];
  const items = alerts
    .filter(
      (a): a is typeof a & {
        alert: typeof a.alert & { malType: 'OIL_OVERDUE' | 'INSPECTION_OVERDUE' };
      } => a.alert.malType === 'OIL_OVERDUE' || a.alert.malType === 'INSPECTION_OVERDUE',
    )
    .map((a) => ({
      alertId: a.alert.malId,
      vehiclePlate: a.vehiclePlate ?? '—',
      type: a.alert.malType as 'OIL_OVERDUE' | 'INSPECTION_OVERDUE',
    }));

  return (
    <AppShell>
      {showBanner && items.length > 0 && <OilOverdueBanner items={items} />}
      {children}
    </AppShell>
  );
}
