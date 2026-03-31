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
import { AdminLoginPage } from '@/pages/admin/AdminLoginPage';
import { AppsLoginPage } from '@/pages/AppsLoginPage';
import { MySubscriptionsPage } from '@/pages/MySubscriptionsPage';
import { useEntityContextStore } from '@/stores/entity-context.store';
import { DebugContextPanel } from '@/components/common/DebugContextPanel';
import { useEffect, useRef } from 'react';

// Capture initial values BEFORE React hydration cleans URL
const _initialReferrer = document.referrer;
const _initialQueryParams = window.location.search;

/**
 * AMA iframe 호출 시 쿼리 파라미터(ent_id, ent_code, ent_name, email)를
 * Zustand 스토어에 저장하고 URL에서 제거.
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
