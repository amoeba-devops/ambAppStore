import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { listActionLogsAction } from '@/server/actions/action-log.actions';
import { ActivityLogFeed } from '@/components/activity-log/ActivityLogFeed';

export default async function ActionHistoryPage() {
  const user = await getCurrentUser();
  requireRole(user.role, ['MANAGER', 'ADMIN']);

  const res = await listActionLogsAction({ limit: 10 });
  const initialRows = res.success ? res.data.rows : [];
  const initialHasMore = res.success ? res.data.hasMore : false;
  const initialTotal = res.success ? res.data.total : 0;
  const initialNextCursor = res.success ? res.data.nextCursor : null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Activity log</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Every action — uploads, edits, approvals, formula changes — is recorded here. Entries are immutable.
        </p>
      </div>

      <ActivityLogFeed
        initialRows={initialRows}
        initialHasMore={initialHasMore}
        initialTotal={initialTotal}
        initialNextCursor={initialNextCursor}
      />
    </div>
  );
}
