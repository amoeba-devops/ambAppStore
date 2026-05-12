import { PlaceholderPage } from '@/components/layout/PlaceholderPage';
import { requireRole } from '@/lib/auth/get-current-user';
import { getCurrentUser } from '@/lib/auth/get-current-user';

export default async function UploadPage() {
  const user = await getCurrentUser();
  requireRole(user.role, ['OPERATOR', 'ADMIN']);

  return (
    <PlaceholderPage
      title="Upload Reports"
      description="Smart Drop Zone — drop consolidated CSV (Shopee 6 sections + TikTok 5 sections) hoặc individual files. App tự detect sections theo row 1 markers + column heuristic. Period picker bắt buộc trước drop. Last-write-wins on overwrite (OI-001), archive bản cũ vào S3."
      fr="FR-01,02,03"
      taskId="F-1 (T-101~110)"
    />
  );
}
