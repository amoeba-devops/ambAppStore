import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useSearchParams } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';
import '@/i18n/i18n';

import { AppLayout } from '@/components/layout/AppLayout';
import { ToastContainer } from '@/components/common/ToastContainer';
import { DashboardPage } from '@/pages/DashboardPage';
import { VehicleListPage } from '@/pages/VehicleListPage';
import { VehicleDetailPage } from '@/pages/VehicleDetailPage';
import { VehicleFormPage } from '@/pages/VehicleFormPage';
import { DispatchListPage } from '@/pages/DispatchListPage';
import { DispatchDetailPage } from '@/pages/DispatchDetailPage';
import { DispatchFormPage } from '@/pages/DispatchFormPage';
import { TripLogListPage } from '@/pages/TripLogListPage';
import { useAuthStore } from '@/stores/auth.store';

/**
 * AMA → AppStore → 앱 진입 시 쿼리 파라미터로 Entity 정보를 전달받아
 * auth.store에 설정하고 URL에서 제거.
 */
function EntityContextInitializer() {
  const [searchParams, setSearchParams] = useSearchParams();
  const setEntityAuth = useAuthStore((s) => s.setEntityAuth);

  useEffect(() => {
    const entId = searchParams.get('ent_id');
    const entCode = searchParams.get('ent_code');
    const entName = searchParams.get('ent_name');
    const email = searchParams.get('email');

    if (entId && entCode) {
      setEntityAuth({
        userId: entId,
        entityId: entId,
        entityCode: entCode,
        email: email ?? '',
        name: entName ?? '',
        roles: [],
      });
      searchParams.delete('ent_id');
      searchParams.delete('ent_code');
      searchParams.delete('ent_name');
      searchParams.delete('email');
      setSearchParams(searchParams, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/app-car-manager">
        <EntityContextInitializer />
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
        <ToastContainer />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
