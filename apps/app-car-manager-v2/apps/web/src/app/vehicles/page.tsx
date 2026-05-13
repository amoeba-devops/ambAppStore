import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { AlertTriangle, Car, Download, Fuel, Gauge, MapPin, Plus, Wrench } from 'lucide-react';
import { Badge, Button, Card } from '@car-v2/ui';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';

type VehicleStatus = 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE';

interface VehicleSummary {
  id: string;
  plate: string;
  model: string;
  color: string;
  year: number;
  km: number;
  status: VehicleStatus;
  driver: string | null;
  nextOilKm: number;
  notes?: string;
}

const VEHICLES: VehicleSummary[] = [
  { id: 'v-01', plate: '51K-238.91', model: 'Hyundai Staria 11', color: 'Pearl White', year: 2023, km: 18420, status: 'IN_USE',     driver: 'Nguyễn Văn Tú',  nextOilKm: 1580 },
  { id: 'v-02', plate: '30A-556.07', model: 'Kia Carnival SX',    color: 'Aurora Black', year: 2022, km: 42118, status: 'AVAILABLE', driver: null,             nextOilKm: -210, notes: 'Oil change overdue' },
  { id: 'v-03', plate: '51F-712.34', model: 'Toyota Camry 2.5Q',  color: 'Silver',       year: 2021, km: 67830, status: 'MAINTENANCE', driver: null,           nextOilKm: 2940, notes: 'Periodic service · back tomorrow 10:00' },
];

const STATUS_TONE: Record<VehicleStatus, 'success' | 'info' | 'warning'> = {
  AVAILABLE: 'success', IN_USE: 'info', MAINTENANCE: 'warning',
};
const STATUS_LABEL: Record<VehicleStatus, string> = {
  AVAILABLE: 'Available', IN_USE: 'In use', MAINTENANCE: 'Maintenance',
};

export default async function VehiclesPage() {
  const t    = await getTranslations('screens.vehicles');
  const tA   = await getTranslations('actions');
  const tNav = await getTranslations('nav');
  const tCo  = await getTranslations('company');

  return (
    <AppShell>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        breadcrumbs={[{ label: tCo('tenant') }, { label: tNav('vehicles') }]}
        actions={
          <>
            <Button variant="ghost" size="md" iconLeft={<Download />}>{tA('export')}</Button>
            <Button variant="accent" size="md" iconLeft={<Plus />}>{tA('new')}</Button>
          </>
        }
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6 space-y-5">
        {/* Summary KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard label="Total" value="3" />
          <SummaryCard label="Available" value="1" tone="success" />
          <SummaryCard label="In use" value="1" tone="info" />
          <SummaryCard label="Maintenance" value="1" tone="warning" />
        </div>

        {/* Vehicle cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {VEHICLES.map((v) => (
            <Link
              key={v.id}
              href={`/vehicles/${v.id}`}
              className="group rounded-md border border-border bg-surface p-5 hover:border-border-strong hover:shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="inline-flex items-center gap-2 text-text-muted">
                  <Car className="h-4 w-4" />
                  <span className="font-mono font-semibold text-text">{v.plate}</span>
                </div>
                <Badge tone={STATUS_TONE[v.status]}>{STATUS_LABEL[v.status]}</Badge>
              </div>
              <div className="mt-3 text-lg font-semibold text-text leading-tight">{v.model}</div>
              <div className="text-sm text-text-muted">{v.color} · {v.year}</div>

              <div className="mt-4 grid grid-cols-3 gap-3 text-sm pt-4 border-t border-border">
                <Stat icon={<Gauge />} label="Odometer" value={`${v.km.toLocaleString()} km`} />
                <Stat
                  icon={<Fuel />}
                  label="Oil in"
                  value={v.nextOilKm < 0 ? `${Math.abs(v.nextOilKm)} km over` : `${v.nextOilKm.toLocaleString()} km`}
                  tone={v.nextOilKm < 0 ? 'danger' : undefined}
                />
                <Stat icon={<MapPin />} label="Driver" value={v.driver ?? '—'} />
              </div>

              {v.notes && (
                <div className={
                  'mt-3 flex items-start gap-2 rounded px-2.5 py-1.5 text-xs ' +
                  (v.nextOilKm < 0 ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning')
                }>
                  {v.nextOilKm < 0 ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> : <Wrench className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
                  <span className="leading-snug">{v.notes}</span>
                </div>
              )}
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'info' | 'warning' }) {
  return (
    <Card className="px-4 py-3">
      <div className={
        'text-xs font-medium uppercase tracking-wide mb-1.5 ' +
        (tone === 'success' ? 'text-success' :
         tone === 'info'    ? 'text-info'    :
         tone === 'warning' ? 'text-warning' :
                              'text-text-muted')
      }>{label}</div>
      <div className="text-2xl font-bold text-text tabular leading-none">{value}</div>
    </Card>
  );
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: 'danger' }) {
  return (
    <div>
      <div className="inline-flex items-center gap-1 text-xs text-text-faint [&_svg]:h-3 [&_svg]:w-3">
        {icon} <span>{label}</span>
      </div>
      <div className={'mt-0.5 text-sm font-medium tabular ' + (tone === 'danger' ? 'text-danger' : 'text-text')}>
        {value}
      </div>
    </div>
  );
}
