import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Car,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Edit3,
  Hourglass,
  Mail,
  Phone,
  ShieldCheck,
  User,
} from 'lucide-react';
import { Avatar, Badge, Button } from '@car-v2/ui';
import type { CarTripStatus } from '@car-v2/db/schema';
import { MapPreview } from '@/components/inputs/map-preview';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { listAuditForEntity } from '@/server/queries/audit.queries';
import { listDrivers } from '@/server/queries/drivers.queries';
import { getTrip } from '@/server/queries/trips.queries';
import { listVehicles } from '@/server/queries/vehicles.queries';
import { TripActions } from './trip-actions';

const STATUS_TONE: Record<CarTripStatus, 'accent' | 'warning' | 'success' | 'info' | 'neutral' | 'danger'> = {
  PENDING_ASSIGNMENT:          'accent',
  PENDING_DRIVER_CONFIRMATION: 'warning',
  CONFIRMED:                   'success',
  IN_PROGRESS:                 'info',
  COMPLETED:                   'neutral',
  REJECTED_BY_DRIVER:          'danger',
  CANCELLED:                   'danger',
};

function statusLongLabel(status: CarTripStatus, t: (k: string) => string): string {
  if (status === 'PENDING_DRIVER_CONFIRMATION') return t('PENDING_DRIVER_CONFIRMATION_LONG');
  if (status === 'REJECTED_BY_DRIVER') return t('REJECTED_BY_DRIVER_LONG');
  return t(status);
}

