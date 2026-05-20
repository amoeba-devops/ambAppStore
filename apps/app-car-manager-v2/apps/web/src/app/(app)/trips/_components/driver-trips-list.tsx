'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Calendar, ChevronRight } from 'lucide-react';
import { Avatar, Badge, Card, EmptyState, cn } from '@car-v2/ui';
import type { CarTripStatus } from '@car-v2/db/schema';
import type { TripListItem } from '@/server/queries/trips.queries';

interface DriverTripsListProps {
  trips: TripListItem[];
}

type DriverTripTab = 'ongoing' | 'completed';

const ONGOING_STATUSES: readonly CarTripStatus[] = [
  'PENDING_DRIVER_CONFIRMATION',
  'CONFIRMED',
  'IN_PROGRESS',
];
const COMPLETED_STATUSES: readonly CarTripStatus[] = [
  'COMPLETED',
  'CANCELLED',
  'REJECTED_BY_DRIVER',
];

const STATUS_TONE: Record<CarTripStatus, 'accent' | 'warning' | 'success' | 'info' | 'neutral' | 'danger'> = {
  PENDING_ASSIGNMENT:          'accent',
  PENDING_DRIVER_CONFIRMATION: 'warning',
  CONFIRMED:                   'success',
  IN_PROGRESS:                 'info',
  COMPLETED:                   'neutral',
  REJECTED_BY_DRIVER:          'danger',
  CANCELLED:                   'danger',
};

/* Driver-only trips list.
 *
 * Diff from the admin/manager list on this same route:
 *   - Card layout at every breakpoint (no desktop table). Driver is on a phone.
 *   - Two tabs: Ongoing (default — what needs attention) / Completed (history).
 *     Admin's 4-button filter ("all/pending/active/completed") would be noise
 *     for someone whose own work fits in two buckets.
 *   - No "driver" column (it's them). The bottom meta line is just time + plate.
 *   - No FAB / no "New trip" button (driver never creates trips). */
export function DriverTripsList({ trips }: DriverTripsListProps) {
  const t       = useTranslations('trips.driver');
  const tList   = useTranslations('trips.list');
  const tStatus = useTranslations('trips.status');
  const tCommon = useTranslations('common');
  const [tab, setTab] = useState<DriverTripTab>('ongoing');

  const filtered = useMemo(() => {
    const allowed = tab === 'ongoing' ? ONGOING_STATUSES : COMPLETED_STATUSES;
    return trips.filter((trip) => allowed.includes(trip.trpStatus));
  }, [trips, tab]);

  return (
    <div className="flex-1 overflow-auto px-4 py-3 space-y-3">
      <div
        role="tablist"
        aria-label={t('tabsAria')}
        className="inline-flex items-center gap-1 rounded-md bg-surface-2 p-1"
      >
        <TabButton active={tab === 'ongoing'}  onClick={() => setTab('ongoing')}  label={t('tabOngoing')}  />
        <TabButton active={tab === 'completed'} onClick={() => setTab('completed')} label={t('tabCompleted')} />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Calendar />}
            title={tab === 'ongoing' ? t('emptyOngoing') : t('emptyCompleted')}
            description={tab === 'ongoing' ? t('emptyOngoingDesc') : t('emptyCompletedDesc')}
          />
        </Card>
      ) : (
        <ul className="space-y-2.5">
          {filtered.map((trip) => (
            <li key={trip.trpId}>
              <Link
                href={`/trips/${trip.trpId}`}
                aria-label={tList('openAria', { ref: trip.trpRef })}
                className={cn(
                  'block rounded-lg border border-border bg-surface px-4 py-3.5 min-h-[80px]',
                  'active:bg-surface-2 transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                )}
              >
                <div className="flex items-start gap-3">
                  <Avatar name={trip.passengerName ?? '?'} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-mono text-[11px] text-text-faint tabular">{trip.trpRef}</div>
                        <div className="font-semibold text-text truncate leading-tight">
                          {trip.passengerName ?? tCommon('unknown')}
                        </div>
                      </div>
                      <Badge tone={STATUS_TONE[trip.trpStatus]} size="sm">{tStatus(trip.trpStatus)}</Badge>
                    </div>
                    <div className="mt-2 text-xs text-text-muted leading-snug">
                      <span className="text-text">{trip.trpPickupAddress}</span>
                      <span className="text-text-faint"> → </span>
                      <span className="text-text">{trip.trpDropoffAddress}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 text-xs text-text-muted">
                      <span className="tabular">{formatScheduled(trip.trpScheduledAt)}</span>
                      {trip.vehiclePlate && (
                        <>
                          <span className="text-text-faint">·</span>
                          <span className="font-mono tabular">{trip.vehiclePlate}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-text-faint shrink-0 self-center" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 h-11 md:h-9 px-4 rounded text-sm font-medium',
        'transition-colors motion-reduce:transition-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active ? 'bg-surface text-text shadow-xs' : 'text-text-muted hover:text-text',
      )}
    >
      {label}
    </button>
  );
}

function formatScheduled(iso: Date | string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return time;
  return `${d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })} · ${time}`;
}
