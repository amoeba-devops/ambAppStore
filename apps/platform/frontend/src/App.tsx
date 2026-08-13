import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';
import '@/i18n/i18n';

import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { LandingPage } from '@/pages/LandingPage';
import { AppDetailPage } from '@/pages/AppDetailPage';
import { AdminGuard } from '@/components/admin/AdminGuard';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminSubscriptionListPage } from '@/pages/admin/AdminSubscriptionListPage';
import { AdminAppListPage } from '@/pages/admin/AdminAppListPage';
import { AdminStatsPage } from '@/pages/admin/AdminStatsPage';
import { AdminSettingsPage } from '@/pages/admin/AdminSettingsPage';
import { AdminLoginPage } from '@/pages/admin/AdminLoginPage';
import { AppsLoginPage } from '@/pages/AppsLoginPage';
import { MySubscriptionsPage } from '@/pages/MySubscriptionsPage';
import { useEntityContextStore } from '@/stores/entity-context.store';
import { getInitialAmaClaims } from '@/lib/ama-token';
import { DebugContextPanel } from '@/components/common/DebugContextPanel';
import { useEffect, useRef } from 'react';

// Capture initial values BEFORE React hydration cleans URL
const _initialReferrer = document.referrer;
const _initialQueryParams = window.location.search;

/**
 * AMA 진입 시 Entity 컨텍스트를 Zustand 스토어에 저장.
 *
 * 두 가지 진입 형태를 모두 처리한다:
 *   1. iframe 쿼리 파라미터(ent_id, ent_code, ent_name, email) — URL에서 제거
 *   2. `?ama_token=` 앱 스코프 JWT — AMA가 `/apps/:slug`를 열 때 쓰는 현재 방식
 *
 * (2)가 없으면 entity 컨텍스트가 null로 남고, AppDetailPage의
 * `useEntitySubscriptions`가 비활성화되어 구독 조회 자체를 하지 않는다. 그러면
 * 이미 승인(ACTIVE)된 사용자에게도 "사용하기" 대신 "신청하기" 버튼이 보여
 * 앱에 들어갈 방법이 없다 (FIX-260813).
 */
function EntityContextInitializer() {
  const [searchParams, setSearchParams] = useSearchParams();
  const setEntity = useEntityContextStore((s) => s.setEntity);

  useEffect(() => {
    const entId = searchParams.get('ent_id');
    const entCode = searchParams.get('ent_code');
    const entName = searchParams.get('ent_name');
    const email = searchParams.get('email');

    if (entId && entCode && entName) {
      setEntity({ entId, entCode, entName, email: email ?? '' });
      // 쿼리 파라미터를 URL에서 제거 (clean URL)
      searchParams.delete('ent_id');
      searchParams.delete('ent_code');
      searchParams.delete('ent_name');
      searchParams.delete('email');
      setSearchParams(searchParams, { replace: true });
      return;
    }

    /* 앱 스코프 토큰 폴백. 토큰에는 entityId만 있고 entCode/entName은 없다 —
     * 구독 조회에는 entId 하나면 충분하고, 신규 신청 모달은 두 필드를 사용자가
     * 직접 입력받는다(폴백 이전에도 비어 있던 값이라 회귀 없음).
     *
     * `ama_token`은 URL에 남겨 둔다: 새로고침해도 컨텍스트가 유지되고,
     * buildAppLaunchUrl()이 실행 링크에 그대로 실어 보낼 수 있어야 한다. */
    const claims = getInitialAmaClaims();
    if (claims?.entityId) {
      setEntity({
        entId: claims.entityId,
        entCode: '',
        entName: '',
        email: claims.email ?? '',
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

function App() {
  const initialRef = useRef({ referrer: _initialReferrer, params: _initialQueryParams });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <EntityContextInitializer />
        <div className="flex min-h-screen flex-col bg-gray-50">
          <Header />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/apps/login" element={<AppsLoginPage />} />
              <Route path="/apps/:slug" element={<AppDetailPage />} />
              <Route path="/my-subscriptions" element={<MySubscriptionsPage />} />
              {/* Admin Login (outside guard) */}
              <Route path="/admin/login" element={<AdminLoginPage />} />
              {/* Admin (protected) */}
              <Route element={<AdminGuard />}>
                <Route element={<AdminLayout />}>
                  <Route path="/admin" element={<Navigate to="/admin/subscriptions" replace />} />
                  <Route path="/admin/subscriptions" element={<AdminSubscriptionListPage />} />
                  <Route path="/admin/apps" element={<AdminAppListPage />} />
                  <Route path="/admin/stats" element={<AdminStatsPage />} />
                  <Route path="/admin/settings" element={<AdminSettingsPage />} />
                </Route>
              </Route>
            </Routes>
          </main>
          <DebugContextPanel
            initialReferrer={initialRef.current.referrer}
            initialQueryParams={initialRef.current.params}
          />
          <Footer />
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
