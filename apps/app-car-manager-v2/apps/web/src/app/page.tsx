import { getTranslations } from 'next-intl/server';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Car,
  Clock,
  Download,
  Fuel,
  IdCard,
  Plus,
  Receipt,
  Wrench,
} from 'lucide-react';
import {
  Avatar,
  Badge,
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
  Sparkline,
  StackedBarChart,
} from '@car-v2/ui';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';

// ─── Sample data ─────────────────────────────────────────────────────────────
// All numbers are placeholders until P1 wires server actions. Sourced from the
// original /design/project/tokens.jsx demo dataset for visual continuity.

const VEHICLES = [
  { plate: '51K-238.91', model: 'Hyundai Staria 11', color: 'Pearl White', km: 18420, driver: 'Nguyễn Văn Tú', state: 'running' as const,    detail: 'D1 HCMC → SGN T2 · 22 min left' },
  { plate: '30A-556.07', model: 'Kia Carnival SX',   color: 'Aurora Black', km: 42118, driver: 'Trần Quốc Hùng', state: 'ready' as const,    detail: 'Next: Long Hậu IZ · 15:30' },
  { plate: '51F-712.34', model: 'Toyota Camry 2.5Q', color: 'Silver',       km: 67830, driver: 'Lê Minh Đức',    state: 'maintenance' as const, detail: 'Periodic service · back tomorrow 10:00' },
];

const SPEND_MIX = [
  { name: 'Fuel',     amount: '6.2M₫', pct: 42, color: chartColors[0] },
  { name: 'Repair',   amount: '4.1M₫', pct: 28, color: chartColors[1] },
  { name: 'Meal',     amount: '2.1M₫', pct: 14, color: chartColors[2] },
  { name: 'Oil',      amount: '1.3M₫', pct:  9, color: chartColors[3] },
  { name: 'Accident', amount: '1.0M₫', pct:  7, color: chartColors[4] },
];

const ACTIONS = [
  { Icon: AlertTriangle, tone: 'danger'  as const, title: 'Approve repair — 51F-712.34', meta: 'Lê Minh Đức · 4.2M₫ · 35 min ago',   tag: 'High',  tagTone: 'danger'  as const },
  { Icon: Fuel,           tone: 'info'   as const, title: 'Approve fuel — 30A-556.07',   meta: 'Trần Quốc Hùng · 1.25M₫ · 2 hr ago', tag: 'Threshold', tagTone: 'warning' as const },
  { Icon: Wrench,        tone: 'success' as const, title: 'Oil change due — 30A-556.07', meta: '210 km past interval',                tag: 'Service', tagTone: 'info'    as const },
  { Icon: IdCard,        tone: 'danger'  as const, title: 'License expiry — Lê Minh Đức', meta: 'Expires May 22 · 10 days left',      tag: 'License', tagTone: 'danger'  as const },
  { Icon: Receipt,       tone: 'purple'  as const, title: 'Reassign driver — TR-1042',   meta: "Trần Quốc Hùng rejected · 'Family appt'", tag: 'Reassign', tagTone: 'purple'  as const },
];

const TOP_USERS = [
  { n: 'Park Joon-ho',   t: 'CEO',                   trips: 14, spend: '3.8M₫', pct: 100 },
  { n: 'Kim Min-seo',    t: 'Director, Operations',  trips: 11, spend: '2.6M₫', pct:  78 },
  { n: 'Choi Ji-woo',    t: 'Director, Sales',       trips:  8, spend: '1.9M₫', pct:  57 },
  { n: 'Nguyễn Thu Hà',  t: 'VP, Finance',           trips:  5, spend: '1.3M₫', pct:  36 },
  { n: 'Lee Hyun-jung',  t: 'Manager, IT',           trips:  3, spend: '0.7M₫', pct:  21 },
];

