import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';
import '@/i18n/i18n';
import { AppLayout } from '@/components/layout/AppLayout';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { AdminLayoutPage } from '@/pages/admin/AdminLayoutPage';
import { MasterImportCountryPage } from '@/pages/admin/MasterImportCountryPage';
import { MasterExportCountryPage } from '@/pages/admin/MasterExportCountryPage';
import { MasterExporterPage } from '@/pages/admin/MasterExporterPage';
import { MasterDataSourcePage } from '@/pages/admin/MasterDataSourcePage';
import { MasterFtaPage } from '@/pages/admin/MasterFtaPage';
import { UserProfilePage } from '@/pages/admin/UserProfilePage';
import { InquiryCreatePage } from '@/pages/inquiry/InquiryCreatePage';
import { IntakeChannelPage } from '@/pages/intake/IntakeChannelPage';
import { DirectInputPage } from '@/pages/intake/DirectInputPage';
import { ExcelUploadPage } from '@/pages/intake/ExcelUploadPage';
import { HoldQueuePage } from '@/pages/intake/HoldQueuePage';
import { MatchingProgressPage } from '@/pages/matching/MatchingProgressPage';
import { RecommendationConfirmPage } from '@/pages/matching/RecommendationConfirmPage';
import { ClassificationListPage } from '@/pages/classification/ClassificationListPage';
import { ClassificationDetailPage } from '@/pages/classification/ClassificationDetailPage';
import { VerificationRegisterPage } from '@/pages/verification/VerificationRegisterPage';
import { ReviewQueuePage } from '@/pages/verification/ReviewQueuePage';
import { EscalationQueuePage } from '@/pages/expert/EscalationQueuePage';
import { ExpertReplyPage } from '@/pages/expert/ExpertReplyPage';
import { PolicyThresholdPage } from '@/pages/admin/PolicyThresholdPage';
import { KpiDashboardPage } from '@/pages/admin/KpiDashboardPage';
import { UnsupportedCountryPage } from '@/pages/admin/UnsupportedCountryPage';
import { meService } from '@/services/me.service';
import { useAuthStore } from '@/stores/auth.store';

function MeBootstrap() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const { data } = useQuery({
    queryKey: ['me'],
    queryFn: meService.get,
    retry: false,
  });
  useEffect(() => {
    if (data) {
      setAuth(localStorage.getItem('ama_token') ?? '__bootstrap__', {
        userId: data.userId,
        entityId: data.entityId,
        entityCode: data.entityCode,
        email: data.email,
        name: data.name,
        roles: data.roles,
      });
    }
  }, [data, setAuth]);
  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/app-hscode">
        <MeBootstrap />
        <AppLayout>
          <Routes>
            <Route path="/" element={<DashboardPage />} />

            <Route path="/new-work" element={<InquiryCreatePage />} />
            <Route path="/new-work/:inquiryId/channel" element={<IntakeChannelPage />} />
            <Route path="/new-work/:inquiryId/direct" element={<DirectInputPage />} />
            <Route path="/new-work/:inquiryId/excel" element={<ExcelUploadPage />} />
            <Route
              path="/new-work/:inquiryId/excel/:batchId/hold"
              element={<HoldQueuePage />}
            />
            <Route
              path="/new-work/:inquiryId/matching"
              element={<MatchingProgressPage />}
            />
            <Route
              path="/new-work/:inquiryId/candidates"
              element={<RecommendationConfirmPage />}
            />

            <Route path="/classifications" element={<ClassificationListPage />} />
            <Route
              path="/classifications/:id"
              element={<ClassificationDetailPage />}
            />

            <Route path="/verification" element={<ReviewQueuePage />} />
            <Route path="/verification/register" element={<VerificationRegisterPage />} />
            <Route
              path="/verification/register/:classificationId"
              element={<VerificationRegisterPage />}
            />

            <Route path="/expert-reviews" element={<EscalationQueuePage />} />
            <Route path="/expert-reviews/:id" element={<ExpertReplyPage />} />

            <Route path="/admin" element={<AdminLayoutPage />}>
              <Route index element={<Navigate to="import-countries" replace />} />
              <Route path="import-countries" element={<MasterImportCountryPage />} />
              <Route path="export-countries" element={<MasterExportCountryPage />} />
              <Route path="exporters" element={<MasterExporterPage />} />
              <Route path="data-sources" element={<MasterDataSourcePage />} />
              <Route path="fta" element={<MasterFtaPage />} />
              <Route path="policy" element={<PolicyThresholdPage />} />
              <Route path="kpi" element={<KpiDashboardPage />} />
              <Route path="ucr" element={<UnsupportedCountryPage />} />
              <Route path="me" element={<UserProfilePage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
