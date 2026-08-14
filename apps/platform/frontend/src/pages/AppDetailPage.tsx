import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { useAppDetail } from '@/hooks/useApps';
import { useSubscriptionCheck, useEntitySubscriptions } from '@/hooks/useSubscription';
import { useAuthStore } from '@/stores/auth.store';
import { useEntityContextStore } from '@/stores/entity-context.store';
import { SubscriptionRequestModal } from '@/components/SubscriptionRequestModal';
import { buildAppLaunchUrl } from '@/lib/app-launch';
import { appScopedTokenFor, getInitialAmaClaims } from '@/lib/ama-token';

/**
 * 세션당 slug별 자동 진입 1회 제한용 키.
 *
 * 앱이 어떤 이유로든 사용자를 카탈로그로 되돌려보내면, 가드가 없을 경우
 * 자동 진입 → 되돌아옴 → 자동 진입 …의 무한 리다이렉트가 된다.
 */
const autoEnterGuardKey = (slug: string) => `plt-auto-entered:${slug}`;

function hasAutoEntered(slug: string): boolean {
  try {
    return sessionStorage.getItem(autoEnterGuardKey(slug)) === '1';
  } catch {
    /* Safari 프라이빗 모드 등 sessionStorage 접근 불가 환경.
     * 가드를 세울 수 없으면 루프 위험이 있으므로 자동 진입을 포기한다
     * (수동 버튼은 그대로 동작하므로 사용자는 여전히 앱에 들어갈 수 있다). */
    return true;
  }
}

function markAutoEntered(slug: string): void {
  try {
    sessionStorage.setItem(autoEnterGuardKey(slug), '1');
  } catch {
    /* 위와 동일 — 저장 실패는 무시한다. hasAutoEntered()가 이미 true를
     * 돌려주므로 자동 진입 자체가 일어나지 않는다. */
  }
}

const APP_ICONS: Record<string, string> = {
  'app-car-manager': '🚗',
  'app-car-manager-v2': '🚐',
  'app-hscode': '📦',
  'app-sales-report': '📊',
  'app-sales-report-v2': '💹',
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

  /* 우리가 누구의 구독을 조회하는지 아는가? 비인증 사용자에게 entId가 없으면
   * 구독 조회 자체가 일어나지 않으므로(useEntitySubscriptions의 enabled),
   * "구독이 없다"가 아니라 "알 수 없다"가 정확한 상태다. 이 둘을 뭉개면
   * 승인된 사용자에게 재신청을 요구하게 된다 (FIX-260813의 근본 증상). */
  const contextResolved = isAuthenticated || !!effectiveEntId;

  // 통합 구독 상태: 인증 사용자는 기존 API, Entity 비인증 사용자는 Public API
  const currentStatus = isAuthenticated
    ? subStatus?.status
    : entityApps?.find((a) => a.appSlug === slug)?.subscription?.status ?? null;
  const isEntityUser = !isAuthenticated && !!effectiveEntId;

  /* 조건 3종을 모두 충족할 때만 자동 진입한다 (REQ-260814 §3.2).
   * 토큰이 없으면 앱이 어차피 /login으로 튕기므로 자동 진입은 무의미하다. */
  const canAutoEnter =
    currentStatus === 'ACTIVE' && isEntityUser && !!appScopedTokenFor(slug);

  /* 이 렌더 사이클에서 리다이렉트를 시작했는지. 가드(sessionStorage)는 진입
   * '직전'에 기록되므로, 그것만으로 전환 화면을 판단하면 기록 직후 리렌더에서
   * 이미 true가 되어 카탈로그(=신청하기 버튼)가 잠깐 번쩍인다. */
  const isRedirectingRef = useRef(false);

  useEffect(() => {
    if (!canAutoEnter || hasAutoEntered(slug)) return;
    markAutoEntered(slug);
    isRedirectingRef.current = true;
    window.location.href = buildAppLaunchUrl(slug);
  }, [canAutoEnter, slug]);

  /* 리다이렉트가 걸리는 짧은 순간에 빈 화면 대신 전환 안내를 보여준다.
   * 아직 effect가 돌기 전(첫 렌더)에도 미리 전환 화면을 띄워 깜빡임을 없앤다. */
  const isEnteringApp =
    isRedirectingRef.current || (canAutoEnter && !hasAutoEntered(slug));

  if (isLoading) return <p className="py-20 text-center text-gray-400">{t('common.loading')}</p>;
  if (!app) return <p className="py-20 text-center text-gray-400">{t('common.error')}</p>;
  if (isEnteringApp)
    return <p className="py-20 text-center text-gray-400">{t('detail.enteringApp')}</p>;

  /* 컨텍스트를 못 잡았을 때만 UNKNOWN. 컨텍스트가 있는데 구독이 없으면
   * 그것은 진짜 미신청이므로 기존 "신청하기" 동선을 그대로 탄다.
   *
   * 로딩 여부는 보지 않는다: contextResolved가 false면 구독 쿼리는 애초에
   * enabled:false라 영원히 로딩이 끝나지 않는다(=조회가 없다). 즉 이 시점에
   * "아직 모른다"는 일시적 상태가 아니라 확정된 상태다. */
  const isContextUnknown = !contextResolved;
  /* `role`은 예전 iframe 파라미터에만 있었다. 지금 AMA는 같은 정보를 앱 스코프
   * 토큰의 클레임으로 넘기므로 폴백으로 읽는다 (FIX-260813). */
  const isMaster = (iframeRole ?? getInitialAmaClaims()?.role) === 'MASTER';

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Back */}
      <button onClick={() => navigate('/')} className="mb-6 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={16} />
        {t('common.back')}
      </button>

      {/* 컨텍스트 미확인 안내 — 구독 조회를 못 했음을 "미신청"과 구분해 알린다.
          이 안내가 없으면 승인된 사용자가 "신청하기"만 보고 이미 승인된 앱을
          다시 신청하려 하게 된다 (FIX-260813). */}
      {isContextUnknown && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-800">{t('detail.contextUnknown')}</p>
          <p className="mt-0.5 text-sm text-amber-700">{t('detail.contextUnknownDesc')}</p>
        </div>
      )}

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
          <h1 className="text-2xl font-bold text-gray-900">{app.nameEn || app.name}</h1>
          {app.name && app.nameEn && (
            <p className="mt-0.5 text-sm text-gray-400">({app.name})</p>
          )}
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
            href={buildAppLaunchUrl(app.slug)}
            className="block w-full rounded-xl bg-green-600 py-3 text-center font-semibold text-white hover:bg-green-700"
          >
            {t('detail.useService')}
          </a>
        ) : currentStatus === 'ACTIVE' ? (
          <a
            href={buildAppLaunchUrl(app.slug)}
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
        ) : isContextUnknown ? (
          /* 구독 여부를 모르는 상태. 신청 버튼을 노출하면 이미 승인된 사용자가
             중복 신청하게 되므로, AMA 재진입을 안내한다. */
          <button disabled className="w-full cursor-not-allowed rounded-xl bg-gray-200 py-3 font-semibold text-gray-500">
            {t('detail.reopenFromAma')}
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
