import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
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
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';

const RECENT_TRIPS = [
  { ref: 'TR-1042', when: 'Today',     route: 'D1 → SGN T2',     driver: 'Nguyễn Văn Tú', km: 22, status: 'IN_PROGRESS' },
  { ref: 'TR-1037', when: 'May 11',    route: 'SGN T1 → Hyatt',  driver: 'Trần Quốc Hùng', km: 18, status: 'COMPLETED' },
  { ref: 'TR-1029', when: 'May 8',     route: 'D2 → D7',         driver: 'Lê Minh Đức',    km: 12, status: 'COMPLETED' },
];

const DOCS = [
  { name: 'Insurance — VNI policy 2026', expiry: '2026-12-15', state: 'valid' },
  { name: 'Inspection certificate',      expiry: '2026-07-22', state: 'valid' },
  { name: 'Vehicle registration',         expiry: '2027-03-01', state: 'valid' },
];

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t    = await getTranslations('screens.vehicleDetail');
  const tA   = await getTranslations('actions');
  const tNav = await getTranslations('nav');
  const tCo  = await getTranslations('company');

  return (
    <AppShell>
      <PageHeader
        title="51K-238.91"
        subtitle="Hyundai Staria 11 · Pearl White · 2023"
        breadcrumbs={[
          { label: tCo('tenant') },
          { label: tNav('vehicles'), href: '/vehicles' },
          { label: id },
        ]}
        actions={
          <>
            <Button variant="ghost" size="md" asChild>
              <Link href="/vehicles"><ChevronLeft />{tA('back')}</Link>
            </Button>
            <Button variant="secondary" size="md" iconLeft={<Edit3 />}>{tA('edit')}</Button>
          </>
        }
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-5 space-y-5">
        {/* Hero */}
        <Card>
          <CardContent>
            <div className="flex items-start gap-5">
              <div className="h-20 w-20 rounded-md bg-accent-soft text-accent flex items-center justify-center shrink-0">
                <Car className="h-9 w-9" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-2xl font-bold text-text font-mono tracking-tight">51K-238.91</h2>
                  <Badge tone="info">In use</Badge>
                </div>
                <p className="mt-1 text-text-muted">Currently with <span className="font-medium text-text">Nguyễn Văn Tú</span> · D1 HCMC → SGN T2 (22 min remaining)</p>
                <div className="mt-4 grid grid-cols-4 gap-5">
                  <Stat icon={<Gauge />}  label="Odometer"    value="18,420 km" />
                  <Stat icon={<Fuel />}   label="Next oil at"  value="1,580 km" />
                  <Stat icon={<Wrench />} label="Last service" value="Apr 22, 2026" />
                  <Stat icon={<MapPin />} label="Home base"   value="HCMC HQ" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="trips">
          <TabsList>
            <TabsTrigger value="trips">Recent trips</TabsTrigger>
            <TabsTrigger value="docs">Documents</TabsTrigger>
            <TabsTrigger value="costs">Cost history</TabsTrigger>
            <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          </TabsList>

          <TabsContent value="trips">
            <Card>
              <CardHeader>
                <CardHeaderText>
                  <CardTitle>Recent trips · last 30 days</CardTitle>
                </CardHeaderText>
              </CardHeader>
              <CardContent padded={false}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ref</TableHead>
                      <TableHead>When</TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead>Driver</TableHead>
                      <TableHead className="text-right">Distance</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {RECENT_TRIPS.map((r) => (
                      <TableRow key={r.ref}>
                        <TableCell className="font-mono text-xs text-text-muted tabular">{r.ref}</TableCell>
                        <TableCell className="text-text-muted">{r.when}</TableCell>
                        <TableCell className="text-text">{r.route}</TableCell>
                        <TableCell>{r.driver}</TableCell>
                        <TableCell className="text-right tabular font-medium">{r.km} km</TableCell>
                        <TableCell>
                          <Badge tone={r.status === 'IN_PROGRESS' ? 'info' : 'neutral'} size="sm">
                            {r.status === 'IN_PROGRESS' ? 'In progress' : 'Completed'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="docs">
            <Card>
              <CardHeader>
                <CardHeaderText>
                  <CardTitle>Documents</CardTitle>
                </CardHeaderText>
                <Button variant="secondary" size="sm" iconLeft={<FileText />}>Upload</Button>
              </CardHeader>
              <CardContent padded={false}>
                <ul className="divide-y divide-border">
                  {DOCS.map((d) => (
                    <li key={d.name} className="flex items-center gap-3 px-5 py-3">
                      <FileText className="h-4 w-4 text-text-faint shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-text truncate">{d.name}</div>
                        <div className="text-xs text-text-faint">Expires {d.expiry}</div>
                      </div>
                      <Badge tone="success" size="sm">Valid</Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="costs">
            <Card>
              <CardContent>
                <p className="text-sm text-text-muted">Cost history will be available in <span className="font-medium text-text">P2</span>.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="maintenance">
            <Card>
              <CardContent>
                <p className="text-sm text-text-muted">Maintenance log will be available in <span className="font-medium text-text">P4</span>.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
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
