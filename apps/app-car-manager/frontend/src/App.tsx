import { BrowserRouter, Routes, Route } from 'react-router-dom';
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/app-car-manager">
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
