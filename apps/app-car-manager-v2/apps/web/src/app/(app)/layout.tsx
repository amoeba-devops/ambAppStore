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
 * Onboarding gate đã move LÊN middleware (REQ-20260526 §3.6 — fixed 2026-05-27)
 * để có hard 307 deterministic thay vì layout-level soft redirect bị streaming
 * RSC quirk làm URL bar không update. Layout chỉ còn ensureCarUser + AppShell.
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
