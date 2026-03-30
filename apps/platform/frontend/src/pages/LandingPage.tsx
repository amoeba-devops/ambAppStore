import { useTranslation } from 'react-i18next';
import { useApps } from '@/hooks/useApps';
import { useMySubscriptions, useEntitySubscriptions } from '@/hooks/useSubscription';
import { useAuthStore } from '@/stores/auth.store';
import { useEntityContextStore } from '@/stores/entity-context.store';
import { AppCard } from '@/components/AppCard';

export function LandingPage() {
  const { t } = useTranslation('platform');
  const { isAuthenticated } = useAuthStore();
  const entity = useEntityContextStore((s) => s.entity);
  const entId = entity?.entId || null;

  const { data: apps, isLoading } = useApps();
  const { data: subscriptions } = useMySubscriptions(isAuthenticated);
  const { data: entityApps } = useEntitySubscriptions(!isAuthenticated ? entId : null);

  // 통합 구독 상태 맵: 인증 사용자는 기존 API, Entity 비인증 사용자는 Public API
  const subStatusMap = isAuthenticated
    ? new Map(subscriptions?.map((s) => [s.appSlug, s.status]) ?? [])
    : new Map(entityApps?.map((a) => [a.appSlug, a.subscription?.status ?? null]) ?? []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      {/* Hero */}
      <div className="mb-12 text-center">
        <h1 className="mb-3 text-4xl font-extrabold text-gray-900">{t('landing.title')}</h1>
        <p className="text-lg text-gray-500">{t('landing.subtitle')}</p>
      </div>

      {/* App Grid */}
      {isLoading ? (
        <p className="text-center text-gray-400">{t('common.loading')}</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {apps?.map((app) => (
            <AppCard
              key={app.appId}
              app={app}
              subscriptionStatus={subStatusMap.get(app.slug) ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
