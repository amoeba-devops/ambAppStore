'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Calendar, Check, Loader2, Receipt, ShieldAlert, UserPlus } from 'lucide-react';
import { Card, cn, toast } from '@car-v2/ui';
import type { CarNotification, NotificationTemplatePayload } from '@car-v2/db/schema';
import type { LocalRole } from '@car-v2/shared/auth';
import { markNotificationReadAction } from '@/server/actions/notifications/notification.actions';

interface InboxListProps {
  items: CarNotification[];
  /** Current user's local role for role-based notification content. */
  userRole: LocalRole;
}

/* Renders the notification stream. Tap on a notification: marks it read +
 * navigates to the related entity if `ntfEntityId` is present (trips: link to
 * `/trips/[id]`; expenses: link to `/expenses` for now — detail page is a
 * follow-up). Empty handling done by parent. */
export function InboxList({ items, userRole }: InboxListProps) {
  const t = useTranslations('inbox');
  const tEvents = useTranslations('notifications.events');
  const [pending, startTransition] = useTransition();

  const handleClick = (ntfId: string, isRead: boolean) => {
    if (isRead) return;
    startTransition(async () => {
      const result = await markNotificationReadAction(ntfId);
      if (!result.success) {
        toast.error(t('markReadFailed'));
      }
    });
  };

  return (
    <ul className="space-y-2">
      {items.map((n) => {
        const isRead = n.ntfReadAt !== null;
        const Icon = pickIcon(n.ntfEvent);
        const href = linkFor(n);
        const { title, body } = resolveCopy(n, tEvents, userRole);

        const inner = (
          <Card
            className={cn(
              'p-5 transition-colors',
              isRead
                ? 'opacity-70 hover:opacity-100'
                : 'border-l-4 border-l-accent shadow-sm',
            )}
          >
            <div className="flex items-start gap-3.5">
              <div
                className={cn(
                  'h-10 w-10 rounded-full flex items-center justify-center shrink-0',
                  isRead ? 'bg-surface-2 text-text-muted' : 'bg-accent-soft text-accent',
                )}
                aria-hidden
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3
                    className={cn(
                      'text-sm leading-snug',
                      isRead ? 'text-text font-medium' : 'text-text font-semibold',
                    )}
                  >
                    {title}
                  </h3>
                  <time
                    className="shrink-0 text-xs text-text-faint tabular"
                    dateTime={new Date(n.ntfCreatedAt).toISOString()}
                  >
                    {formatRelative(n.ntfCreatedAt)}
                  </time>
                </div>
                {body && (
                  <p className={cn('mt-1 text-xs leading-relaxed', isRead ? 'text-text-muted' : 'text-text')}>
                    {body}
                  </p>
                )}
                {n.ntfEntityRef && (
                  <div className="mt-1.5 font-mono text-[11px] text-text-faint tabular">
                    {n.ntfEntityRef}
                  </div>
                )}
              </div>
              {!isRead && (
                <span
                  aria-label={t('unreadAria')}
                  className="h-2 w-2 rounded-full bg-accent shrink-0 mt-2"
                />
              )}
              {pending && !isRead && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-text-muted shrink-0 mt-2" />
              )}
            </div>
          </Card>
        );

        return (
          <li key={n.ntfId}>
            {href ? (
              <Link
                href={href}
                onClick={() => handleClick(n.ntfId, isRead)}
                className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded"
              >
                {inner}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => handleClick(n.ntfId, isRead)}
                className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded"
              >
                {inner}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* Re-render a notification's title/body in the user's CURRENT UI locale via
 * `notifications.events.{EVENT}` JSON templates. Falls back to the frozen
 * `ntf_title` / `ntf_body` stored at insert time for legacy rows (no payload)
 * OR when the event has no template registered yet. */
function resolveCopy(
  n: CarNotification,
  tEvents: ReturnType<typeof useTranslations>,
  userRole: LocalRole,
): { title: string; body: string | null } {
  const payload = n.ntfTemplatePayload as NotificationTemplatePayload | null;
  if (!payload) {
    return { title: n.ntfTitle, body: n.ntfBody };
  }
  /* `useTranslations` throws if the key is missing — wrap so a new event
   * deployed before its JSON copy doesn't crash the whole inbox. */
  try {
    const subjectKey = pickSubjectKey(n.ntfEvent, userRole);
    const bodyKey = pickBodyKey(n.ntfEvent, payload, userRole);
    const interp = {
      ref: payload.ref,
      route: payload.route ?? '',
      reason: payload.reason ?? '',
      amount: payload.amount ?? '',
      description: payload.description ?? '',
      actorName: payload.actorName ?? '',
    };
    const title = tEvents(`${n.ntfEvent}.${subjectKey}`, interp);
    const body = tEvents(`${n.ntfEvent}.${bodyKey}`, interp);
    return { title, body };
  } catch {
    return { title: n.ntfTitle, body: n.ntfBody };
  }
}

/* Mirror of notification-template.service.pickSubjectKey — kept duplicated to
 * avoid pulling a server-only module into the client bundle. Both must stay
 * in sync if a new conditional subject variant is added. */
function pickSubjectKey(event: string, userRole: LocalRole): 'subject' | 'subjectDriver' {
  if (event === 'TRIP.CANCELLED' && userRole === 'DRIVER') {
    return 'subjectDriver';
  }
  return 'subject';
}

/* Mirror of notification-template.service.pickBodyKey — kept duplicated to
 * avoid pulling a server-only module into the client bundle. Both must stay
 * in sync if a new conditional body variant is added. */
function pickBodyKey(
  event: string,
  payload: NotificationTemplatePayload,
  userRole: LocalRole,
): 'body' | 'bodyWithRoute' | 'bodyWithReason' | 'bodyDriver' | 'bodyDriverWithReason' {
  /* TRIP.CANCELLED has role-specific variants for Driver recipients. */
  if (event === 'TRIP.CANCELLED' && userRole === 'DRIVER') {
    return payload.reason ? 'bodyDriverWithReason' : 'bodyDriver';
  }
  if ((event === 'TRIP.ASSIGNED' || event === 'TRIP.NEEDS_ASSIGNMENT') && payload.route) {
    return 'bodyWithRoute';
  }
  if ((event === 'TRIP.REJECTED' || event === 'TRIP.CANCELLED') && payload.reason) {
    return 'bodyWithReason';
  }
  return 'body';
}

/* Icon glyph chosen by event prefix. Falls back to a generic icon so a new
 * event family never makes the row look broken. */
function pickIcon(event: string) {
  if (event.startsWith('TRIP.ASSIGN')) return UserPlus;
  if (event.startsWith('TRIP.REJECT')) return ShieldAlert;
  if (event.startsWith('TRIP.')) return Calendar;
  if (event.startsWith('EXPENSE.')) return Receipt;
  return Check;
}

/* Build the destination href from event family + entity id. Trip events go
 * to the trip detail; expense events to the list (detail page is a future
 * follow-up). Unknown families return null and the row is a plain button. */
function linkFor(n: CarNotification): string | null {
  if (!n.ntfEntityId) return null;
  if (n.ntfEvent.startsWith('TRIP.')) return `/trips/${n.ntfEntityId}`;
  if (n.ntfEvent.startsWith('EXPENSE.')) return `/expenses`;
  return null;
}

function formatRelative(date: Date | string): string {
  const t = new Date(date).getTime();
  const diff = Date.now() - t;
  const min = Math.round(diff / 60_000);
  if (min < 1) return 'now';
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  const d = Math.round(hr / 24);
  if (d < 30) return `${d}d`;
  return new Date(date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
}
