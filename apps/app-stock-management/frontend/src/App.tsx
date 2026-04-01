import { BrowserRouter, Routes, Route, Navigate, Outlet, useSearchParams, useNavigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';
import { useAuthStore } from '@/stores/auth.store';
import { apiClient } from '@/lib/api-client';
import { AppLayout } from '@/components/layout/AppLayout';
import { ToastContainer } from '@/components/common/ToastContainer';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import '@/i18n/i18n';

import { EntityInfoPage } from '@/pages/auth/EntityInfoPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { ChangePasswordPage } from '@/pages/auth/ChangePasswordPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ProductListPage } from '@/pages/ProductListPage';
import { ProductFormPage } from '@/pages/ProductFormPage';
import { SkuListPage } from '@/pages/SkuListPage';
import { SkuFormPage } from '@/pages/SkuFormPage';
import { TransactionListPage } from '@/pages/TransactionListPage';
import { InventoryListPage } from '@/pages/InventoryListPage';
import { ReceivingListPage } from '@/pages/ReceivingListPage';
import { SalesOrderListPage } from '@/pages/SalesOrderListPage';
import { SalesOrderFormPage } from '@/pages/SalesOrderFormPage';
import { OrderBatchListPage } from '@/pages/OrderBatchListPage';
import { ForecastListPage } from '@/pages/ForecastListPage';
import { SafetyStockListPage } from '@/pages/SafetyStockListPage';
import { ParameterSettingsPage } from '@/pages/ParameterSettingsPage';
import { SeasonalityPage } from '@/pages/SeasonalityPage';
import { ChannelListPage } from '@/pages/ChannelListPage';
import { DebugContextPanel } from '@/components/common/DebugContextPanel';
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
 * 5. ACTIVE → POST /v1/auth/ama-sso → 자체 JWT 발급 → setAuth → 앱 렌더링
 * 6. 미구독 → Platform 앱 상세 페이지로 리다이렉트
 */
function AmaTokenHandler({ children }: { children: React.ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { setAuth, setCrpCode, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useTranslation('stock');
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

    // Check subscription then exchange for app-specific JWT
    checkSubscription(payload.entityId).then((status) => {
      if (status === 'ACTIVE') {
        // Exchange AMA token for app-specific JWT
        apiClient
          .post('/v1/auth/ama-sso', { ama_token: token })
          .then((res) => {
            const { accessToken, refreshToken, user } = res.data.data;
            setAuth(accessToken, refreshToken, user);
            if (user.crpCode) setCrpCode(user.crpCode);

            // Clean URL
            searchParams.delete('ama_token');
            searchParams.delete('locale');
            setSearchParams(searchParams, { replace: true });
            navigate('/', { replace: true });
            setReady(true);
          })
          .catch((err) => {
            console.error('AMA SSO exchange failed:', err);
            setError(t('auth.invalidAccess'));
          });
      } else {
        // Redirect to platform app detail page for subscription
        const platformBase = window.location.origin;
        const redirectUrl = `${platformBase}/apps/app-stock-management?ent_id=${encodeURIComponent(payload.entityId)}&role=${encodeURIComponent(payload.role)}&from=iframe`;
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

function ProtectedRoute() {
  const { token } = useAuthStore();
  if (!token) return <Navigate to="/entity-info" replace />;
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}

export default function App() {
  const initialRef = useRef({ referrer: _initialReferrer, params: _initialQueryParams });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/app-stock-management">
        <AmaTokenHandler>
          <Routes>
            {/* Public routes */}
            <Route path="/entity-info" element={<EntityInfoPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/change-password" element={<ChangePasswordPage />} />

            {/* Protected routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/products" element={<ProductListPage />} />
              <Route path="/products/new" element={<ProductFormPage />} />
              <Route path="/products/:id/edit" element={<ProductFormPage />} />
              <Route path="/skus" element={<SkuListPage />} />
              <Route path="/skus/new" element={<SkuFormPage />} />
              <Route path="/skus/:id/edit" element={<SkuFormPage />} />
              <Route path="/transactions" element={<TransactionListPage />} />
              <Route path="/inventories" element={<InventoryListPage />} />
              <Route path="/receiving" element={<ReceivingListPage />} />
              <Route path="/sales-orders" element={<SalesOrderListPage />} />
              <Route path="/sales-orders/new" element={<SalesOrderFormPage />} />
              <Route path="/order-batches" element={<OrderBatchListPage />} />
              <Route path="/forecasts" element={<ForecastListPage />} />
              <Route path="/safety-stocks" element={<SafetyStockListPage />} />
              <Route path="/settings/parameters" element={<ParameterSettingsPage />} />
              <Route path="/settings/seasonality" element={<SeasonalityPage />} />
              <Route path="/settings/channels" element={<ChannelListPage />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <DebugContextPanel
            initialReferrer={initialRef.current.referrer}
            initialQueryParams={initialRef.current.params}
          />
        </AmaTokenHandler>
        <ToastContainer />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
