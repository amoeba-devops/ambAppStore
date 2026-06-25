import { Calendar, Car, Clock, MapPin } from 'lucide-react';
import { Avatar, Badge, Card, CardContent } from '@car-v2/ui';
import type { CarTripStatus } from '@car-v2/db/schema';
import type { TripListItem } from '@/server/queries/trips.queries';

interface DriverNextTripCardProps {
  trip: TripListItem;
  /* Mode is reserved for future state-specific visual treatments (e.g. a
   * pulse animation on 'active'). It's currently unused inside the card body
   * but kept on the prop interface so callers can grow into it. */
  mode: 'active' | 'confirm' | 'ready';
  /* Pre-formatted display strings — kept out of the component so the
   * server-side i18n + Intl.DateTimeFormat instance can be reused. */
  labels: {
    statusLine: string;
    statusBadge: string;
    pickup: string;
    dropoff: string;
    timeFormatted: string;
    durationSuffix: string | null;
    passengerFallback: string;
  };
}

/* Hero card for the trip a driver should care about right now. The card body
 * itself is action-free — actions live in the surrounding `<DriverActionBar>`
 * so the same card composes inside Active / Confirm / Ready states without
 * each state re-declaring CTAs.
 *
 * Visual hierarchy (top → bottom):
 *   1. Status banner (gradient, white-on-color) — answers "what's the trip's state?"
 *   2. Passenger avatar + name + (optional) purpose
 *   3. Route stops (pickup → dropoff) — large enough to read at arms-length
 *   4. Time + vehicle plate footer
 *
 * Notes vs. /today's old `NextTripHero`:
 *   - No "Open trip" link CTA. The bottom action bar now hosts the primary action.
 *   - Status banner uses a stronger gradient + tracking for outdoor readability. */
export function DriverNextTripCard({ trip, mode: _mode, labels }: DriverNextTripCardProps) {
  const heroTone = STATUS_HERO[trip.trpStatus];

  return (
    <Card className="overflow-hidden">
      <div className={`px-5 py-4 flex items-center justify-between gap-3 ${heroTone.bg}`}>
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wider opacity-90">
            {labels.statusLine}
          </div>
          <div className="mt-1 text-lg font-bold tabular truncate">{trip.trpRef}</div>
        </div>
        <Badge tone="solid" size="md" className="bg-white/15 text-white ring-white/20 shrink-0">
          {labels.statusBadge}
        </Badge>
      </div>

      <CardContent>
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <Avatar name={trip.passengerName ?? '?'} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="text-md font-semibold text-text truncate">
              {trip.passengerName ?? labels.passengerFallback}
            </div>
            {trip.trpPurpose && (
              <div className="text-sm text-text-muted truncate">{trip.trpPurpose}</div>
            )}
          </div>
        </div>

        <div className="pt-4 space-y-3.5">
          <RouteStep tone="accent" label={labels.pickup} value={trip.trpPickupAddress} />
          <RouteStep tone="success" label={labels.dropoff} value={trip.trpDropoffAddress} />
          <div className="flex items-center justify-between gap-3 text-sm pt-2 flex-wrap">
            <span className="inline-flex items-center gap-2 text-text-muted">
              <Clock className="h-4 w-4" aria-hidden />
              <span className="font-semibold text-text tabular">{labels.timeFormatted}</span>
              {labels.durationSuffix && (
                <span className="text-text-faint">· {labels.durationSuffix}</span>
              )}
            </span>
            {trip.vehiclePlate && (
              <span className="inline-flex items-center gap-1.5 text-text-muted">
                <Car className="h-4 w-4" aria-hidden />
                <span className="font-mono tabular text-text font-semibold">{trip.vehiclePlate}</span>
              </span>
            )}
          </div>
        </div>
      </CardContent>

    </Card>
  );
}

function RouteStep({ tone, label, value }: { tone: 'accent' | 'success'; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={
          'mt-0.5 h-9 w-9 rounded-full flex items-center justify-center shrink-0 ' +
          (tone === 'accent' ? 'bg-accent-soft text-accent' : 'bg-success-soft text-success')
        }
      >
        <MapPin className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-text-muted uppercase tracking-wider">{label}</div>
        <div className="text-md text-text font-semibold leading-snug mt-0.5">{value}</div>
      </div>
    </div>
  );
}

const STATUS_HERO: Record<CarTripStatus, { bg: string }> = {
  PENDING_ASSIGNMENT:          { bg: 'bg-surface-2 text-text' },
  PENDING_DRIVER_CONFIRMATION: { bg: 'bg-gradient-to-br from-warning via-warning to-info text-white' },
  CONFIRMED:                   { bg: 'bg-gradient-to-br from-accent via-accent to-info text-white' },
  IN_PROGRESS:                 { bg: 'bg-gradient-to-br from-info via-accent to-info text-white' },
  COMPLETED:                   { bg: 'bg-surface-2 text-text' },
  REJECTED_BY_DRIVER:          { bg: 'bg-danger-soft text-danger' },
  CANCELLED:                   { bg: 'bg-surface-2 text-text-muted' },
};

// Re-used by parent component to render an empty state header consistent with the card aesthetic.
export { Calendar as DriverNextTripIcon };
