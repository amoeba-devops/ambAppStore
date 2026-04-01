import { useEffect, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, useSearchParams } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';
import { useTranslation } from 'react-i18next';
import '@/i18n/i18n';

import { AppLayout } from '@/components/layout/AppLayout';
import { ToastContainer } from '@/components/common/ToastContainer';
import { DebugContextPanel } from '@/components/common/DebugContextPanel';
import { DashboardPage } from '@/pages/DashboardPage';
import { VehicleListPage } from '@/pages/VehicleListPage';
import { VehicleDetailPage } from '@/pages/VehicleDetailPage';
import { VehicleFormPage } from '@/pages/VehicleFormPage';
import { DispatchListPage } from '@/pages/DispatchListPage';
import { DispatchDetailPage } from '@/pages/DispatchDetailPage';
import { DispatchFormPage } from '@/pages/DispatchFormPage';
import { TripLogListPage } from '@/pages/TripLogListPage';
import { useAuthStore } from '@/stores/auth.store';
import type { User } from '@/stores/auth.store';
import {
  getAmaTokenFromUrl,
  decodeAmaToken,
  validateReferrer,
  isTokenExpired,
  isValidAppCode,
  checkSubscription,
} from '@/lib/ama-token';
import i18n from '@/i18n/i18n';

// Capture initial values BEFORE React hydration cleans URL
const _initialReferrer = document.referrer;
const _initialQueryParams = window.location.search;

/**
 * AMA → iframe 진입 시 ama_token JWT 처리 (게이팅 컴포넌트):
 * ama_token이 URL에 있으면 처리 완료 전까지 자식 컴포넌트를 렌더링하지 않음.
 * 1. URL에서 ama_token 추출 → 기존 인증 클리어
 * 2. referrer 검증 (soft mode)
 * 3. JWT 디코드 + appCode 검증
 * 4. Platform API로 구독 확인
 * 5. ACTIVE → setAuth + URL cleanup → 앱 렌더링
 * 6. 미구독 → Platform 앱 상세 페이지로 리다이렉트
 */
function AmaTokenHandler({ children }: { children: React.ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const { t } = useTranslation('car');
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const processed = useRef(false);

  // Check if ama_token is in URL at mount time
  const hasAmaToken = useRef(!!new URLSearchParams(window.location.search).get('ama_token'));

  useEffect(() => {
    if (processed.current) return;

    const tokenData = getAmaTokenFromUrl();
    if (!tokenData) {
      // No ama_token in URL → let existing auth pass through
      setReady(true);
      return;
    }
    processed.current = true;

    // Clear any existing auth before processing new token
    clearAuth();

    const { token, locale } = tokenData;

    // Set locale
    if (locale && locale !== i18n.language) {
      i18n.changeLanguage(locale);
    }

    // Validate referrer
    if (!validateReferrer()) {
      window.location.href = window.location.origin;
      return;
    }

    // Decode token
    const payload = decodeAmaToken(token);
    if (!payload) {
      setError(t('auth.invalidAccess'));
      return;
    }

    // Check token expiry
    if (isTokenExpired(payload)) {
      setError(t('auth.tokenExpired'));
      return;
    }

    // Validate appCode
    if (!isValidAppCode(payload)) {
      setError(t('auth.invalidAccess'));
      return;
    }

    // Check subscription
    checkSubscription(payload.entityId).then((status) => {
      if (status === 'ACTIVE') {
        // Build user from AMA token payload
        const user: User = {
          userId: payload.sub,
          entityId: payload.entityId,
          entityCode: '',
          email: payload.email,
          name: payload.email.split('@')[0],
          roles: [payload.role],
        };
        setAuth(token, user);

        // Clean URL: remove ama_token and locale params
        searchParams.delete('ama_token');
        searchParams.delete('locale');
        setSearchParams(searchParams, { replace: true });
        setReady(true);
      } else {
        // Redirect to platform app detail page for subscription
        const platformBase = window.location.origin;
        const redirectUrl = `${platformBase}/apps/app-car-manager?ent_id=${encodeURIComponent(payload.entityId)}&role=${encodeURIComponent(payload.role)}&from=iframe`;
        window.location.href = redirectUrl;
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="rounded-lg border border-red-200 bg-red-50 px-6 py-4 text-center">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  // Gate: if ama_token was in URL but not ready yet, show loading
  if (hasAmaToken.current && !ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
          <p className="text-sm text-gray-500">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function App() {
  const initialRef = useRef({ referrer: _initialReferrer, params: _initialQueryParams });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/app-car-manager">
        <AmaTokenHandler>
          <AppLayout>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/vehicles" element={<VehicleListPage />} />
              <Route path="/vehicles/new" element={<VehicleFormPage />} />
              <Route path="/vehicles/:id" element={<VehicleDetailPage />} />
              <Route path="/dispatches" element={<DispatchListPage />} />
              <Route path="/dispatches/new" element={<DispatchFormPage />} />
              <Route path="/dispatches/:id" element={<DispatchDetailPage />} />
              <Route path="/trip-logs" element={<TripLogListPage />} />
            </Routes>
          </AppLayout>
        </AmaTokenHandler>
        <DebugContextPanel
          initialReferrer={initialRef.current.referrer}
          initialQueryParams={initialRef.current.params}
        />
        <ToastContainer />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
