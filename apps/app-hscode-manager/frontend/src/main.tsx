import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from './router';
import i18n from './i18n/i18n';
import { bootstrapAmaAuth } from '@/lib/ama-token';
import './index.css';

// AMA SSO: 렌더 전에 ama_token을 캡처해 스토어에 세팅 (첫 API 호출부터 Bearer 부착).
const amaLocale = bootstrapAmaAuth();
if (amaLocale && amaLocale !== i18n.language) {
  void i18n.changeLanguage(amaLocale);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
