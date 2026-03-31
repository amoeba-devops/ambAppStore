import { BrowserRouter, Routes, Route, Navigate, Outlet, useSearchParams, useNavigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';
import { useAuthStore } from '@/stores/auth.store';
import { apiClient } from '@/lib/api-client';
import { AppLayout } from '@/components/layout/AppLayout';
import { ToastContainer } from '@/components/common/ToastContainer';
import { useEffect, useRef, useState } from 'react';
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

// Capture initial values BEFORE React hydration cleans URL
const _initialReferrer = document.referrer;
const _initialQueryParams = window.location.search;

/**
 * AMA iframe 쿼리파라미터(ent_id, ent_code, ent_name, email) 감지 후
 * 자동 인증하여 대시보드에 진입시키는 컴포넌트.
 */
function AmaEntryHandler() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { setAuth, setCrpCode } = useAuthStore();
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const entId = searchParams.get('ent_id');
    const entCode = searchParams.get('ent_code');
    const entName = searchParams.get('ent_name');
    const email = searchParams.get('email');

    if (!entId || !entCode || !entName || !email) return;
    if (processing) return;

    setProcessing(true);

    // 쿼리 파라미터 제거 (clean URL)
    searchParams.delete('ent_id');
    searchParams.delete('ent_code');
    searchParams.delete('ent_name');
    searchParams.delete('email');
    setSearchParams(searchParams, { replace: true });

    // AMA 자동 인증 API 호출
    apiClient
      .post('/v1/auth/ama-entry', {
        ent_id: entId,
        ent_code: entCode,
        ent_name: entName,
        email,
      })
      .then((res) => {
        const { accessToken, refreshToken, user } = res.data.data;
        setAuth(accessToken, refreshToken, user);
        setCrpCode(user.crpCode);
        navigate('/', { replace: true });
      })
      .catch((err) => {
        console.error('AMA entry login failed:', err);
        navigate('/entity-info', { replace: true });
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
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
        <AmaEntryHandler />
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
        <ToastContainer />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
