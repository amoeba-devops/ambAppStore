import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Calendar, ChevronRight } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardHeaderText, CardTitle, EmptyState } from '@car-v2/ui';
import { DriverActionBar } from '@/components/layout/driver-action-bar';
import { TripActions } from '@/app/(app)/trips/[id]/trip-actions';
import type { TripListItem } from '@/server/queries/trips.queries';
import type { DriverVehicleSummary } from '@/server/queries/vehicles.queries';
import { DriverNextTripCard } from './driver-next-trip-card';
import { DriverMyVehicles } from './driver-my-vehicles';

const TIME_FMT = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
const DATE_FMT = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' });

interface DriverTodayViewProps {
  /* Driver's assigned trips (any status) ordered by scheduled time. The view
   * picks the next actionable trip and routes the rest into the "Later today"
   * list. Trips outside today are ignored for the laterToday list. */
  trips: TripListItem[];
  /** Unique vehicles từ trip history của driver — render trong "My vehicles" section. */
  vehicles: DriverVehicleSummary[];
}

/* Driver-only `/today` screen. Optimised for the three states a driver actually
 * cares about, in order:
 *
 *   1. IN_PROGRESS         → "On the road" — single big "End trip" CTA
 *   2. PENDING_DRIVER_CONFIRMATION (any time) → Accept / Reject
 *   3. CONFIRMED (today or soon) → "Start trip"
 *
 * In all three cases the action lives in `<DriverActionBar>` sticky to the
 * bottom of the viewport so the user can act without scrolling. If none of the
 * three apply, the view falls back to an empty state with a "View all trips"
 * affordance.
 *
 * A floating "Record expense" button is always present (above the action bar
 * and the global BottomTabNav) because expense capture is the second most
 * common driver action after status updates. */
