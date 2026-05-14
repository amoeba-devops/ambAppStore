import { getTranslations } from 'next-intl/server';
import { Calendar, Download, FileSpreadsheet, FileText } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeaderText,
  CardTitle,
  chartColors,
  DonutChart,
  KpiCard,
  LineChart,
  Sparkline,
  StackedBarChart,
} from '@car-v2/ui';
import { PageHeader } from '@/components/layout/page-header';

const SPEND_MIX = [
  { name: 'Fuel',       amount: '24.4M₫', pct: 38, color: chartColors[0] },
  { name: 'Repair',     amount: '17.2M₫', pct: 27, color: chartColors[1] },
  { name: 'Meal',       amount:  '8.6M₫', pct: 13, color: chartColors[2] },
  { name: 'Oil',        amount:  '5.1M₫', pct:  8, color: chartColors[3] },
  { name: 'Parking',    amount:  '3.8M₫', pct:  6, color: chartColors[5] },
  { name: 'Toll',       amount:  '3.2M₫', pct:  5, color: chartColors[6] },
  { name: 'Inspection', amount:  '1.9M₫', pct:  3, color: chartColors[7] },
];

const WEEKLY = Array.from({ length: 12 }, (_, i) => ({
  week: `W${i + 1}`,
  Fuel:   2.1 + Math.sin(i / 1.6) * 0.7 + i * 0.12,
  Repair: 1.3 + Math.cos(i / 1.4) * 0.6 + i * 0.08,
  Meal:   0.6 + Math.sin(i / 0.8) * 0.3,
  Oil:    0.3 + (i % 4) * 0.15,
}));

const UTIL = Array.from({ length: 12 }, (_, i) => ({
  week: `W${i + 1}`,
  '51K': 60 + Math.sin(i / 1.2) * 10 + i,
  '30A': 50 + Math.cos(i / 1.5) * 8 + i * 0.5,
  '51F': 40 + Math.sin(i / 2.0) * 12,
}));

export default async function ReportsPage() {
  const t    = await getTranslations('screens.reports');
  const tA   = await getTranslations('actions');
  const tNav = await getTranslations('nav');
  const tCo  = await getTranslations('company');

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        breadcrumbs={[{ label: tCo('tenant') }, { label: tNav('reports') }]}
        actions={
          <>
            <Button variant="ghost" size="md" iconLeft={<Calendar />}>Q2 2026 · Apr — Jun</Button>
            <Button variant="secondary" size="md" iconLeft={<FileSpreadsheet />}>Excel</Button>
            <Button variant="accent" size="md" iconLeft={<FileText />}>PDF</Button>
          </>
        }
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6 space-y-4">
        {/* Period KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Total trips · 90d"    value="284"   delta="+18%" deltaKind="up"
            trailing={<div className="w-24"><Sparkline data={[18, 22, 19, 25, 21, 28, 24, 30, 32, 28, 30, 38]} /></div>} />
          <KpiCard label="Total spend · 90d"    value="63.2M₫" delta="+6.4%" deltaKind="up"
            trailing={<div className="w-24"><Sparkline data={[4, 5, 4, 6, 5, 8, 6, 7, 9, 7, 8, 11]} color={chartColors[1]} /></div>} />
          <KpiCard label="Avg cost / trip"      value="222K₫"  delta="-3.1%" deltaKind="down"
            trailing={<div className="w-24"><Sparkline data={[260, 250, 245, 240, 235, 230, 228, 225, 222, 220, 222, 222]} color={chartColors[2]} /></div>} />
          <KpiCard label="Fleet utilisation"    value="68%"    delta="+5 pts" deltaKind="up"
            trailing={<div className="w-24"><Sparkline data={[55, 58, 60, 62, 60, 64, 66, 68, 70, 68, 70, 68]} color="hsl(var(--success))" /></div>} />
        </div>

        {/* Spend breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-3">
          <Card>
            <CardHeader>
              <CardHeaderText>
                <CardTitle>Spend mix · last 90 days</CardTitle>
                <CardDescription>Total 63.2M₫ across 8 categories</CardDescription>
              </CardHeaderText>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-5">
                <DonutChart
                  data={SPEND_MIX.map((s) => ({ name: s.name, value: s.pct, color: s.color }))}
                  size={180}
                  thickness={22}
                  centerValue="63.2M"
                  centerLabel="VND · 90d"
                />
                <ul className="flex-1 space-y-1.5 text-sm">
                  {SPEND_MIX.map((s) => (
                    <li key={s.name} className="flex items-center gap-2.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                      <span className="flex-1 text-text font-medium">{s.name}</span>
                      <span className="text-text-muted tabular">{s.amount}</span>
                      <span className="w-9 text-right text-text-faint tabular text-xs">{s.pct}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardHeaderText>
                <CardTitle>Weekly spend by category</CardTitle>
                <CardDescription>Stacked, last 12 weeks</CardDescription>
              </CardHeaderText>
            </CardHeader>
            <CardContent>
              <StackedBarChart
                data={WEEKLY}
                xKey="week"
                series={[
                  { key: 'Fuel',   name: 'Fuel',   color: chartColors[0] },
                  { key: 'Repair', name: 'Repair', color: chartColors[1] },
                  { key: 'Meal',   name: 'Meal',   color: chartColors[2] },
                  { key: 'Oil',    name: 'Oil',    color: chartColors[3] },
                ]}
                height={260}
                valueSuffix="M"
                valuePrecision={1}
              />
            </CardContent>
          </Card>
        </div>

        {/* Fleet utilisation */}
        <Card>
          <CardHeader>
            <CardHeaderText>
              <CardTitle>Fleet utilisation by vehicle</CardTitle>
              <CardDescription>% of working hours in use · last 12 weeks</CardDescription>
            </CardHeaderText>
          </CardHeader>
          <CardContent>
            <LineChart
              data={UTIL}
              xKey="week"
              series={[
                { key: '51K', name: '51K-238.91',   color: chartColors[0] },
                { key: '30A', name: '30A-556.07',   color: chartColors[1] },
                { key: '51F', name: '51F-712.34',   color: chartColors[3] },
              ]}
              height={240}
              valueSuffix="%"
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