function fmtDateTime(d: Date): string {
  return new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tA      = await getTranslations('actions');
  const tNav    = await getTranslations('nav');
  const tCo     = await getTranslations('company');
  const tStatus = await getTranslations('trips.status');
  const tDetail = await getTranslations('trips.detail');
  const user = await getCurrentUser();

  const trip = await getTrip(user.entId, id);
  if (!trip) notFound();

  const [drivers, vehicles, auditRows] = await Promise.all([
    user.role === 'ADMIN' ? listDrivers(user.entId) : Promise.resolve([]),
    user.role === 'ADMIN' ? listVehicles(user.entId) : Promise.resolve([]),
    listAuditForEntity(user.entId, 'Trip', id),
  ]);

  let isAssignedDriver = false;
  if (user.role === 'DRIVER' && trip.trpDriverId) {
    const { getDriverByUserId } = await import('@/server/queries/drivers.queries');
    const actorDriver = await getDriverByUserId(user.entId, user.userId);
    isAssignedDriver = actorDriver?.drvId === trip.trpDriverId;
  }
  const isCreator = trip.trpCreatorId === user.userId;

  const canEdit =
    (user.role === 'ADMIN' && trip.trpStatus !== 'COMPLETED') ||
    (user.role === 'MANAGER' && isCreator &&
     (trip.trpStatus === 'PENDING_ASSIGNMENT' || trip.trpStatus === 'PENDING_DRIVER_CONFIRMATION'));

  const driverOptions = drivers.map((d) => ({
    id: d.drvId,
    label: `${d.user.usrName} — ${d.drvLicenseNumber} (${d.drvLicenseClass})`,
  }));
  const vehicleOptions = vehicles
    .filter((v) => v.cvhStatus !== 'RETIRED' && v.cvhStatus !== 'MAINTENANCE')
    .map((v) => ({ id: v.cvhId, label: `${v.cvhPlateNumber} — ${v.cvhModel}` }));

  const statusLabel = statusLongLabel(trip.trpStatus, tStatus);
  const hasMap = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY;

  return (
    <>
      <PageHeader
        title={trip.trpRef}
        subtitle={statusLabel}
        breadcrumbs={[
          { label: tCo('tenant') },
          { label: tNav('trips'), href: '/trips' },
          { label: trip.trpRef },
        ]}
        back="/trips"
        actions={
          <>
            <Button variant="ghost" size="md" asChild>
              <Link href="/trips"><ChevronLeft />{tA('back')}</Link>
            </Button>
            {canEdit && (
              <Button variant="secondary" size="md" asChild>
                <Link href={`/trips/${trip.trpId}/edit`}><Edit3 />{tA('edit')}</Link>
              </Button>
            )}
          </>
        }
        mobileAction={
          canEdit ? (
            <Link
              href={`/trips/${trip.trpId}/edit`}
              aria-label={tA('edit')}
              className="inline-flex items-center justify-center h-10 w-10 rounded-full text-text hover:bg-surface-2 active:bg-surface-2/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Edit3 className="h-5 w-5" />
            </Link>
          ) : undefined
        }
      />

      {/* Document-style detail: inline sections + hairline dividers, NO nested cards.
       * Right rail uses bg-surface-2 + border-l to visually separate properties from
       * primary content. Inspired by Linear ticket pages and Stripe Dashboard. */}
      <div className="flex-1 overflow-auto">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] min-h-full">

          {/* ─── MAIN — primary content (route, map, notes, activity) ─── */}
          <main className="min-w-0 px-4 md:px-7 py-5 md:py-6">

            {/* Status strip — inline hero row, hairline below. Inline Edit
             * button sits at the trailing edge on mobile (replacing the
             * header `actions` Edit that we no longer render on `< md`).
             * Conditional on `canEdit` so the button is hidden for trips
             * in a non-editable state (in-progress, completed, etc.). */}
            <div className="flex items-center gap-3 md:gap-4 flex-wrap pb-5 md:pb-6 border-b border-border">
              <Badge tone={STATUS_TONE[trip.trpStatus]} size="md" className="px-3 py-1 text-[13px] font-semibold">
                {statusLabel}
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
              {canEdit && (
                <Button variant="secondary" size="sm" iconLeft={<Edit3 />} asChild className="ml-auto shrink-0">
                  <Link href={`/trips/${trip.trpId}/edit`}>{tA('edit')}</Link>
                </Button>
              )}
            </div>

            {/* Reject/Cancel reason — prominent, immediately under status */}
            {trip.trpRejectReason && (
              <div className="mt-5 rounded-md px-4 py-3 bg-danger-soft text-danger text-sm leading-relaxed">
                <span className="font-semibold">{tDetail('rejectReason')}</span>{trip.trpRejectReason}
              </div>
            )}
            {trip.trpCancelReason && (
              <div className="mt-5 rounded-md px-4 py-3 bg-surface-2 border border-border text-text-muted text-sm leading-relaxed">
                <span className="font-semibold text-text">{tDetail('cancelReason')}</span>{trip.trpCancelReason}
              </div>
            )}

            {/* MAP HERO — full-width, rounded, subtle shadow. Driver's primary focus. */}
            {hasMap && (
              <section className="mt-6">
                <MapPreview
                  pickup={trip.trpPickupAddress}
                  dropoff={trip.trpDropoffAddress}
                  stopovers={trip.stopovers.map((s) => s.address)}
                  showFullscreenLink
                  className=""
                />
              </section>
            )}

            {/* ROUTE — vertical timeline visual */}
            <section className="mt-7 md:mt-8 pt-6 md:pt-7 border-t border-border">
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

              {trip.stopovers.length > 0 && (
                <div className="mt-6 pt-5 border-t border-border-faint">
                  <SectionTitle as="h3">
                    {tDetail('stopoversTitle', { count: trip.stopovers.length })}
                  </SectionTitle>
                  <ol className="space-y-2 text-sm">
                    {trip.stopovers.map((s, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="font-mono text-xs text-text-muted tabular w-5 shrink-0 mt-0.5">{i + 1}.</span>
                        <span className="text-text leading-snug">{s.address}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </section>

            {/* PURPOSE — only if any */}
            {trip.trpPurpose && (
              <section className="mt-7 md:mt-8 pt-6 md:pt-7 border-t border-border">
                <SectionTitle>{tDetail('purposeTitle')}</SectionTitle>
                <p className="text-sm text-text leading-relaxed">{trip.trpPurpose}</p>
              </section>
            )}

            {/* NOTES — only if any */}
            {trip.trpNotes && (
              <section className="mt-7 md:mt-8 pt-6 md:pt-7 border-t border-border">
                <SectionTitle>{tDetail('notesTitle')}</SectionTitle>
                <p className="text-sm text-text leading-relaxed whitespace-pre-wrap">{trip.trpNotes}</p>
              </section>
            )}

            {/* ACTIVITY — full audit feed at the bottom */}
            <section className="mt-7 md:mt-8 pt-6 md:pt-7 border-t border-border">
              <SectionTitle>{tDetail('activityTitle')}</SectionTitle>
              {auditRows.length === 0 ? (
                <p className="text-sm text-text-faint italic">{tDetail('noActivity')}</p>
              ) : (
                <ul className="space-y-4">
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
                          <span className="tabular">
                            {new Date(row.audCreatedAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </main>

          {/* ─── RIGHT RAIL ─── Properties panel + Actions + Audit hint
           * bg-surface-2 makes it feel like a "metadata sidebar" (Linear/GitHub style).
           * Single cohesive column: each block has section title → content with hairlines
           * between property rows, so the rail reads as one panel — not 3 floating blobs. */}
          <aside
            className="
              lg:bg-surface-2/40 lg:border-l border-border
              px-4 md:px-6 py-5 md:py-6
              lg:sticky lg:top-14 lg:self-start
              lg:max-h-[calc(100vh-3.5rem)] lg:overflow-y-auto
            "
          >
            {/* ── DETAILS ── semantic <dl> with hairline rows for visual rhythm */}
            <section>
              <SectionTitle>{tDetail('detailsTitle')}</SectionTitle>
              <dl className="divide-y divide-border-faint border-y border-border-faint -mt-1">
                <PropertyRow
                  icon={<User />}
                  label={tDetail('passenger')}
                  value={trip.passengerName ?? tDetail('passengerUnspecified')}
                  muted={!trip.passengerName}
                  avatar={trip.passengerName ?? undefined}
                  lines={trip.passengerEmail ? [
                    { icon: <Mail className="h-3 w-3" />, text: trip.passengerEmail },
                  ] : []}
                />
                <PropertyRow
                  icon={<Car />}
                  label={tDetail('vehicle')}
                  value={trip.vehiclePlate ?? tDetail('notAssigned')}
                  muted={!trip.vehiclePlate}
                  mono={!!trip.vehiclePlate}
                  lines={trip.vehicleModel ? [{ text: trip.vehicleModel }] : []}
                />
                <PropertyRow
                  icon={<User />}
                  label={tDetail('driver')}
                  value={trip.driverName ?? tDetail('notAssigned')}
                  muted={!trip.driverName}
                  avatar={trip.driverName ?? undefined}
                  lines={trip.driverPhone ? [
                    { icon: <Phone className="h-3 w-3" />, text: trip.driverPhone, mono: true },
                  ] : []}
                />
              </dl>
            </section>

            {/* ── ACTIONS ── full-width stacked buttons (TripActions stacks in rail) */}
            <section className="mt-7 pt-6 border-t border-border">
              <SectionTitle as="h3">{tDetail('actionsTitle')}</SectionTitle>
              <TripActions
                tripId={trip.trpId}
                status={trip.trpStatus}
                role={user.role}
                isAssignedDriver={isAssignedDriver}
                isCreator={isCreator}
                drivers={driverOptions}
                vehicles={vehicleOptions}
              />
            </section>

            {/* ── AUDIT FOOTNOTE ── reassurance, visually subordinate */}
            <div className="mt-7 pt-5 border-t border-border-faint flex gap-2 text-xs leading-relaxed">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5 text-text-faint" aria-hidden />
              <div className="min-w-0">
                <div className="font-medium text-text-muted">{tDetail('auditLogged')}</div>
                <div className="mt-0.5 text-text-faint">{tDetail('auditLoggedDesc')}</div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

/* ─── Helpers ───────────────────────────────────────────────────────── */

/** Section heading — small uppercase title used to label inline sections
 *  (no card chrome). Replaces the heavyweight CardTitle pattern. */
function SectionTitle({
  children,
  as: As = 'h2',
  className,
}: {
  children: React.ReactNode;
  as?: 'h2' | 'h3';
  className?: string;
}) {
  return (
    <As className={`text-[10.5px] font-bold text-text-faint uppercase tracking-wider mb-4 ${className ?? ''}`}>
      {children}
    </As>
  );
}

/** Property row in the right rail — semantic <dt>/<dd> pair with hairline-divider
 *  rhythm. Icon + uppercase label, then value (semibold) and optional sub-lines.
 *  `muted` softens the value tone for unassigned fields ("Not assigned").
 *  `avatar`: nếu truyền vào, render Avatar trước value (Passenger/Driver rows). */
function PropertyRow({
  icon,
  label,
  value,
  lines = [],
  mono,
  muted,
  avatar,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  lines?: { icon?: React.ReactNode; text: string; mono?: boolean }[];
  mono?: boolean;
  muted?: boolean;
  avatar?: string;
}) {
  return (
    <div className="py-3 first:pt-3 last:pb-3">
      <dt className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-text-faint uppercase tracking-wider mb-1.5 [&_svg]:h-3 [&_svg]:w-3">
        {icon}
        <span>{label}</span>
      </dt>
      <dd
        className={`flex items-center gap-2 text-sm leading-tight ${
          muted ? 'text-text-muted italic' : 'text-text font-semibold'
        } ${mono ? 'font-mono tabular' : ''}`}
      >
        {avatar && <Avatar name={avatar} size="xs" />}
        <span className="min-w-0 truncate">{value}</span>
      </dd>
      {lines.map((ln, i) => (
        <dd
          key={i}
          className={`mt-1 inline-flex items-center gap-1.5 text-xs text-text-muted ${ln.mono ? 'font-mono tabular' : ''} ${avatar ? 'pl-8' : ''}`}
        >
          {ln.icon}
          <span>{ln.text}</span>
        </dd>
      ))}
    </div>
  );
}

/** Vertical route timeline — solid line connecting pickup ⬤ and dropoff ⬤
 *  with optional "+ N stopovers" indicator midway. Dots have `ring-4 ring-bg`
 *  so the connecting line visually passes BEHIND them. */
function RouteTimeline({
  pickup,
  dropoff,
  stopoverCount,
  labels,
}: {
  pickup: string;
  dropoff: string;
  stopoverCount: number;
  labels: { pickup: string; dropoff: string; stopovers: string };
}) {
  return (
    <div className="relative">
      <div className="absolute left-[11px] top-3 bottom-3 w-px bg-border" aria-hidden />

      <div className="relative flex items-start gap-3.5 pb-5">
        <div className="h-[22px] w-[22px] rounded-full bg-accent flex items-center justify-center shrink-0 ring-4 ring-bg relative z-10">
          <div className="h-1.5 w-1.5 bg-bg rounded-full" />
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="text-[10.5px] font-semibold text-text-faint uppercase tracking-wider">{labels.pickup}</div>
          <div className="text-sm font-semibold text-text mt-1.5 leading-snug break-words">{pickup}</div>
        </div>
      </div>

      {stopoverCount > 0 && (
        <div className="relative flex items-center gap-3.5 pb-5 -mt-1">
          <div className="w-[22px] flex justify-center shrink-0">
            <div className="h-1.5 w-1.5 rounded-full bg-text-muted/40" aria-hidden />
          </div>
          <span className="text-xs text-text-muted italic">{labels.stopovers}</span>
        </div>
      )}

      <div className="relative flex items-start gap-3.5">
        <div className="h-[22px] w-[22px] rounded-full bg-success flex items-center justify-center shrink-0 ring-4 ring-bg relative z-10">
          <div className="h-1.5 w-1.5 bg-bg rounded-full" />
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="text-[10.5px] font-semibold text-text-faint uppercase tracking-wider">{labels.dropoff}</div>
          <div className="text-sm font-semibold text-text mt-1.5 leading-snug break-words">{dropoff}</div>
        </div>
      </div>
    </div>
  );
}
