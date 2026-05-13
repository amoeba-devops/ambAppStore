import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { UploadReportsClient } from '@/components/upload/UploadReportsClient';

export default async function UploadPage() {
  const user = await getCurrentUser();
  requireRole(user.role, ['OPERATOR', 'ADMIN']);
  return <UploadReportsClient />;
}
