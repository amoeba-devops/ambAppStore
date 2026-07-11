import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import {
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
  StackedBarChart,
} from '@car-v2/ui';
import { ExportDropdown } from '@/components/export-dropdown';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import {
  getReportKpis,
  getSpendByCategory,
  getSpendByWeek,
  getVehicleUtilization,
} from '@/server/queries/reports.queries';
import { PeriodPicker } from './_components/period-picker';

const DEFAULT_PERIOD_WEEKS = 12;

/* Color palette per category — khớp chartColors order. */
const CATEGORY_COLOR: Record<string, string> = {
  FUEL:       chartColors[0],
  REPAIR:     chartColors[1],
  MEAL:       chartColors[2],
  OIL:        chartColors[3],
  ACCIDENT:   chartColors[4],
  PARKING:    chartColors[5],
  TOLL:       chartColors[6],
  INSPECTION: chartColors[7],
};

function formatVndShort(amount: number): string {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)}B₫`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M₫`;
  if (amount >= 1_000) return `${Math.round(amount / 1_000)}K₫`;
  return `${amount}₫`;
}

function deltaLabel(value: number, suffix = '%'): string {
  if (value === 0) return `0${suffix}`;
  const sign = value > 0 ? '+' : '';
  return `${sign}${value}${suffix}`;
}

function deltaKind(value: number): 'up' | 'down' {
  return value >= 0 ? 'up' : 'down';
}

interface ReportsPageProps {
  searchParams: Promise<{ weeks?: string }>;
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const actor = await getCurrentUser();
  // RBAC: chỉ ADMIN/MANAGER xem báo cáo, driver redirect /today.
  if (actor.role === 'DRIVER') {
    redirect('/today');
  }

  const sp = await searchParams;
  const periodWeeks = Math.min(52, Math.max(1, Number(sp.weeks ?? DEFAULT_PERIOD_WEEKS)));

  const t       = await getTranslations('screens.reports');
  const tNav    = await getTranslations('nav');
  const tCo     = await getTranslations('company');
  const tR      = await getTranslations('reports');
  const tCat    = await getTranslations('reports.categories');
  const tA      = await getTranslations('actions');

  // Parallel fetch
  const [kpis, categorySpend, weeklySpend, utilization] = await Promise.all([
    getReportKpis(actor.entId, periodWeeks),
    getSpendByCategory(actor.entId, periodWeeks),
    getSpendByWeek(actor.entId, periodWeeks),
    getVehicleUtilization(actor.entId, periodWeeks),
  ]);

  const periodOptions = [
    { key: '4w',  weeks: 4,  label: tR('period4w') },
    { key: '8w',  weeks: 8,  label: tR('period8w') },
    { key: '12w', weeks: 12, label: tR('period12w') },
    { key: '3m',  weeks: 13, label: tR('period3m') },
    { key: '6m',  weeks: 26, label: tR('period6m') },
  ];

  const exportParams: Record<string, string> = periodWeeks !== DEFAULT_PERIOD_WEEKS
    ? { weeks: String(periodWeeks) }
    : {};

