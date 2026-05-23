import { getTranslations } from 'next-intl/server';
import { Car, CheckCircle2, Clock, Hourglass, Mail, Phone, ShieldCheck, User } from 'lucide-react';
import { Badge } from '@car-v2/ui';
import { MapPreview } from '@/components/inputs/map-preview';
import type { AuditRow } from '@/server/queries/audit.queries';
import type { TripDetail } from '@/server/queries/trips.queries';
import { TripActions } from '../trip-actions';
import {
  fmtDateTime,
  fmtShortDateTime,
  Property,
  RouteTimeline,
  SectionTitle,
  STATUS_TONE,
  statusLongLabel,
  WorkflowStepper,
} from './helpers';

interface ManagerViewProps {
  trip: TripDetail;
  auditRows: AuditRow[];
  isAssignedDriver: boolean;
  hasMap: boolean;
}

/**
 * MANAGER view — oversight & accountability.
 *
 * Priority: WORKFLOW position (where is this in its lifecycle?), then full
 * trip details (Manager often verifies what was scheduled), then map, then
 * EXPANDED audit feed (Manager is the accountability witness — they want to
 * see who did what when). Cancel is the only action Manager can take, and
 * only if they're the creator; it lives at the bottom (not promoted).
 */
export async function ManagerView({
  trip,
  auditRows,
  isAssignedDriver,
  hasMap,
}: ManagerViewProps) {
  const tStatus = await getTranslations('trips.status');
  const tDetail = await getTranslations('trips.detail');

  const isBranchState =
    trip.trpStatus === 'REJECTED_BY_DRIVER' || trip.trpStatus === 'CANCELLED';

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-[1180px] mx-auto px-4 md:px-7 py-5 md:py-6 space-y-6">
        {/* Status hero + workflow stepper — the manager's primary anchor.
         *  Visual hierarchy: status pill (state) + datetime (when) + stepper
         *  (where in lifecycle). One row tells the whole story. */}
        <section className="rounded-2xl border border-border bg-surface px-5 md:px-6 py-5 md:py-6">
          <div className="flex items-center gap-3 md:gap-4 flex-wrap mb-5">
            <Badge tone={STATUS_TONE[trip.trpStatus]} size="md" className="px-3 py-1 text-[13px] font-semibold">
              {statusLongLabel(trip.trpStatus, tStatus)}
            </Badge>
            <div className="inline-flex items-center gap-2 text-[15px] font-semibold text-text tabular">
              <Clock className="h-4 w-4 text-text-muted shrink-0" aria-hidden />
              {fmtDateTime(trip.trpScheduledAt)}
            </div>
            {trip.trpDurationMinutes && (
              <div className="inline-flex items-center gap-1.5 text-xs text-text-muted">
                <Hourglass className="h-3 w-3" aria-hidden />
                {tDetail('durationApprox', { minutes: trip.trpDurationMinutes })}
              </div>
            )}
          </div>
          <WorkflowStepper status={trip.trpStatus} t={tStatus} />
          {isBranchState && (
            <div className="mt-4 text-xs text-danger font-medium">
              {statusLongLabel(trip.trpStatus, tStatus)}
            </div>
          )}
        </section>

        {/* Reason banners */}
        {trip.trpRejectReason && (
          <div className="rounded-lg px-4 py-3 bg-danger-soft text-danger text-sm leading-relaxed">
            <span className="font-semibold">{tDetail('rejectReason')}</span>
            {trip.trpRejectReason}
          </div>
        )}
        {trip.trpCancelReason && (
          <div className="rounded-lg px-4 py-3 bg-surface-2 border border-border text-text-muted text-sm leading-relaxed">
            <span className="font-semibold text-text">{tDetail('cancelReason')}</span>
            {trip.trpCancelReason}
          </div>
        )}

        {/* Trip details + Map — 2-col, equal weight. Manager reviews what was
         *  scheduled, and the map confirms the spatial intent. */}
        <section className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-border bg-surface px-5 py-5 space-y-5">
            <div>
              <SectionTitle>{tDetail('routeTitle')}</SectionTitle>
              <RouteTimeline
                pickup={trip.trpPickupAddress}
                dropoff={trip.trpDropoffAddress}
                stopoverCount={trip.stopovers.length}
                labels={{
                  pickup:    tDetail('pickup'),
                  dropoff:   tDetail('dropoff'),
                  stopovers: tDetail('stopoversBetween', { count: trip.stopovers.length }),
                }}
              />
            </div>

            {trip.stopovers.length > 0 && (
              <div className="pt-4 border-t border-border-faint">
                <SectionTitle as="h3">
                  {tDetail('stopoversTitle', { count: trip.stopovers.length })}
                </SectionTitle>
                <ol className="space-y-1.5 text-sm">
                  {trip.stopovers.map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="font-mono text-xs text-text-muted tabular w-5 shrink-0 mt-0.5">{i + 1}.</span>
                      <span className="text-text leading-snug">{s.address}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div className="pt-4 border-t border-border-faint grid grid-cols-2 gap-4">
              <Property
                icon={<User />}
                label={tDetail('passenger')}
                value={trip.passengerName ?? tDetail('passengerUnspecified')}
                sub={
                  trip.passengerEmail && (
                    <span className="inline-flex items-center gap-1 text-[11px] break-all">
                      <Mail className="h-3 w-3" aria-hidden />
                      {trip.passengerEmail}
                    </span>
                  )
                }
              />
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
                sub={
                  trip.driverPhone && (
                    <span className="inline-flex items-center gap-1 font-mono tabular">
                      <Phone className="h-3 w-3" aria-hidden />
                      {trip.driverPhone}
                    </span>
                  )
                }
              />
            </div>
          </div>

          {hasMap && (
            <div className="rounded-2xl border border-border bg-surface overflow-hidden">
              <MapPreview
                pickup={trip.trpPickupAddress}
                dropoff={trip.trpDropoffAddress}
                stopovers={trip.stopovers.map((s) => s.address)}
                showFullscreenLink
              />
            </div>
          )}
        </section>

        {/* Purpose + Notes — content sections */}
        {(trip.trpPurpose || trip.trpNotes) && (
          <section className="grid md:grid-cols-2 gap-4">
            {trip.trpPurpose && (
              <div className="rounded-2xl border border-border bg-surface px-5 py-4">
                <SectionTitle>{tDetail('purposeTitle')}</SectionTitle>
                <p className="text-sm text-text leading-relaxed">{trip.trpPurpose}</p>
              </div>
            )}
            {trip.trpNotes && (
              <div className="rounded-2xl border border-border bg-surface px-5 py-4">
                <SectionTitle>{tDetail('notesTitle')}</SectionTitle>
                <p className="text-sm text-text leading-relaxed whitespace-pre-wrap">{trip.trpNotes}</p>
              </div>
            )}
          </section>
        )}

        {/* ACTIVITY — expanded by default. The Manager's audit witness view. */}
        <section className="rounded-2xl border border-border bg-surface px-5 py-5">
          <div className="flex items-center justify-between mb-4">
            <SectionTitle className="!mb-0">{tDetail('activityTitle')}</SectionTitle>
            <span className="text-xs text-text-faint tabular">{auditRows.length}</span>
          </div>
          {auditRows.length === 0 ? (
            <p className="text-sm text-text-faint italic">{tDetail('noActivity')}</p>
          ) : (
            <ol className="relative space-y-4">
              <div className="absolute left-[13px] top-3 bottom-3 w-px bg-border" aria-hidden />
              {auditRows.map((row) => (
                <li key={row.audId} className="relative flex gap-3.5">
                  <div className="h-7 w-7 rounded-full bg-success-soft text-success flex items-center justify-center shrink-0 ring-4 ring-bg relative z-10">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="text-sm font-medium text-text leading-tight font-mono tabular">
                      {row.audAction.replace('TRIP.', '')}
                    </div>
                    <div className="text-xs text-text-faint mt-1">
                      {row.actorName ?? <span className="italic">system</span>}
                      <span className="mx-1.5">·</span>
                      <span className="tabular">{fmtShortDateTime(row.audCreatedAt)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
          <div className="mt-5 pt-4 border-t border-border-faint flex gap-2 text-xs text-text-faint leading-relaxed">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
            <span>{tDetail('auditLoggedDesc')}</span>
          </div>
        </section>

        {/* Manager actions (cancel etc.) — bottom-of-page placement. */}
        {(trip.trpStatus === 'PENDING_ASSIGNMENT' ||
          trip.trpStatus === 'PENDING_DRIVER_CONFIRMATION') && (
          <section className="rounded-2xl border border-border bg-surface px-5 py-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <SectionTitle className="!mb-0">{tDetail('actionsTitle')}</SectionTitle>
              <TripActions
                tripId={trip.trpId}
                status={trip.trpStatus}
                role="MANAGER"
                isAssignedDriver={isAssignedDriver}
                drivers={[]}
                vehicles={[]}
              />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
