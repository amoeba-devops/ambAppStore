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
} from '@car-v2/ui';
import type { CarDriverStatus } from '@car-v2/db/schema';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getDriver } from '@/server/queries/drivers.queries';
import { listTripsForDriver } from '@/server/queries/trips.queries';
import { TripHistorySection } from '../../trips/_components/trip-history-section';
import { DriverDeleteButton } from './_components/driver-delete-button';

const STATUS_TONE: Record<CarDriverStatus, 'success' | 'info' | 'neutral'> = {
  AVAILABLE:   'success',
  ON_TRIP:     'info',
  OFF_DUTY:    'neutral',
  UNAVAILABLE: 'neutral',
};

function daysUntil(dateStr: string): number {
  const d = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(d / (1000 * 60 * 60 * 24));
}

export default async function DriverDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tA       = await getTranslations('actions');
  const tNav     = await getTranslations('nav');
  const tCo      = await getTranslations('company');
  const tStatus  = await getTranslations('drivers.status');
  const tDetail  = await getTranslations('drivers.detail');
  const tList    = await getTranslations('drivers.list');
  const user = await getCurrentUser();

  const driver = await getDriver(user.entId, id);
  if (!driver) notFound();
  /* Pull a fuller history (not just 10) so the Kanban board has enough cards
   * across its status columns to be meaningful. The table view paginates
   * visually via scroll. */
  const trips = await listTripsForDriver(user.entId, id, 50);
  const tripsLast30 = trips.filter(
    (t) => new Date(t.trpScheduledAt).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).length;
  const expiryDays = daysUntil(driver.drvLicenseExpiry);

  return (
    <>
      <PageHeader
        title={driver.user.usrName ?? tDetail('defaultName')}
        subtitle={`${tList('classLabel', { class: driver.drvLicenseClass })} · ${driver.drvLicenseNumber}`}
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
        mobileAction={
          <Link
            href={`/drivers/${id}/edit`}
            aria-label={tA('edit')}
            className="inline-flex items-center justify-center h-10 w-10 rounded-full text-text hover:bg-surface-2 active:bg-surface-2/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Edit3 className="h-5 w-5" />
          </Link>
        }
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-5">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-5">
          {/* Main — `min-w-0` lets the embedded Kanban board scroll horizontally
           * inside this 1fr track instead of forcing the track (and the page)
           * wider than the viewport. */}
          <div className="min-w-0 space-y-5">
            <Card>
              <CardContent>
                <div className="flex flex-col sm:flex-row items-start gap-5">
                  <Avatar name={driver.user.usrName ?? '?'} size="xl" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 flex-wrap min-w-0">
                        <h2 className="text-2xl font-bold text-text leading-tight">{driver.user.usrName}</h2>
                        <Badge tone={STATUS_TONE[driver.drvStatus]}>{tStatus(driver.drvStatus)}</Badge>
                      </div>
                      {/* Inline Edit + Delete buttons — visible on all sizes.
                       * On mobile (< sm): icon-only for compact layout.
                       * On desktop (sm+): shows text labels. */}
                      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                        <Button variant="secondary" size="sm" className="px-2 sm:px-3" asChild>
                          <Link href={`/drivers/${id}/edit`} aria-label={tA('edit')}>
                            <Edit3 className="h-4 w-4" />
                            <span className="hidden sm:inline ml-1.5">{tA('edit')}</span>
                          </Link>
                        </Button>
                        <DriverDeleteButton
                          driverId={driver.drvId}
                          driverName={driver.user.usrName ?? driver.drvLicenseNumber}
                          variant="ghost"
                          size="sm"
                        />
                      </div>
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
                      <Stat label={tDetail('statLicense')} value={driver.drvLicenseNumber} />
                      <Stat label={tDetail('statClass')} value={driver.drvLicenseClass} />
                      <Stat label={tDetail('statExpires')} value={driver.drvLicenseExpiry} />
                      <Stat label={tDetail('statTrips30')} value={String(tripsLast30)} />
                    </div>
                    {expiryDays <= 30 && (
                      <div className="mt-3 inline-flex items-center gap-2 rounded px-3 py-2 bg-danger-soft text-danger text-xs font-medium">
                        <Calendar className="h-3.5 w-3.5" />
                        {expiryDays === 1
                          ? tDetail('expiryAlertOne', { days: expiryDays })
                          : tDetail('expiryAlertOther', { days: expiryDays })}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <TripHistorySection
              trips={trips}
              variant="driver"
              title={tDetail('recentTrips')}
              emptyLabel={tDetail('noTrips')}
            />
          </div>

          {/* Side */}
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardHeaderText>
                  <CardTitle>{tDetail('notesTitle')}</CardTitle>
                </CardHeaderText>
              </CardHeader>
              <CardContent>
                {driver.drvNotes ? (
                  <p className="text-sm text-text leading-relaxed">{driver.drvNotes}</p>
                ) : (
                  <p className="text-sm text-text-faint italic">{tDetail('noNotes')}</p>
                )}
              </CardContent>
            </Card>

            {driver.drvEmergencyContact && (
              <Card>
                <CardHeader>
                  <CardHeaderText>
                    <CardTitle>{tDetail('emergencyTitle')}</CardTitle>
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
