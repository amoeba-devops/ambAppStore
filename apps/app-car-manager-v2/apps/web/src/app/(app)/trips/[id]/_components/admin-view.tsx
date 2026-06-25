import { getTranslations } from 'next-intl/server';
import { Calendar, Car, CheckCircle2, Clock, Hourglass, Mail, ShieldCheck, User } from 'lucide-react';
import { Badge } from '@car-v2/ui';
import { MapPreview } from '@/components/inputs/map-preview';
import type { AuditRow } from '@/server/queries/audit.queries';
import type { TripDetail } from '@/server/queries/trips.queries';
import { TripActions } from '../trip-actions';
import {
  Property,
  RouteTimeline,
  SectionTitle,
  STATUS_TONE,
  fmtDateTime,
  fmtShortDateTime,
  statusLongLabel,
} from './helpers';

interface AdminViewProps {
  trip: TripDetail;
  auditRows: AuditRow[];
  isAssignedDriver: boolean;
  driverOptions: { id: string; label: string }[];
  vehicleOptions: { id: string; label: string }[];
  hasMap: boolean;
}

/* ADMIN view — DISPATCHER mode.
 *
 * Goal: enable the dispatcher to triage and act in <5 seconds.
 *   1. Quick Actions surface IMMEDIATELY (assign/reassign/cancel) — these
 *      are the high-frequency operations Admin runs across many trips.
 *   2. Assignment + passenger in a tight 2-col grid — the "who's involved"
 *      block scans top-to-bottom-left-to-right.
 *   3. Route + Map together (map is reference, not hero) — Admin already
 *      knows the city; the map confirms feasibility, not exploration.
 *   4. Activity at bottom, full feed visible (audit is part of Admin's job).
 */
export async function AdminView({
  trip,
  auditRows,
  isAssignedDriver,
  driverOptions,
  vehicleOptions,
  hasMap,
}: AdminViewProps) {
  const tStatus = await getTranslations('trips.status');
  const tDetail = await getTranslations('trips.detail');

  return (
    <div className="flex-1 overflow-auto">
      <div className="mx-auto max-w-6xl px-4 md:px-7 py-5 md:py-6 space-y-6 md:space-y-7">

        {/* ── Status banner — single inline row, hairline below ──────── */}
        <div className="flex items-center gap-3 md:gap-5 flex-wrap pb-4 border-b border-border">
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

        {/* ── Reject / Cancel banner (only when present) ─────────────── */}
        {trip.trpRejectReason && (
          <div className="rounded-md px-4 py-3 bg-danger-soft text-danger text-sm leading-relaxed">
            <span className="font-semibold">{tDetail('rejectReason')}</span>
            {trip.trpRejectReason}
          </div>
        )}
        {trip.trpCancelReason && (
          <div className="rounded-md px-4 py-3 bg-surface-2 border border-border text-text-muted text-sm leading-relaxed">
            <span className="font-semibold text-text">{tDetail('cancelReason')}</span>
            {trip.trpCancelReason}
          </div>
        )}

        {/* ── Quick Actions — surfaced near top, dispatcher-first ───── */}
        <section className="rounded-xl border border-border bg-surface px-4 py-4 md:px-5 md:py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2.5 text-[10.5px] font-bold text-text-faint uppercase tracking-wider">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              {tDetail('actionsTitle')}
            </div>
            <TripActions
              tripId={trip.trpId}
              status={trip.trpStatus}
              role="ADMIN"
              isAssignedDriver={isAssignedDriver}
              drivers={driverOptions}
              vehicles={vehicleOptions}
            />
          </div>
        </section>

        {/* ── Assignment + Passenger grid ────────────────────────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6 pt-1">
          <div className="space-y-5">
            <SectionTitle>{tDetail('assignmentTitle')}</SectionTitle>
            <div className="space-y-4">
              <Property
                icon={<Car />}
                label={tDetail('vehicle')}
                value={trip.vehiclePlate ?? tDetail('notAssigned')}
                sub={trip.vehicleModel}
                mono={!!trip.vehiclePlate}
              />
              <Property
                icon={<User />}
                label={tDetail('driver')}
                value={trip.driverName ?? tDetail('notAssigned')}
                sub={trip.driverPhone && <span className="font-mono tabular">{trip.driverPhone}</span>}
              />
            </div>
          </div>
          <div className="space-y-5">
            <SectionTitle>{tDetail('passenger')}</SectionTitle>
            <div className="space-y-4">
              <Property
                icon={<User />}
                label={tDetail('passenger')}
                value={trip.passengerName ?? tDetail('passengerUnspecified')}
                sub={
                  trip.passengerEmail && (
                    <span className="inline-flex items-center gap-1.5">
                      <Mail className="h-3 w-3" />
                      {trip.passengerEmail}
                    </span>
                  )
                }
              />
              {trip.trpPurpose && (
                <Property
                  label={tDetail('purposeTitle')}
                  value={<span className="font-normal leading-relaxed whitespace-pre-wrap">{trip.trpPurpose}</span>}
                />
              )}
            </div>
          </div>
        </section>

        {/* ── Route timeline + Map (side-by-side on lg) ──────────────── */}
        <section className="pt-6 border-t border-border">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-x-8 gap-y-5">
            <div>
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
            </div>

            {hasMap && (
              <div className="lg:pt-0">
                <MapPreview
                  pickup={trip.trpPickupAddress}
                  dropoff={trip.trpDropoffAddress}
                  stopovers={trip.stopovers.map((s) => s.address)}
                  showFullscreenLink
                />
              </div>
            )}
          </div>
        </section>

        {/* ── Notes (only if present) ────────────────────────────────── */}
        {trip.trpNotes && (
          <section className="pt-6 border-t border-border">
            <SectionTitle>{tDetail('notesTitle')}</SectionTitle>
            <p className="text-sm text-text leading-relaxed whitespace-pre-wrap">{trip.trpNotes}</p>
          </section>
        )}

        {/* ── Activity — full feed, Admin's audit oversight ──────────── */}
        <section className="pt-6 border-t border-border">
          <div className="flex items-center justify-between mb-4">
            <SectionTitle className="!mb-0">
              {tDetail('activityTitle')}
              {auditRows.length > 0 && (
                <span className="ml-2 text-text-muted normal-case tracking-normal font-mono tabular">
                  ({auditRows.length})
                </span>
              )}
            </SectionTitle>
          </div>
          {auditRows.length === 0 ? (
            <p className="text-sm text-text-faint italic">{tDetail('noActivity')}</p>
          ) : (
            <ul className="space-y-3.5">
              {auditRows.map((row) => (
                <li key={row.audId} className="flex gap-3">
                  <div className="mt-0.5 h-7 w-7 rounded-full bg-accent-soft text-accent flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text leading-tight font-mono tabular">
                      {row.audAction.replace('TRIP.', '')}
                    </div>
                    <div className="text-xs text-text-faint mt-1">
                      {row.actorName ?? <span className="italic">system</span>}
                      <span className="mx-1.5">·</span>
                      <Clock className="inline-block h-3 w-3 -mt-0.5" />
                      <span className="ml-1 tabular">{fmtShortDateTime(row.audCreatedAt)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Audit reassurance footer ───────────────────────────────── */}
        <div className="flex gap-2 text-xs text-text-faint leading-relaxed pt-6 border-t border-border-faint">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
          <div>
            <span className="font-medium text-text-muted">{tDetail('auditLogged')}</span>
            <span className="mx-1.5">·</span>
            {tDetail('auditLoggedDesc')}
          </div>
        </div>
      </div>
    </div>
  );
}
