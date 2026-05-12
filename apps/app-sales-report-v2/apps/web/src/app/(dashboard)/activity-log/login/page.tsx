import { PlaceholderPage } from '@/components/layout/PlaceholderPage';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';

export default async function LoginHistoryPage() {
  const user = await getCurrentUser();
  requireRole(user.role, ['MANAGER', 'ADMIN']);

  return (
    <PlaceholderPage
      title="Login History"
      description="Immutable log of all login attempts (success + fail) per FR-19. Columns: username | IP | success | timestamp. Filter by date range + username. Read-only — no edit/delete kể cả Admin (NFR-13)."
      fr="FR-19"
      taskId="F-5 (T-501)"
    />
  );
}
