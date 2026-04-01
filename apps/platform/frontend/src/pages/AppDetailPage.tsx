import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { useAppDetail } from '@/hooks/useApps';
import { useSubscriptionCheck, useEntitySubscriptions } from '@/hooks/useSubscription';
import { useAuthStore } from '@/stores/auth.store';
import { useEntityContextStore } from '@/stores/entity-context.store';
import { SubscriptionRequestModal } from '@/components/SubscriptionRequestModal';

const APP_ICONS: Record<string, string> = {
  'app-car-manager': '🚗',
  'app-hscode': '📦',
  'app-sales-report': '📊',
  'app-stock-management': '📈',
};

export function AppDetailPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation('platform');
  const { isAuthenticated } = useAuthStore();
  const entity = useEntityContextStore((s) => s.entity);
  const setEntity = useEntityContextStore((s) => s.setEntity);
  const entId = entity?.entId || null;

  // Detect iframe redirect params: from=iframe&ent_id=...&role=...
  const [searchParams, setSearchParams] = useSearchParams();
  const fromIframe = searchParams.get('from') === 'iframe';
  const iframeRole = searchParams.get('role');
  const iframeEntId = searchParams.get('ent_id');

  // Set entity context from iframe params if needed
  useEffect(() => {
    if (fromIframe && iframeEntId && !entId) {
      setEntity({ entId: iframeEntId, entCode: '', entName: '', email: '' });
      // Clean iframe params from URL
      searchParams.delete('from');
      searchParams.delete('role');
      searchParams.delete('ent_id');
      setSearchParams(searchParams, { replace: true });
    }
  }, [fromIframe, iframeEntId]); // eslint-disable-line react-hooks/exhaustive-deps

  const effectiveEntId = entId || iframeEntId;

  const { data: app, isLoading } = useAppDetail(slug);
  const { data: subStatus } = useSubscriptionCheck(slug, isAuthenticated);
  const { data: entityApps } = useEntitySubscriptions(!isAuthenticated ? effectiveEntId : null);
  const [showModal, setShowModal] = useState(false);

  if (isLoading) return <p className="py-20 text-center text-gray-400">{t('common.loading')}</p>;
  if (!app) return <p className="py-20 text-center text-gray-400">{t('common.error')}</p>;

  // 통합 구독 상태: 인증 사용자는 기존 API, Entity 비인증 사용자는 Public API
  const currentStatus = isAuthenticated
    ? subStatus?.status
    : entityApps?.find((a) => a.appSlug === slug)?.subscription?.status ?? null;
  const isEntityUser = !isAuthenticated && !!effectiveEntId;
  const isMaster = iframeRole === 'MASTER';

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Back */}
      <button onClick={() => navigate('/')} className="mb-6 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={16} />
        {t('common.back')}
      </button>

      {/* iframe redirect info banner */}
      {fromIframe && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          {currentStatus === 'PENDING' ? (
            <p className="text-sm text-amber-700">{t('detail.pendingReview')}</p>
          ) : currentStatus === 'SUSPENDED' ? (
            <p className="text-sm text-amber-700">{t('detail.suspended')}</p>
          ) : !isMaster ? (
            <p className="text-sm text-amber-700">{t('detail.masterOnly')}</p>
          ) : (
            <p className="text-sm text-amber-700">{t('detail.subscriptionRequired')}</p>
          )}
        </div>
      )}

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
        {currentStatus === 'ACTIVE' && isEntityUser ? (
          <a
            href={`/${app.slug}`}
            className="block w-full rounded-xl bg-green-600 py-3 text-center font-semibold text-white hover:bg-green-700"
          >
            {t('detail.useService')}
          </a>
        ) : currentStatus === 'ACTIVE' ? (
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
        ) : currentStatus === 'EXPIRED' ? (
          <button
            onClick={() => setShowModal(true)}
            className="w-full rounded-xl bg-orange-600 py-3 font-semibold text-white hover:bg-orange-700"
          >
            {t('detail.reapply')}
          </button>
        ) : app.status === 'COMING_SOON' ? (
          <button disabled className="w-full cursor-not-allowed rounded-xl bg-gray-200 py-3 font-semibold text-gray-400">
            {t('landing.statusComingSoon')}
          </button>
        ) : fromIframe && !isMaster ? (
          <button disabled className="w-full cursor-not-allowed rounded-xl bg-gray-200 py-3 font-semibold text-gray-500">
            {t('detail.masterOnly')}
          </button>
        ) : (
          <button
            onClick={() => setShowModal(true)}
            className="w-full rounded-xl bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-700"
          >
            {t('detail.applyButton')}
          </button>
        )}
      </div>

      {/* Subscription Modal */}
      {showModal && (
        <SubscriptionRequestModal
          appSlug={app.slug}
          appName={app.nameEn || app.name || app.slug}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
