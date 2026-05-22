import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Car, ChevronLeft, Edit3, FileText, Fuel, Gauge, MapPin, Wrench } from 'lucide-react';
import {
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@car-v2/ui';
import type { CarTripStatus, CarVehicleStatus } from '@car-v2/db/schema';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { listTripsForVehicle } from '@/server/queries/trips.queries';
import { getVehicle } from '@/server/queries/vehicles.queries';

const STATUS_TONE: Record<CarVehicleStatus, 'success' | 'info' | 'warning' | 'neutral'> = {
  AVAILABLE: 'success',
  IN_USE: 'info',
  MAINTENANCE: 'warning',
  RETIRED: 'neutral',
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

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tA       = await getTranslations('actions');
  const tNav     = await getTranslations('nav');
  const tCo      = await getTranslations('company');
  const tStatus  = await getTranslations('vehicles.status');
  const tDetail  = await getTranslations('vehicles.detail');
  const tTripSt  = await getTranslations('trips.status');
  const user = await getCurrentUser();

  const vehicle = await getVehicle(user.entId, id);
  if (!vehicle) notFound();

  const trips = await listTripsForVehicle(user.entId, id, 10);
  const remainingOil =
    vehicle.cvhLastOilChangeKm != null
      ? vehicle.cvhLastOilChangeKm + vehicle.cvhOilIntervalKm - vehicle.cvhOdometerKm
      : vehicle.cvhOilIntervalKm;
  const lastService = vehicle.cvhLastOilChangeAt
    ? new Date(vehicle.cvhLastOilChangeAt).toISOString().slice(0, 10)
    : '—';

  return (
    <>
      <PageHeader
        title={vehicle.cvhPlateNumber}
        subtitle={[vehicle.cvhModel, vehicle.cvhColor, vehicle.cvhYear].filter(Boolean).join(' · ')}
        breadcrumbs={[
          { label: tCo('tenant') },
          { label: tNav('vehicles'), href: '/vehicles' },
          { label: vehicle.cvhPlateNumber },
        ]}
        back="/vehicles"
        actions={
          <>
            <Button variant="ghost" size="md" asChild>
              <Link href="/vehicles"><ChevronLeft />{tA('back')}</Link>
            </Button>
            <Button variant="secondary" size="md" asChild>
              <Link href={`/vehicles/${vehicle.cvhId}/edit`}><Edit3 />{tA('edit')}</Link>
            </Button>
          </>
        }
        mobileAction={
          <Link
            href={`/vehicles/${vehicle.cvhId}/edit`}
            aria-label={tA('edit')}
            className="inline-flex items-center justify-center h-10 w-10 rounded-full text-text hover:bg-surface-2 active:bg-surface-2/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Edit3 className="h-5 w-5" />
          </Link>
        }
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-5 space-y-5">
        <Card>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-start gap-5">
              <div className="h-20 w-20 rounded-md bg-accent-soft text-accent flex items-center justify-center shrink-0">
                <Car className="h-9 w-9" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 flex-wrap min-w-0">
                    <h2 className="text-2xl font-bold text-text font-mono tracking-tight">{vehicle.cvhPlateNumber}</h2>
                    <Badge tone={STATUS_TONE[vehicle.cvhStatus]}>{tStatus(vehicle.cvhStatus)}</Badge>
                  </div>
                  {/* Inline Edit — mirrors the header `actions` slot for mobile
                   * users who no longer see the header right buttons. */}
                  <Button variant="secondary" size="sm" iconLeft={<Edit3 />} asChild className="shrink-0">
                    <Link href={`/vehicles/${vehicle.cvhId}/edit`}>{tA('edit')}</Link>
                  </Button>
                </div>
                {vehicle.cvhNotes && <p className="mt-1 text-text-muted">{vehicle.cvhNotes}</p>}
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-5">
                  <Stat icon={<Gauge />}  label={tDetail('statOdometer')}    value={`${vehicle.cvhOdometerKm.toLocaleString()} km`} />
                  <Stat icon={<Fuel />}   label={tDetail('statOilIn')}       value={remainingOil < 0 ? `${Math.abs(remainingOil)} km` : `${remainingOil.toLocaleString()} km`} />
                  <Stat icon={<Wrench />} label={tDetail('statLastService')} value={lastService} />
                  <Stat icon={<MapPin />} label={tDetail('statBase')}        value={vehicle.cvhHomeBase ?? '—'} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="trips">
          <TabsList>
            <TabsTrigger value="trips">{tDetail('tabTrips')}</TabsTrigger>
            <TabsTrigger value="docs">{tDetail('tabDocs')}</TabsTrigger>
            <TabsTrigger value="maintenance">{tDetail('tabMaintenance')}</TabsTrigger>
          </TabsList>

          <TabsContent value="trips">
            <Card>
              <CardHeader>
                <CardHeaderText>
                  <CardTitle>{tDetail('recentTripsTitle')}</CardTitle>
                </CardHeaderText>
              </CardHeader>
              <CardContent padded={false}>
                {trips.length === 0 ? (
                  <div className="p-8 text-center text-sm text-text-muted">{tDetail('noTrips')}</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{tDetail('thRef')}</TableHead>
                        <TableHead>{tDetail('thWhen')}</TableHead>
                        <TableHead>{tDetail('thRoute')}</TableHead>
                        <TableHead>{tDetail('thDriver')}</TableHead>
                        <TableHead>{tDetail('thStatus')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {trips.map((r) => (
                        <TableRow key={r.trpId}>
                          <TableCell>
                            <Link href={`/trips/${r.trpId}`} className="font-mono text-xs text-accent hover:underline tabular">{r.trpRef}</Link>
                          </TableCell>
                          <TableCell className="text-text-muted tabular">{new Date(r.trpScheduledAt).toISOString().slice(0, 10)}</TableCell>
                          <TableCell className="max-w-[280px] truncate">{r.trpPickupAddress} → {r.trpDropoffAddress}</TableCell>
                          <TableCell>{r.driverName ?? '—'}</TableCell>
                          <TableCell>
                            <Badge tone={TRIP_STATUS_TONE[r.trpStatus]} size="sm">{tTripSt(r.trpStatus)}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="docs">
            <Card>
              <CardHeader>
                <CardHeaderText>
                  <CardTitle>{tDetail('docsTitle')}</CardTitle>
                </CardHeaderText>
                <Button variant="secondary" size="sm" iconLeft={<FileText />}>{tDetail('upload')}</Button>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-text-muted">{tDetail('docsP2Note')}</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="maintenance">
            <Card>
              <CardContent>
                <p className="text-sm text-text-muted">{tDetail('maintP4Note')} <span className="font-medium text-text">P4</span>.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="inline-flex items-center gap-1 text-xs text-text-faint [&_svg]:h-3 [&_svg]:w-3">
        {icon} <span>{label}</span>
      </div>
      <div className="mt-1 text-sm font-semibold text-text tabular">{value}</div>
    </div>
  );
}
