import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Car,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Edit3,
  MapPin,
  ShieldCheck,
  User,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardHeaderText,
  CardTitle,
} from '@car-v2/ui';
import type { CarTripStatus } from '@car-v2/db/schema';
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
const STATUS_LABEL: Record<CarTripStatus, string> = {
  PENDING_ASSIGNMENT:          'Pending assignment',
  PENDING_DRIVER_CONFIRMATION: 'Awaiting driver',
  CONFIRMED:                   'Confirmed',
  IN_PROGRESS:                 'In progress',
  COMPLETED:                   'Completed',
  REJECTED_BY_DRIVER:          'Rejected by driver',
  CANCELLED:                   'Cancelled',
};

function fmtDateTime(d: Date): string {
  return new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tA   = await getTranslations('actions');
  const tNav = await getTranslations('nav');
  const tCo  = await getTranslations('company');
  const user = await getCurrentUser();

  const trip = await getTrip(user.entId, id);
  if (!trip) notFound();

  /* Load drivers + vehicles for the Assign dialog. Could be deferred to a
   * client fetch but RSC fetch is simpler and the lists are tiny. */
  const [drivers, vehicles, auditRows] = await Promise.all([
    user.role === 'ADMIN' ? listDrivers(user.entId) : Promise.resolve([]),
    user.role === 'ADMIN' ? listVehicles(user.entId) : Promise.resolve([]),
    listAuditForEntity(user.entId, 'Trip', id),
  ]);

  /* Determine if current user is the assigned driver — needed for action gating */
  let isAssignedDriver = false;
  if (user.role === 'DRIVER' && trip.trpDriverId) {
    // We need the driver record's user_id. The query already returned trp_driver_id,
    // so we need to cross-check. Cheap: look up the driver row.
    const { getDriverByUserId } = await import('@/server/queries/drivers.queries');
    const actorDriver = await getDriverByUserId(user.entId, user.userId);
    isAssignedDriver = actorDriver?.drvId === trip.trpDriverId;
  }
  const isCreator = trip.trpCreatorId === user.userId;

  /* PRD FR-1.3: Manager edits own pre-confirm; Admin edits any non-completed. */
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

  return (
    <>
      <PageHeader
        title={`${trip.trpRef} · ${STATUS_LABEL[trip.trpStatus]}`}
        subtitle={[trip.passengerName, trip.trpPurpose].filter(Boolean).join(' · ')}
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
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-5">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
          {/* Main column */}
          <div className="space-y-5">
            {/* Summary */}
            <Card>
              <CardHeader>
                <CardHeaderText>
                  <CardTitle>Summary</CardTitle>
                </CardHeaderText>
                <Badge tone={STATUS_TONE[trip.trpStatus]}>{STATUS_LABEL[trip.trpStatus]}</Badge>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                  <Field icon={<User />} label="Passenger" value={trip.passengerName ?? 'Unspecified'} sub={trip.passengerEmail ?? undefined} />
                  <Field icon={<Clock />} label="Scheduled" value={fmtDateTime(trip.trpScheduledAt)} sub={trip.trpDurationMinutes ? `~${trip.trpDurationMinutes} min` : undefined} />
                  <Field icon={<MapPin />} label="Pickup" value={trip.trpPickupAddress} />
                  <Field icon={<MapPin />} label="Drop-off" value={trip.trpDropoffAddress} />
                  <Field
                    icon={<Car />}
                    label="Vehicle"
                    value={trip.vehiclePlate ?? 'Not assigned'}
                    sub={trip.vehicleModel ?? undefined}
                  />
                  <Field icon={<User />} label="Driver" value={trip.driverName ?? 'Not assigned'} sub={trip.driverPhone ?? undefined} />
                </dl>

                {trip.stopovers.length > 0 && (
                  <div className="mt-5 pt-4 border-t border-border">
                    <div className="text-xs font-medium text-text-muted mb-2">Stopovers ({trip.stopovers.length})</div>
                    <ol className="space-y-1.5 list-decimal list-inside text-sm">
                      {trip.stopovers.map((s, i) => <li key={i} className="text-text">{s.address}</li>)}
                    </ol>
                  </div>
                )}

                {trip.trpPurpose && (
                  <div className="mt-5 pt-4 border-t border-border">
                    <div className="text-xs font-medium text-text-muted mb-1.5">Purpose</div>
                    <p className="text-sm text-text leading-relaxed">{trip.trpPurpose}</p>
                  </div>
                )}
                {trip.trpNotes && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="text-xs font-medium text-text-muted mb-1.5">Notes</div>
                    <p className="text-sm text-text leading-relaxed whitespace-pre-wrap">{trip.trpNotes}</p>
                  </div>
                )}
                {trip.trpRejectReason && (
                  <div className="mt-3 rounded px-3 py-2 bg-danger-soft text-danger text-xs">
                    <span className="font-medium">Reject reason: </span>{trip.trpRejectReason}
                  </div>
                )}
                {trip.trpCancelReason && (
                  <div className="mt-3 rounded px-3 py-2 bg-surface-2 text-text-muted text-xs">
                    <span className="font-medium">Cancel reason: </span>{trip.trpCancelReason}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardHeaderText>
                  <CardTitle>Actions</CardTitle>
                </CardHeaderText>
              </CardHeader>
              <CardContent>
                <TripActions
                  tripId={trip.trpId}
                  status={trip.trpStatus}
                  role={user.role}
                  isAssignedDriver={isAssignedDriver}
                  isCreator={isCreator}
                  drivers={driverOptions}
                  vehicles={vehicleOptions}
                  googleMapsUrl={trip.trpGoogleMapsUrl}
                />
              </CardContent>
            </Card>
          </div>

          {/* Side rail */}
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardHeaderText>
                  <CardTitle>Activity</CardTitle>
                </CardHeaderText>
              </CardHeader>
              <CardContent>
                {auditRows.length === 0 ? (
                  <p className="text-sm text-text-faint italic">No activity yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {auditRows.map((row) => (
                      <li key={row.audId} className="flex gap-3">
                        <div className="mt-0.5 h-6 w-6 rounded-full bg-accent-soft text-accent flex items-center justify-center shrink-0">
                          <CheckCircle2 className="h-3 w-3" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-text leading-tight font-mono tabular">{row.audAction.replace('TRIP.', '')}</div>
                          <div className="text-xs text-text-faint mt-0.5">
                            {row.actorName ?? <span className="italic">system</span>} ·{' '}
                            <span className="tabular">{new Date(row.audCreatedAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card variant="ghost" className="border border-dashed border-border p-4">
              <div className="flex gap-3">
                <ShieldCheck className="h-4 w-4 text-text-muted shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-text">Audit-logged</div>
                  <div className="text-xs text-text-muted mt-1">Every action on this trip is recorded (NFR-9).</div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

function Field({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div>
      <dt className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted mb-1 [&_svg]:h-3 [&_svg]:w-3">
        {icon}
        <span>{label}</span>
      </dt>
      <dd className="text-text font-medium leading-tight">{value}</dd>
      {sub && <div className="text-xs text-text-faint mt-0.5">{sub}</div>}
    </div>
  );
}

