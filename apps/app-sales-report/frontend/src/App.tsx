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
import { SpuMasterListPage } from '@/pages/SpuMasterListPage';
import { SkuMasterListPage } from '@/pages/SkuMasterListPage';
import { SkuDetailPage } from '@/pages/SkuDetailPage';
import { ChannelMappingListPage } from '@/pages/ChannelMappingListPage';
import { OrderUploadPage } from '@/pages/OrderUploadPage';
import { DailyReportPage } from '@/pages/DailyReportPage';
import { DailyDetailPage } from '@/pages/DailyDetailPage';
import { WeeklyCmPage } from '@/pages/WeeklyCmPage';
import { MonthlyCmPage } from '@/pages/MonthlyCmPage';
import { RawOrderListPage } from '@/pages/RawOrderListPage';
import { RawOrderDetailPage } from '@/pages/RawOrderDetailPage';
import { UploadHistoryPage } from '@/pages/UploadHistoryPage';
import { LivestreamPage } from '@/pages/LivestreamPage';
import { CreatorPage } from '@/pages/CreatorPage';
import { ManualInputPage } from '@/pages/ManualInputPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { ReportUploadPage } from '@/pages/ReportUploadPage';
import {
  getAmaTokenFromUrl,
  decodeAmaToken,
  validateReferrer,
  isTokenExpired,
  isValidAppCode,
  checkSubscription,
} from '@/lib/ama-token';
import i18n from '@/i18n/i18n';

function AmaTokenHandler({ children }: { children: React.ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { setAuth, setCrpCode, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useTranslation('sales');
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const processed = useRef(false);
  const hasAmaToken = useRef(!!new URLSearchParams(window.location.search).get('ama_token'));

  useEffect(() => {
    if (processed.current) return;

    const tokenData = getAmaTokenFromUrl();
    if (!tokenData) {
      setReady(true);
      return;
    }
    processed.current = true;
    clearAuth();

    const { token, locale } = tokenData;
    if (locale && locale !== i18n.language) {
      i18n.changeLanguage(locale);
    }

    if (!validateReferrer()) {
      window.location.href = window.location.origin;
      return;
    }

    const payload = decodeAmaToken(token);
    if (!payload) { setError(t('auth.invalidAccess')); return; }
    if (isTokenExpired(payload)) { setError(t('auth.tokenExpired')); return; }
    if (!isValidAppCode(payload)) { setError(t('auth.invalidAccess')); return; }

    checkSubscription(payload.entityId).then((status) => {
      if (status === 'ACTIVE') {
        apiClient
          .post('/v1/auth/ama-sso', { ama_token: token })
          .then((res) => {
            const { accessToken, refreshToken, user } = res.data.data;
            setAuth(accessToken, refreshToken, user);
            if (user.crpCode) setCrpCode(user.crpCode);
            searchParams.delete('ama_token');
            searchParams.delete('locale');
            setSearchParams(searchParams, { replace: true });
            navigate('/', { replace: true });
            setReady(true);
          })
          .catch(() => { setError(t('auth.invalidAccess')); });
      } else {
        const platformBase = window.location.origin;
        const redirectUrl = `${platformBase}/apps/app-sales-report?ent_id=${encodeURIComponent(payload.entityId)}&role=${encodeURIComponent(payload.role)}&from=iframe`;
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
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/app-sales-report">
        <AmaTokenHandler>
          <Routes>
            {/* Public routes */}
            <Route path="/entity-info" element={<EntityInfoPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/change-password" element={<ChangePasswordPage />} />

            {/* Protected routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/spu" element={<SpuMasterListPage />} />
              <Route path="/sku" element={<SkuMasterListPage />} />
              <Route path="/sku/:skuId" element={<SkuDetailPage />} />
              <Route path="/channel-mapping" element={<ChannelMappingListPage />} />
              <Route path="/daily-report" element={<DailyReportPage />} />
              <Route path="/daily-report/detail" element={<DailyDetailPage />} />
              <Route path="/weekly-cm" element={<WeeklyCmPage />} />
              <Route path="/monthly-cm" element={<MonthlyCmPage />} />
              <Route path="/upload" element={<OrderUploadPage />} />
              <Route path="/report-upload" element={<ReportUploadPage />} />
              <Route path="/upload-history" element={<UploadHistoryPage />} />
              <Route path="/orders" element={<RawOrderListPage />} />
              <Route path="/orders/:ordId" element={<RawOrderDetailPage />} />
              <Route path="/livestream" element={<LivestreamPage />} />
              <Route path="/creator" element={<CreatorPage />} />
              <Route path="/manual-input" element={<ManualInputPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AmaTokenHandler>
        <ToastContainer />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
