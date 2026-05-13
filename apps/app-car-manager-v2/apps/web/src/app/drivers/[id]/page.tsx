import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Calendar, ChevronLeft, Edit3, Mail, Phone, Star } from 'lucide-react';
import {
  Avatar,
  Alert,
  AlertDescription,
  AlertTitle,
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
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';

const RECENT_TRIPS = [
  { ref: 'TR-1042', when: 'Today',  route: 'D1 → SGN T2',  vehicle: '51K-238.91', km: 22, status: 'IN_PROGRESS' },
  { ref: 'TR-1038', when: 'Tomorrow', route: 'D1 → Saigon Centre', vehicle: '51K-238.91', km: 10, status: 'CONFIRMED' },
  { ref: 'TR-1029', when: 'May 8',  route: 'D2 → D7',       vehicle: '51K-238.91', km: 12, status: 'COMPLETED' },
];

export default async function DriverDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t    = await getTranslations('screens.driverDetail');
  const tA   = await getTranslations('actions');
  const tNav = await getTranslations('nav');
  const tCo  = await getTranslations('company');

  const name = 'Nguyễn Văn Tú';
  return (
    <AppShell>
      <PageHeader
        title={name}
        subtitle={t('subtitle')}
        breadcrumbs={[
          { label: tCo('tenant') },
          { label: tNav('drivers'), href: '/drivers' },
          { label: id },
        ]}
        actions={
          <>
            <Button variant="ghost" size="md" asChild>
              <Link href="/drivers"><ChevronLeft />{tA('back')}</Link>
            </Button>
            <Button variant="secondary" size="md" iconLeft={<Edit3 />}>{tA('edit')}</Button>
          </>
        }
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-5">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
          {/* Main */}
          <div className="space-y-5">
            <Card>
              <CardContent>
                <div className="flex items-start gap-5">
                  <Avatar name={name} size="xl" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className="text-2xl font-bold text-text leading-tight">{name}</h2>
                      <Badge tone="info">On a trip</Badge>
                    </div>
                    <div className="mt-2 space-y-1 text-sm">
                      <div className="inline-flex items-center gap-2 text-text-muted">
                        <Phone className="h-3.5 w-3.5" />
                        <span className="font-mono tabular">+84 90 555 8819</span>
                      </div>
                      <div className="inline-flex items-center gap-2 text-text-muted ml-5">
                        <Mail className="h-3.5 w-3.5" />
                        <span>tu.nguyen@hanatech.vn</span>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-4 gap-5">
                      <Stat label="License" value="B2-1234567" />
                      <Stat label="Class" value="B2" />
                      <Stat label="Expires" value="2028-08-12" />
                      <Stat label="Trips · 30d" value="14" />
                    </div>
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ref</TableHead>
                      <TableHead>When</TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead className="text-right">km</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {RECENT_TRIPS.map((r) => (
                      <TableRow key={r.ref}>
                        <TableCell className="font-mono text-xs text-text-muted tabular">{r.ref}</TableCell>
                        <TableCell className="text-text-muted">{r.when}</TableCell>
                        <TableCell>{r.route}</TableCell>
                        <TableCell className="font-mono text-xs tabular">{r.vehicle}</TableCell>
                        <TableCell className="text-right tabular font-medium">{r.km}</TableCell>
                        <TableCell>
                          <Badge
                            tone={r.status === 'IN_PROGRESS' ? 'info' : r.status === 'CONFIRMED' ? 'success' : 'neutral'}
                            size="sm"
                          >
                            {r.status === 'IN_PROGRESS' ? 'In progress' : r.status === 'CONFIRMED' ? 'Confirmed' : 'Completed'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Side */}
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardHeaderText>
                  <CardTitle>Performance</CardTitle>
                </CardHeaderText>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Metric label="On-time arrival" value="96%" tone="success" />
                  <Metric label="Acceptance rate" value="94%" tone="success" />
                  <Metric label="Avg rating" value="4.9" icon={<Star className="h-3 w-3 fill-current" />} tone="warning" />
                  <Metric label="Cancellations" value="0" tone="neutral" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardHeaderText>
                  <CardTitle>Schedule</CardTitle>
                </CardHeaderText>
              </CardHeader>
              <CardContent>
                <div className="inline-flex items-center gap-2 text-sm text-text-muted">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Off duty Sundays</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
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

function Metric({ label, value, icon, tone }: { label: string; value: string; icon?: React.ReactNode; tone: 'success' | 'warning' | 'danger' | 'neutral' }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-text-muted">{label}</span>
      <span className={
        'inline-flex items-center gap-1 text-sm font-semibold tabular ' +
        (tone === 'success' ? 'text-success' :
         tone === 'warning' ? 'text-warning' :
         tone === 'danger'  ? 'text-danger'  :
                              'text-text')
      }>
        {icon}{value}
      </span>
    </div>
  );
}
