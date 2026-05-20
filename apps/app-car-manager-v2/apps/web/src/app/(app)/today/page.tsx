import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import {
  Calendar,
  Car,
  ChevronRight,
  Clock,
  MapPin,
} from 'lucide-react';
import {
  Avatar,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardHeaderText,
  CardTitle,
  EmptyState,
} from '@car-v2/ui';
import type { CarTripStatus } from '@car-v2/db/schema';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getDriverByUserId } from '@/server/queries/drivers.queries';
import { listTrips, listTripsForDriver, type TripListItem } from '@/server/queries/trips.queries';
import { DriverTodayView } from './_components/driver-today-view';

const TIME_FMT = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

function isToday(d: Date | string): boolean {
  const date = new Date(d);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() &&
         date.getMonth() === now.getMonth() &&
         date.getDate() === now.getDate();
}

function minutesFromNow(d: Date | string): number {
  return Math.round((new Date(d).getTime() - Date.now()) / 60_000);
}

export default async function TodayPage() {
  const tCo     = await getTranslations('company');
  const tT      = await getTranslations('today');
  const tStatus = await getTranslations('today.status');
  const user = await getCurrentUser();

  let myTrips: TripListItem[] = [];
  if (user.role === 'DRIVER') {
    const driver = await getDriverByUserId(user.entId, user.userId);
    if (driver) myTrips = await listTripsForDriver(user.entId, driver.drvId, 20);
  } else {
    /* Manager/Admin sees today's overview */
    const { items } = await listTrips({
      entId: user.entId,
      role: user.role,
      userId: user.userId,
      status: 'all',
    });
    myTrips = items;
  }

  /* Driver gets the dedicated PWA-first content view (state-aware hero +
   * sticky bottom action + expense FAB). The page chrome (PageHeader) is the
   * same component admins use — keeping the visual identity consistent across
   * roles per user feedback. */
  if (user.role === 'DRIVER') {
    return (
      <>
        <PageHeader
          title={tT('title')}
          subtitle={`${tCo('currentUser')} · ${tT('subtitleTrips', { count: myTrips.filter((t) => isToday(t.trpScheduledAt)).length })}`}
          breadcrumbs={[{ label: tCo('tenant') }, { label: tT('title') }]}
        />
        <DriverTodayView trips={myTrips} />
      </>
    );
  }

  /* Pick the "next" trip — CONFIRMED or IN_PROGRESS today or the earliest upcoming. */
  const todayTrips = myTrips.filter((t) => isToday(t.trpScheduledAt));
  const nextTrip =
    myTrips.find((t) => t.trpStatus === 'IN_PROGRESS') ??
    todayTrips.find((t) => t.trpStatus === 'CONFIRMED' || t.trpStatus === 'PENDING_DRIVER_CONFIRMATION') ??
    myTrips.find((t) =>
      ['CONFIRMED', 'PENDING_DRIVER_CONFIRMATION', 'PENDING_ASSIGNMENT'].includes(t.trpStatus) &&
      new Date(t.trpScheduledAt).getTime() >= Date.now(),
    ) ??
    null;

  const laterToday = todayTrips.filter((t) => t.trpId !== nextTrip?.trpId);

  return (
    <>
      <PageHeader
        title={tT('title')}
        subtitle={`${tCo('currentUser')} · ${tT('subtitleTrips', { count: todayTrips.length })}`}
        breadcrumbs={[{ label: tCo('tenant') }, { label: tT('title') }]}
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6 space-y-4">
        {nextTrip ? <NextTripHero trip={nextTrip} t={tT} tStatus={tStatus} /> : (
          <Card>
            <EmptyState
              icon={<Calendar />}
              title={tT('emptyTitle')}
              description={tT('emptyOtherDesc')}
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
                        <div className="text-xs text-text-faint truncate">{t.trpPickupAddress} → {t.trpDropoffAddress}</div>
                      </div>
                      <div className="text-xs text-text-muted tabular shrink-0">{TIME_FMT.format(new Date(t.trpScheduledAt))}</div>
                      <ChevronRight className="h-4 w-4 text-text-faint shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

/* ── Hero card for the next/active trip ────────────────────────────────── */
function NextTripHero({
  trip,
  t,
  tStatus,
}: {
  trip: TripListItem;
  t: (key: string, vars?: Record<string, string | number>) => string;
  tStatus: (key: string) => string;
}) {
  const minutes = minutesFromNow(trip.trpScheduledAt);
  const subtitle =
    trip.trpStatus === 'IN_PROGRESS' ? t('inProgressNow')
      : minutes <= 0 ? t('startingNow')
      : minutes < 60 ? t('inMinutes', { n: minutes })
      : t('atTime', { time: TIME_FMT.format(new Date(trip.trpScheduledAt)) });
  const heroTone = STATUS_HERO[trip.trpStatus];

  return (
    <Card className="overflow-hidden">
      <div className={`px-5 py-4 flex items-center justify-between ${heroTone.bg} ${heroTone.text}`}>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider opacity-80">
            {trip.trpStatus === 'IN_PROGRESS' ? t('activeTrip') : t('nextTrip')} · {subtitle}
          </div>
          <div className="mt-1 text-lg font-bold font-mono tabular">{trip.trpRef}</div>
        </div>
        <Badge tone="solid" size="md" className="bg-white/15 text-white ring-white/20">
          {tStatus(trip.trpStatus)}
        </Badge>
      </div>

      <CardContent>
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <Avatar name={trip.passengerName ?? '?'} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="text-md font-semibold text-text truncate">{trip.passengerName ?? t('passengerUnspecified')}</div>
            {trip.trpPurpose && <div className="text-sm text-text-muted truncate">{trip.trpPurpose}</div>}
          </div>
        </div>

        <div className="pt-4 space-y-3.5">
          <RouteStep tone="accent"  label={t('pickup')}  value={trip.trpPickupAddress} />
          <RouteStep tone="success" label={t('dropoff')} value={trip.trpDropoffAddress} />
          <div className="flex items-center justify-between text-sm pt-2">
            <span className="inline-flex items-center gap-2 text-text-muted">
              <Clock className="h-4 w-4" />
              <span className="font-medium text-text tabular">{TIME_FMT.format(new Date(trip.trpScheduledAt))}</span>
              {trip.trpDurationMinutes && (
                <span className="text-text-faint">· {t('durationMin', { n: trip.trpDurationMinutes })}</span>
              )}
            </span>
            {trip.vehiclePlate && (
              <span className="inline-flex items-center gap-1.5 text-text-muted">
                <Car className="h-4 w-4" />
                <span className="font-mono tabular text-text">{trip.vehiclePlate}</span>
              </span>
            )}
          </div>
        </div>
      </CardContent>

      <Link
        href={`/trips/${trip.trpId}`}
        className="block border-t border-border h-12 inline-flex items-center justify-center gap-2 text-accent font-semibold text-sm hover:bg-accent-soft transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        {t('openTrip')} <ChevronRight className="h-4 w-4" />
      </Link>
    </Card>
  );
}

function RouteStep({ tone, label, value }: { tone: 'accent' | 'success'; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className={
        'mt-0.5 h-9 w-9 rounded-full flex items-center justify-center shrink-0 ' +
        (tone === 'accent' ? 'bg-accent-soft text-accent' : 'bg-success-soft text-success')
      }>
        <MapPin className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-text-muted uppercase tracking-wider">{label}</div>
        <div className="text-md text-text font-semibold leading-snug mt-0.5">{value}</div>
      </div>
    </div>
  );
}

const STATUS_HERO: Record<CarTripStatus, { bg: string; text: string }> = {
  PENDING_ASSIGNMENT:          { bg: 'bg-surface-2',                                   text: 'text-text' },
  PENDING_DRIVER_CONFIRMATION: { bg: 'bg-gradient-to-br from-warning to-info text-white', text: 'text-white' },
  CONFIRMED:                   { bg: 'bg-gradient-to-br from-accent to-info text-white',  text: 'text-white' },
  IN_PROGRESS:                 { bg: 'bg-gradient-to-br from-info to-accent text-white',  text: 'text-white' },
  COMPLETED:                   { bg: 'bg-surface-2', text: 'text-text' },
  REJECTED_BY_DRIVER:          { bg: 'bg-danger-soft', text: 'text-danger' },
  CANCELLED:                   { bg: 'bg-surface-2', text: 'text-text-muted' },
};

