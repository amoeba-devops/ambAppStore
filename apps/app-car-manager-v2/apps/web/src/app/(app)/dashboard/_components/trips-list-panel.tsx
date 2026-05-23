'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';
import { Badge, Card, CardContent, CardHeader, CardTitle, cn } from '@car-v2/ui';
import type { CarTripStatus } from '@car-v2/db/schema';
import type { TripListItem } from '@/server/queries/trips.queries';

interface TripsListPanelProps {
  trips: TripListItem[];
  highlightId?: string | null;
  onCreateClick: () => void;
}

const STATUS_TONE: Record<CarTripStatus, 'accent' | 'warning' | 'success' | 'info' | 'neutral' | 'danger'> = {
  PENDING_ASSIGNMENT:          'accent',
  PENDING_DRIVER_CONFIRMATION: 'warning',
  CONFIRMED:                   'success',
  IN_PROGRESS:                 'info',
  COMPLETED:                   'neutral',
  REJECTED_BY_DRIVER:          'danger',
  CANCELLED:                   'danger',
};

function formatTime(d: Date | string): string {
  return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
}

export function TripsListPanel({ trips, highlightId, onCreateClick }: TripsListPanelProps) {
  const t = useTranslations('dashboard.tripsList');
  const tStatus = useTranslations('trips.status');
  const router = useRouter();
  const highlightRef = useRef<HTMLAnchorElement | null>(null);

  /* Auto-scroll the highlighted row into view when the panel mounts /
   * receives a new highlightId — so the user's eye lands on their newly
   * created or edited trip without manual scrolling. */
  useEffect(() => {
    if (!highlightId || !highlightRef.current) return;
    highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [highlightId]);

  /* Height strategy:
   *   - Mobile (< lg): natural overall card height but the inner trip <ul>
   *     caps at `max-h-[360px]` (~6 rows visible) so the page doesn't grow
   *     to N×row height when the tenant has many trips.
   *   - Desktop (lg+): the calendar's intrinsic height drives the grid
   *     row; `items-stretch` mirrors that onto this column. We add
   *     `lg:min-h-0 lg:flex-1` here so this Card both (a) flex-fills the
   *     space below VehicleLegend AND (b) zeroes its own min-content
   *     contribution so a long trips list doesn't push the rail past the
   *     calendar's natural height (which would re-stretch the calendar
   *     and bring back the empty band below the last hour row). The
   *     inner <ul> then drops its pixel cap and scrolls internally. */
  return (
    <Card className="flex min-h-0 flex-col lg:min-h-0 lg:flex-1">
      {/* "Xem tất cả →" moved out of the footer and pinned to the right
       * edge of this header — matches the VehicleLegend convention so
       * every dashboard section's "see full page" link sits in the same
       * top-right spot. Frees the footer of competing affordances and
       * means the link doesn't have to dodge the floating "+ Tạo chuyến"
       * FAB on mobile anymore.
       *
       * The primary "+ Tạo chuyến mới" CTA still lives on PageHeader
       * (desktop) / FAB (mobile) — no duplicate here. */}
      <CardHeader className="shrink-0">
        <CardTitle>{t('title')}</CardTitle>
        <Link
          href="/trips"
          className={cn(
            'shrink-0 inline-flex items-center gap-1 text-xs font-medium',
            'text-text-muted transition-colors hover:text-accent',
            'focus-visible:outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          {t('viewAll')}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-1">
        {trips.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center py-6 text-center text-xs text-text-faint">
            <p>{t('empty')}</p>
            <button
              type="button"
              onClick={onCreateClick}
              className="mt-2 text-accent hover:underline"
            >
              {t('emptyAction')}
            </button>
          </div>
        ) : (
          <ul className="max-h-[360px] space-y-1 overflow-y-auto pr-1 lg:max-h-none lg:flex-1 lg:min-h-0">
            {trips.map((tr) => {
              const isHighlighted = tr.trpId === highlightId;
              const href = `/dashboard?peek=${tr.trpId}`;
              return (
                <li key={tr.trpId}>
                  <Link
                    href={href}
                    scroll={false}
                    ref={isHighlighted ? highlightRef : undefined}
                    onClick={(e) => {
                      /* Use router.push to avoid full page reload — Next/Link
                       * already does client navigation but explicit push gives
                       * tighter control over the highlight cleanup timing. */
                      e.preventDefault();
                      router.push(href, { scroll: false });
                    }}
                    className={cn(
                      'block rounded-md border border-border bg-surface px-3 py-2 transition-colors hover:bg-surface-2',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isHighlighted && 'ccms-event-highlight',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-[10px] text-text-muted">{tr.trpRef}</span>
                      <Badge tone={STATUS_TONE[tr.trpStatus]} size="sm">{tStatus(tr.trpStatus)}</Badge>
                    </div>
                    <div className="mt-0.5 truncate text-[13px] font-semibold text-text">
                      {tr.passengerName ?? '—'}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-text-muted">
                      <span className="tabular">{formatDate(tr.trpScheduledAt)}</span>
                      <span>·</span>
                      <span className="tabular">{formatTime(tr.trpScheduledAt)}</span>
                      {tr.vehiclePlate && (
                        <>
                          <span>·</span>
                          <span className="font-mono">{tr.vehiclePlate}</span>
                        </>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
