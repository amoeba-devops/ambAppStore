import { createBrowserRouter, Navigate } from 'react-router-dom';
import App from './App';
import QaSearchPage from './pages/QaSearchPage';
import BarcodeLookupPage from './pages/BarcodeLookupPage';
import AttributeExcelPage from './pages/AttributeExcelPage';
import ResultDetailPage from './pages/ResultDetailPage';
import ReferencePage from './pages/ReferencePage';
import AdminSettingsPage from './pages/AdminSettingsPage';

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <App />,
      children: [
        { index: true, element: <Navigate to="/search/qa" replace /> },
        { path: 'search/qa', element: <QaSearchPage /> },
        { path: 'search/barcode', element: <BarcodeLookupPage /> },
        { path: 'search/attribute', element: <AttributeExcelPage /> },
        { path: 'result', element: <ResultDetailPage /> },
        { path: 'result/:id', element: <ResultDetailPage /> },
        { path: 'reference', element: <ReferencePage /> },
        { path: 'admin', element: <AdminSettingsPage /> },
      ],
    },
  ],
  { basename: '/app-hscode' },
);
