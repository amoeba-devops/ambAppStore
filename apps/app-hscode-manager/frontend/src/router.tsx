import { createBrowserRouter, Navigate } from 'react-router-dom';
import App from './App';
import MatchUploadPage from './pages/MatchUploadPage';
import MatchResultPage from './pages/MatchResultPage';
import ChatPage from './pages/ChatPage';
import HistoryPage from './pages/HistoryPage';
import ReferenceBuildPage from './pages/ReferenceBuildPage';
import QaSearchPage from './pages/QaSearchPage';
import BarcodeLookupPage from './pages/BarcodeLookupPage';
import AttributeExcelPage from './pages/AttributeExcelPage';
import ResultDetailPage from './pages/ResultDetailPage';
import ReferencePage from './pages/ReferencePage';
import AdminSettingsPage from './pages/AdminSettingsPage';
import KnowledgeBaseDashboardPage from './pages/KnowledgeBaseDashboardPage';
import KnowledgeBaseListPage from './pages/KnowledgeBaseListPage';
import KnowledgeBaseDetailPage from './pages/KnowledgeBaseDetailPage';
import KnowledgeBasePostEditPage from './pages/KnowledgeBasePostEditPage';
import KnowledgeBaseAdminPage from './pages/KnowledgeBaseAdminPage';

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <App />,
      children: [
        // 통관 AI 에이전트 (Phase 2~4) — 홈 = 문서 업로드 매칭(주 기능)
        { index: true, element: <Navigate to="/match" replace /> },
        { path: 'match', element: <MatchUploadPage /> },
        { path: 'match/:id', element: <MatchResultPage /> },
        { path: 'chat', element: <ChatPage /> },
        { path: 'history', element: <HistoryPage /> },
        { path: 'reference-build', element: <ReferenceBuildPage /> },

        // 지식창고 (Knowledge Base) — 게시판형 참조 라이브러리
        { path: 'knowledge-base', element: <KnowledgeBaseDashboardPage /> },
        { path: 'knowledge-base/posts', element: <KnowledgeBaseListPage /> },
        { path: 'knowledge-base/posts/new', element: <KnowledgeBasePostEditPage /> },
        { path: 'knowledge-base/posts/:id', element: <KnowledgeBaseDetailPage /> },
        { path: 'knowledge-base/posts/:id/edit', element: <KnowledgeBasePostEditPage /> },
        { path: 'knowledge-base/admin', element: <KnowledgeBaseAdminPage /> },

        // 레거시/보조 기능
        { path: 'search/qa', element: <QaSearchPage /> },
        { path: 'search/barcode', element: <BarcodeLookupPage /> },
        { path: 'search/attribute', element: <AttributeExcelPage /> }, // 고급 수동 입력
        { path: 'result', element: <ResultDetailPage /> },
        { path: 'result/:id', element: <ResultDetailPage /> },
        { path: 'reference', element: <ReferencePage /> },
        { path: 'admin', element: <AdminSettingsPage /> },
      ],
    },
  ],
  { basename: '/app-hscode' },
);
