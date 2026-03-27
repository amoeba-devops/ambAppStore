import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { useAppDetail } from '@/hooks/useApps';
import { useSubscriptionCheck } from '@/hooks/useSubscription';
import { useAuthStore } from '@/stores/auth.store';
import { SubscriptionRequestModal } from '@/components/SubscriptionRequestModal';

const APP_ICONS: Record<string, string> = {
  'app-car-manager': '🚗',
  'app-hscode': '📦',
  'app-sales-report': '📊',
  'app-stock-forecast': '📈',
};

export function AppDetailPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation('platform');
  const { isAuthenticated } = useAuthStore();

  const { data: app, isLoading } = useAppDetail(slug);
  const { data: subStatus } = useSubscriptionCheck(slug, isAuthenticated);
  const [showModal, setShowModal] = useState(false);

  if (isLoading) return <p className="py-20 text-center text-gray-400">{t('common.loading')}</p>;
  if (!app) return <p className="py-20 text-center text-gray-400">{t('common.error')}</p>;

  const currentStatus = subStatus?.status;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Back */}
      <button onClick={() => navigate('/')} className="mb-6 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={16} />
        {t('common.back')}
      </button>

      {/* Header */}
      <div className="mb-8 flex items-start gap-5">
        <span className="text-5xl">{APP_ICONS[app.slug] || '📱'}</span>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{app.name}</h1>
          <p className="mt-1 text-gray-500">{app.shortDesc}</p>
        </div>
      </div>

      {/* Screenshots */}
      {app.screenshots?.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">{t('detail.screenshot')}</h2>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {app.screenshots.map((src, i) => (
              <img key={i} src={src} alt={`${app.name} screenshot ${i + 1}`} className="h-60 rounded-lg border object-cover" />
            ))}
          </div>
        </section>
      )}

      {/* Description */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">{t('detail.appIntro')}</h2>
        <p className="whitespace-pre-line text-gray-700">{app.description}</p>
      </section>

      {/* Features */}
      {app.features?.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">{t('detail.keyFeatures')}</h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {app.features.map((f, i) => (
              <li key={i} className="flex items-center gap-2 rounded-lg border bg-gray-50 px-4 py-3 text-sm text-gray-700">
                <span>{f.icon}</span>
                <span>{f.label}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Action Button */}
      <div className="sticky bottom-4">
        {currentStatus === 'ACTIVE' ? (
          <a
            href={`/${app.slug}`}
            className="block w-full rounded-xl bg-blue-600 py-3 text-center font-semibold text-white hover:bg-blue-700"
          >
            {t('detail.inUse')}
          </a>
        ) : currentStatus === 'PENDING' ? (
          <button disabled className="w-full cursor-not-allowed rounded-xl bg-purple-100 py-3 font-semibold text-purple-700">
            {t('detail.underReview')}
          </button>
        ) : app.status === 'COMING_SOON' ? (
          <button disabled className="w-full cursor-not-allowed rounded-xl bg-gray-200 py-3 font-semibold text-gray-400">
            {t('landing.statusComingSoon')}
          </button>
        ) : isAuthenticated ? (
          <button
            onClick={() => setShowModal(true)}
            className="w-full rounded-xl bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-700"
          >
            {t('detail.applyButton')}
          </button>
        ) : (
          <button disabled className="w-full cursor-not-allowed rounded-xl bg-gray-200 py-3 font-semibold text-gray-500">
            {t('detail.loginToApply')}
          </button>
        )}
      </div>

      {/* Subscription Modal */}
      {showModal && (
        <SubscriptionRequestModal
          appSlug={app.slug}
          appName={app.name}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
