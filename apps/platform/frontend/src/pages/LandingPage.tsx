import { useTranslation } from 'react-i18next';
import { useApps } from '@/hooks/useApps';
import { useMySubscriptions } from '@/hooks/useSubscription';
import { useAuthStore } from '@/stores/auth.store';
import { AppCard } from '@/components/AppCard';

export function LandingPage() {
  const { t } = useTranslation('platform');
  const { isAuthenticated } = useAuthStore();
  const { data: apps, isLoading } = useApps();
  const { data: subscriptions } = useMySubscriptions(isAuthenticated);

  const subStatusMap = new Map(
    subscriptions?.map((s) => [s.appSlug, s.status]) ?? [],
  );

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
