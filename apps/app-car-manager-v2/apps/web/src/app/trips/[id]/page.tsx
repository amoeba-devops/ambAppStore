import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import {
  Car,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Edit3,
  ExternalLink,
  MapPin,
  Receipt,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
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
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';

const TIMELINE = [
  { at: '14:38', actor: 'Driver',  action: 'Arrived pickup', tone: 'success' as const, Icon: CheckCircle2 },
  { at: '14:30', actor: 'Driver',  action: 'Started trip',   tone: 'info'    as const, Icon: Car },
  { at: '14:12', actor: 'Driver',  action: 'Accepted assignment', tone: 'success' as const, Icon: CheckCircle2 },
  { at: '13:55', actor: 'Admin',   action: 'Assigned to Nguyễn Văn Tú (51K-238.91)', tone: 'accent' as const, Icon: User },
  { at: '13:48', actor: 'Park Joon-ho', action: 'Created trip request',                tone: 'neutral' as const, Icon: Clock },
];

const EXPENSES = [
  { id: 'e-501', when: 'Today · 14:50', type: 'Fuel',      amount: '850,000₫', status: 'PENDING'  as const },
  { id: 'e-498', when: 'Today · 14:42', type: 'Parking',   amount:  '40,000₫', status: 'APPROVED' as const },
];

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t    = await getTranslations('screens.tripDetail');
  const tA   = await getTranslations('actions');
  const tNav = await getTranslations('nav');
  const tCo  = await getTranslations('company');

  return (
    <AppShell>
      <PageHeader
        title={`${t('title')} · TR-1042`}
        subtitle="Park Joon-ho · D1 HCMC → Tan Son Nhat T2"
        breadcrumbs={[
          { label: tCo('tenant') },
          { label: tNav('trips'), href: '/trips' },
          { label: id },
        ]}
        actions={
          <>
            <Button variant="ghost" size="md" asChild>
              <Link href="/trips"><ChevronLeft />{tA('back')}</Link>
            </Button>
            <Button variant="secondary" size="md" iconLeft={<Edit3 />}>{tA('edit')}</Button>
            <Button variant="danger" size="md" iconLeft={<X />}>{tA('cancel')}</Button>
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
                <Badge tone="info">In progress</Badge>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                  <Field icon={<User />} label="Passenger" value="Park Joon-ho (CEO)" />
                  <Field icon={<Clock />} label="Scheduled" value="Today · 14:30 — 16:00" />
                  <Field icon={<MapPin />} label="Pickup" value="District 1, HCMC" sub="225 Lê Thánh Tôn" />
                  <Field icon={<MapPin />} label="Drop-off" value="SGN T2" sub="Tan Son Nhat Intl. Terminal 2" />
                  <Field icon={<Car />} label="Vehicle" value="Hyundai Staria 11" sub="51K-238.91 · Pearl White" />
                  <Field icon={<User />} label="Driver" value="Nguyễn Văn Tú" sub="License A2 · Active" />
                </dl>
                <div className="mt-5 pt-4 border-t border-border">
                  <div className="text-xs font-medium text-text-muted mb-1.5">Purpose</div>
                  <p className="text-sm text-text leading-relaxed">
                    Airport pickup for Seoul HQ delegation. Wait at gate B, hold "HanaTech" sign.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Linked expenses */}
            <Card>
              <CardHeader>
                <CardHeaderText>
                  <CardTitle>Linked expenses</CardTitle>
                </CardHeaderText>
                <Button variant="ghost" size="sm" iconLeft={<Receipt />}>Add expense</Button>
              </CardHeader>
              <CardContent padded={false}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Ref</TableHead>
                      <TableHead>When</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {EXPENSES.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-mono text-xs text-text-muted tabular">{e.id.toUpperCase()}</TableCell>
                        <TableCell className="text-text-muted">{e.when}</TableCell>
                        <TableCell className="text-text font-medium">{e.type}</TableCell>
                        <TableCell className="text-right font-semibold tabular text-text">{e.amount}</TableCell>
                        <TableCell>
                          <Badge tone={e.status === 'APPROVED' ? 'success' : 'warning'} size="sm">
                            {e.status === 'APPROVED' ? 'Approved' : 'Pending'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Map placeholder */}
            <Card>
              <CardHeader>
                <CardHeaderText>
                  <CardTitle>Route</CardTitle>
                </CardHeaderText>
                <Button variant="ghost" size="sm" iconRight={<ExternalLink />}>Open in Google Maps</Button>
              </CardHeader>
              <CardContent>
                <div className="h-48 rounded bg-gradient-to-br from-surface-2 to-accent-soft/40 border border-border flex items-center justify-center text-text-faint text-xs">
                  <span className="inline-flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> Map preview (P3 — Google Maps Static API)</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Side rail */}
          <div className="space-y-5">
            {/* Status panel */}
            <Card>
              <CardHeader>
                <CardHeaderText>
                  <CardTitle>Status</CardTitle>
                </CardHeaderText>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {TIMELINE.map((e, i) => (
                    <li key={i} className="flex gap-3">
                      <div className={
                        'mt-0.5 h-6 w-6 rounded-full flex items-center justify-center shrink-0 ' +
                        (e.tone === 'success' ? 'bg-success-soft text-success' :
                         e.tone === 'info'    ? 'bg-info-soft text-info' :
                         e.tone === 'accent'  ? 'bg-accent-soft text-accent' :
                                                'bg-surface-2 text-text-muted')
                      }>
                        <e.Icon className="h-3 w-3" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-text leading-tight">{e.action}</div>
                        <div className="text-xs text-text-faint mt-0.5">
                          <span className="font-medium">{e.actor}</span> · <span className="tabular">{e.at}</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Audit hint */}
            <Card variant="ghost" className="border border-dashed border-border p-4">
              <div className="flex gap-3">
                <ShieldCheck className="h-4 w-4 text-text-muted shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-text">Audit-logged</div>
                  <div className="text-xs text-text-muted mt-1">Every mutation on this trip is recorded in the audit log (NFR-9).</div>
                  <Link href="/audit" className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline mt-2">
                    View audit trail <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
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
