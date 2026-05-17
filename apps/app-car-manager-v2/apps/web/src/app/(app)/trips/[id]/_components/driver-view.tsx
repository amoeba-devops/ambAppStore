import { getTranslations } from 'next-intl/server';
import { Calendar, Clock, Hourglass, Mail, Phone, User } from 'lucide-react';
import { Badge } from '@car-v2/ui';
import { MapRoute } from '@/components/inputs/map-route';
import type { TripDetail } from '@/server/queries/trips.queries';
import { TripActions } from '../trip-actions';
import {
  Property,
  RouteTimeline,
  SectionTitle,
  STATUS_TONE,
  fmtDateTime,
  statusLongLabel,
} from './helpers';

interface DriverViewProps {
  trip: TripDetail;
  isAssignedDriver: boolean;
  hasMap: boolean;
}

/* DRIVER view — IN-CAB mode (PWA-first).
 *
 * Goal: minimise cognitive load behind the wheel. One thing at a time.
 *   1. Status pill + scheduled time inline — answers "is this trip live now?"
 *   2. BIG MAP (50vh) as hero — driver's primary spatial reference.
 *   3. Primary CTA panel — single accent-soft block makes the next action
 *      unmistakable (Accept / Reject / Start trip / End trip — whichever
 *      transition is available given current state).
 *   4. Route stops vertically — easy to glance at during driving.
 *   5. Passenger card with tap-to-call/email — the only contact path.
 *   6. Notes collapsed by default — secondary context.
 *
 *  NOT shown:
 *   - Activity log (driver doesn't need to audit themselves)
 *   - Assignment block (they ARE the assignment)
 *   - Purpose (often empty; subordinate to action)
 */
export async function DriverView({ trip, isAssignedDriver, hasMap }: DriverViewProps) {
  const tStatus = await getTranslations('trips.status');
  const tDetail = await getTranslations('trips.detail');

  /* Whether the driver currently has a state-machine action they can take.
   * Used to emphasise the Primary Action panel visually. */
  const driverHasPrimaryAction =
    isAssignedDriver &&
    (trip.trpStatus === 'PENDING_DRIVER_CONFIRMATION' ||
      trip.trpStatus === 'CONFIRMED' ||
      trip.trpStatus === 'IN_PROGRESS');

  return (
    <div className="flex-1 overflow-auto">
      <div className="mx-auto max-w-3xl px-4 md:px-6 py-4 md:py-5 space-y-5">

        {/* ── Status row — single inline, tight ─────────────────────── */}
        <div className="flex items-center gap-3 flex-wrap">
          <Badge tone={STATUS_TONE[trip.trpStatus]} size="md" className="px-3 py-1 text-[13px] font-semibold">
            {statusLongLabel(trip.trpStatus, tStatus)}
          </Badge>
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-text tabular">
            <Calendar className="h-3.5 w-3.5 text-text-muted shrink-0" aria-hidden />
            {fmtDateTime(trip.trpScheduledAt)}
          </div>
          {trip.trpDurationMinutes && (
            <div className="inline-flex items-center gap-1.5 text-xs text-text-muted">
              <Hourglass className="h-3 w-3" aria-hidden />
              {tDetail('durationApprox', { minutes: trip.trpDurationMinutes })}
            </div>
          )}
        </div>

        {/* ── Reject reason — only relevant if driver rejected; show why ── */}
        {trip.trpRejectReason && (
          <div className="rounded-md px-4 py-3 bg-danger-soft text-danger text-sm leading-relaxed">
            <span className="font-semibold">{tDetail('rejectReason')}</span>
            {trip.trpRejectReason}
          </div>
        )}

        {/* ── MAP HERO — full-width, ~50vh on mobile, taller on tablet ── */}
        {hasMap && (
          <section>
            <MapRoute
              pickup={trip.trpPickupAddress}
              dropoff={trip.trpDropoffAddress}
              stopovers={trip.stopovers.map((s) => s.address)}
              showFullscreenLink
              heightClassName="h-[50vh] md:h-[420px]"
            />
          </section>
        )}

        {/* ── PRIMARY ACTION — emphasised when driver can act ───────── */}
        <section
          className={[
            'rounded-2xl px-4 py-4 md:px-5 md:py-5',
            driverHasPrimaryAction
              ? 'bg-accent-soft border-2 border-accent shadow-sm'
              : 'bg-surface border border-border',
          ].join(' ')}
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="text-[10.5px] font-bold text-text-faint uppercase tracking-wider">
              {tDetail('actionsTitle')}
            </div>
            <TripActions
              tripId={trip.trpId}
              status={trip.trpStatus}
              role="DRIVER"
              isAssignedDriver={isAssignedDriver}
              isCreator={false}
              drivers={[]}
              vehicles={[]}
            />
          </div>
        </section>

        {/* ── Route stops — vertical, easy to glance ───────────────── */}
        <section className="rounded-xl border border-border bg-surface px-4 py-4 md:px-5 md:py-5">
          <SectionTitle>{tDetail('routeTitle')}</SectionTitle>
          <RouteTimeline
            pickup={trip.trpPickupAddress}
            dropoff={trip.trpDropoffAddress}
            stopoverCount={trip.stopovers.length}
            labels={{
              pickup: tDetail('pickup'),
              dropoff: tDetail('dropoff'),
              stopovers: tDetail('stopoversBetween', { count: trip.stopovers.length }),
            }}
          />
          {trip.stopovers.length > 0 && (
            <ol className="mt-5 space-y-2 text-sm">
              {trip.stopovers.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="font-mono text-xs text-text-muted tabular w-5 shrink-0 mt-0.5">{i + 1}.</span>
                  <span className="text-text leading-snug">{s.address}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* ── Passenger card with tap-to-act ────────────────────────── */}
        <section className="rounded-xl border border-border bg-surface px-4 py-4 md:px-5 md:py-5">
          <SectionTitle>{tDetail('passenger')}</SectionTitle>
          <Property
            icon={<User />}
            label={tDetail('passenger')}
            value={trip.passengerName ?? tDetail('passengerUnspecified')}
          />
          {trip.passengerEmail && (
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={`mailto:${trip.passengerEmail}`}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm font-medium text-text hover:bg-surface-3 transition-colors"
              >
                <Mail className="h-4 w-4" />
                <span>{trip.passengerEmail}</span>
              </a>
            </div>
          )}
        </section>

        {/* ── Notes (collapsible, default closed) ───────────────────── */}
        {trip.trpNotes && (
          <details className="rounded-xl border border-border bg-surface px-4 py-3 md:px-5 group">
            <summary className="flex items-center justify-between cursor-pointer list-none">
              <span className="text-[10.5px] font-bold text-text-faint uppercase tracking-wider">
                {tDetail('notesTitle')}
              </span>
              <span className="text-xs text-text-muted group-open:rotate-180 transition-transform">▾</span>
            </summary>
            <p className="mt-3 text-sm text-text leading-relaxed whitespace-pre-wrap">{trip.trpNotes}</p>
          </details>
        )}

        {/* ── Driver phone reminder (only if assigned and phone present) ── */}
        {isAssignedDriver && trip.driverPhone && (
          <div className="text-xs text-text-faint inline-flex items-center gap-1.5 px-1">
            <Phone className="h-3 w-3" aria-hidden />
            <span className="font-mono tabular">{trip.driverPhone}</span>
            <Clock className="h-3 w-3 ml-2" aria-hidden />
            <span className="tabular">{tDetail('auditLogged')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
