import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Calendar, ChevronLeft, Edit3, Mail, Phone } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardHeaderText,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@car-v2/ui';
import type { CarDriverStatus, CarTripStatus } from '@car-v2/db/schema';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getDriver } from '@/server/queries/drivers.queries';
import { listTripsForDriver } from '@/server/queries/trips.queries';

const STATUS: Record<CarDriverStatus, { tone: 'success' | 'info' | 'neutral'; label: string }> = {
  AVAILABLE:   { tone: 'success', label: 'Available' },
  ON_TRIP:     { tone: 'info',    label: 'On a trip' },
  OFF_DUTY:    { tone: 'neutral', label: 'Off duty'  },
  UNAVAILABLE: { tone: 'neutral', label: 'Unavailable' },
};

const TRIP_STATUS_TONE: Record<CarTripStatus, 'info' | 'success' | 'neutral' | 'warning' | 'danger' | 'accent'> = {
  PENDING_ASSIGNMENT: 'accent',
  PENDING_DRIVER_CONFIRMATION: 'warning',
  CONFIRMED: 'success',
  IN_PROGRESS: 'info',
  COMPLETED: 'neutral',
  REJECTED_BY_DRIVER: 'danger',
  CANCELLED: 'danger',
};
const TRIP_STATUS_LABEL: Record<CarTripStatus, string> = {
  PENDING_ASSIGNMENT: 'Pending',
  PENDING_DRIVER_CONFIRMATION: 'Awaiting',
  CONFIRMED: 'Confirmed',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  REJECTED_BY_DRIVER: 'Rejected',
  CANCELLED: 'Cancelled',
};

function daysUntil(dateStr: string): number {
  const d = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(d / (1000 * 60 * 60 * 24));
}

export default async function DriverDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tA   = await getTranslations('actions');
  const tNav = await getTranslations('nav');
  const tCo  = await getTranslations('company');
  const user = await getCurrentUser();

  const driver = await getDriver(user.entId, id);
  if (!driver) notFound();
  const trips = await listTripsForDriver(user.entId, id, 10);
  const tripsLast30 = trips.filter(
    (t) => new Date(t.trpScheduledAt).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).length;
  const expiryDays = daysUntil(driver.drvLicenseExpiry);

  return (
    <>
      <PageHeader
        title={driver.user.usrName ?? 'Driver'}
        subtitle={`Class ${driver.drvLicenseClass} · ${driver.drvLicenseNumber}`}
        breadcrumbs={[
          { label: tCo('tenant') },
          { label: tNav('drivers'), href: '/drivers' },
          { label: driver.user.usrName ?? id },
        ]}
        back="/drivers"
        actions={
          <>
            <Button variant="ghost" size="md" asChild>
              <Link href="/drivers"><ChevronLeft />{tA('back')}</Link>
            </Button>
            <Button variant="secondary" size="md" asChild>
              <Link href={`/drivers/${id}/edit`}><Edit3 />{tA('edit')}</Link>
            </Button>
          </>
        }
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-5">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
          {/* Main */}
          <div className="space-y-5">
            <Card>
              <CardContent>
                <div className="flex flex-col sm:flex-row items-start gap-5">
                  <Avatar name={driver.user.usrName ?? '?'} size="xl" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className="text-2xl font-bold text-text leading-tight">{driver.user.usrName}</h2>
                      <Badge tone={STATUS[driver.drvStatus].tone}>{STATUS[driver.drvStatus].label}</Badge>
                    </div>
                    <div className="mt-2 space-y-1 text-sm">
                      {driver.drvPhone && (
                        <div className="inline-flex items-center gap-2 text-text-muted">
                          <Phone className="h-3.5 w-3.5" />
                          <span className="font-mono tabular">{driver.drvPhone}</span>
                        </div>
                      )}
                      {driver.user.usrEmail && (
                        <div className="inline-flex items-center gap-2 text-text-muted ml-5">
                          <Mail className="h-3.5 w-3.5" />
                          <span>{driver.user.usrEmail}</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-5">
                      <Stat label="License" value={driver.drvLicenseNumber} />
                      <Stat label="Class" value={driver.drvLicenseClass} />
                      <Stat label="Expires" value={driver.drvLicenseExpiry} />
                      <Stat label="Trips · 30d" value={String(tripsLast30)} />
                    </div>
                    {expiryDays <= 30 && (
                      <div className="mt-3 inline-flex items-center gap-2 rounded px-3 py-2 bg-danger-soft text-danger text-xs font-medium">
                        <Calendar className="h-3.5 w-3.5" />
                        License expires in {expiryDays} day{expiryDays === 1 ? '' : 's'}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardHeaderText>
                  <CardTitle>Recent trips</CardTitle>
                </CardHeaderText>
              </CardHeader>
              <CardContent padded={false}>
                {trips.length === 0 ? (
                  <div className="p-8 text-center text-sm text-text-muted">No trips assigned yet.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ref</TableHead>
                        <TableHead>When</TableHead>
                        <TableHead>Route</TableHead>
                        <TableHead>Vehicle</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {trips.map((r) => (
                        <TableRow key={r.trpId}>
                          <TableCell>
                            <Link href={`/trips/${r.trpId}`} className="font-mono text-xs text-accent hover:underline tabular">{r.trpRef}</Link>
                          </TableCell>
                          <TableCell className="text-text-muted tabular">{new Date(r.trpScheduledAt).toISOString().slice(0, 10)}</TableCell>
                          <TableCell className="max-w-[240px] truncate">{r.trpPickupAddress} → {r.trpDropoffAddress}</TableCell>
                          <TableCell className="font-mono text-xs tabular">{r.vehiclePlate ?? '—'}</TableCell>
                          <TableCell>
                            <Badge tone={TRIP_STATUS_TONE[r.trpStatus]} size="sm">{TRIP_STATUS_LABEL[r.trpStatus]}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Side */}
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardHeaderText>
                  <CardTitle>Notes</CardTitle>
                </CardHeaderText>
              </CardHeader>
              <CardContent>
                {driver.drvNotes ? (
                  <p className="text-sm text-text leading-relaxed">{driver.drvNotes}</p>
                ) : (
                  <p className="text-sm text-text-faint italic">No notes</p>
                )}
              </CardContent>
            </Card>

            {driver.drvEmergencyContact && (
              <Card>
                <CardHeader>
                  <CardHeaderText>
                    <CardTitle>Emergency contact</CardTitle>
                  </CardHeaderText>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-text">{driver.drvEmergencyContact}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-text-faint uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-sm font-semibold text-text tabular">{value}</div>
    </div>
  );
}
