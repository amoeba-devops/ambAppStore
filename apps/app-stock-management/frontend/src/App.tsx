import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';
import { useAuthStore } from '@/stores/auth.store';
import { AppLayout } from '@/components/layout/AppLayout';
import { ToastContainer } from '@/components/common/ToastContainer';

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
      <BrowserRouter basename="/app-stock-management">
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
        <ToastContainer />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
