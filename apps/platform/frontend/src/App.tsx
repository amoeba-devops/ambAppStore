import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';
import '@/i18n/i18n';

import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { LandingPage } from '@/pages/LandingPage';
import { AppDetailPage } from '@/pages/AppDetailPage';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="flex min-h-screen flex-col bg-gray-50">
          <Header />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/apps/:slug" element={<AppDetailPage />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
