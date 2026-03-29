import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
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
          <Footer />
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