  const totalCategorySpend = categorySpend.reduce((s, c) => s + c.amountVnd, 0);
  const SPEND_MIX = categorySpend
    .filter((c) => c.amountVnd > 0)
    .map((c) => {
      const pct = totalCategorySpend > 0
        ? Math.round((c.amountVnd / totalCategorySpend) * 100)
        : 0;
      // Map exp_type → i18n label key (Fuel/Repair/Meal/Oil/Parking/Toll/Inspection)
      const labelKey =
        c.expType.charAt(0).toUpperCase() + c.expType.slice(1).toLowerCase();
      return {
        name: tCat(labelKey),
        key: c.expType,
        amount: formatVndShort(c.amountVnd),
        pct,
        color: CATEGORY_COLOR[c.expType] ?? chartColors[0],
        rawAmount: c.amountVnd,
      };
    })
    .sort((a, b) => b.rawAmount - a.rawAmount);

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        breadcrumbs={[{ label: tCo('tenant') }, { label: tNav('reports') }]}
        actions={
          <>
            <PeriodPicker
              options={periodOptions}
              currentWeeks={periodWeeks}
              labels={{ period: tR('period') }}
            />
            <ExportDropdown
              baseUrl="/api/v1/reports/export"
              queryParams={exportParams}
              labels={{
                export: tA('export'),
                excel: tA('exportExcel'),
                pdf: tA('exportPdf'),
                csv: tA('exportCsv'),
              }}
              variant="secondary"
            />
          </>
        }
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6 space-y-4">
        {/* Period KPIs — real data */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label={tR('kTotalTrips')}
            value={kpis.totalTrips.toLocaleString('vi-VN')}
            delta={deltaLabel(kpis.delta.tripsPct)}
            deltaKind={deltaKind(kpis.delta.tripsPct)}
          />
          <KpiCard
            label={tR('kTotalSpend')}
            value={formatVndShort(kpis.totalSpendVnd)}
            delta={deltaLabel(kpis.delta.spendPct)}
            deltaKind={deltaKind(kpis.delta.spendPct)}
          />
          <KpiCard
            label={tR('kAvgCost')}
            value={formatVndShort(kpis.avgCostVnd)}
            delta={deltaLabel(kpis.delta.avgCostPct)}
            deltaKind={deltaKind(-kpis.delta.avgCostPct)} // giảm cost = up (xanh)
          />
          <KpiCard
            label={tR('kUtil')}
            value={`${kpis.utilizationPct}%`}
            delta={deltaLabel(kpis.delta.utilizationPts, ' pts')}
            deltaKind={deltaKind(kpis.delta.utilizationPts)}
          />
        </div>

        {/* Spend breakdown — donut + weekly bar */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-3">
          <Card>
            <CardHeader>
              <CardHeaderText>
                <CardTitle>{tR('spendMixTitle')}</CardTitle>
                <CardDescription>
                  {tR('spendMixDesc', {
                    total: formatVndShort(totalCategorySpend),
                    count: SPEND_MIX.length,
                  })}
                </CardDescription>
              </CardHeaderText>
            </CardHeader>
            <CardContent>
              {SPEND_MIX.length === 0 ? (
                <div className="py-8 text-center text-sm text-text-muted">
                  {tR('emptyNoExpense', { weeks: periodWeeks })}
                </div>
              ) : (
                <div className="flex items-center gap-5">
                  <DonutChart
                    data={SPEND_MIX.map((s) => ({ name: s.name, value: s.pct, color: s.color }))}
                    size={180}
                    thickness={22}
                    centerValue={formatVndShort(totalCategorySpend).replace('₫', '')}
                    centerLabel={tR('donutCenter')}
                  />
                  <ul className="flex-1 space-y-1.5 text-sm">
                    {SPEND_MIX.map((s) => (
                      <li key={s.key} className="flex items-center gap-2.5">
                        <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                        <span className="flex-1 text-text font-medium">{s.name}</span>
                        <span className="text-text-muted tabular">{s.amount}</span>
                        <span className="w-9 text-right text-text-faint tabular text-xs">{s.pct}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardHeaderText>
                <CardTitle>{tR('weeklyTitle')}</CardTitle>
                <CardDescription>{tR('weeklyDesc')}</CardDescription>
              </CardHeaderText>
            </CardHeader>
            <CardContent>
              <StackedBarChart
                data={weeklySpend}
                xKey="week"
                series={[
                  { key: 'FUEL',   name: tCat('Fuel'),   color: chartColors[0] },
                  { key: 'REPAIR', name: tCat('Repair'), color: chartColors[1] },
                  { key: 'MEAL',   name: tCat('Meal'),   color: chartColors[2] },
                  { key: 'OIL',    name: tCat('Oil'),    color: chartColors[3] },
                ]}
                height={260}
                valueSuffix="M"
                valuePrecision={1}
              />
            </CardContent>
          </Card>
        </div>

        {/* Fleet utilisation — real per-vehicle, per-week */}
        <Card>
          <CardHeader>
            <CardHeaderText>
              <CardTitle>{tR('utilTitle')}</CardTitle>
              <CardDescription>{tR('utilDesc')}</CardDescription>
            </CardHeaderText>
          </CardHeader>
          <CardContent>
            {utilization.vehicles.length === 0 ? (
              <div className="py-8 text-center text-sm text-text-muted">
                {tR('emptyNoVehicle')}
              </div>
            ) : (
              <LineChart
                data={utilization.data}
                xKey="week"
                series={utilization.vehicles.map((v, i) => ({
                  key: v.plate,
                  name: v.plate,
                  color: chartColors[i % chartColors.length]!,
                }))}
                height={240}
                valueSuffix="%"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