export async function DriverTodayView({ trips, vehicles }: DriverTodayViewProps) {
  const tT = await getTranslations('today');
  const tD = await getTranslations('today.driver');
  const tStatus = await getTranslations('today.status');
  const pickupLabel = tT('pickup');
  const dropoffLabel = tT('dropoff');
  const passengerFallback = tT('passengerUnspecified');

  /* Trip selection priority — driver picks the single most "actionable" trip.
   * Once that's chosen the rest of today's trips become the secondary list. */
  const inProgress = trips.find((t) => t.trpStatus === 'IN_PROGRESS');
  const awaitingConfirm = trips.find((t) => t.trpStatus === 'PENDING_DRIVER_CONFIRMATION');
  const confirmedNext = trips
    .filter((t) => t.trpStatus === 'CONFIRMED')
    .sort((a, b) => new Date(a.trpScheduledAt).getTime() - new Date(b.trpScheduledAt).getTime())[0];

  const primary = inProgress ?? awaitingConfirm ?? confirmedNext ?? null;
  const mode: 'active' | 'confirm' | 'ready' | 'empty' =
    inProgress ? 'active' : awaitingConfirm ? 'confirm' : confirmedNext ? 'ready' : 'empty';

  const todayTrips = trips.filter((t) => isSameDay(new Date(t.trpScheduledAt), new Date()));
  const laterToday = primary ? todayTrips.filter((t) => t.trpId !== primary.trpId) : todayTrips;

  /* "Chuyến gần đây" — trips NOT today (past or upcoming), capped at 5 cho card preview.
   * `trips` đã được order theo scheduledAt DESC từ query, nên slice đầu = mới nhất. */
  const recentTrips = trips
    .filter((t) => !isSameDay(new Date(t.trpScheduledAt), new Date()))
    .slice(0, 5);
  const tR = await getTranslations('today.driver.recent');

  return (
    <>
      {/* Main scroll area — bottom padding is conditional: with a primary trip
       * we reserve room for the sticky action bar (h-14 + 2 stacked buttons +
       * BottomTabNav + safe-area ≈ 200px). Without a primary trip there's no
       * action bar, so we only clear the BottomTabNav. */}
      <div
        className={
          'flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6 space-y-4 ' +
          (primary ? 'pb-[220px] md:pb-[120px]' : 'pb-24 md:pb-12')
        }
      >
        {primary ? (
          <>
            <DriverNextTripCard
              trip={primary}
              mode={mode === 'empty' ? 'ready' : mode}
              labels={buildCardLabels(primary, mode, tD, tStatus, {
                pickup: pickupLabel,
                dropoff: dropoffLabel,
                passengerFallback,
              })}
            />
            {/* Secondary CTA — link to full detail when driver wants to read
             * notes / stopovers / activity. Subtle so it doesn't compete with
             * the sticky primary action below. */}
            <Link
              href={`/trips/${primary.trpId}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded px-1"
            >
              {tD('openDetail')} <ChevronRight className="h-4 w-4" />
            </Link>
          </>
        ) : (
          <Card>
            <EmptyState
              icon={<Calendar />}
              title={tD('nothingToday')}
              description={tD('nothingTodayDesc')}
              action={
                <Button asChild variant="secondary" size="lg">
                  <Link href="/trips">{tD('viewAllTrips')}</Link>
                </Button>
              }
            />
          </Card>
        )}

        {laterToday.length > 0 && (
          <Card>
            <CardHeader>
              <CardHeaderText>
                <CardTitle>{tT('laterToday')}</CardTitle>
              </CardHeaderText>
            </CardHeader>
            <CardContent padded={false}>
              <ul className="divide-y divide-border">
                {laterToday.map((t) => (
                  <li key={t.trpId}>
                    <Link
                      href={`/trips/${t.trpId}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    >
                      <div className="font-mono text-xs text-text-muted tabular shrink-0">{t.trpRef}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-text truncate">{t.passengerName ?? '—'}</div>
                        <div className="text-xs text-text-faint truncate">
                          {t.trpPickupAddress} → {t.trpDropoffAddress}
                        </div>
                      </div>
                      <div className="text-xs text-text-muted tabular shrink-0">
                        {TIME_FMT.format(new Date(t.trpScheduledAt))}
                      </div>
                      <ChevronRight className="h-4 w-4 text-text-faint shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* "Phương tiện của tôi" — vehicles từ trip history. Ẩn nếu driver
         *  chưa có trip nào với vehicle assigned. */}
        <DriverMyVehicles vehicles={vehicles} />

        {/* "Chuyến gần đây" — trips KHÔNG phải hôm nay (5 chuyến mới nhất).
         *  Bổ sung cho "laterToday" (chỉ hôm nay) để driver thấy lịch sử ngắn
         *  + sắp tới. Link "Xem tất cả" dẫn về /trips (đã filter theo driver). */}
        {recentTrips.length > 0 && (
          <Card>
            <CardHeader>
              <CardHeaderText>
                <CardTitle>{tR('title')}</CardTitle>
              </CardHeaderText>
              <Link
                href="/trips"
                className="text-xs font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1"
              >
                {tR('viewAll')}
              </Link>
            </CardHeader>
            <CardContent padded={false}>
              <ul className="divide-y divide-border">
                {recentTrips.map((t) => (
                  <li key={t.trpId}>
                    <Link
                      href={`/trips/${t.trpId}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    >
                      <div className="font-mono text-xs text-text-muted tabular shrink-0">{t.trpRef}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-text truncate">
                          {t.passengerName ?? '—'}
                          {t.vehiclePlate && (
                            <span className="ml-2 font-mono text-[11px] text-text-faint tabular">
                              · {t.vehiclePlate}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-text-faint truncate">
                          {t.trpPickupAddress} → {t.trpDropoffAddress}
                        </div>
                      </div>
                      <div className="text-xs text-text-muted tabular shrink-0 text-right">
                        <div>{DATE_FMT.format(new Date(t.trpScheduledAt))}</div>
                        <div className="text-text-faint">{TIME_FMT.format(new Date(t.trpScheduledAt))}</div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-text-faint shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Bottom action bar — only when there's actually something to do.
       * (Expense submission is reached via the bottom-tab "Expenses" → "+ New"
       * — no separate FAB on /today to avoid two Receipt-icon affordances
       * competing in the same viewport.) */}
      {primary && (
        <DriverActionBar>
          <TripActions
            tripId={primary.trpId}
            status={primary.trpStatus}
            role="DRIVER"
            isAssignedDriver
            isCreator={false}
            drivers={[]}
            vehicles={[]}
            tripScheduledAtIso={primary.trpScheduledAt.toISOString()}
            tripDurationMinutes={primary.trpDurationMinutes}
          />
        </DriverActionBar>
      )}
    </>
  );
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function buildCardLabels(
  trip: TripListItem,
  mode: 'active' | 'confirm' | 'ready' | 'empty',
  tD: (key: string, vars?: Record<string, string | number>) => string,
  tStatus: (key: string) => string,
  routeLabels: { pickup: string; dropoff: string; passengerFallback: string },
) {
  const minutes = Math.round((new Date(trip.trpScheduledAt).getTime() - Date.now()) / 60_000);
  const statusLine =
    mode === 'active'
      ? tD('activeNow')
      : mode === 'confirm'
        ? tD('waitingConfirm')
        : minutes <= 0
          ? tD('readyToStart')
          : tD('readyToStartIn', { n: Math.max(minutes, 0) });

  return {
    statusLine,
    statusBadge: tStatus(trip.trpStatus),
    pickup: routeLabels.pickup,
    dropoff: routeLabels.dropoff,
    timeFormatted: TIME_FMT.format(new Date(trip.trpScheduledAt)),
    durationSuffix: trip.trpDurationMinutes ? `${trip.trpDurationMinutes} ${tD('minutesAbbr')}` : null,
    passengerFallback: routeLabels.passengerFallback,
  };
}