const STACKED = Array.from({ length: 8 }, (_, i) => ({
  week: `W${i + 1}`,
  Fuel:   1.2 + Math.sin(i / 1.4) * 0.6 + i * 0.18,
  Repair: 0.4 + Math.cos(i / 2.1) * 0.4 + i * 0.10,
  Meal:   0.3 + Math.sin(i / 0.9) * 0.2 + i * 0.05,
  Oil:    0.15 + (i % 3) * 0.18,
}));

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const t    = await getTranslations('screens.dashboardA');
  const tNav = await getTranslations('nav');
  const tCo  = await getTranslations('company');
  const tAct = await getTranslations('actions');

  return (
    <AppShell>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        breadcrumbs={[{ label: tCo('tenant') }, { label: tNav('dashboard') }]}
        actions={
          <>
            <Button variant="ghost" size="md" iconLeft={<Calendar />}>{t('dateRange')}</Button>
            <Button variant="secondary" size="md" iconLeft={<Download />}>{tAct('export')}</Button>
            <Button variant="accent" size="md" iconLeft={<Plus />}>{t('newTrip')}</Button>
          </>
        }
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6 space-y-4">
        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label={t('kTrips')}
            value="28"
            delta="+12%"
            deltaKind="up"
            trailing={<div className="w-24"><Sparkline data={[3, 5, 4, 6, 5, 7, 8, 4, 6, 9]} /></div>}
          />
          <KpiCard
            label={t('kSpend')}
            value="14.8M₫"
            delta="+4.2%"
            deltaKind="up"
            trailing={<div className="w-24"><Sparkline data={[2, 4, 3, 6, 5, 8, 7, 5, 9, 11]} color={chartColors[1]} /></div>}
          />
          <KpiCard
            label={t('kPending')}
            value="4"
            delta="2 in last 24h"
            deltaKind="down"
            trailing={<div className="w-24"><Sparkline data={[1, 2, 1, 3, 2, 2, 4, 3, 4, 4]} color={chartColors[2]} /></div>}
          />
          <KpiCard
            label={t('kUtil')}
            value="73%"
            delta="+8 pts"
            deltaKind="up"
            trailing={<div className="w-24"><Sparkline data={[40, 55, 52, 60, 68, 65, 72, 70, 73, 73]} color="hsl(var(--success))" /></div>}
          />
        </div>

        {/* Fleet status + Spend mix */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-3">
          <Card>
            <CardHeader>
              <CardHeaderText>
                <CardTitle>{t('fleetTitle')}</CardTitle>
                <CardDescription>{t('fleetSubtitle')}</CardDescription>
              </CardHeaderText>
              <Button variant="ghost" size="sm" iconRight={<ArrowRight />}>{t('viewAll')}</Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {VEHICLES.map((v) => <FleetCard key={v.plate} v={v} />)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardHeaderText>
                <CardTitle>{t('spendTitle')}</CardTitle>
                <CardDescription>{t('spendSubtitle')}</CardDescription>
              </CardHeaderText>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-5">
                <DonutChart
                  data={SPEND_MIX.map((s) => ({ name: s.name, value: s.pct, color: s.color }))}
                  size={160}
                  thickness={18}
                  centerValue="14.8M₫"
                  centerLabel={t('spendTitle')}
                />
                <ul className="flex-1 space-y-1.5 text-sm">
                  {SPEND_MIX.map((s) => (
                    <li key={s.name} className="flex items-center gap-2.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: s.color }} aria-hidden />
                      <span className="flex-1 text-text font-medium">{s.name}</span>
                      <span className="text-text-muted tabular">{s.amount}</span>
                      <span className="w-9 text-right text-text-faint tabular text-xs">{s.pct}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action queue + (Placeholder for schedule) */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-3">
          <Card>
            <CardHeader>
              <CardHeaderText>
                <CardTitle>{t('schedTitle')}</CardTitle>
                <CardDescription>{t('schedSubtitle')}</CardDescription>
              </CardHeaderText>
              <div className="inline-flex gap-1.5 rounded-md bg-surface-2 p-1">
                <button className="h-7 px-3 rounded text-xs text-text-muted hover:text-text">{t('day')}</button>
                <button className="h-7 px-3 rounded text-xs bg-surface text-text shadow-xs">{t('week')}</button>
                <button className="h-7 px-3 rounded text-xs text-text-muted hover:text-text">{t('month')}</button>
              </div>
            </CardHeader>
            <CardContent>
              <SchedulePlaceholder />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardHeaderText>
                <CardTitle>{t('queueTitle')}</CardTitle>
                <CardDescription>{t('queueSubtitle')}</CardDescription>
              </CardHeaderText>
            </CardHeader>
            <CardContent padded={false}>
              <ul className="divide-y divide-border">
                {ACTIONS.map((a, i) => (
                  <li key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-surface-2/60 transition-colors cursor-pointer">
                    <span className={`mt-0.5 h-7 w-7 rounded-md flex items-center justify-center shrink-0
                      ${a.tone === 'danger'  ? 'bg-danger-soft text-danger'   : ''}
                      ${a.tone === 'info'    ? 'bg-info-soft text-info'       : ''}
                      ${a.tone === 'success' ? 'bg-success-soft text-success' : ''}
                      ${a.tone === 'purple'  ? 'bg-purple-soft text-purple'   : ''}`}>
                      <a.Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-text leading-snug truncate">{a.title}</div>
                      <div className="text-xs text-text-muted mt-0.5 truncate">{a.meta}</div>
                    </div>
                    <Badge tone={a.tagTone} size="sm">{a.tag}</Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Stacked + Top users */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-3">
          <Card>
            <CardHeader>
              <CardHeaderText>
                <CardTitle>{t('chartTitle')}</CardTitle>
                <CardDescription>{t('chartSubtitle')}</CardDescription>
              </CardHeaderText>
              <div className="flex gap-3 text-xs text-text-muted">
                <Legend color={chartColors[0]} label="Fuel" />
                <Legend color={chartColors[1]} label="Repair" />
                <Legend color={chartColors[2]} label="Meal" />
                <Legend color={chartColors[3]} label="Oil" />
              </div>
            </CardHeader>
            <CardContent>
              <StackedBarChart
                data={STACKED}
                xKey="week"
                series={[
                  { key: 'Fuel',   name: 'Fuel',   color: chartColors[0] },
                  { key: 'Repair', name: 'Repair', color: chartColors[1] },
                  { key: 'Meal',   name: 'Meal',   color: chartColors[2] },
                  { key: 'Oil',    name: 'Oil',    color: chartColors[3] },
                ]}
                height={220}
                valueSuffix="M"
                valuePrecision={1}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardHeaderText>
                <CardTitle>{t('topTitle')}</CardTitle>
                <CardDescription>{t('topSubtitle')}</CardDescription>
              </CardHeaderText>
            </CardHeader>
            <CardContent padded={false}>
              <ul className="divide-y divide-border">
                {TOP_USERS.map((u) => (
                  <li key={u.n} className="flex items-center gap-3 px-5 py-2.5">
                    <Avatar name={u.n} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-text truncate">{u.n}</div>
                      <div className="text-xs text-text-faint truncate">{u.t}</div>
                    </div>
                    <div className="w-20 hidden sm:block">
                      <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                        <div className="h-full bg-accent" style={{ width: `${u.pct}%` }} />
                      </div>
                    </div>
                    <div className="w-9 text-right text-sm font-semibold text-text tabular">{u.trips}</div>
                    <div className="w-14 text-right text-xs text-text-muted tabular">{u.spend}</div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

// ─── Small subcomponents (page-local) ────────────────────────────────────────

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-medium">
      <span className="h-2 w-2 rounded-sm" style={{ background: color }} aria-hidden />
      {label}
    </span>
  );
}

function FleetCard({ v }: { v: (typeof VEHICLES)[number] }) {
  const tone = v.state === 'running' ? 'info' : v.state === 'ready' ? 'success' : 'warning';
  return (
    <div className="rounded-md border border-border bg-surface p-3.5 hover:border-border-strong transition-colors">
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 text-xs font-medium text-text-muted">
          <Car className="h-3.5 w-3.5" />
          <span className="font-mono text-[12px] text-text font-semibold tracking-tight">{v.plate}</span>
        </div>
        <Badge tone={tone} size="sm">
          {v.state === 'running' ? 'In progress' : v.state === 'ready' ? 'Available' : 'Maintenance'}
        </Badge>
      </div>
      <div className="mt-2 text-sm font-semibold text-text leading-tight">{v.model}</div>
      <div className="mt-0.5 text-xs text-text-muted">{v.color} · {v.km.toLocaleString()} km</div>
      <div className="mt-3 flex items-center gap-2 text-xs text-text-muted border-t border-border pt-2.5">
        <Clock className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{v.detail}</span>
      </div>
    </div>
  );
}

function SchedulePlaceholder() {
  const days = ['Mon 5', 'Tue 6', 'Wed 7', 'Thu 8', 'Fri 9', 'Sat 10', 'Sun 11'];
  const hours = ['08', '10', '12', '14', '16', '18'];
  return (
    <div className="overflow-hidden rounded border border-border bg-surface">
      <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-border bg-surface-2/50">
        <div className="px-2 py-2 text-[11px] font-semibold text-text-faint uppercase">Hr</div>
        {days.map((d) => (
          <div key={d} className="px-2 py-2 text-[11px] font-semibold text-text-muted text-center">{d}</div>
        ))}
      </div>
      {hours.map((h, hi) => (
        <div key={h} className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-border last:border-b-0 min-h-[42px]">
          <div className="px-2 py-2 text-[11px] font-mono text-text-faint border-r border-border">{h}:00</div>
          {days.map((d, di) => {
            // Sparsely seed sample chips for visual rhythm
            const has = (hi + di) % 3 === 0;
            const tone =
              (hi + di) % 5 === 0 ? 'bg-warning-soft text-warning border-warning/30' :
              (hi + di) % 4 === 0 ? 'bg-info-soft text-info border-info/30' :
                                    'bg-accent-soft text-accent border-accent/20';
            return (
              <div key={d} className="px-1.5 py-1 border-r border-border last:border-r-0">
                {has && (
                  <div className={`text-[11px] leading-tight rounded px-1.5 py-1 border ${tone} font-medium truncate`}>
                    Trip · {h}:30
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
