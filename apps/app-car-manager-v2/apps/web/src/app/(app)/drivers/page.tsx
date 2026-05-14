import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Calendar, ChevronRight, Download, Phone, Plus, Search } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@car-v2/ui';
import type { CarDriverStatus } from '@car-v2/db/schema';
import { Fab } from '@/components/layout/fab';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { listDrivers } from '@/server/queries/drivers.queries';

const STATUS: Record<CarDriverStatus, { tone: 'success' | 'info' | 'neutral'; label: string }> = {
  AVAILABLE:   { tone: 'success', label: 'Available' },
  ON_TRIP:     { tone: 'info',    label: 'On a trip' },
  OFF_DUTY:    { tone: 'neutral', label: 'Off duty'  },
  UNAVAILABLE: { tone: 'neutral', label: 'Unavailable' },
};

function daysUntil(dateStr: string): number {
  const d = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(d / (1000 * 60 * 60 * 24));
}

export default async function DriversPage() {
  const tA   = await getTranslations('actions');
  const tNav = await getTranslations('nav');
  const tCo  = await getTranslations('company');
  const user = await getCurrentUser();
  const drivers = await listDrivers(user.entId);

  const expiringSoon = drivers.filter((d) => daysUntil(d.drvLicenseExpiry) <= 30).length;

  return (
    <>
      <PageHeader
        title={tNav('drivers')}
        subtitle={`${drivers.length} drivers · ${expiringSoon} license${expiringSoon === 1 ? '' : 's'} expiring within 30 days`}
        breadcrumbs={[{ label: tCo('tenant') }, { label: tNav('drivers') }]}
        actions={
          <>
            <Button variant="ghost" size="md" iconLeft={<Download />}>{tA('export')}</Button>
            <Button variant="accent" size="md" asChild>
              <Link href="/drivers/new"><Plus />{tA('new')}</Link>
            </Button>
          </>
        }
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <Input placeholder="Search by name, license, phone…" iconLeft={<Search />} className="md:w-80" />
          <div className="text-xs md:text-sm text-text-muted">
            <span className="font-semibold text-text">{drivers.length}</span> drivers ·{' '}
            <span className={'font-semibold ' + (expiringSoon > 0 ? 'text-danger' : 'text-text-faint')}>
              {expiringSoon}
            </span> license expiring within 30 days
          </div>
        </div>

        {drivers.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Phone />}
              title="No drivers yet"
              description="Invite a driver — they need to have an account in this tenant first."
              action={
                <Button variant="accent" size="md" asChild>
                  <Link href="/drivers/new"><Plus />Add driver</Link>
                </Button>
              }
            />
          </Card>
        ) : (
          <>
            {/* Mobile card list */}
            <ul className="md:hidden space-y-2.5">
              {drivers.map((d) => {
                const daysLeft = daysUntil(d.drvLicenseExpiry);
                return (
                  <li key={d.drvId}>
                    <Link
                      href={`/drivers/${d.drvId}`}
                      className="block rounded-md border border-border bg-surface px-4 py-3.5 active:bg-surface-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                    >
                      <div className="flex items-start gap-3">
                        <Avatar name={d.user.usrName ?? '?'} size="md" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-semibold text-text truncate">{d.user.usrName}</div>
                              <div className="text-xs text-text-faint truncate font-mono tabular">{d.drvPhone ?? '—'}</div>
                            </div>
                            <Badge tone={STATUS[d.drvStatus].tone} size="sm">{STATUS[d.drvStatus].label}</Badge>
                          </div>
                          <div className="mt-2 text-xs text-text-muted">
                            <span className="font-mono tabular">{d.drvLicenseNumber}</span>
                            <span className="text-text-faint ml-1">· {d.drvLicenseClass}</span>
                          </div>
                          {daysLeft <= 30 && (
                            <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-danger bg-danger-soft px-2 py-0.5 rounded">
                              <Calendar className="h-3 w-3" />
                              License expires {d.drvLicenseExpiry} ({daysLeft}d)
                            </div>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-text-faint shrink-0 self-center" />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>

            {/* Desktop table */}
            <Card variant="outline" className="hidden md:block overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Driver</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>License</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12 text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drivers.map((d) => {
                    const daysLeft = daysUntil(d.drvLicenseExpiry);
                    return (
                      <TableRow key={d.drvId} className="cursor-pointer">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar name={d.user.usrName ?? '?'} size="md" />
                            <div className="min-w-0">
                              <div className="font-medium text-text truncate">{d.user.usrName}</div>
                              <div className="text-xs text-text-faint truncate">{d.user.usrEmail}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="inline-flex items-center gap-1.5 text-text">
                            <Phone className="h-3.5 w-3.5 text-text-faint" />
                            <span className="font-mono tabular text-sm">{d.drvPhone ?? '—'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-text">
                            <span className="font-mono tabular text-sm">{d.drvLicenseNumber}</span>
                            <span className="text-xs text-text-faint ml-2">Class {d.drvLicenseClass}</span>
                          </div>
                          <div className={
                            'inline-flex items-center gap-1 text-xs mt-0.5 ' +
                            (daysLeft <= 30 ? 'text-danger' : daysLeft <= 90 ? 'text-warning' : 'text-text-faint')
                          }>
                            <Calendar className="h-3 w-3" />
                            <span>Expires {d.drvLicenseExpiry}</span>
                            {daysLeft <= 30 && <span className="ml-1 font-semibold">({daysLeft}d)</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge tone={STATUS[d.drvStatus].tone} size="sm">{STATUS[d.drvStatus].label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/drivers/${d.drvId}`}>{tA('view')}</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </>
        )}
      </div>

      <Fab href="/drivers/new" label={tA('new')} icon={<Plus />} />
    </>
  );
}
