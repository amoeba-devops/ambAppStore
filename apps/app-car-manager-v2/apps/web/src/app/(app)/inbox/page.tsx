import { getTranslations } from 'next-intl/server';
import { Inbox as InboxIcon } from 'lucide-react';
import { Card, EmptyState } from '@car-v2/ui';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { listUserNotifications } from '@/server/queries/notifications.queries';
import { InboxList } from './_components/inbox-list';
import { MarkAllReadButton } from './_components/mark-all-read-button';

/* Inbox — in-app notification stream.
 *
 * Driver gets this for trip-assigned, trip-rejected-by-admin, expense-
 * approval-state-changed alerts. Admin/manager also see it (assignment
 * rejections, conflict overrides etc.). Same shape for both roles.
 *
 * Read state is per-row in `car_notifications.ntf_read_at` — we don't surface
 * a separate "unread" tab right now; just style unread rows with an accent
 * dot. Mark-all-read is the only bulk action. */
export default async function InboxPage() {
  const tCo  = await getTranslations('company');
  const tNav = await getTranslations('nav');
  const tI   = await getTranslations('inbox');
  const user = await getCurrentUser();

  const items = await listUserNotifications({
    entId: user.entId,
    userId: user.userId,
    limit: 50,
  });

  const unreadCount = items.filter((n) => n.ntfReadAt === null).length;

  return (
    <>
      <PageHeader
        title={tI('title')}
        subtitle={unreadCount > 0 ? tI('unreadCount', { n: unreadCount }) : tI('allRead')}
        breadcrumbs={[{ label: tCo('tenant') }, { label: tNav('inbox') }]}
        actions={unreadCount > 0 ? <MarkAllReadButton /> : undefined}
        back={user.role === 'DRIVER' ? '/today' : undefined}
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6 max-w-3xl mx-auto w-full">
        {items.length === 0 ? (
          <Card>
            <EmptyState
              icon={<InboxIcon />}
              title={tI('emptyTitle')}
              description={tI('emptyDesc')}
            />
          </Card>
        ) : (
          <InboxList items={items} />
        )}
      </div>
    </>
  );
}

