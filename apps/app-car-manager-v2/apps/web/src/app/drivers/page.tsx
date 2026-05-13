import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Calendar, ChevronRight, Download, Phone, Plus, Search } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@car-v2/ui';
import { AppShell } from '@/components/layout/app-shell';
import { Fab } from '@/components/layout/fab';
import { PageHeader } from '@/components/layout/page-header';

interface DriverRow {
  id: string;
  name: string;
  phone: string;
  license: string;
  licenseClass: 'A2' | 'B1' | 'B2' | 'C';
  licenseExpiry: string;
  expiryDaysLeft: number;
  status: 'AVAILABLE' | 'ON_TRIP' | 'OFF_DUTY';
  tripsThisMonth: number;
  rating: number;
}

const DRIVERS: DriverRow[] = [
  { id: 'd-01', name: 'Nguyễn Văn Tú',   phone: '+84 90 555 8819', license: 'B2-1234567', licenseClass: 'B2', licenseExpiry: '2028-08-12', expiryDaysLeft: 800, status: 'ON_TRIP',   tripsThisMonth: 14, rating: 4.9 },
  { id: 'd-02', name: 'Trần Quốc Hùng', phone: '+84 91 444 7720', license: 'B2-1108800', licenseClass: 'B2', licenseExpiry: '2027-02-04', expiryDaysLeft: 270, status: 'AVAILABLE', tripsThisMonth: 12, rating: 4.7 },
  { id: 'd-03', name: 'Lê Minh Đức',    phone: '+84 90 778 1132', license: 'B2-1090012', licenseClass: 'B2', licenseExpiry: '2026-05-22', expiryDaysLeft:  10, status: 'OFF_DUTY',  tripsThisMonth:  9, rating: 4.6 },
];

const STATUS: Record<DriverRow['status'], { tone: 'success' | 'info' | 'neutral'; label: string }> = {
  AVAILABLE: { tone: 'success', label: 'Available' },
  ON_TRIP:   { tone: 'info',    label: 'On a trip' },
  OFF_DUTY:  { tone: 'neutral', label: 'Off duty'  },
};

export default async function DriversPage() {
  const t    = await getTranslations('screens.drivers');
  const tA   = await getTranslations('actions');
  const tNav = await getTranslations('nav');
  const tCo  = await getTranslations('company');

  return (
    <AppShell>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        breadcrumbs={[{ label: tCo('tenant') }, { label: tNav('drivers') }]}
        actions={
          <>
            <Button variant="ghost" size="md" iconLeft={<Download />}>{tA('export')}</Button>
            <Button variant="accent" size="md" iconLeft={<Plus />}>{tA('new')}</Button>
          </>
        }
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <Input placeholder="Search by name, license, plate…" iconLeft={<Search />} className="md:w-80" />
          <div className="text-xs md:text-sm text-text-muted">
            <span className="font-semibold text-text">3</span> drivers ·{' '}
            <span className="font-semibold text-danger">1</span> license expiring within 30 days
          </div>
        </div>

        {/* Mobile: card list */}
        <ul className="md:hidden space-y-2.5">
          {DRIVERS.map((d) => (
            <li key={d.id}>
              <Link
                href={`/drivers/${d.id}`}
                className="block rounded-md border border-border bg-surface px-4 py-3.5 active:bg-surface-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                <div className="flex items-start gap-3">
                  <Avatar name={d.name} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-text truncate">{d.name}</div>
                        <div className="text-xs text-text-faint truncate font-mono tabular">{d.phone}</div>
                      </div>
                      <Badge tone={STATUS[d.status].tone} size="sm">{STATUS[d.status].label}</Badge>
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-xs">
                      <div className="text-text-muted">
                        <span className="font-mono tabular">{d.license}</span>
                        <span className="text-text-faint ml-1">· {d.licenseClass}</span>
                      </div>
                      <div className="text-text-faint">·</div>
                      <div className="tabular text-text-muted">{d.tripsThisMonth} trips · {d.rating.toFixed(1)}★</div>
                    </div>
                    {d.expiryDaysLeft <= 30 && (
                      <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-danger bg-danger-soft px-2 py-0.5 rounded">
                        <Calendar className="h-3 w-3" />
                        License expires {d.licenseExpiry} ({d.expiryDaysLeft}d)
                      </div>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-text-faint shrink-0 self-center" />
                </div>
              </Link>
            </li>
          ))}
        </ul>

        <Card variant="outline" className="hidden md:block overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Driver</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>License</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Trips · 30d</TableHead>
                <TableHead className="text-right">Rating</TableHead>
                <TableHead className="w-12 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {DRIVERS.map((d) => (
                <TableRow key={d.id} className="cursor-pointer">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar name={d.name} size="md" />
                      <div className="min-w-0">
                        <div className="font-medium text-text truncate">{d.name}</div>
                        <div className="text-xs text-text-faint">{d.id.toUpperCase()}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="inline-flex items-center gap-1.5 text-text">
                      <Phone className="h-3.5 w-3.5 text-text-faint" />
                      <span className="font-mono tabular text-sm">{d.phone}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-text">
                      <span className="font-mono tabular text-sm">{d.license}</span>
                      <span className="text-xs text-text-faint ml-2">Class {d.licenseClass}</span>
                    </div>
                    <div className={
                      'inline-flex items-center gap-1 text-xs mt-0.5 ' +
                      (d.expiryDaysLeft <= 30 ? 'text-danger' : d.expiryDaysLeft <= 90 ? 'text-warning' : 'text-text-faint')
                    }>
                      <Calendar className="h-3 w-3" />
                      <span>Expires {d.licenseExpiry}</span>
                      {d.expiryDaysLeft <= 30 && (
                        <span className="ml-1 font-semibold">({d.expiryDaysLeft}d left)</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge tone={STATUS[d.status].tone} size="sm">{STATUS[d.status].label}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular font-semibold text-text">{d.tripsThisMonth}</TableCell>
                  <TableCell className="text-right tabular text-text">{d.rating.toFixed(1)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/drivers/${d.id}`}>{tA('view')}</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      <Fab href="/drivers/new" label={tA('new')} icon={<Plus />} />
    </AppShell>
  );
}
