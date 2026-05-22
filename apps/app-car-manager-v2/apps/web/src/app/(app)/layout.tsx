import { AppShell } from '@/components/layout/app-shell';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { ensureCarUser } from '@/server/services/user/ensure-car-user.service';

/**
 * Shared layout for all authenticated pages. The AppShell (sidebar + header
 * chrome) is rendered ONCE here — Next.js preserves it across navigations,
 * so switching sidebar items only re-renders the page segment and triggers
 * the segment-level loading.tsx (not the whole shell).
 *
 * `ensureCarUser` upserts car_users row + audit on first login or role change
 * (D-006 step 4). CRITICAL: every server action với FK đến car_users.usr_id
 * (trip create, expense submit, ...) phụ thuộc vào row đã được sync. Bỏ qua →
 * FK violation. React `cache()` dedupes nếu multiple RSC trong cùng request.
 *
 * The previous CRITICAL maintenance-alert sticky banner (oil/inspection overdue,
 * REQ-20260519 Q7) has been removed from this layout — the alert UI is being
 * redefined elsewhere. The OilOverdueBanner component and getCriticalUnresolvedAlerts
 * query are still in the codebase for that future placement to consume.
 */
export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  await ensureCarUser({
    entId: user.entId,
    amaUserId: user.userId,
    amaRole: user.amaRole,
    email: user.email,
    name: user.name,
  });

  return <AppShell>{children}</AppShell>;
}
