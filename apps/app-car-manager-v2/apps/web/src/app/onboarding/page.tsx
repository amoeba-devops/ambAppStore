import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Building2 } from 'lucide-react';
import { Card, CardContent } from '@car-v2/ui';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { ensureCarUser } from '@/server/services/user/ensure-car-user.service';
import { OnboardingForm } from './_components/onboarding-form';

/**
 * Onboarding screen — lần đầu admin/manager của entity access v2.
 *
 * Flow:
 *   1. Middleware redirect tới đây nếu tns_users_synced_at IS NULL + role ADMIN/MANAGER
 *   2. Page hiển thị welcome + nút "Bắt đầu đồng bộ"
 *   3. Click → syncTenantUsersAction bulk upsert car_users
 *   4. Success → redirect /
 *
 * DRIVER không bao giờ vào đây (middleware filter). Nếu lỡ vào → redirect /today.
 * Admin của entity đã onboard → redirect / (idempotent guard).
 *
 * Layout: standalone full-screen card, không có AppShell sidebar — UX clean
 * cho first-time experience.
 */
export default async function OnboardingPage() {
  const user = await getCurrentUser();

  /* DRIVER không có quyền onboard tenant. */
  if (user.role === 'DRIVER') {
    redirect('/today');
  }

  /* Ensure self-row tồn tại trước khi sync bắt đầu — phòng trường hợp current
   * admin chưa có car_users (FK reference từ tnsUpdatedBy). */
  await ensureCarUser({
    entId: user.entId,
    amaUserId: user.userId,
    amaRole: user.amaRole,
    email: user.email,
    name: user.name,
  });

  /* KHÔNG redirect khi syncedAt non-null. Lý do: sync action set syncedAt =
   * NOW() → server action revalidation trigger RSC refetch → page re-render →
   * nếu redirect ở đây thì client success card không kịp hiển thị.
   *
   * Thay vì redirect, OnboardingForm tự handle state:
   *   - syncedAt null → form sync button
   *   - syncedAt set + chưa sync trong session → vẫn cho sync button (để re-sync)
   *   - sau sync success → result state hiển thị success card */
  const t = await getTranslations('onboarding');

  return (
    <div className="min-h-dvh flex items-center justify-center bg-bg p-4">
      <Card variant="elevated" className="w-full max-w-md">
        <CardContent>
          <div className="flex flex-col items-center text-center py-2">
            <div className="h-14 w-14 rounded-full bg-accent-soft text-accent flex items-center justify-center mb-5">
              <Building2 className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-semibold text-text">{t('title')}</h1>
            {user.entName && (
              <p className="mt-1 text-sm font-medium text-text-muted">
                {user.entName}
              </p>
            )}
            <p className="mt-3 text-sm text-text-muted leading-relaxed">
              {t('description')}
            </p>
          </div>

          <div className="mt-6">
            {user.role === 'ADMIN' ? (
              <OnboardingForm />
            ) : (
              /* MANAGER reach onboarding khi admin chưa sync. Họ KHÔNG được
               * call /entity-settings/members (AMA OwnEntityGuard chỉ accept
               * MASTER/ADMIN). Show waiting message thay vì broken button. */
              <div className="rounded-md bg-warning-soft text-warning-strong p-4 space-y-1.5">
                <p className="font-semibold text-sm">{t('managerWaitTitle')}</p>
                <p className="text-sm leading-relaxed">{t('managerWaitDesc')}</p>
              </div>
            )}
          </div>

          {user.role === 'ADMIN' && (
            <p className="mt-5 text-xs text-text-faint text-center">
              {t('footnote')}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
